# Verification

Run comprehensive verification on the current codebase state (Python-first, with optional Node.js checks).

## Step 0: Detect tooling

First, print the repo-specific commands (uv/poetry/pdm/pipenv, npm/pnpm, etc.):

```bash
node .cursor/scripts/recommend-commands.js
```

Then use those commands for the steps below.

## Instructions

Execute verification in this order:

1. **Build Check**
   - Python: run compile/import sanity
   - Node (if present): run build (if configured)
   - If it fails, report errors and STOP

2. **Type Check**
   - Python: mypy (or pyright if your repo uses it)
   - TypeScript (if present): tsc/typecheck script
   - Report all errors with file:line

3. **Lint Check**
   - Python: ruff check (and format if needed)
   - Node: lint script if configured
   - Report warnings and errors

4. **Test Suite**
   - Run all tests (pytest / node test runner)
   - Report pass/fail count
   - Report coverage percentage

5. **Debug Print Audit**
   - Python: search for `print(` in tracked source (as a proxy for debug prints)
   - JS/TS: search for `console.log`
   - Report locations

6. **Git Status**
   - Show uncommitted changes
   - Show files modified since last commit

## Output

Produce a concise verification report:

```
VERIFICATION: [PASS/FAIL]

Build:    [OK/FAIL]
Types:    [OK/X errors]
Lint:     [OK/X issues]
Tests:    [X/Y passed, Z% coverage]
Secrets:  [OK/X found]
Logs:     [OK/X console.logs]

Ready for PR: [YES/NO]
```

If any critical issues, list them with fix suggestions.

## Arguments

$ARGUMENTS can be:
- `quick` - Only build + types
- `full` - All checks (default)
- `pre-commit` - Checks relevant for commits
- `pre-pr` - Full checks plus security scan
