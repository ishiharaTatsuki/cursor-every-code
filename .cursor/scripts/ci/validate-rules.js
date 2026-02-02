#!/usr/bin/env node
/**
 * Validate Cursor rule files (.mdc)
 */

const fs = require('fs');
const path = require('path');

const RULES_DIR = path.join(__dirname, '../../rules');

function walk(dir) {
  const out = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      out.push(...walk(full));
    } else if (e.isFile()) {
      out.push(full);
    }
  }
  return out;
}

function hasFrontmatter(content) {
  // Minimal check: file starts with --- and has a closing ---
  if (!content.startsWith('---')) return false;
  const idx = content.indexOf('\n---', 3);
  return idx !== -1;
}

function validateRules() {
  if (!fs.existsSync(RULES_DIR)) {
    console.log('No rules directory found, skipping validation');
    process.exit(0);
  }

  const files = walk(RULES_DIR).filter(f => f.endsWith('.mdc'));
  let hasErrors = false;
  let validatedCount = 0;

  for (const filePath of files) {
    const rel = path.relative(RULES_DIR, filePath);

    try {
      const content = fs.readFileSync(filePath, 'utf-8');

      if (content.trim().length === 0) {
        console.error(`ERROR: ${rel} - Empty rule file`);
        hasErrors = true;
        continue;
      }

      if (!hasFrontmatter(content)) {
        console.error(`ERROR: ${rel} - Missing YAML frontmatter (--- ... ---)`);
        hasErrors = true;
        continue;
      }

      validatedCount++;
    } catch (err) {
      console.error(`ERROR: ${rel} - ${err.message}`);
      hasErrors = true;
    }
  }

  if (hasErrors) process.exit(1);

  console.log(`Validated ${validatedCount} rule files (.mdc)`);
}

validateRules();
