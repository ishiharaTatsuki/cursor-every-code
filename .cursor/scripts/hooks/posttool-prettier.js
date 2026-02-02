#!/usr/bin/env node
"use strict";

/**
 * PostToolUse (Edit): Auto-format JS/TS files with Prettier.
 *
 * Mirrors prior behavior (best-effort, swallow errors).
 */

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

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

if (!filePath || !/\.(ts|tsx|js|jsx)$/i.test(filePath)) process.exit(0);

const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const abs = path.isAbsolute(filePath) ? filePath : path.resolve(projectDir, filePath);
if (!fileExists(abs)) process.exit(0);

try {
  execFileSync("npx", ["prettier", "--write", abs], {
    cwd: projectDir,
    stdio: ["ignore", "ignore", "ignore"],
  });
} catch {
  // best-effort
}

process.exit(0);
