#!/usr/bin/env node

/**
 * PreToolUse reminder to run potentially long-running commands inside tmux/screen.
 *
 * Default behavior: WARN only (never blocks).
 * Throttled to avoid noisy repeats.
 */

const path = require('path');
const fs = require('fs');

const { readStdinJson, log, ensureDir, getProjectDir } = require('../lib/utils');
const { getToolName, getCommand } = require('../lib/hook-input');

function norm(s) {
  return String(s || '').trim().replace(/\s+/g, ' ');
}

function shouldSuggestTmux(command) {
  const c = norm(command);

  // Common "long-ish" commands
  const patterns = [
    /^(npm|pnpm|yarn)\s+(install|ci)\b/i,
    /^(npm|pnpm|yarn)\s+run\s+(build|test|lint)\b/i,
    /^(pip|pip3)\s+install\b/i,
    /^poetry\s+(install|update)\b/i,
    /^uv\s+(sync|pip\s+install)\b/i,
    /^(pytest|mypy|ruff)\b/i,
    /^python\s+-m\s+pytest\b/i,
    /^cargo\s+(build|test)\b/i,
    /^go\s+(build|test)\b/i,
    /^make\s+\w+/i
  ];

  return patterns.some(r => r.test(c));
}

function readState(filePath) {
  try {
    if (!fs.existsSync(filePath)) return {};
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return {};
  }
}

function writeState(filePath, state) {
  try {
    ensureDir(path.dirname(filePath));
    fs.writeFileSync(filePath, JSON.stringify(state, null, 2) + '\n', 'utf8');
  } catch {
    // ignore
  }
}

async function main() {
  if (process.env.ECC_DISABLE_TMUX_REMINDER === '1') {
    return;
  }

  const input = await readStdinJson().catch(() => ({}));
  const tool = getToolName(input);
  if (tool !== 'Bash' && tool !== 'Shell') return;

  // If user is already inside tmux/screen, do nothing.
  if (process.env.TMUX || process.env.STY) return;

  const cmd = getCommand(input);
  if (!shouldSuggestTmux(cmd)) return;

  const projectDir = getProjectDir();
  const stateFile = path.join(projectDir, '.cursor', '.hook_state', 'tmux-reminder.json');

  const now = Date.now();
  const state = readState(stateFile);

  // Throttle: once per 15 minutes
  const last = state.lastShownAt || 0;
  if (now - last < 15 * 60 * 1000) return;

  log(
    `[tmux] Long-running command detected. Consider running it inside tmux/screen to avoid losing it on disconnect.\n` +
    `  Example: tmux new-session -d -s work '${norm(cmd).replace(/'/g, "'\\''")}'`
  );

  state.lastShownAt = now;
  state.lastCommand = norm(cmd);
  writeState(stateFile, state);
}

main().catch(() => process.exit(0));
