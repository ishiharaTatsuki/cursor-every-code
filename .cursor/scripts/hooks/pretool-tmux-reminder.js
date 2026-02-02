#!/usr/bin/env node
"use strict";

/**
 * PreToolUse: Suggest running long-lived commands inside tmux.
 *
 * Non-blocking (exit 0).
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

  // Matches common install/test/build commands or other potentially long-running commands.
  const longRe = /^(?:npm\s+(?:install|test)|pnpm\s+(?:install|test)|yarn(?:\s+(?:install|test))?|bun\s+(?:install|test)|cargo\s+build|make(?:\s|$)|docker(?:\s|$)|pytest(?:\s|$)|vitest(?:\s|$)|playwright(?:\s|$))/i;

  if (longRe.test(cmd) && !process.env.TMUX) {
    console.error("[Hook] Tip: consider running this in tmux for session persistence.");
    console.error('[Hook] tmux new -s dev   (or)   tmux new-session -d -s dev "' + cmd.replace(/"/g, "\\\"") + '"');
    console.error("[Hook] tmux attach -t dev");
  }

  process.exit(0);
}

main();
