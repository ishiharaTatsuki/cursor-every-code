#!/usr/bin/env node
/**
 * Validate hooks.json schema
 */

const fs = require('fs');
const path = require('path');

const HOOKS_FILE = path.join(__dirname, '../../hooks/hooks.json');
const CLAUDE_SETTINGS_FILE = path.join(__dirname, '../../../.claude/settings.json');
const VALID_EVENTS = ['PreToolUse', 'PostToolUse', 'PreCompact', 'SessionStart', 'SessionEnd', 'Stop', 'Notification', 'SubagentStop'];
const REPO_ROOT = path.resolve(__dirname, '../../..');

function validateMatcherSyntax(matcher, eventType, index, errors) {
  if (typeof matcher !== 'string') return;
  // Claude Code matchers are tool names / regexes, not boolean expressions.
  if (matcher.includes('tool ==') || matcher.includes('tool_input')) {
    errors.push(`ERROR: ${eventType}[${index}] matcher looks like an expression (use tool-name matcher like "Bash" or "Edit|Write")`);
  }
}

function validateCommandRefs(cmd, eventType, index, hookIndex, errors, warnings) {
  if (typeof cmd !== 'string') return;

  if (cmd.includes('node -e')) {
    warnings.push(`WARN: ${eventType}[${index}].hooks[${hookIndex}] uses inline node -e (prefer a checked-in script for auditability)`);
  }

  const re = /\.cursor\/scripts\/hooks\/[A-Za-z0-9._-]+\.js/g;
  const matches = cmd.match(re) || [];
  for (const m of matches) {
    const abs = path.join(REPO_ROOT, m);
    if (!fs.existsSync(abs)) {
      errors.push(`ERROR: ${eventType}[${index}].hooks[${hookIndex}] references missing file: ${m}`);
    }
  }
}

function validateHooks() {
  const targetFile = fs.existsSync(HOOKS_FILE)
    ? HOOKS_FILE
    : (fs.existsSync(CLAUDE_SETTINGS_FILE) ? CLAUDE_SETTINGS_FILE : null);

  if (!targetFile) {
    console.log('No hooks configuration found (.cursor/hooks/hooks.json or .claude/settings.json), skipping validation');
    process.exit(0);
  }

  let data;
  try {
    data = JSON.parse(fs.readFileSync(targetFile, 'utf-8'));
  } catch (e) {
    console.error(`ERROR: Invalid JSON in ${path.basename(targetFile)}: ${e.message}`);
    process.exit(1);
  }

  // Support both object format { hooks: {...} } and array format
  const hooks = data.hooks || data;
  let hasErrors = false;
  let totalMatchers = 0;
  const errors = [];
  const warnings = [];

  if (typeof hooks === 'object' && !Array.isArray(hooks)) {
    // Object format: { EventType: [matchers] }
    for (const [eventType, matchers] of Object.entries(hooks)) {
      if (!VALID_EVENTS.includes(eventType)) {
        const msg = `ERROR: Invalid event type: ${eventType}`;
        console.error(msg);
        errors.push(msg);
        hasErrors = true;
        continue;
      }

      if (!Array.isArray(matchers)) {
        const msg = `ERROR: ${eventType} must be an array`;
        console.error(msg);
        errors.push(msg);
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
        if (!matcher.matcher) {
          console.error(`ERROR: ${eventType}[${i}] missing 'matcher' field`);
          hasErrors = true;
        } else {
          validateMatcherSyntax(matcher.matcher, eventType, i, errors);
        }
        if (!matcher.hooks || !Array.isArray(matcher.hooks)) {
          console.error(`ERROR: ${eventType}[${i}] missing 'hooks' array`);
          hasErrors = true;
        } else {
          // Validate each hook entry
          for (let j = 0; j < matcher.hooks.length; j++) {
            const hook = matcher.hooks[j];
            if (!hook.type || typeof hook.type !== 'string') {
              console.error(`ERROR: ${eventType}[${i}].hooks[${j}] missing or invalid 'type' field`);
              hasErrors = true;
            }
            if (!hook.command || (typeof hook.command !== 'string' && !Array.isArray(hook.command))) {
              console.error(`ERROR: ${eventType}[${i}].hooks[${j}] missing or invalid 'command' field`);
              hasErrors = true;
            } else {
              if (typeof hook.command === 'string') {
                validateCommandRefs(hook.command, eventType, i, j, errors, warnings);
              } else if (Array.isArray(hook.command)) {
                for (const part of hook.command) {
                  validateCommandRefs(part, eventType, i, j, errors, warnings);
                }
              }
            }
          }
        }
        totalMatchers++;
      }
    }
  } else if (Array.isArray(hooks)) {
    // Array format (legacy)
    for (let i = 0; i < hooks.length; i++) {
      const hook = hooks[i];
      if (!hook.matcher) {
        console.error(`ERROR: Hook ${i} missing 'matcher' field`);
        hasErrors = true;
      } else {
        validateMatcherSyntax(hook.matcher, 'hooks', i, errors);
      }
      if (!hook.hooks || !Array.isArray(hook.hooks)) {
        console.error(`ERROR: Hook ${i} missing 'hooks' array`);
        hasErrors = true;
      } else {
        // Validate each hook entry
        for (let j = 0; j < hook.hooks.length; j++) {
          const h = hook.hooks[j];
          if (!h.type || typeof h.type !== 'string') {
            console.error(`ERROR: Hook ${i}.hooks[${j}] missing or invalid 'type' field`);
            hasErrors = true;
          }
          if (!h.command || (typeof h.command !== 'string' && !Array.isArray(h.command))) {
            console.error(`ERROR: Hook ${i}.hooks[${j}] missing or invalid 'command' field`);
            hasErrors = true;
          } else {
            if (typeof h.command === 'string') {
              validateCommandRefs(h.command, 'hooks', i, j, errors, warnings);
            } else if (Array.isArray(h.command)) {
              for (const part of h.command) {
                validateCommandRefs(part, 'hooks', i, j, errors, warnings);
              }
            }
          }
        }
      }
      totalMatchers++;
    }
  } else {
    console.error('ERROR: hooks.json must be an object or array');
    process.exit(1);
  }

  // Report non-fatal warnings
  for (const w of warnings) {
    console.warn(w);
  }

  // Report errors
  if (hasErrors || errors.length) {
    for (const e of errors) console.error(e);
    process.exit(1);
  }

  console.log(`Validated ${totalMatchers} hook matchers`);
}

validateHooks();
