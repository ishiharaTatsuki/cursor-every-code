#!/usr/bin/env node
/**
 * Strategic Compact Suggester
 *
 * Cross-platform (Windows, macOS, Linux)
 *
 * Runs on PreToolUse to suggest manual compaction at logical intervals.
 *
 * Why manual over auto-compact:
 * - Auto-compact can happen at arbitrary points, often mid-task.
 * - Strategic compacting preserves context through logical phases.
 * - Compact after exploration, before execution.
 * - Compact after completing a milestone, before starting next.
 */

const path = require('path');
const {
  getTempDir,
  readFile,
  writeFile,
  log
} = require('../lib/utils');

function safeInt(x, fallback) {
  const n = parseInt(String(x || '').trim(), 10);
  return Number.isFinite(n) ? n : fallback;
}

function loadState(stateFile, legacyFile) {
  const raw = readFile(stateFile) || (legacyFile ? readFile(legacyFile) : null);
  if (!raw) return { count: 0, lastSuggestedAt: 0 };

  // Prefer JSON
  try {
    const obj = JSON.parse(raw);
    if (obj && typeof obj === 'object') {
      return {
        count: safeInt(obj.count, 0),
        lastSuggestedAt: safeInt(obj.lastSuggestedAt, 0)
      };
    }
  } catch {
    // fall through
  }

  // Legacy: plain integer counter
  return { count: safeInt(raw, 0), lastSuggestedAt: 0 };
}

async function main() {
  if (process.env.ECC_DISABLE_SUGGEST_COMPACT === '1') {
    process.exit(0);
  }

  // Session-scoped counter
  const sessionId = process.env.CLAUDE_SESSION_ID || process.ppid || 'default';
  const stateFile = path.join(getTempDir(), `claude-tool-count-${sessionId}.json`);
  const legacyFile = path.join(getTempDir(), `claude-tool-count-${sessionId}`);

  const threshold = safeInt(process.env.COMPACT_THRESHOLD, 50);
  const cooldownMs = safeInt(process.env.COMPACT_COOLDOWN_MS, 10 * 60 * 1000);

  const now = Date.now();

  // Load, increment, persist
  const state = loadState(stateFile, legacyFile);
  state.count += 1;

  // Always persist count updates
  writeFile(stateFile, JSON.stringify(state, null, 2) + '\n');

  // Suggest compact after threshold tool calls
  const shouldSuggest =
    state.count === threshold ||
    (state.count > threshold && state.count % 25 === 0);

  if (!shouldSuggest) {
    process.exit(0);
  }

  // Throttle by time to reduce noise
  const last = state.lastSuggestedAt || 0;
  if (cooldownMs > 0 && now - last < cooldownMs) {
    process.exit(0);
  }

  log(
    `[StrategicCompact] ${state.count} tool calls (threshold=${threshold}) - consider /compact if you're transitioning phases`
  );

  state.lastSuggestedAt = now;
  writeFile(stateFile, JSON.stringify(state, null, 2) + '\n');

  process.exit(0);
}

main().catch(err => {
  console.error('[StrategicCompact] Error:', err?.message || err);
  process.exit(0);
});
