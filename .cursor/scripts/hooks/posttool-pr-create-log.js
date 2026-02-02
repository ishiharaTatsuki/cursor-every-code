#!/usr/bin/env node
"use strict";

/**
 * PostToolUse (Bash): After `gh pr create`, print the PR URL and a review command.
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
if (!cmd || !/\bgh\s+pr\s+create\b/.test(cmd)) process.exit(0);

const out = (input && input.tool_output && typeof input.tool_output.output === "string")
  ? input.tool_output.output
  : (input && input.tool_output && typeof input.tool_output.stdout === "string")
    ? input.tool_output.stdout
    : "";

const m = out.match(/https:\/\/github\.com\/[^/]+\/[^/]+\/pull\/\d+/);
if (!m) process.exit(0);

const url = m[0];
const repo = url.replace(/https:\/\/github\.com\/([^/]+\/[^/]+)\/pull\/\d+/, "$1");
const pr = url.replace(/.*\/pull\/(\d+)/, "$1");

console.error(`[Hook] PR created: ${url}`);
console.error(`[Hook] To review: gh pr review ${pr} --repo ${repo}`);
process.exit(0);
