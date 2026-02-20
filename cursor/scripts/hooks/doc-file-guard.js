#!/usr/bin/env node

/**
 * Guard against writing "random docs" (optional).
 *
 * This is intentionally OFF by default because it can be annoying.
 *
 * Modes:
 * - ECC_DOC_GUARD=off (default): do nothing
 * - ECC_DOC_GUARD=warn: warn on writes/edits to .md/.txt (except allowlist)
 * - ECC_DOC_GUARD=block: block those writes/edits
 *
 * Allowlist:
 * - README.md
 * - CHANGELOG.md (and changelog/ directory)
 */

const path = require('path');
const { readStdinJson, log } = require('../lib/utils');
const { getToolName, getFilePath } = require('../lib/hook-input');

function normPath(p) {
  return String(p || '').replace(/\\/g, '/');
}

function isDocFile(filePath) {
  const p = normPath(filePath).toLowerCase();
  return p.endsWith('.md') || p.endsWith('.txt');
}

function isAllowlisted(filePath) {
  const p = normPath(filePath);
  const base = path.posix.basename(p);
  if (base.toLowerCase() === 'readme.md') return true;
  if (base.toLowerCase() === 'changelog.md') return true;
  if (p.toLowerCase().includes('/changelog/')) return true;
  return false;
}

async function main() {
  const mode = (process.env.ECC_DOC_GUARD || 'off').toLowerCase();
  if (mode === 'off' || mode === '') return;

  const input = await readStdinJson().catch(() => ({}));
  const tool = getToolName(input);

  // Apply to file write/edit tools only
  if (!['Write', 'Edit', 'MultiEdit'].includes(tool)) return;

  const filePath = getFilePath(input);
  if (!filePath) return;

  if (!isDocFile(filePath)) return;
  if (isAllowlisted(filePath)) return;

  const msg =
    `[doc-guard] ${tool} to a doc file detected: ${filePath}\n` +
    `If this is intentional, continue. Otherwise, consider focusing on code first.\n` +
    `Set ECC_DOC_GUARD=off to disable, or ECC_DOC_GUARD=warn/block to control behavior.`;

  if (mode === 'block') {
    log(msg);
    process.exit(2);
  } else {
    log(msg);
    process.exit(0);
  }
}

main().catch(() => process.exit(0));
