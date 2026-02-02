#!/usr/bin/env node
"use strict";

/**
 * PostToolUse: After `gh pr create`, surface the PR URL and a helpful review command.
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

function getToolOutputText(input) {
  // Claude Code / Cursor variants
  return (
    input?.tool_output?.output ||
    input?.tool_output?.stdout ||
    input?.tool_output?.text ||
    input?.output ||
    ""
  );
}

function main() {
  const input = readStdinJson();
  const cmd = String(getCommand(input) || "");
  if (!/\bgh\s+pr\s+create\b/i.test(cmd)) process.exit(0);

  const out = String(getToolOutputText(input) || "");
  const m = out.match(/https:\/\/github\.com\/[^/]+\/[^/]+\/pull\/\d+/);
  if (!m) process.exit(0);

  const url = m[0];
  const repo = url.replace(/https:\/\/github\.com\/([^/]+\/[^/]+)\/pull\/\d+/, "$1");
  const pr = url.replace(/.*\/pull\/(\d+)/, "$1");

  console.error("[Hook] PR created: " + url);
  console.error("[Hook] To review: gh pr review " + pr + " --repo " + repo);
  process.exit(0);
}

main();
