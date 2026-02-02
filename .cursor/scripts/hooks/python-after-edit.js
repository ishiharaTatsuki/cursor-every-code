#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

function readStdinJson() {
    try {
        const raw = fs.readFileSync(0, "utf8");
        return raw ? JSON.parse(raw) : {};
    } catch {
        return {};
    }
}

function ensureDir(p) {
    fs.mkdirSync(p, { recursive: true });
}

function loadJsonArray(p) {
    try {
        const raw = fs.readFileSync(p, "utf8");
        const v = JSON.parse(raw);
        return Array.isArray(v) ? v : [];
    } catch {
        return [];
    }
}

function saveJsonArray(p, arr) {
    fs.writeFileSync(p, JSON.stringify(arr, null, 2) + "\n", "utf8");
}

function fileExists(p) {
    try {
        fs.accessSync(p);
        return true;
    } catch {
        return false;
    }
}

function hasCmd(cmd) {
    const r = spawnSync(cmd, ["--version"], { stdio: "ignore" });
    return r.status === 0;
}

function detectRunner(projectDir) {
    // optional override: ECC_PY_RUNNER="uv run" or "poetry run" etc.
    const override = (process.env.ECC_PY_RUNNER || "").trim();
    if (override) return override.split(/\s+/);

    const pyproject = path.join(projectDir, "pyproject.toml");
    const hasPyproject = fileExists(pyproject);
    const pyprojectText = hasPyproject ? fs.readFileSync(pyproject, "utf8") : "";

    if (hasCmd("uv") && hasPyproject) return ["uv", "run"];
    if (
        hasCmd("poetry") &&
        (fileExists(path.join(projectDir, "poetry.lock")) || /\[tool\.poetry\]/.test(pyprojectText))
    )
        return ["poetry", "run"];
    if (
        hasCmd("pdm") &&
        (fileExists(path.join(projectDir, "pdm.lock")) || /\[tool\.pdm\]/.test(pyprojectText))
    )
        return ["pdm", "run"];
    if (hasCmd("pipenv") && fileExists(path.join(projectDir, "Pipfile"))) return ["pipenv", "run"];

    return [];
}

function run(cmd, args, opts = {}) {
    const r = spawnSync(cmd, args, {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        ...opts,
    });

    const out = (r.stdout || "").trim();
    const err = (r.stderr || "").trim();

    // show output only if meaningful
    if (out) process.stderr.write(out + "\n");
    if (err) process.stderr.write(err + "\n");

    return r.status === 0;
}

function tryRunTool(projectDir, runnerPrefix, tool, toolModule, args, timeoutMs) {
    // 1) runnerPrefix + tool
    if (runnerPrefix.length) {
        if (run(runnerPrefix[0], [...runnerPrefix.slice(1), tool, ...args], { cwd: projectDir, timeout: timeoutMs })) {
            return true;
        }
    }

    // 2) .venv python -m module
    const venvPy =
        process.platform === "win32"
            ? path.join(projectDir, ".venv", "Scripts", "python.exe")
            : path.join(projectDir, ".venv", "bin", "python");
    if (fileExists(venvPy)) {
        if (run(venvPy, ["-m", toolModule, ...args], { cwd: projectDir, timeout: timeoutMs })) return true;
    }

    // 3) python -m module
    if (run("python", ["-m", toolModule, ...args], { cwd: projectDir, timeout: timeoutMs })) return true;

    // 4) tool directly
    return run(tool, args, { cwd: projectDir, timeout: timeoutMs });
}

function probeTool(projectDir, runnerPrefix, tool, toolModule) {
    // Probe without producing output (avoid noisy errors when tools aren't installed).

    // 1) runnerPrefix + tool
    if (runnerPrefix.length) {
        const r = spawnSync(runnerPrefix[0], [...runnerPrefix.slice(1), tool, "--version"], {
            cwd: projectDir,
            stdio: "ignore",
        });
        if (r.status === 0) return true;
    }

    // 2) .venv python -m module
    const venvPy =
        process.platform === "win32"
            ? path.join(projectDir, ".venv", "Scripts", "python.exe")
            : path.join(projectDir, ".venv", "bin", "python");
    if (fileExists(venvPy)) {
        const r = spawnSync(venvPy, ["-m", toolModule, "--version"], { cwd: projectDir, stdio: "ignore" });
        if (r.status === 0) return true;
    }

    // 3) python -m module
    {
        const r = spawnSync("python", ["-m", toolModule, "--version"], { cwd: projectDir, stdio: "ignore" });
        if (r.status === 0) return true;
    }

    // 4) tool directly
    {
        const r = spawnSync(tool, ["--version"], { cwd: projectDir, stdio: "ignore" });
        if (r.status === 0) return true;
    }

    return false;
}

function main() {
    const input = readStdinJson();

    // PostToolUse input typically has tool_input.file_path (Claude Code hooks)
    const filePath =
        input?.tool_input?.file_path ||
        input?.tool_input?.filePath ||
        input?.file_path ||
        input?.filePath ||
        input?.path ||
        input?.tool_response?.filePath ||
        input?.tool_response?.file_path ||
        input?.tool_output?.filePath ||
        input?.tool_output?.file_path ||
        "";

    if (!filePath || !/\.(py|pyi)$/.test(filePath)) process.exit(0);

    const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
    const stateDir = path.join(projectDir, ".cursor", ".hook_state");
    const stateFile = path.join(stateDir, "py_changed_files.json");
    ensureDir(stateDir);

    const rel = path.isAbsolute(filePath) ? path.relative(projectDir, filePath) : filePath;
    const cur = loadJsonArray(stateFile);
    const set = new Set(cur);
    set.add(rel);
    saveJsonArray(stateFile, Array.from(set).sort());

    // run ruff (fast feedback). default: no autofix (set ECC_RUFF_FIX=1 to enable)
    const runner = detectRunner(projectDir);
    const absPath = path.isAbsolute(filePath) ? filePath : path.join(projectDir, filePath);

    const skipRuff = (process.env.ECC_SKIP_RUFF || "").trim() === "1";
    if (skipRuff) process.exit(0);

    // If ruff is not installed/available in this environment, skip silently.
    if (!probeTool(projectDir, runner, "ruff", "ruff")) process.exit(0);

    // ruff format
    tryRunTool(projectDir, runner, "ruff", "ruff", ["format", absPath], 30_000);

    // ruff check (+ optional --fix)
    const fix = (process.env.ECC_RUFF_FIX || "").trim() === "1";
    const checkArgs = fix ? ["check", "--fix", absPath] : ["check", absPath];
    tryRunTool(projectDir, runner, "ruff", "ruff", checkArgs, 30_000);

    process.exit(0);
}

main();
