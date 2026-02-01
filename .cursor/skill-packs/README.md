# Skill Packs

This repo ships a large skill library. For **Python-first templates**, keeping all skills enabled can add noise.

## Default: python-node-minimal

Enabled skills live in:
- `./.cursor/skills/`

Optional skills live in:
- `./.cursor/skills-optional/`

## Switch packs

```bash
# Enable all skills (full)
node .cursor/scripts/apply-skill-pack.js --pack full

# Go back to the minimal set
node .cursor/scripts/apply-skill-pack.js --pack python-node-minimal
```

## Notes

- This is a simple filesystem move operation (no symlinks).
- If you add new skills, update the JSON files under `./.cursor/skill-packs/`.
