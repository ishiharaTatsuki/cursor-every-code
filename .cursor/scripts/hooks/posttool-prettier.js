#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { getPackageManager } = require("../lib/package-manager");

function readStdinJson() {
  try {
    const raw = fs.readFileSync(0, "utf8");
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function fileExists(p) {
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
}

function resolveLocalBin(projectDir, name) {
  const base = path.join(projectDir, "node_modules", ".bin");
  const unix = path.join(base, name);
  const win = path.join(base, `${name}.cmd`);
  if (fileExists(unix)) return unix;
  if (fileExists(win)) return win;
  return "";
}

function main() {
  const input = readStdinJson();
  const p = String(input?.tool_input?.file_path || "");
  if (!p || !/\.(ts|tsx|js|jsx)$/.test(p)) process.exit(0);

  const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const abs = path.isAbsolute(p) ? p : path.join(projectDir, p);
  if (!fileExists(abs)) process.exit(0);

  try {
    // Prefer local binary to avoid network downloads.
    const local = resolveLocalBin(projectDir, "prettier");
    if (local) {
      execFileSync(local, ["--write", abs], {
        cwd: projectDir,
        stdio: ["ignore", "ignore", "ignore"],
        timeout: 30000,
      });
      process.exit(0);
    }

    // Fallback: use the detected package manager (best-effort).
    const pm = getPackageManager({ projectDir }).name;
    if (pm === "pnpm") {
      execFileSync("pnpm", ["exec", "prettier", "--write", abs], {
        cwd: projectDir,
        stdio: ["ignore", "ignore", "ignore"],
        timeout: 30000,
      });
      process.exit(0);
    }

    if (pm === "yarn") {
      execFileSync("yarn", ["prettier", "--write", abs], {
        cwd: projectDir,
        stdio: ["ignore", "ignore", "ignore"],
        timeout: 30000,
      });
      process.exit(0);
    }

    // npm default: avoid auto-install by using --no-install.
    execFileSync("npx", ["--no-install", "prettier", "--write", abs], {
      cwd: projectDir,
      stdio: ["ignore", "ignore", "ignore"],
      timeout: 30000,
    });
  } catch {
    // Ignore failures; formatting is best-effort.
  }

  process.exit(0);
}

main();
