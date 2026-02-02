#!/usr/bin/env node
"use strict";

/**
 * PostToolUse: Run a quick TypeScript check after editing TS files.
 *
 * Safety:
 * - Prefer local node_modules/.bin/tsc
 * - Fallback to `npx --no-install tsc`
 * - Hard timeout
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

function findNearestTsconfig(startDir, stopDir) {
  let dir = startDir;
  const stop = path.resolve(stopDir);

  while (true) {
    const cand = path.join(dir, "tsconfig.json");
    if (fileExists(cand)) return { dir, tsconfig: cand };

    const parent = path.dirname(dir);
    if (dir === parent) return null;
    if (path.resolve(dir) === stop) return null;
    dir = parent;
  }
}

function findLocalTsc(startDir, stopDir) {
  let dir = startDir;
  const stop = path.resolve(stopDir);
  const rel = process.platform === "win32" ? "node_modules/.bin/tsc.cmd" : "node_modules/.bin/tsc";

  while (true) {
    const cand = path.join(dir, rel);
    if (fileExists(cand)) return cand;

    const parent = path.dirname(dir);
    if (dir === parent) return null;
    if (path.resolve(dir) === stop) return null;
    dir = parent;
  }
}

function run(bin, args, cwd, timeoutMs) {
  try {
    execFileSync(bin, args, {
      cwd,
      stdio: ["ignore", "ignore", "pipe"],
      timeout: timeoutMs,
    });
    return { ok: true, stderr: "" };
  } catch (err) {
    const stderr = (err?.stderr || "").toString();
    return { ok: false, stderr };
  }
}

function main() {
  const input = readStdinJson();
  const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();

  const fpRaw = String(getFilePath(input) || "");
  if (!fpRaw) process.exit(0);
  if (!/\.(ts|tsx)$/.test(fpRaw)) process.exit(0);

  const absPath = path.isAbsolute(fpRaw) ? fpRaw : path.join(projectDir, fpRaw);
  if (!fileExists(absPath)) process.exit(0);

  const fileDir = path.dirname(absPath);
  const tsconfigHit = findNearestTsconfig(fileDir, projectDir);
  if (!tsconfigHit) process.exit(0);

  const localTsc = findLocalTsc(tsconfigHit.dir, projectDir);
  const timeoutMs = 60_000;
  const args = ["--noEmit", "--pretty", "false", "--project", tsconfigHit.tsconfig];

  const res = localTsc
    ? run(localTsc, args, projectDir, timeoutMs)
    : run("npx", ["--no-install", "tsc", ...args], projectDir, timeoutMs);

  if (!res.ok && res.stderr) {
    // Print a short, actionable excerpt.
    const lines = res.stderr.split("\n").filter(Boolean);
    console.error("[Hook] TypeScript check found errors (excerpt):");
    console.error(lines.slice(0, 12).join("\n"));
  }

  process.exit(0);
}

main();
