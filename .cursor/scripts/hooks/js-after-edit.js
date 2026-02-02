#!/usr/bin/env node

/**
 * PostToolUse hook for JS/TS edits.
 *
 * - If Prettier is available locally, format the edited file.
 * - Optionally run tsc --noEmit (disabled by default; can be slow).
 * - Warn on console.log/debugger in the edited file.
 *
 * Safety:
 * - Never installs dependencies by default (npx uses --no-install).
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const {
  readStdinJson,
  log,
  commandExists,
  getProjectDir
} = require('../lib/utils');

const { getToolName, getFilePath } = require('../lib/hook-input');

function normPath(p) {
  return String(p || '').replace(/\\/g, '/');
}

function isJsLike(filePath) {
  const p = normPath(filePath).toLowerCase();
  return (
    p.endsWith('.js') ||
    p.endsWith('.jsx') ||
    p.endsWith('.ts') ||
    p.endsWith('.tsx') ||
    p.endsWith('.json') ||
    p.endsWith('.yml') ||
    p.endsWith('.yaml')
  );
}

function findLocalBin(projectDir, binName) {
  const p = path.join(projectDir, 'node_modules', '.bin', binName + (process.platform === 'win32' ? '.cmd' : ''));
  return fs.existsSync(p) ? p : null;
}

function run(cmd, args, cwd) {
  const r = spawnSync(cmd, args, { cwd, stdio: 'pipe', encoding: 'utf8' });
  return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
}

function warnIfConsoleLog(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const hasConsole = /\bconsole\.log\s*\(/.test(content);
    const hasDebugger = /\bdebugger\s*;/.test(content);
    if (hasConsole || hasDebugger) {
      log(`[js-after-edit] Warning: found ${[hasConsole ? 'console.log' : null, hasDebugger ? 'debugger' : null].filter(Boolean).join(' and ')} in ${filePath}`);
    }
  } catch {
    // ignore
  }
}

async function main() {
  if (process.env.ECC_DISABLE_JS_AFTER_EDIT === '1') return;

  const input = await readStdinJson().catch(() => ({}));
  const tool = getToolName(input);
  if (!['Write', 'Edit', 'MultiEdit'].includes(tool)) return;

  const filePath = getFilePath(input);
  if (!filePath) return;
  if (!isJsLike(filePath)) return;

  const projectDir = getProjectDir();

  // 1) Prettier (best-effort)
  if (process.env.ECC_JS_FORMAT_ON_SAVE !== '0') {
    const localPrettier = findLocalBin(projectDir, 'prettier');
    let prettierCmd = null;
    let prettierArgs = [];

    if (localPrettier) {
      prettierCmd = localPrettier;
      prettierArgs = ['--write', filePath];
    } else if (commandExists('prettier')) {
      prettierCmd = 'prettier';
      prettierArgs = ['--write', filePath];
    } else if (commandExists('npx')) {
      prettierCmd = 'npx';
      const allowInstall = process.env.ECC_ALLOW_NPX_INSTALL === '1';
      prettierArgs = [
        ...(allowInstall ? [] : ['--no-install']),
        'prettier',
        '--write',
        filePath
      ];
    }

    if (prettierCmd) {
      const r = run(prettierCmd, prettierArgs, projectDir);
      if (r.status === 0) {
        log(`[js-after-edit] Prettier formatted: ${filePath}`);
      } else {
        // Non-blocking; avoid noisy output unless user opts in.
        if (process.env.ECC_JS_AFTER_EDIT_VERBOSE === '1') {
          log(`[js-after-edit] Prettier failed (non-blocking):\n${r.stderr || r.stdout}`);
        }
      }
    }
  }

  // 2) tsc --noEmit (opt-in)
  if (process.env.ECC_JS_TSC_ON_SAVE === '1') {
    const localTsc = findLocalBin(projectDir, 'tsc');
    let tscCmd = null;
    let tscArgs = ['--noEmit'];

    if (localTsc) {
      tscCmd = localTsc;
    } else if (commandExists('tsc')) {
      tscCmd = 'tsc';
    } else if (commandExists('npx')) {
      tscCmd = 'npx';
      const allowInstall = process.env.ECC_ALLOW_NPX_INSTALL === '1';
      tscArgs = [
        ...(allowInstall ? [] : ['--no-install']),
        'tsc',
        '--noEmit'
      ];
    }

    if (tscCmd) {
      const r = run(tscCmd, tscArgs, projectDir);
      if (r.status === 0) {
        log('[js-after-edit] TypeScript check passed (tsc --noEmit).');
      } else {
        log('[js-after-edit] TypeScript check failed (non-blocking). Enable ECC_JS_AFTER_EDIT_VERBOSE=1 for details.');
        if (process.env.ECC_JS_AFTER_EDIT_VERBOSE === '1') {
          log(r.stderr || r.stdout);
        }
      }
    }
  }

  // 3) console.log / debugger warning
  warnIfConsoleLog(filePath);
}

main().catch(() => process.exit(0));
