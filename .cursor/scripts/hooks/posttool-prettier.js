#!/usr/bin/env node
"use strict";

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

function main() {
  const input = readStdinJson();
  const p = String(input?.tool_input?.file_path || "");
  if (!p || !/\.(ts|tsx|js|jsx)$/.test(p)) process.exit(0);

  const projectDir = process.env.cursor_PROJECT_DIR || process.cwd();
  const abs = path.isAbsolute(p) ? p : path.join(projectDir, p);
  if (!fileExists(abs)) process.exit(0);

  try {
    execFileSync("npx", ["prettier", "--write", abs], {
      cwd: projectDir,
      stdio: ["ignore", "ignore", "ignore"],
    });
  } catch {
    // Ignore failures; formatting is best-effort.
  }

  process.exit(0);
}

main();
