#!/usr/bin/env node
"use strict";

/**
 * Recommend project commands based on detected tooling.
 *
 * Usage:
 *   node .cursor/scripts/recommend-commands.js           # Markdown output
 *   node .cursor/scripts/recommend-commands.js --json    # JSON output
 *   node .cursor/scripts/recommend-commands.js --write   # Write .cursor/.hook_state/tooling.json
 */

const fs = require("fs");
const path = require("path");

const { computeToolingState } = require("./lib/tooling");

function parseArgs(argv) {
  const args = new Set(argv.slice(2));
  return {
    json: args.has("--json"),
    write: args.has("--write"),
  };
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function writeToolingJson(projectDir, tooling) {
  const stateDir = path.join(projectDir, ".cursor", ".hook_state");
  ensureDir(stateDir);
  const outPath = path.join(stateDir, "tooling.json");
  fs.writeFileSync(outPath, JSON.stringify(tooling, null, 2) + "\n", "utf8");
  return outPath;
}

function mdCodeBlock(lines) {
  const body = lines.filter(Boolean).join("\n");
  return `\n\`\`\`bash\n${body}\n\`\`\`\n`;
}

function renderMarkdown(tooling) {
  const py = tooling.python;
  const node = tooling.node;

  let md = "# Project Tooling (auto-detected)\n\n";
  md += `- Python: **${py.manager}** (source: ${py.source}${py.installed ? ", installed" : ""})\n`;
  md += node.present
    ? `- Node.js: **${node.packageManager}** (source: ${node.source}${node.installed ? ", installed" : ""})\n`
    : "- Node.js: (not detected)\n";

  md += "\n## Recommended Commands\n";

  md += "\n### Python\n";
  md += mdCodeBlock([
    `# install deps\n${py.commands.install}`,
    "",
    `# format\n${py.commands.format}`,
    `# lint\n${py.commands.lint}`,
    `# types\n${py.commands.types}`,
    `# tests\n${py.commands.tests}`,
  ]);

  if (node.present && node.commands) {
    md += "\n### Node.js\n";
    md += mdCodeBlock([
      `# install deps\n${node.commands.install}`,
      `# tests\n${node.commands.test}`,
      "",
      `# format (if prettier configured)\n${node.commands.prettier}`,
      `# types (TypeScript)\n${node.commands.tsc}`,
    ]);
  }

  md += "\n## Notes\n";
  md += "- If your repo defines scripts like `typecheck`, `lint`, or `format`, prefer those over raw tool invocations.\n";
  md += "- If detection is wrong, add the expected lockfile (e.g., `uv.lock`, `poetry.lock`, `pnpm-lock.yaml`) or set env overrides (see docs).\n";

  return md;
}

function main() {
  const { json, write } = parseArgs(process.argv);
  const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();

  const tooling = computeToolingState(projectDir);

  let outPath = "";
  if (write) {
    outPath = writeToolingJson(projectDir, tooling);
  }

  if (json) {
    // Keep stdout clean JSON for programmatic use.
    const payload = write ? { ...tooling, wrote: outPath } : tooling;
    process.stdout.write(JSON.stringify(payload, null, 2) + "\n");
    process.exit(0);
  }

  const md = renderMarkdown(tooling);
  process.stdout.write(md);
  if (write) {
    process.stderr.write(`[Tooling] Wrote ${outPath}\n`);
  }
  process.exit(0);
}

main();
