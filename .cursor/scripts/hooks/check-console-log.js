#!/usr/bin/env node

/**
 * Stop Hook: Warn on console.log/debugger in modified JS/TS files.
 *
 * Notes:
 * - Stop hooks run when the main agent finishes a response (not session end).
 * - This hook is WARN-only by default (never blocks).
 * - Keep it lightweight; fail-open on errors.
 */
const { getProjectDir } = require('../lib/utils');
try { process.chdir(getProjectDir()); } catch (_) { }

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function run(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch {
    return '';
  }
}

function inGitRepo() {
  return Boolean(run('git rev-parse --git-dir'));
}

function hasHead() {
  return Boolean(run('git rev-parse --verify HEAD'));
}

function uniq(arr) {
  return Array.from(new Set(arr.filter(Boolean)));
}

function getChangedFiles() {
  if (!inGitRepo()) return [];

  const diffBase = hasHead() ? 'HEAD' : '';
  const unstaged = run(`git diff --name-only ${diffBase}`.trim()).split('\n');
  const staged = run('git diff --name-only --cached').split('\n');
  const untracked = run('git ls-files --others --exclude-standard').split('\n');

  return uniq([...unstaged, ...staged, ...untracked]);
}

function isJsTs(file) {
  return /\.(ts|tsx|js|jsx)$/.test(file);
}

function readFileSafe(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}

function main() {
  if (process.env.ECC_DISABLE_CONSOLE_LOG_CHECK === '1') return;

  const files = getChangedFiles().filter(f => isJsTs(f) && fs.existsSync(f));
  if (files.length === 0) return;

  // Avoid scanning too many files every Stop hook.
  const limit = Number(process.env.ECC_CONSOLE_LOG_CHECK_LIMIT || '25');
  const toScan = files.slice(0, Math.max(0, limit));

  let found = 0;

  for (const file of toScan) {
    const content = readFileSafe(file);
    if (!content) continue;

    const hasConsole = /\bconsole\.log\s*\(/.test(content);
    const hasDebugger = /\bdebugger\s*;/.test(content);

    if (hasConsole || hasDebugger) {
      found += 1;
      console.error(`[Hook] WARNING: ${hasConsole ? 'console.log' : ''}${hasConsole && hasDebugger ? ' & ' : ''}${hasDebugger ? 'debugger' : ''} found in ${file}`);
    }
  }

  if (found > 0) {
    console.error('[Hook] Reminder: remove debug statements before committing.');
  }
}

try {
  main();
} catch {
  // fail-open
}
