#!/usr/bin/env node
"use strict";

/**
 * PreToolUse: Block creation of ad-hoc documentation files.
 *
 * Goal:
 * - Keep documentation consolidated and intentional.
 * - Prevent the assistant from spraying new *.md/*.txt files into the repo.
 *
 * Behavior:
 * - Blocks Write operations creating .md/.txt files outside an allowlist.
 * - Exit code 2 blocks the tool execution (Claude Code convention).
 *
 * Config:
 * - ECC_STRICT_DOC_BLOCK=1
 *     If set, blocks ALL new .md/.txt files except a small root allowlist.
 *     Useful for ultra-strict repos.
 */

const fs = require("fs");
const path = require("path");

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

function normalizeRel(projectDir, p) {
  if (!p) return "";
  try {
    if (path.isAbsolute(p)) return path.relative(projectDir, p);
  } catch {
    // ignore
  }
  return p;
}

function main() {
  const input = readStdinJson();

  // Emergency escape hatch (project-local). Use sparingly.
  if ((process.env.ECC_ALLOW_DOC_WRITES || '').trim() === '1') {
    process.exit(0);
  }

  const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const filePathRaw = String(getFilePath(input) || "");
  if (!filePathRaw) process.exit(0);

  const filePath = normalizeRel(projectDir, filePathRaw).replace(/\\/g, "/");
  const ext = path.extname(filePath).toLowerCase();
  if (ext !== ".md" && ext !== ".txt") process.exit(0);

  const base = path.basename(filePath);

  // Root allowlist (case-sensitive by convention)
  const rootAllow = new Set(["README.md", "CLAUDE.md", "AGENTS.md", "CONTRIBUTING.md"]);

  // Project-internal allowlist (these directories are part of the template system)
  const allowDirs = [
    ".cursor/", // slash commands, rules, skills, etc.
    ".github/",
    "changelog/",
  ];

  // Optional: allow controlled docs/codemaps generation unless strict mode
  const strict = (process.env.ECC_STRICT_DOC_BLOCK || "").trim() === "1";
  if (!strict) {
    allowDirs.push("docs/", "codemaps/", ".reports/");
  }

  const isRootDoc = rootAllow.has(base) && !filePath.includes("/");
  const inAllowedDir = allowDirs.some((d) => filePath.startsWith(d));

  if (isRootDoc || inAllowedDir) {
    process.exit(0);
  }

  console.error("[Hook] BLOCKED: Unnecessary documentation file creation");
  console.error("[Hook] File: " + filePath);
  console.error("[Hook] Prefer: README.md / docs/ / codemaps/ (or place under .cursor/skills/learned for patterns)");
  console.error("[Hook] Allowed locations: docs/ , codemaps/ , .reports/ , .cursor/ ...");
  console.error("[Hook] Temporary override: set ECC_ALLOW_DOC_WRITES=1");
  console.error("[Hook] (To make docs/codemaps strict too, set ECC_STRICT_DOC_BLOCK=1)");
  process.exit(2);
}

main();
