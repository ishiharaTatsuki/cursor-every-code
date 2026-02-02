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
  const input = readStdinJson();
  const cmd = String(input?.tool_input?.command || "");
  if (!/gh\s+pr\s+create/.test(cmd)) process.exit(0);

  const out =
    String(
      input?.tool_output?.output ||
        input?.tool_output?.stdout ||
        input?.tool_response?.output ||
        input?.tool_response?.stdout ||
        ""
    );

  const m = out.match(/https:\/\/github\.com\/[^/]+\/[^/]+\/pull\/\d+/);
  if (!m) process.exit(0);

  const url = m[0];
  console.error("[Hook] PR created: " + url);

  const repoMatch = url.match(/https:\/\/github\.com\/([^/]+\/[^/]+)\/pull\/(\d+)/);
  if (!repoMatch) process.exit(0);

  const repo = repoMatch[1];
  const pr = repoMatch[2];
  console.error("[Hook] To review: gh pr review " + pr + " --repo " + repo);
  process.exit(0);
}

main();
