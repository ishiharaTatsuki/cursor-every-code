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

function findUp(dir, filename) {
  let cur = dir;
  while (true) {
    const candidate = path.join(cur, filename);
    if (fileExists(candidate)) return candidate;
    const parent = path.dirname(cur);
    if (parent === cur) return "";
    cur = parent;
  }
}

function main() {
  const input = readStdinJson();
  const p = String(input?.tool_input?.file_path || "");
  if (!p || !/\.(ts|tsx)$/.test(p)) process.exit(0);

  const projectDir = process.env.cursor_PROJECT_DIR || process.cwd();
  const abs = path.isAbsolute(p) ? p : path.join(projectDir, p);
  if (!fileExists(abs)) process.exit(0);

  const startDir = path.dirname(abs);
  const tsconfig = findUp(startDir, "tsconfig.json");
  if (!tsconfig) process.exit(0);

  const cwd = path.dirname(tsconfig);

  let stdout = "";
  let stderr = "";
  try {
    stdout = execFileSync("npx", ["tsc", "--noEmit", "--pretty", "false"], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (e) {
    stdout = String(e.stdout || "");
    stderr = String(e.stderr || "");
  }

  const combined = (stdout + "\n" + stderr).trim();
  if (!combined) process.exit(0);

  // Try to surface relevant lines.
  const rel = path.relative(cwd, abs).replace(/\\/g, "/");
  const base = path.basename(abs);

  const lines = combined
    .split("\n")
    .filter((l) => l.includes(rel) || l.includes(base) || l.includes(abs))
    .slice(0, 10);

  if (lines.length) {
    console.error(lines.join("\n"));
  }

  process.exit(0);
}

main();
