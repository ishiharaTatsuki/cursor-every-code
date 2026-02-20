# Skill Packs

This repo ships a large skill library. You can **enable/disable skill sets** by moving directories between:

- Enabled skills: `./.cursor/skills/`
- Optional/disabled skills: `./.cursor/skills-optional/`

## Default: full

This repo is configured to run in **full mode by default** (all shipped skills are enabled).

If you prefer a smaller surface area (less noise), switch to the `python-node-minimal` pack.

## Switch packs

```bash
# Enable all skills (full)
node .cursor/scripts/apply-skill-pack.js --pack full

# Switch to a minimal core set
node .cursor/scripts/apply-skill-pack.js --pack python-node-minimal
```

## Notes

- This is a simple filesystem move operation (no symlinks).
- If you add new skills, update the JSON files under `./.cursor/skill-packs/`.
