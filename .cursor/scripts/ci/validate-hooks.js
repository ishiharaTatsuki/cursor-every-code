#!/usr/bin/env node
/**
 * Validate Claude-style hooks config (.claude/settings.json)
 *
 * This repo targets Cursor "third-party hooks" compatibility by using Claude Code's settings.json format.
 */

const fs = require('fs');
const path = require('path');

const SETTINGS_FILE = path.join(__dirname, '../../../.claude/settings.json');

const VALID_EVENTS = [
  'PreToolUse',
  'PostToolUse',
  'PermissionRequest',
  'PreCompact',
  'SessionStart',
  'SessionEnd',
  'Stop',
  'Notification',
  'SubagentStop'
];

// Events that require matchers in Claude Code
const REQUIRES_MATCHER = new Set(['PreToolUse', 'PostToolUse', 'PermissionRequest']);

function validateHooks() {
  if (!fs.existsSync(SETTINGS_FILE)) {
    console.log('No .claude/settings.json found, skipping validation');
    process.exit(0);
  }

  let data;
  try {
    data = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8'));
  } catch (e) {
    console.error(`ERROR: Invalid JSON in .claude/settings.json: ${e.message}`);
    process.exit(1);
  }

  const hooks = data.hooks;
  if (!hooks || typeof hooks !== 'object' || Array.isArray(hooks)) {
    console.error('ERROR: .claude/settings.json must contain an object field: { "hooks": { ... } }');
    process.exit(1);
  }

  let hasErrors = false;
  let totalMatchers = 0;

  for (const [eventType, matchers] of Object.entries(hooks)) {
    if (!VALID_EVENTS.includes(eventType)) {
      console.error(`ERROR: Invalid event type: ${eventType}`);
      hasErrors = true;
      continue;
    }

    if (!Array.isArray(matchers)) {
      console.error(`ERROR: ${eventType} must be an array`);
      hasErrors = true;
      continue;
    }

    for (let i = 0; i < matchers.length; i++) {
      const matcher = matchers[i];
      if (typeof matcher !== 'object' || matcher === null) {
        console.error(`ERROR: ${eventType}[${i}] is not an object`);
        hasErrors = true;
        continue;
      }

      if (REQUIRES_MATCHER.has(eventType)) {
        if (!('matcher' in matcher)) {
          console.error(`ERROR: ${eventType}[${i}] missing 'matcher' field`);
          hasErrors = true;
        } else if (typeof matcher.matcher !== 'string') {
          console.error(`ERROR: ${eventType}[${i}] matcher must be a string`);
          hasErrors = true;
        }
      }

      if (!matcher.hooks || !Array.isArray(matcher.hooks)) {
        console.error(`ERROR: ${eventType}[${i}] missing 'hooks' array`);
        hasErrors = true;
        continue;
      }

      for (let j = 0; j < matcher.hooks.length; j++) {
        const hook = matcher.hooks[j];
        if (!hook.type || typeof hook.type !== 'string') {
          console.error(`ERROR: ${eventType}[${i}].hooks[${j}] missing or invalid 'type' field`);
          hasErrors = true;
        }
        if (!hook.command || typeof hook.command !== 'string') {
          console.error(`ERROR: ${eventType}[${i}].hooks[${j}] missing or invalid 'command' field`);
          hasErrors = true;
        }
      }

      totalMatchers++;
    }
  }

  if (hasErrors) process.exit(1);

  console.log(`Validated ${totalMatchers} hook matcher blocks in .claude/settings.json`);
}

validateHooks();
