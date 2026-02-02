#!/usr/bin/env node
"use strict";

/**
 * PreToolUse: Reminder before `git push`.
 *
 * Non-blocking by default.
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

  if (/\bgit\s+push\b/i.test(cmd)) {
    console.error("[Hook] Reminder: review changes before pushing.");
    console.error("[Hook] Suggested: git status && git diff --stat && git diff");
  }

  process.exit(0);
}

main();
