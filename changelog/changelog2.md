了解です。`everything-claude-code` の hooks 形式（Claude Code 互換）を **Cursor が third‑party hooks として実行できる**前提で、**Python（ruff / mypy / pytest）用の hooks を追加**します。([Cursor](https://cursor.com/docs/agent/third-party-hooks?utm_source=chatgpt.com "Third Party Hooks | Cursor Docs"))

ポイントは2つです：

* **PostToolUse（Edit/Writeの直後）**で「変更された `.py` を記録 + ruff format/check」
* **Stop（応答の最後）**で「今回変更されたPythonファイルがある時だけ mypy / pytest を走らせる」
  ※Stop hook の入力自体には「どのファイルが変わったか」が入らないので、**PostToolUse 側で状態ファイルに記録**する必要があります。([Claude Code](https://code.cursor.com/docs/en/hooks "Hooks reference - Claude Code Docs"))

以下、そのまま貼れる **完成パッチ**です。

---

# 1) 追加するスクリプト（2ファイル）

## A. `.cursor/scripts/hooks/python-after-edit.js`

* 役割：`.py/.pyi` が Edit/Write されたら
  * `.cursor/.hook_state/py_changed_files.json` に追記（重複排除）
  * `ruff format` → `ruff check`（任意で `--fix`）を該当ファイルに実行

```js
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

function main() {
  const input = readStdinJson();

  // PostToolUse input typically has tool_input.file_path (Claude Code docs) :contentReference[oaicite:2]{index=2}
  const filePath =
    input?.tool_input?.file_path ||
    input?.tool_response?.filePath ||
    input?.tool_response?.file_path ||
    input?.tool_output?.filePath ||
    input?.tool_output?.file_path ||
    "";

  if (!filePath || !/\.(py|pyi)$/.test(filePath)) process.exit(0);

  const projectDir = process.env.cursor_PROJECT_DIR || process.cwd();
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

  // ruff format
  tryRunTool(projectDir, runner, "ruff", "ruff", ["format", absPath], 30_000);

  // ruff check (+ optional --fix)
  const fix = (process.env.ECC_RUFF_FIX || "").trim() === "1";
  const checkArgs = fix ? ["check", "--fix", absPath] : ["check", absPath];
  tryRunTool(projectDir, runner, "ruff", "ruff", checkArgs, 30_000);

  process.exit(0);
}

main();
```

---

## B. `.cursor/scripts/hooks/python-stop-checks.js`

* 役割：Stop（応答の最後）で
  * `py_changed_files.json` が空なら何もしない
  * あるなら **ruff / mypy / pytest** を実行（存在・設定がある場合だけ）
  * 実行後に state をクリア

```js
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
```

---

# 2) `.cursor/settings.json` に hooks を追加

あなたの `.cursor/settings.json` は `everything-claude-code` 由来で、`hooks` の各イベントに matcher/hook を並べる構造になっています。([Claude Code](https://code.cursor.com/docs/en/hooks "Hooks reference - Claude Code Docs"))
そこへ、以下を追記します。

## A. `hooks.PostToolUse` 配列に追加（末尾でOK）

```json
{
  "matcher": "(tool == \"Edit\" || tool == \"Write\") && tool_input.file_path matches \"\\\\.(py|pyi)$\"",
  "hooks": [
    {
      "type": "command",
      "command": "node \"./.cursor/scripts/hooks/python-after-edit.js\"",
      "timeout": 45
    }
  ],
  "description": "Python: track changed files + ruff format/check after edits"
}
```

## B. `hooks.Stop` 配列に追加（末尾でOK）

Stop 入力には file_path が無いので、先に記録した state を読んで動かします。([Claude Code](https://code.cursor.com/docs/en/hooks "Hooks reference - Claude Code Docs"))

```json
{
  "matcher": "*",
  "hooks": [
    {
      "type": "command",
      "command": "node \"./.cursor/scripts/hooks/python-stop-checks.js\"",
      "timeout": 240
    }
  ],
  "description": "Python: if .py changed this turn, run ruff/mypy/pytest then clear state"
}
```

> 既存の Stop hook（例：console.log検知）と **並列実行**になります。Claude Code hooks は同一イベントで複数 hook がマッチすると並列で走ります。([Claude Code](https://code.cursor.com/docs/en/hooks "Hooks reference - Claude Code Docs"))

---

# 3) `.gitignore`（強く推奨）

state をコミットしないように：

```gitignore
.cursor/.hook_state/
```

---

# 4) 実装後のフォルダ構成（追加分込み）

```text
<project-root>/
├── .cursor/
│   └── settings.json
│
├── .cursor/
│   ├── scripts/
│   │   └── hooks/
│   │       ├── (vendor由来の各種js) ...
│   │       ├── python-after-edit.js          # ← 追加
│   │       └── python-stop-checks.js         # ← 追加
│   │
│   ├── .hook_state/                          # ← 実行時に自動生成（gitignore推奨）
│   │   └── py_changed_files.json
│   │
│   ├── commands/ ...
│   ├── agents/ ...
│   ├── rules/ ...
│   ├── skills/ ...
│   └── mcp.json
│
└── .gitignore
```

---

# 5) 使い方・調整（任意）

* **自動修正を入れたい** （ruff check の `--fix` を有効化）
  環境変数：`ECC_RUFF_FIX=1`
* **pytest が重すぎる**
  `ECC_SKIP_PYTEST=1`（または `ECC_PYTEST_ARGS` で `-k` や `-m` を指定）
* **mypy 未導入/うるさい**
  `ECC_SKIP_MYPY=1`

> これらは hooks の仕組み自体（設定ファイルとstdin JSON）に沿った作りです。([Claude Code](https://code.cursor.com/docs/en/hooks "Hooks reference - Claude Code Docs"))

---

必要なら、あなたの実プロジェクト（uv/poetry/venv、srcレイアウト、pytest構成）に合わせて、`pytest` を「変更ファイルから関連テストだけ推定して部分実行」に寄せる版（速い）も出せます。
