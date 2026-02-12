---
name: continuous-learning
description: SessionEnd hook that records lightweight session metadata and prompts you to run /learn to save reusable patterns.
---

# Continuous Learning Skill

This repo's **continuous-learning** skill runs as a **SessionEnd hook** and does two things:

1. **Writes lightweight session metadata** (JSON) to `./.cursor/.sessions/evaluations/`
2. **Prompts you to run `/learn`** if the session was long enough to likely contain reusable patterns

> Important: It **does not automatically create learned skills**. Extraction is intentionally manual via `/learn`.

## How It Works

On SessionEnd:

1. Reads the session transcript path from hook input (`transcript_path`)  
2. Counts user messages in the transcript  
3. Writes metadata to `./.cursor/.sessions/evaluations/<session_id>.json`  
4. If the session is long enough, prints a reminder to run `/learn`

## Configuration

Edit `config.json`:

- `min_session_length` *(used)*: minimum number of **user messages** before prompting `/learn`
- `learned_skills_path` *(used)*: where `/learn` should write extracted skills

Other fields in `config.json` are **reserved** for future extraction logic and are currently ignored by the hook script.

## Hook Setup (already included)

This repo wires it in `./.claude/settings.json`:

```json
{
  "hooks": {
    "SessionEnd": [{
      "matcher": "",
      "hooks": [{
        "type": "command",
        "command": "node \"$CLAUDE_PROJECT_DIR/.cursor/scripts/hooks/evaluate-session.js\""
      }]
    }]
  }
}
```

## Related

- `/learn` command (manual extraction): `./.cursor/commands/learn.md`
