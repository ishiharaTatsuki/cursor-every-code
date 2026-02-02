#!/usr/bin/env node

/**
 * PreToolUse guard for Bash commands.
 *
 * Goal:
 * - Block obviously destructive / high-risk commands by default
 * - Allow opt-in overrides via environment variables for power users
 *
 * This is intentionally conservative: it only blocks "high confidence" dangerous patterns.
 */

const { readStdinJson, log } = require('../lib/utils');
const { getToolName, getCommand } = require('../lib/hook-input');

function norm(s) {
  return String(s || '').trim().replace(/\s+/g, ' ');
}

function hasFlag(command, flag) {
  return new RegExp(`(^|\\s)${flag}(\\s|$)`).test(command);
}

function mainReason(command) {
  const c = norm(command);

  if (!c) return null;

  // Allow disabling the guard entirely (use sparingly).
  if (process.env.ECC_DISABLE_BASH_GUARD === '1') return null;

  // Block curl|wget piping into a shell unless explicitly allowed
  const curlPipe = /(\bcurl\b|\bwget\b)[^\n]*\|\s*(bash|sh)(\s|$)/i;
  if (curlPipe.test(c) && process.env.ECC_ALLOW_CURL_PIPE_SHELL !== '1') {
    return 'Blocked: piping remote scripts into a shell (curl/wget | sh). Set ECC_ALLOW_CURL_PIPE_SHELL=1 to bypass (not recommended).';
  }

  // Block sudo/doas unless explicitly allowed
  const sudo = /(^|\s)(sudo|doas)(\s|$)/i;
  if (sudo.test(c) && process.env.ECC_ALLOW_SUDO !== '1') {
    return 'Blocked: sudo/doas detected. Prefer documenting the command and run it manually, or set ECC_ALLOW_SUDO=1 to bypass.';
  }

  // Block explicitly disabling rm safety
  if (/--no-preserve-root/i.test(c)) {
    return 'Blocked: rm --no-preserve-root detected.';
  }

  // Block rm -rf on /, ~, $HOME
  const rmRf = /(^|\s)rm(\s|$)/;
  if (rmRf.test(c)) {
    // Normalize common quoting
    const cNoQuotes = c.replace(/["']/g, '');

    const dangerousTargets = [
      // Root
      /\brm\b[^\n]*\s-rf\s+\/$/i,
      /\brm\b[^\n]*\s-rf\s+\/[\*\w\-\.]+/i, // /foo, /*
      // Home-ish
      /\brm\b[^\n]*\s-rf\s+~\b/i,
      /\brm\b[^\n]*\s-rf\s+\$HOME\b/i
    ];

    if (dangerousTargets.some(r => r.test(cNoQuotes))) {
      return 'Blocked: rm -rf targeting / or home directory. This is almost certainly destructive.';
    }
  }

  // Block disk / system destruction tools unless explicitly allowed
  const diskDestructive = /(^|\s)(mkfs(\.[a-z0-9]+)?|dd)(\s|$)/i;
  if (diskDestructive.test(c) && process.env.ECC_ALLOW_DISK_TOOLS !== '1') {
    return 'Blocked: mkfs/dd detected. Set ECC_ALLOW_DISK_TOOLS=1 to bypass.';
  }

  // Block power commands
  const power = /(^|\s)(shutdown|reboot|halt|poweroff)(\s|$)/i;
  if (power.test(c) && process.env.ECC_ALLOW_POWER_COMMANDS !== '1') {
    return 'Blocked: shutdown/reboot/halt detected. Set ECC_ALLOW_POWER_COMMANDS=1 to bypass.';
  }

  // No block
  return null;
}

async function main() {
  const input = await readStdinJson().catch(() => ({}));
  const tool = getToolName(input);

  if (tool !== 'Bash' && tool !== 'Shell') {
    process.exit(0);
  }

  const cmd = getCommand(input);
  const reason = mainReason(cmd);

  if (reason) {
    log(`[BashGuard] ${reason}\nCommand: ${norm(cmd)}`);
    // Exit 2 blocks the tool call (Claude Code semantics)
    process.exit(2);
  }

  process.exit(0);
}

main().catch(err => {
  log(`[BashGuard] ERROR: ${err?.message || err}`);
  // Fail-open to avoid blocking due to hook bugs.
  process.exit(0);
});
