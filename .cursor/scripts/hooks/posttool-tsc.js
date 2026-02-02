#!/usr/bin/env node
"use strict";

/**
 * PostToolUse (Edit): TypeScript check after editing .ts/.tsx files.
 *
 * Best-effort: finds nearest tsconfig.json and runs `npx tsc --noEmit --pretty false`.
 */

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

function fileExists(p) {
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
}

const input = readStdinJson();
const filePath = (input && input.tool_input && input.tool_input.file_path) ? String(input.tool_input.file_path) : "";

if (!filePath || !/\.(ts|tsx)$/i.test(filePath)) process.exit(0);

const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const abs = path.isAbsolute(filePath) ? filePath : path.resolve(projectDir, filePath);
if (!fileExists(abs)) process.exit(0);

// Find nearest tsconfig.json
let dir = path.dirname(abs);
while (dir && dir !== path.dirname(dir)) {
  if (fileExists(path.join(dir, "tsconfig.json"))) break;
  dir = path.dirname(dir);
}

if (!dir || !fileExists(path.join(dir, "tsconfig.json"))) process.exit(0);

const relFromTscDir = path.relative(dir, abs);
const base = path.basename(abs);

const r = spawnSync("npx", ["tsc", "--noEmit", "--pretty", "false"], {
  cwd: dir,
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"],
});

const combined = `${r.stdout || ""}\n${r.stderr || ""}`.trim();
if (!combined) process.exit(0);

// Print only lines likely relevant to the edited file.
const lines = combined
  .split("\n")
  .filter((l) => l.includes(relFromTscDir) || l.includes(base))
  .slice(0, 10);

if (lines.length) {
  console.error(lines.join("\n"));
}

process.exit(0);
