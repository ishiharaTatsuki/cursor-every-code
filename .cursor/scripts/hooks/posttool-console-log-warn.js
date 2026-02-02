#!/usr/bin/env node
"use strict";

/**
 * PostToolUse: Warn if an edited JS/TS file contains console.log.
 *
 * Non-blocking.
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

function getFilePath(input) {
  return (
    input?.tool_input?.file_path ||
    input?.tool_input?.filePath ||
    input?.input?.file_path ||
    input?.input?.filePath ||
    ""
  );
}

function main() {
  const input = readStdinJson();
  const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();

  const fpRaw = String(getFilePath(input) || "");
  if (!fpRaw) process.exit(0);
  if (!/\.(ts|tsx|js|jsx)$/.test(fpRaw)) process.exit(0);

  const absPath = path.isAbsolute(fpRaw) ? fpRaw : path.join(projectDir, fpRaw);
  if (!fs.existsSync(absPath)) process.exit(0);

  const content = fs.readFileSync(absPath, "utf8");
  if (!content.includes("console.log")) process.exit(0);

  // Provide small excerpt with line numbers.
  const lines = content.split(/\r?\n/);
  const hits = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("console.log")) {
      hits.push(`${i + 1}: ${lines[i].trim()}`);
      if (hits.length >= 5) break;
    }
  }

  const rel = path.relative(projectDir, absPath).replace(/\\/g, "/");
  console.error(`[Hook] WARNING: console.log detected in ${rel}`);
  console.error(hits.join("\n"));
  console.error("[Hook] Remove debug logs before committing.");

  process.exit(0);
}

main();
