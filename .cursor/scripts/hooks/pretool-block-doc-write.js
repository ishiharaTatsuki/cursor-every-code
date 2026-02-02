#!/usr/bin/env node
"use strict";

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

function main() {
  const input = readStdinJson();
  const filePath = String(input?.tool_input?.file_path || "");

  if (!filePath || !/\.(md|txt)$/i.test(filePath)) process.exit(0);

  // Allow the canonical docs files even when creating anew
  const base = path.basename(filePath);
  if (/^(README|CLAUDE|AGENTS|CONTRIBUTING)\.md$/i.test(base)) process.exit(0);

  // Allow overwriting an existing file (some tools use Write even for updates)
  const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const abs = path.isAbsolute(filePath) ? filePath : path.join(projectDir, filePath);
  if (fileExists(abs)) process.exit(0);

  console.error("[Hook] BLOCKED: Unnecessary documentation file creation");
  console.error("[Hook] File: " + filePath);
  console.error("[Hook] Use README.md for documentation instead");

  // Claude Code: exit 2 blocks the tool call.
  process.exit(2);
}

main();
