#!/usr/bin/env node
"use strict";

/**
 * PostToolUse (Bash): Example async hook for build analysis.
 *
 * Intentionally minimal: only prints a message when build commands are detected.
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

const BUILD_RE = /(\bnpm\s+run\s+build\b|\bpnpm\s+build\b|\byarn\s+build\b)/;
if (!cmd || !BUILD_RE.test(cmd)) process.exit(0);

console.error("[Hook] Build completed - async analysis running in background");
process.exit(0);
