#!/usr/bin/env node
"use strict";

/**
 * PostToolUse (Edit): Warn about console.log statements after edits.
 */

const fs = require("fs");
const path = require("path");

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

let content = "";
try {
  content = fs.readFileSync(abs, "utf8");
} catch {
  process.exit(0);
}

if (!content.includes("console.log")) process.exit(0);

const matches = [];
content.split("\n").forEach((line, idx) => {
  if (/console\.log/.test(line)) matches.push(`${idx + 1}: ${line.trim()}`);
});

if (matches.length) {
  console.error(`[Hook] WARNING: console.log found in ${filePath}`);
  matches.slice(0, 5).forEach((m) => console.error(m));
  console.error("[Hook] Remove console.log before committing");
}

process.exit(0);
