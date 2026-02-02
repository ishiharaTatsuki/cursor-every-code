#!/usr/bin/env node
"use strict";

/**
 * PostToolUse: Auto-format JS/TS files with Prettier.
 *
 * Safety:
 * - Prefer local node_modules/.bin/prettier.
 * - Fallback to `npx --no-install prettier` to avoid supply-chain installs.
 * - Hard timeout.
 */

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

function readStdinJson() {
  try {
    const raw = fs.readFileSync(0, "utf8");
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function getFilePath(input) {
  return (
    input?.tool_input?.file_path ||
    input?.tool_input?.filePath ||
    input?.input?.file_path ||
    input?.input?.filePath ||
    ""
  );
}

function fileExists(p) {
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
}

function findUp(startDir, stopDir, rel) {
  let dir = startDir;
  const stop = path.resolve(stopDir);
  while (true) {
    const cand = path.join(dir, rel);
    if (fileExists(cand)) return cand;
    const parent = path.dirname(dir);
    if (dir === parent) return null;
    if (path.resolve(dir) === stop) return null;
    dir = parent;
  }
}

function runPrettier(bin, args, cwd, timeoutMs) {
  try {
    execFileSync(bin, args, {
      cwd,
      stdio: ["ignore", "ignore", "pipe"],
      timeout: timeoutMs,
    });
    return true;
  } catch (err) {
    const msg = (err?.stderr || "").toString().trim();
    if (msg) console.error(msg.split("\n").slice(0, 6).join("\n"));
    return false;
  }
}

function main() {
  const input = readStdinJson();
  const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();

  const fpRaw = String(getFilePath(input) || "");
  if (!fpRaw) process.exit(0);
  if (!/\.(ts|tsx|js|jsx)$/.test(fpRaw)) process.exit(0);

  const absPath = path.isAbsolute(fpRaw) ? fpRaw : path.join(projectDir, fpRaw);
  if (!fileExists(absPath)) process.exit(0);

  const fileDir = path.dirname(absPath);

  // Prefer local prettier from nearest node_modules.
  const prettierRel = process.platform === "win32" ? "node_modules/.bin/prettier.cmd" : "node_modules/.bin/prettier";
  const localPrettier = findUp(fileDir, projectDir, prettierRel);

  const timeoutMs = 30_000;

  if (localPrettier) {
    // Run from project root so Prettier can resolve configs/ignores consistently.
    runPrettier(localPrettier, ["--write", absPath], projectDir, timeoutMs);
    process.exit(0);
  }

  // Fallback: npx --no-install prettier (avoids installing packages)
  runPrettier("npx", ["--no-install", "prettier", "--write", absPath], projectDir, timeoutMs);

  process.exit(0);
}

main();
