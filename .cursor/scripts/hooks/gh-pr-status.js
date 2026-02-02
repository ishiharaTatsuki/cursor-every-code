#!/usr/bin/env node

/**
 * PostToolUse helper for GitHub PR URLs.
 *
 * Default: detect PR URL in Bash output and print a small hint.
 * Optional: set ECC_GH_PR_STATUS=1 to attempt `gh pr view` (requires gh + auth).
 */
const { getProjectDir, readStdinJson, log, commandExists } = require('../lib/utils');
try { process.chdir(getProjectDir()); } catch (_) { }

const { readStdinJson, log, commandExists } = require('../lib/utils');
const { getToolName, getToolResponseText } = require('../lib/hook-input');
const { spawnSync } = require('child_process');

const PR_URL = /https:\/\/github\.com\/[^\s/]+\/[^\s/]+\/pull\/(\d+)/;

function run(cmd, args) {
  return spawnSync(cmd, args, { stdio: 'pipe', encoding: 'utf8' });
}

async function main() {
  if (process.env.ECC_DISABLE_GH_PR_STATUS === '1') return;

  const input = await readStdinJson().catch(() => ({}));
  const tool = getToolName(input);
  if (tool !== 'Bash' && tool !== 'Shell') return;

  const text = getToolResponseText(input);
  if (!text) return;

  const m = text.match(PR_URL);
  if (!m) return;

  const prNumber = m[1];
  const url = m[0];

  log(`[gh] Detected PR: ${url}`);

  if (process.env.ECC_GH_PR_STATUS !== '1') {
    log(`[gh] Tip: gh pr view ${prNumber} --web`);
    return;
  }

  if (!commandExists('gh')) {
    log('[gh] gh CLI not found in PATH. Skipping PR status.');
    return;
  }

  const r = run('gh', ['pr', 'view', prNumber, '--json', 'state,title,url,number,baseRefName,headRefName']);
  if (r.status === 0) {
    log(`[gh] PR status: ${r.stdout.trim()}`);
  } else {
    log('[gh] gh pr view failed (non-blocking).');
    if (process.env.ECC_GH_PR_STATUS_VERBOSE === '1') {
      log(r.stderr || r.stdout);
    }
  }
}

main().catch(() => process.exit(0));
