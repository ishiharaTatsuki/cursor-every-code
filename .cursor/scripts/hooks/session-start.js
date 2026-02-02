#!/usr/bin/env node
/**
 * SessionStart Hook - Load previous context on new session
 *
 * Cross-platform (Windows, macOS, Linux)
 *
 * Runs when a new Claude session starts. Checks for recent session
 * files and notifies Claude of available context to load.
 */

const {
  getSessionsDir,
  getLearnedSkillsDir,
  findFiles,
  ensureDir,
  log,
  writeFile
} = require('../lib/utils');
const { getPackageManager, getSelectionPrompt } = require('../lib/package-manager');
const { computeToolingState } = require('../lib/tooling');

async function main() {
  const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();

  const sessionsDir = getSessionsDir();
  const learnedDir = getLearnedSkillsDir();

  // Ensure directories exist
  ensureDir(sessionsDir);
  ensureDir(learnedDir);

  // Check for recent session files (last 7 days)
  // Match both old format (YYYY-MM-DD-session.tmp) and new format (YYYY-MM-DD-shortid-session.tmp)
  const recentSessions = findFiles(sessionsDir, '*-session.tmp', { maxAge: 7 });

  if (recentSessions.length > 0) {
    const latest = recentSessions[0];
    log(`[SessionStart] Found ${recentSessions.length} recent session(s)`);
    log(`[SessionStart] Latest: ${latest.path}`);
  }

  // Check for learned skills
  const learnedSkills = findFiles(learnedDir, '*.md');

  if (learnedSkills.length > 0) {
    log(`[SessionStart] ${learnedSkills.length} learned skill(s) available in ${learnedDir}`);
  }

  // Detect and report package manager
  const pm = getPackageManager({ projectDir });
  log(`[SessionStart] Package manager: ${pm.name} (${pm.source})`);

  // If package manager was detected via fallback, show selection prompt
  if (pm.source === 'fallback' || pm.source === 'default') {
    log('[SessionStart] No package manager preference found.');
    log(getSelectionPrompt());
  }

  // Detect project tooling (Python + Node) and persist to .cursor/.hook_state/tooling.json
  try {
    const tooling = computeToolingState(projectDir);
    const statePath = require('path').join(projectDir, '.cursor', '.hook_state', 'tooling.json');
    writeFile(statePath, JSON.stringify(tooling, null, 2) + '\n');
    log(`[SessionStart] Tooling snapshot written: ${statePath}`);
    log(`[SessionStart] Python tooling: ${tooling.python.manager} (${tooling.python.source})`);
    if (tooling.node.present) {
      log(`[SessionStart] Node tooling: ${tooling.node.packageManager} (${tooling.node.source})`);
    }
  } catch (err) {
    // Best-effort only; never block SessionStart.
    log(`[SessionStart] Tooling detection skipped: ${err.message}`);
  }

  process.exit(0);
}

main().catch(err => {
  console.error('[SessionStart] Error:', err.message);
  process.exit(0); // Don't block on errors
});
