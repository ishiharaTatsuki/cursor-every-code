#!/usr/bin/env node
"use strict";

/**
 * PreToolUse: Block starting dev servers outside tmux
 *
 * Rationale:
 * - Long-running dev servers are easy to lose (terminal disconnects, UI resets)
 * - tmux provides session persistence and log access
 *
 * Blocking behavior:
 * - If the tool is Bash and the command looks like a JS dev server, and TMUX is NOT set,
 *   exit code 2 to block the tool.
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

  // Match common dev server invocations.
  // Keep this conservative to avoid false positives.
  const devRe = /^(?:npm\s+run\s+dev|pnpm(?:\s+run)?\s+dev|yarn\s+dev|bun\s+run\s+dev)(?:\s|$)/i;
  const isDev = devRe.test(cmd);
  const inTmux = !!process.env.TMUX;

  if (isDev && !inTmux) {
    console.error("[Hook] BLOCKED: Dev server must run inside tmux for log access/persistence.");
    console.error('[Hook] Use: tmux new-session -d -s dev "' + cmd.replace(/"/g, "\\\"") + '"');
    console.error("[Hook] Then: tmux attach -t dev");
    process.exit(2);
  }

  process.exit(0);
}

main();
