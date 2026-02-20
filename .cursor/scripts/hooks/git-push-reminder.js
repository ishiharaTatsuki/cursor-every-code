#!/usr/bin/env node

/**
 * PreToolUse reminder for `git push`.
 * - Warn on any push
 * - Warn strongly (and optionally block) on force pushes
 */

const { readStdinJson, log } = require('../lib/utils');
const { getToolName, getCommand } = require('../lib/hook-input');

function norm(s) {
  return String(s || '').trim().replace(/\s+/g, ' ');
}

function isGitPush(command) {
  return /^git\s+push\b/i.test(norm(command));
}

function isForcePush(command) {
  const c = norm(command);
  return /\s(--force|-f)(\s|$)/i.test(c) || /--force-with-lease/i.test(c);
}

async function main() {
  if (process.env.ECC_DISABLE_GIT_PUSH_REMINDER === '1') return;

  const input = await readStdinJson().catch(() => ({}));
  const tool = getToolName(input);
  if (tool !== 'Bash' && tool !== 'Shell') return;

  const cmd = getCommand(input);
  if (!isGitPush(cmd)) return;

  const c = norm(cmd);

  if (isForcePush(c)) {
    const msg =
      `[git push] FORCE push detected. Double-check remote/branch and prefer --force-with-lease.\n` +
      `Command: ${c}`;

    if (process.env.ECC_BLOCK_FORCE_PUSH === '1') {
      log(msg + '\nBlocking because ECC_BLOCK_FORCE_PUSH=1.');
      process.exit(2);
    } else {
      log(msg);
      return;
    }
  }

  log(
    `[git push] Reminder: run tests/lint, confirm the target branch, and review staged changes before pushing.\n` +
    `Command: ${c}`
  );
}

main().catch(() => process.exit(0));
