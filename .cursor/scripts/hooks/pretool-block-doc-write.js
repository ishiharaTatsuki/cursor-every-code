#!/usr/bin/env node
"use strict";

/**
 * PreToolUse (Write): Block creation of random .md/.txt files.
 *
 * Behavior:
 * - Allowed (always): README.md, CLAUDE.md, AGENTS.md, CONTRIBUTING.md
 * - Allowed: overwriting an existing file (Write sometimes overwrites)
 * - Blocked: creating a new .md/.txt file outside the allowlist
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
if (!filePath || !/\.(md|txt)$/i.test(filePath)) process.exit(0);

const base = path.basename(filePath);
if (/^(README|CLAUDE|AGENTS|CONTRIBUTING)\.md$/i.test(base)) process.exit(0);

const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const abs = path.isAbsolute(filePath) ? filePath : path.resolve(projectDir, filePath);

// If the file already exists, treat as overwrite/update and allow.
if (fileExists(abs)) process.exit(0);

console.error("[Hook] BLOCKED: Unnecessary documentation file creation");
console.error(`[Hook] File: ${filePath}`);
console.error("[Hook] Use README.md (or an existing docs file) for documentation instead");

process.exit(2);
