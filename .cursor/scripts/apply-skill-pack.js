#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

function usage() {
  console.log(`
Apply Skill Pack

Usage:
  node .cursor/scripts/apply-skill-pack.js --pack <python-node-minimal|full> [--dry-run]
  node .cursor/scripts/apply-skill-pack.js --list

Notes:
  - Moves directories between:
      .cursor/skills
      .cursor/skills-optional
  - No symlinks, so it works cross-platform.
`);
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function listSkillDirs(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function moveDir(src, dst) {
  fs.renameSync(src, dst);
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.length === 0) {
    usage();
    process.exit(0);
  }

  const dryRun = args.includes("--dry-run");
  const list = args.includes("--list");
  const packIdx = args.indexOf("--pack");
  const packName = packIdx >= 0 ? args[packIdx + 1] : "";

  const cursorDir = path.resolve(__dirname, "..");
  const packsDir = path.join(cursorDir, "skill-packs");
  const skillsDir = path.join(cursorDir, "skills");
  const optDir = path.join(cursorDir, "skills-optional");

  ensureDir(skillsDir);
  ensureDir(optDir);

  if (list) {
    const files = fs
      .readdirSync(packsDir, { withFileTypes: true })
      .filter((d) => d.isFile() && d.name.endsWith(".json"))
      .map((d) => d.name.replace(/\.json$/, ""))
      .sort();

    console.log("Available packs:");
    for (const f of files) console.log("  - " + f);
    process.exit(0);
  }

  if (!packName) {
    console.error("Error: --pack is required unless --list is used");
    usage();
    process.exit(1);
  }

  const packPath = path.join(packsDir, `${packName}.json`);
  if (!fs.existsSync(packPath)) {
    console.error(`Error: pack not found: ${packName}`);
    console.error(`Expected file: ${packPath}`);
    process.exit(1);
  }

  const pack = readJson(packPath);
  const want = new Set(pack.skills || []);

  const enabled = new Set(listSkillDirs(skillsDir));
  const optional = new Set(listSkillDirs(optDir));
  const all = new Set([...enabled, ...optional]);

  for (const s of want) {
    if (!all.has(s)) {
      console.error(`Error: pack references missing skill: ${s}`);
      process.exit(1);
    }
  }

  const toEnable = [...want].filter((s) => !enabled.has(s));
  const toDisable = [...enabled].filter((s) => !want.has(s));

  function log(action, from, to) {
    console.log(`${action}: ${from} -> ${to}`);
  }

  for (const s of toEnable) {
    const src = path.join(optDir, s);
    const dst = path.join(skillsDir, s);
    if (!fs.existsSync(src)) continue;
    log("ENABLE", src, dst);
    if (!dryRun) moveDir(src, dst);
  }

  for (const s of toDisable) {
    const src = path.join(skillsDir, s);
    const dst = path.join(optDir, s);
    if (!fs.existsSync(src)) continue;
    log("DISABLE", src, dst);
    if (!dryRun) moveDir(src, dst);
  }

  console.log(dryRun ? "\nDry-run complete." : "\nDone.");
}

main();
