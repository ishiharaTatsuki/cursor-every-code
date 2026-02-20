# Tooling

Detect the project tooling (Python runner: uv/poetry/pdm/pipenv, and Node.js package manager: npm/pnpm/yarn/bun) and output the **exact commands** to use in this repo.

## What to do

1. Run the detector:

```bash
node .cursor/scripts/recommend-commands.js --write
```

2. Use the printed commands as the canonical "install / format / lint / typecheck / test" loop for this repository.

## Notes

- The snapshot is written to: `.cursor/.hook_state/tooling.json`
- If detection seems wrong, add the appropriate lockfile(s) or config and re-run.
