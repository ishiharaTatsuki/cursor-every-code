#!/usr/bin/env node
"use strict";

const fs = require("fs");

function readStdinJson() {
  try {
    const raw = fs.readFileSync(0, "utf8");
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function main() {
  // Only remind when NOT already in tmux.
  if (process.env.TMUX) process.exit(0);

  const input = readStdinJson();
  const cmd = String(input?.tool_input?.command || "");

  // Long-ish / log-important commands (keep regex close to previous config)
  const longCmdRe = /(npm (install|test)|pnpm (install|test)|yarn( install| test)?|bun (install|test)|cargo build|\bmake\b|\bdocker\b|\bpytest\b|\bvitest\b|\bplaywright\b)/;
  if (!longCmdRe.test(cmd)) process.exit(0);

  console.error("[Hook] Consider running in tmux for session persistence");
  console.error("[Hook] tmux new -s dev  |  tmux attach -t dev");
  process.exit(0);
}

main();
