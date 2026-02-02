#!/usr/bin/env node
"use strict";

/**
 * PreToolUse (Bash): Friendly reminder to use tmux for long-running commands.
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

if (process.env.TMUX) process.exit(0);

const input = readStdinJson();
const cmd = (input && input.tool_input && input.tool_input.command) ? String(input.tool_input.command) : "";

const LONG_RE = /(\bnpm\s+(install|test)\b|\bpnpm\s+(install|test)\b|\byarn\s+(install|test)?\b|\bbun\s+(install|test)\b|\bcargo\s+build\b|\bmake\b|\bdocker\b|\bpytest\b|\bvitest\b|\bplaywright\b)/;

if (!cmd || !LONG_RE.test(cmd)) process.exit(0);

console.error("[Hook] Consider running this in tmux for session persistence");
console.error("[Hook] Example: tmux new -s dev  |  tmux attach -t dev");
process.exit(0);
