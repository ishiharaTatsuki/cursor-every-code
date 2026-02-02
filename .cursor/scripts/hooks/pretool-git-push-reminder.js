#!/usr/bin/env node
"use strict";

/**
 * PreToolUse (Bash): Reminder before git push.
 * Non-blocking.
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

const input = readStdinJson();
const cmd = (input && input.tool_input && input.tool_input.command) ? String(input.tool_input.command) : "";

if (!cmd || !/\bgit\s+push\b/.test(cmd)) process.exit(0);

console.error("[Hook] Review changes before push...");
console.error("[Hook] Continuing with push (remove this hook to add interactive review)");
process.exit(0);
