#!/usr/bin/env node
"use strict";

/**
 * PostToolUse: Lightweight message after build commands.
 *
 * NOTE:
 * This hook intentionally does NOT run heavy background analysis.
 * Keep it fast and predictable.
 */

const fs = require("fs");

function readStdinJson() {
  try {
    const raw = fs.readFileSync(0, "utf8");
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function getCommand(input) {
  return (
    input?.tool_input?.command ||
    input?.input?.command ||
    input?.tool?.command ||
    ""
  );
}

function main() {
  const input = readStdinJson();
  const cmd = String(getCommand(input) || "").trim();
  if (!cmd) process.exit(0);

  const buildRe = /^(?:npm\s+run\s+build|pnpm(?:\s+run)?\s+build|yarn\s+build|bun\s+run\s+build)(?:\s|$)/i;
  if (buildRe.test(cmd)) {
    console.error("[Hook] Build finished. If you want deeper checks, run: /verify (or your CI suite).");
  }

  process.exit(0);
}

main();
