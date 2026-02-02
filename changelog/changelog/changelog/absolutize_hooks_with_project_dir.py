#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
import shutil
import sys
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, List, Tuple


@dataclass
class Change:
    where: str
    before: str
    after: str


# Paths we want to anchor to $CLAUDE_PROJECT_DIR
# We intentionally limit scope to ".cursor/..." and ".claude/..." so we don't touch "go build ./..." etc.
SQ_PATH = re.compile(r"'(?P<prefix>\./)?(?P<root>\.cursor|\.claude)(?P<rest>/[^']*)'")
DQ_PATH = re.compile(r"\"(?P<prefix>\./)?(?P<root>\.cursor|\.claude)(?P<rest>/[^\"]*)\"")
BARE_PATH = re.compile(r"(?P<lead>(?:^|\s))(?P<prefix>\./)?(?P<root>\.cursor|\.claude)(?P<rest>/[A-Za-z0-9._/\-]+)")

NODE_INLINE = re.compile(r"\bnode\b\s+-(e|p)\b|\bnode\b\s+--eval\b")


def ts() -> str:
    return datetime.now().strftime("%Y%m%d-%H%M%S")


def backup_file(p: Path) -> Path:
    bak = p.with_suffix(p.suffix + f".bak-{ts()}")
    shutil.copy2(p, bak)
    return bak


def absolutize_command(cmd: str) -> Tuple[str, bool]:
    # Don't rewrite node -e / node --eval inline scripts (no file path to anchor)
    if NODE_INLINE.search(cmd):
        return cmd, False

    orig = cmd

    # 1) single-quoted paths -> double-quoted absolute paths (so $VAR expands)
    def repl_sq(m: re.Match) -> str:
        root = m.group("root")
        rest = m.group("rest")
        return f"\"$CLAUDE_PROJECT_DIR/{root}{rest}\""

    cmd = SQ_PATH.sub(repl_sq, cmd)

    # 2) double-quoted paths -> absolute paths
    def repl_dq(m: re.Match) -> str:
        root = m.group("root")
        rest = m.group("rest")
        return f"\"$CLAUDE_PROJECT_DIR/{root}{rest}\""

    cmd = DQ_PATH.sub(repl_dq, cmd)

    # 3) bare tokens -> quoted absolute paths
    def repl_bare(m: re.Match) -> str:
        lead = m.group("lead")
        root = m.group("root")
        rest = m.group("rest")
        return f'{lead}"$CLAUDE_PROJECT_DIR/{root}{rest}"'

    cmd = BARE_PATH.sub(repl_bare, cmd)

    return cmd, (cmd != orig)


def walk_and_patch_hooks(data: Any) -> List[Change]:
    changes: List[Change] = []
    hooks = data.get("hooks")
    if not isinstance(hooks, dict):
        return changes

    for event, rules in hooks.items():
        if not isinstance(rules, list):
            continue
        for i, rule in enumerate(rules):
            if not isinstance(rule, dict):
                continue
            handlers = rule.get("hooks")
            if not isinstance(handlers, list):
                continue
            for j, h in enumerate(handlers):
                if not isinstance(h, dict):
                    continue
                if h.get("type") != "command":
                    continue
                cmd = h.get("command")
                if not isinstance(cmd, str) or not cmd.strip():
                    continue

                new_cmd, changed = absolutize_command(cmd)
                if changed:
                    where = f"hooks.{event}[{i}].hooks[{j}]"
                    changes.append(Change(where=where, before=cmd, after=new_cmd))
                    h["command"] = new_cmd

    return changes


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--file", default=".claude/settings.json", help="Path to settings.json (default: .claude/settings.json)")
    ap.add_argument("--apply", action="store_true", help="Write changes (default: dry-run)")
    ap.add_argument("--backup", action="store_true", help="Create backup before writing")
    ap.add_argument("--show", type=int, default=30, help="Show first N changes")
    args = ap.parse_args()

    settings = Path(args.file)
    if not settings.exists():
        print(f"[ERROR] not found: {settings}", file=sys.stderr)
        return 2

    try:
        data = json.loads(settings.read_text(encoding="utf-8"))
    except Exception as e:
        print(f"[ERROR] invalid JSON: {settings}: {e}", file=sys.stderr)
        return 2

    # Work on a copy; if dry-run, we still collect changes by patching in-memory.
    changes = walk_and_patch_hooks(data)

    if not changes:
        print("No hook commands needed changes (already anchored or no .cursor/.claude paths found).")
        return 0

    print(f"{'APPLY' if args.apply else 'DRY-RUN'}: {len(changes)} command(s) will be updated.")
    for c in changes[: args.show]:
        print(f"\n- {c.where}")
        print(f"  before: {c.before}")
        print(f"  after : {c.after}")

    if args.apply:
        if args.backup:
            bak = backup_file(settings)
            print(f"\nBackup created: {bak}")
        settings.parent.mkdir(parents=True, exist_ok=True)
        settings.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        print(f"\nWrote: {settings}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
