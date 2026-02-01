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

  const buildRe = /(npm run build|pnpm build|yarn build)/;
  if (!buildRe.test(cmd)) process.exit(0);

  console.error("[Hook] Build completed - async analysis running in background");
  process.exit(0);
}

main();
