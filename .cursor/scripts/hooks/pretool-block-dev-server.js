#!/usr/bin/env node
"use strict";

/**
 * PreToolUse (Bash): Block dev server commands outside tmux.
 *
 * This is designed to be used with a Claude Code compatible hooks runner where
 * matcher only filters by tool name (e.g. "Bash").
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

// Only apply to common dev server invocations.
const DEV_RE = /(\bnpm\s+run\s+dev\b|\bpnpm\s+(run\s+)?dev\b|\byarn\s+dev\b|\bbun\s+run\s+dev\b)/;

if (!cmd || !DEV_RE.test(cmd)) {
  process.exit(0);
}

if (process.env.TMUX) {
  process.exit(0);
}

console.error("[Hook] BLOCKED: Dev server must run in tmux for log access");
console.error(`[Hook] Command: ${cmd}`);
console.error('[Hook] Example: tmux new-session -d -s dev "npm run dev"');
console.error('[Hook] Then: tmux attach -t dev');

// Claude Code compatible: exit code 2 blocks the tool execution.
process.exit(2);
