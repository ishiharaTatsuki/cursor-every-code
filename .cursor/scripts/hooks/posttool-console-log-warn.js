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
  const p = String(input?.tool_input?.file_path || "");
  if (!p || !/\.(ts|tsx|js|jsx)$/.test(p)) process.exit(0);

  const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const abs = path.isAbsolute(p) ? p : path.join(projectDir, p);
  if (!fileExists(abs)) process.exit(0);

  let content = "";
  try {
    content = fs.readFileSync(abs, "utf8");
  } catch {
    process.exit(0);
  }

  const lines = content.split("\n");
  const matches = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes("console.log")) {
      matches.push(`${i + 1}: ${line.trim()}`);
    }
  }

  if (matches.length) {
    console.error("[Hook] WARNING: console.log found in " + p);
    matches.slice(0, 5).forEach((m) => console.error(m));
    console.error("[Hook] Remove console.log before committing");
  }

  process.exit(0);
}

main();
