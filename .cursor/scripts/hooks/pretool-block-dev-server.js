#!/usr/bin/env node
"use strict";

const fs = require("fs");
const { getPackageManager } = require("../lib/package-manager");

function readStdinJson() {
  try {
    const raw = fs.readFileSync(0, "utf8");
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function main() {
  const input = readStdinJson();
  const cmd = String(input?.tool_input?.command || "");

  // Match common dev-server commands
  const devServerRe = /(npm run dev|pnpm( run)? dev|yarn dev|bun run dev)/;
  if (!devServerRe.test(cmd)) process.exit(0);

  // Allow when already inside tmux
  if (process.env.TMUX) process.exit(0);

  // Best-effort: suggest the correct dev command for the repo
  const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const pm = getPackageManager({ projectDir });
  const devCmd = pm?.config?.devCmd || "npm run dev";

  console.error("[Hook] BLOCKED: Dev server must run in tmux for log access");
  console.error(`[Hook] Use: tmux new-session -d -s dev \"${devCmd}\"`);
  console.error("[Hook] Then: tmux attach -t dev");

  // Claude Code: exit 2 blocks the tool call.
  process.exit(2);
}

main();
