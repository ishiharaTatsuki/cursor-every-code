#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

function ensureDir(p) {
    fs.mkdirSync(p, { recursive: true });
}

function fileExists(p) {
    try {
        fs.accessSync(p);
        return true;
    } catch {
        return false;
    }
}

function readJsonArray(p) {
    try {
        const raw = fs.readFileSync(p, "utf8");
        const v = JSON.parse(raw);
        return Array.isArray(v) ? v : [];
    } catch {
        return [];
    }
}

function writeJsonArray(p, arr) {
    fs.writeFileSync(p, JSON.stringify(arr, null, 2) + "\n", "utf8");
}

function hasCmd(cmd) {
    const r = spawnSync(cmd, ["--version"], { stdio: "ignore" });
    return r.status === 0;
}

function detectRunner(projectDir) {
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

    if (out) process.stderr.write(out + "\n");
    if (err) process.stderr.write(err + "\n");

    return r.status === 0;
}

function tryRunTool(projectDir, runnerPrefix, tool, toolModule, args, timeoutMs) {
    if (runnerPrefix.length) {
        if (run(runnerPrefix[0], [...runnerPrefix.slice(1), tool, ...args], { cwd: projectDir, timeout: timeoutMs })) {
            return true;
        }
    }

    const venvPy =
        process.platform === "win32"
            ? path.join(projectDir, ".venv", "Scripts", "python.exe")
            : path.join(projectDir, ".venv", "bin", "python");
    if (fileExists(venvPy)) {
        if (run(venvPy, ["-m", toolModule, ...args], { cwd: projectDir, timeout: timeoutMs })) return true;
    }

    if (run("python", ["-m", toolModule, ...args], { cwd: projectDir, timeout: timeoutMs })) return true;
    return run(tool, args, { cwd: projectDir, timeout: timeoutMs });
}

function hasMypyConfig(projectDir) {
    if (fileExists(path.join(projectDir, "mypy.ini"))) return true;
    if (fileExists(path.join(projectDir, ".mypy.ini"))) return true;

    const setupCfg = path.join(projectDir, "setup.cfg");
    if (fileExists(setupCfg) && /\[\s*mypy\s*\]/.test(fs.readFileSync(setupCfg, "utf8"))) return true;

    const pyproject = path.join(projectDir, "pyproject.toml");
    if (fileExists(pyproject) && /\[tool\.mypy\]/.test(fs.readFileSync(pyproject, "utf8"))) return true;

    return false;
}

function hasPytestConfig(projectDir) {
    if (fileExists(path.join(projectDir, "pytest.ini"))) return true;

    const setupCfg = path.join(projectDir, "setup.cfg");
    if (fileExists(setupCfg) && /\[\s*tool:pytest\s*\]/.test(fs.readFileSync(setupCfg, "utf8"))) return true;

    const pyproject = path.join(projectDir, "pyproject.toml");
    if (fileExists(pyproject) && /\[tool\.pytest\.ini_options\]/.test(fs.readFileSync(pyproject, "utf8"))) return true;

    if (fileExists(path.join(projectDir, "tests")) || fileExists(path.join(projectDir, "test"))) return true;

    return false;
}

function main() {
    const projectDir = process.env.cursor_PROJECT_DIR || process.cwd();
    const stateDir = path.join(projectDir, ".cursor", ".hook_state");
    const stateFile = path.join(stateDir, "py_changed_files.json");
    ensureDir(stateDir);

    const changedRel = readJsonArray(stateFile).filter((p) => typeof p === "string" && p.length);
    if (changedRel.length === 0) process.exit(0);

    const runner = detectRunner(projectDir);
    const changedAbs = changedRel.map((p) => (path.isAbsolute(p) ? p : path.join(projectDir, p)));

    // 1) ruff (project-wideは重い時もあるので、まず changed files に限定)
    if ((process.env.ECC_SKIP_RUFF || "").trim() !== "1") {
        tryRunTool(projectDir, runner, "ruff", "ruff", ["check", ...changedAbs], 60_000);
    }

    // 2) mypy (設定がある時だけ)
    const skipMypy = (process.env.ECC_SKIP_MYPY || "").trim() === "1";
    if (!skipMypy && hasMypyConfig(projectDir)) {
        const args = changedAbs.length <= 25 ? changedAbs : ["."];
        tryRunTool(projectDir, runner, "mypy", "mypy", args, 120_000);
    }

    // 3) pytest (設定がある時だけ)
    const skipPytest = (process.env.ECC_SKIP_PYTEST || "").trim() === "1";
    if (!skipPytest && hasPytestConfig(projectDir)) {
        const extra = (process.env.ECC_PYTEST_ARGS || "-q --maxfail=1").trim().split(/\s+/).filter(Boolean);
        tryRunTool(projectDir, runner, "pytest", "pytest", extra, 180_000);
    }

    // clear state
    writeJsonArray(stateFile, []);
    process.exit(0);
}

main();
