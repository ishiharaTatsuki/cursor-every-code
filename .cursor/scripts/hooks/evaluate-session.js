#!/usr/bin/env node
/**
 * Continuous Learning - Session Evaluator (SessionEnd hook)
 *
 * Purpose:
 * - Analyze the session transcript length and write lightweight metadata
 * - Provide a stable place to store "learning candidates" for later manual /learn
 *
 * Notes:
 * - SessionEnd hook output is shown to the user, not injected into the model.
 *   Therefore this script focuses on side effects (writing files), not prompting the model.
 */

const path = require('path');
const fs = require('fs');
const os = require('os');

const {
  getProjectDir,
  getLearnedSkillsDir,
  getSessionsDir,
  ensureDir,
  readFile,
  countInFile,
  readStdinJson,
  log
} = require('../lib/utils');

function resolvePath(projectDir, p) {
  if (!p) return '';
  const s = String(p);
  if (s.startsWith('~')) return path.join(os.homedir(), s.slice(1));
  if (path.isAbsolute(s)) return s;
  return path.resolve(projectDir, s);
}

async function main() {
  const projectDir = getProjectDir();

  // Config lives in the project repo
  const configFile = path.join(projectDir, '.cursor', 'skills', 'continuous-learning', 'config.json');

  // Defaults
  let minSessionLength = 10;
  let learnedSkillsPath = getLearnedSkillsDir();

  // Load config if exists
  const configContent = readFile(configFile);
  if (configContent) {
    try {
      const config = JSON.parse(configContent);
      minSessionLength = Number(config.min_session_length || minSessionLength);

      if (config.learned_skills_path) {
        learnedSkillsPath = resolvePath(projectDir, config.learned_skills_path);
      }
    } catch {
      // ignore invalid config
    }
  }

  ensureDir(learnedSkillsPath);

  // Hook input JSON
  const input = await readStdinJson().catch(() => ({}));
  const transcriptPath =
    input?.transcript_path ||
    input?.transcriptPath ||
    process.env.CLAUDE_TRANSCRIPT_PATH ||
    '';

  const sessionId = input?.session_id || process.env.CLAUDE_SESSION_ID || 'unknown';

  if (!transcriptPath || !fs.existsSync(transcriptPath)) {
    return;
  }

  const messageCount = countInFile(transcriptPath, /"type":"user"/g);

  // Write metadata regardless (useful for debugging)
  const sessionsDir = getSessionsDir();
  const evalDir = ensureDir(path.join(sessionsDir, 'evaluations'));

  const outFile = path.join(evalDir, `${sessionId}.json`);
  const payload = {
    session_id: sessionId,
    transcript_path: transcriptPath,
    user_message_count: messageCount,
    min_session_length: minSessionLength,
    learned_skills_path: learnedSkillsPath,
    created_at: new Date().toISOString()
  };

  try {
    fs.writeFileSync(outFile, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  } catch {
    // ignore
  }

  if (messageCount < minSessionLength) {
    log(`[ContinuousLearning] Session too short (${messageCount} user messages). Metadata: ${outFile}`);
    return;
  }

  log(`[ContinuousLearning] Session has ${messageCount} user messages. Consider running /learn to extract reusable patterns.`);
  log(`[ContinuousLearning] Learned skills directory: ${learnedSkillsPath}`);
  log(`[ContinuousLearning] Metadata saved: ${outFile}`);
}

main().catch(err => {
  console.error('[ContinuousLearning] Error:', err?.message || err);
  process.exit(0);
});
