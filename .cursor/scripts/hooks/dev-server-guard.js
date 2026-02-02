#!/usr/bin/env node

/**
 * Guard for dev servers that can run indefinitely.
 *
 * Default: WARN (do not block).
 * Optional: set ECC_REQUIRE_TMUX_FOR_DEV_SERVER=1 to BLOCK when not in tmux/screen/nohup.
 */

const { readStdinJson, log } = require('../lib/utils');
const { getToolName, getCommand } = require('../lib/hook-input');

function norm(s) {
  return String(s || '').trim().replace(/\s+/g, ' ');
}

function isWrapped(command) {
  const c = norm(command).toLowerCase();
  return (
    c.startsWith('tmux ') ||
    c.startsWith('screen ') ||
    c.startsWith('nohup ') ||
    c.startsWith('setsid ')
  );
}

function isDevServer(command) {
  const c = norm(command);

  const patterns = [
    // Node
    /^(npm\s+run\s+dev|pnpm\s+dev|yarn\s+dev|next\s+dev)\b/i,
    // Python web
    /^uvicorn\b/i,
    /^gunicorn\b/i,
    /^flask\s+run\b/i,
    /^python\s+manage\.py\s+runserver\b/i,
    /^python\s+-m\s+http\.server\b/i,
    /^streamlit\s+run\b/i,
    // Frontend bundlers
    /^vite\b/i
  ];

  return patterns.some(r => r.test(c));
}

async function main() {
  if (process.env.ECC_DISABLE_DEV_SERVER_GUARD === '1') return;

  const input = await readStdinJson().catch(() => ({}));
  const tool = getToolName(input);
  if (tool !== 'Bash' && tool !== 'Shell') return;

  // If already in tmux/screen, allow silently.
  if (process.env.TMUX || process.env.STY) return;

  const cmd = getCommand(input);
  if (!isDevServer(cmd)) return;

  if (isWrapped(cmd)) return;

  const msg =
    `[dev-server] This looks like a long-running dev server command.\n` +
    `Command: ${norm(cmd)}\n` +
    `Tip: run it inside tmux/screen or wrap with nohup/setsid if you need it to survive disconnects.`;

  if (process.env.ECC_REQUIRE_TMUX_FOR_DEV_SERVER === '1') {
    log(msg + '\nBlocking because ECC_REQUIRE_TMUX_FOR_DEV_SERVER=1.');
    process.exit(2);
  } else {
    log(msg);
    process.exit(0);
  }
}

main().catch(() => process.exit(0));
