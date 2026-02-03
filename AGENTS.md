# AGENTS.md

This repository is a “Cursor workflow + automation template.”
Codex reads this file before doing work, so it captures the minimum set of: **operating flow / quality gates / safety rules**.

> Policy: keep this **short and stable**. For details, refer to `.cursor/` (rules/commands/skills).

## 0) Repo map (start here if unsure)

- `README.md` … overall template overview, hooks, operational switches
- `.cursor/rules/` … conventions (especially:
  - `python-style.mdc` / `testing.mdc` / `security.mdc` / `git-workflow.mdc` / `hooks.mdc`)
- `.cursor/commands/` … recommended workflows (e.g. `plan.md` / `tdd.md` / `verify.md`)
- `.cursor/skills/` … “read when needed” procedure packs (TDD, verification-loop, etc.)
- `.claude/settings.json` / `.cursor/scripts/hooks/` … local hooks that can execute commands (**handle with care**)
  - Do **not** modify these unless explicitly requested, because they affect safety and automation

## 1) Default workflow (Explore → Plan → Implement → Verify)

### A. Explore

- Read relevant files first and follow existing patterns (do not guess).
- If the change is wide, identify the impact surface before editing.

### B. Plan

- For **multi-file changes / ambiguous requirements / high-risk work**, propose a short plan first:
  - restate requirements, call out risks, list steps (about 3–8), and define verification
- If assumptions remain uncertain, ask clarifying questions before proceeding.

### C. Implement

- Keep diffs small and incremental (make it work, then extend).
- Avoid “incidental refactors” unless requested or clearly necessary to fix a bug.

### D. Verify

- Always provide a way to verify (tests/lint/type-check/expected output) and run it when possible.
- If tests are heavy:
  - run the smallest relevant subset first → then the recommended full set (if feasible)

## 2) Quality gates (template standard)

This template primarily targets Python, but may include Node/TS/Go.
**The repository’s own “source of truth” commands come first** (README / Makefile / package.json / pyproject.toml, etc.).

### If you’re unsure which commands are “official” (recommended)

Run this to determine the repo’s canonical commands:

- `node .cursor/scripts/recommend-commands.js --write`
- Prefer what it writes into `.cursor/.hook_state/tooling.json`

### Python (general)

Run these if the tools exist in the environment:

- Format: `ruff format .`
- Lint: `ruff check .` (use `--fix` if appropriate)
- Tests: `pytest`
- Types (optional): `mypy .`

### JS/TS (if present)

- Use the package manager indicated by lockfiles/config (npm/pnpm/yarn/bun).
- Typical: `... run lint` / `... test` / `... run build`

> If you cannot run verification, state why (env/dep missing) and propose an alternative.

## 3) Coding conventions (minimal)

Follow `.cursor/rules/` first; it is authoritative for style and process.

Minimum expectations:

- Optimize for readability; keep functions small; separate responsibilities.
- At boundaries (I/O, external APIs, DB), make validation and error handling explicit.
- Never hardcode or print secrets (API keys/tokens/passwords).

## 4) Safety rules (important)

- Ask for confirmation **before**:
  - adding dependencies, large lockfile updates, migrations, data deletion, auth/permissions changes
  - any network-reaching actions (calling external APIs, curl/wget, etc.)
- Do **not** run (instead explain and propose alternatives):
  - destructive commands (e.g. `rm -rf`, disk tools, reboot/shutdown)
  - `curl | sh` / `wget | sh` style piped execution
  - unnecessary `sudo`

## 5) Completion report format (keep it concise)

Include:

- What changed (key points)
- Which files were modified (major ones)
- How you verified it (commands + results)
- Remaining issues / items to confirm (if any)

## 6) Continuity / “memory” artifacts are file-based

- Session notes: `.cursor/.sessions/*-session.tmp` (ignored by git)
- Learned notes (optional): `.cursor/skills/learned/`
- v2 observations/instincts (optional): `.claude/homunculus/` (ignored by git)

When relevant, read these before continuing work to avoid repeating the same questions or mistakes.
