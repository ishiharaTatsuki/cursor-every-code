---
name: verification-loop
description: A pragmatic quality gate checklist (Python-first) to run before PRs or after major changes.
---

# Verification Loop Skill

A comprehensive verification system for sessions and PR prep.

## When to Use

Invoke this skill:
- After completing a feature or significant code change
- Before creating a PR
- After refactoring
- When you suspect regressions

## Verification Phases

> The goal is **signal**, not ceremony. Prefer the commands your repo already defines.

Before running checks, **auto-detect the repo tooling** (uv/poetry/pdm/pipenv, npm/pnpm, etc.) and copy/paste the recommended commands:

```bash
node .cursor/scripts/recommend-commands.js
```

If hooks are enabled, the tooling snapshot is written automatically to `.cursor/.hook_state/tooling.json` on session start.

### Phase 1: Build / Sanity Check

**Python:**
```bash
# Syntax/import sanity (use the correct runner prefix for your repo)
# uv:     uv run python -m compileall -q .
# poetry: poetry run python -m compileall -q .
python -m compileall -q .

# Optional: verify dependencies are consistent
python -m pip check || true
```

**Node.js (if present):**
```bash
# Use your detected package manager (see recommend-commands.js output):
# pnpm: pnpm build
# npm:  npm run build
# yarn: yarn build
npm run build 2>&1 | tail -50
```

If the build/sanity check fails, **STOP** and fix before continuing.

### Phase 2: Type Check

**Python (preferred):**
```bash
# uv:     uv run mypy .
# poetry: poetry run mypy .
mypy . 2>&1 | head -60
```

If you use pyright instead:
```bash
pyright . 2>&1 | head -60
```

**TypeScript (if present):**
```bash
# Prefer your repo's typecheck script if it exists.
# Otherwise use a local tsc invocation:
# pnpm: pnpm exec tsc --noEmit
# npm:  npx --no-install tsc --noEmit
npm run typecheck 2>&1 | head -60
```

### Phase 3: Lint / Format

**Python:**
```bash
# uv:     uv run ruff format .
#         uv run ruff check .
# poetry: poetry run ruff format .
#         poetry run ruff check .
ruff format .
ruff check . 2>&1 | head -60
```

**JavaScript/TypeScript:**
```bash
# Use your package manager:
# pnpm: pnpm lint
# npm:  npm run lint
# yarn: yarn lint
npm run lint 2>&1 | head -60
```

### Phase 4: Test Suite

**Python:**
```bash
# uv:     uv run pytest -q
# poetry: poetry run pytest -q
pytest -q

# With coverage (recommended for PR)
# uv:     uv run pytest -q --cov=. --cov-report=term-missing
# poetry: poetry run pytest -q --cov=. --cov-report=term-missing
pytest -q --cov=. --cov-report=term-missing
```

**Node.js:**
```bash
# Use your package manager:
# pnpm: pnpm test
# npm:  npm test
# yarn: yarn test
npm test 2>&1 | tail -80
# With coverage (if configured)
npm test -- --coverage 2>&1 | tail -80
```

Report:
- Total tests: X
- Passed: X
- Failed: X
- Coverage: X% (if applicable)

### Phase 5: Security & Secrets Scan (lightweight)

Minimal checks that work everywhere:

```bash
# Common secret patterns (expand as needed)
git grep -nE "(sk-[A-Za-z0-9]{10,}|AKIA[0-9A-Z]{16}|-----BEGIN (RSA|OPENSSH) PRIVATE KEY-----)" -- . || true

# Accidental debug prints
# Python
git grep -nE "\bprint\(" -- '*.py' || true
# JS/TS
git grep -nE "\bconsole\.log\b" -- '*.ts' '*.tsx' '*.js' '*.jsx' || true
```

If your org uses a scanner (gitleaks/trufflehog), prefer that in CI.

### Phase 6: Diff Review

```bash
git diff --stat

# Files changed vs HEAD (works even if only working tree changed)
git diff --name-only

# If you have a previous commit to compare:
# git diff --name-only HEAD~1
```

Review each changed file for:
- unintended changes
- missing validation/error handling
- security regressions
- test gaps

## Output Format

After running all phases, produce a verification report:

```
VERIFICATION REPORT
==================

Build:     [PASS/FAIL]
Types:     [PASS/FAIL] (X errors)
Lint:      [PASS/FAIL] (X warnings)
Tests:     [PASS/FAIL] (X/Y passed, Z% coverage)
Security:  [PASS/FAIL] (X issues)
Diff:      [X files changed]

Overall:   [READY/NOT READY] for PR

Issues to Fix:
1. ...
2. ...
```

## Continuous Mode

For long sessions, run a mini-check after major milestones:
- after finishing a function
- after adding an endpoint
- after refactoring a core module

If hooks are enabled, they can catch issues incrementally; this skill is for the *full* gate.
