了解です。`.cursor/settings.json`（third‑party hooks）内の **command hook が参照する `.cursor/...` や `.cursor/...` を、`$CLAUDE_PROJECT_DIR` 基準の絶対（=プロジェクトルート固定）に統一**します。

これは Claude Code の hooks 公式でも「作業ディレクトリに依存しないよう `$CLAUDE_PROJECT_DIR` を使う」ことが推奨されています（スペース対策でクォートも推奨）。([Claude Code](https://code.cursor.com/docs/en/hooks "Hooks reference - Claude Code Docs"))
また Cursor は Claude Code 互換の third‑party hooks を読み込めます。([Cursor](https://cursor.com/docs/agent/third-party-hooks?utm_source=chatgpt.com "Third Party Hooks | Cursor Docs"))

---

# 1) 置換スクリプト（dry-run → apply）

`tools/absolutize_hooks_with_project_dir.py` として保存してください。

* 対象：`.cursor/settings.json` の `hooks.*[].hooks[].command`
* 変換：`./.cursor/...` / `.cursor/...` / `./.cursor/...` / `.cursor/...` を
  `"$CLAUDE_PROJECT_DIR/.cursor/..."` / `"$CLAUDE_PROJECT_DIR/.cursor/..."` に統一
* `node -e "..."` など **インライン実行**は（ファイル参照でないので）**変更しません**
* **バックアップ**作成対応

```python
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
# We intentionally limit scope to ".cursor/..." and ".cursor/..." so we don't touch "go build ./..." etc.
SQ_PATH = re.compile(r"'(?P<prefix>\./)?(?P<root>\.cursor|\.cursor)(?P<rest>/[^']*)'")
DQ_PATH = re.compile(r"\"(?P<prefix>\./)?(?P<root>\.cursor|\.cursor)(?P<rest>/[^\"]*)\"")
BARE_PATH = re.compile(r"(?P<lead>(?:^|\s))(?P<prefix>\./)?(?P<root>\.cursor|\.cursor)(?P<rest>/[A-Za-z0-9._/\-]+)")

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
    ap.add_argument("--file", default=".cursor/settings.json", help="Path to settings.json (default: .cursor/settings.json)")
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
        print("No hook commands needed changes (already anchored or no .cursor/.cursor paths found).")
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
```

---

## 実行手順

```bash
# 1) まず確認（dry-run）
python tools/absolutize_hooks_with_project_dir.py

# 2) 書き込み（バックアップ推奨）
python tools/absolutize_hooks_with_project_dir.py --apply --backup
```

---

# 2) 変更後の確認コマンド（おすすめ）

```bash
# .cursor/settings.json に .cursor/ が "相対で" 残ってないか（0件が理想）
rg -n '(^|[^\$])(\./)?\.cursor/' .cursor/settings.json
rg -n '(^|[^\$])(\./)?\.cursor/' .cursor/settings.json

# $CLAUDE_PROJECT_DIR が入ったか
rg -n 'CLAUDE_PROJECT_DIR' .cursor/settings.json
```

---

# 3) 注意（Windows等で $CLAUDE_PROJECT_DIR が空のケース）

あなたが Cursor（third‑party hooks）で動かす場合でも多くは大丈夫ですが、**環境によって hooks 実行時に `CLAUDE_PROJECT_DIR` が入らない**という報告があります（Windowsなど）。([GitHub](https://github.com/anthropics/claude-code/issues/6023?utm_source=chatgpt.com "[BUG] When I use hooks the CLAUDE_PROJECT_DIR isn't ..."))

もしその症状が出たら、最終的には hooks の `command` を

* `bash -lc 'ROOT="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"; node "$ROOT/..."'`

のように **フォールバック付き**にするのが堅いです（必要なら、その“フォールバック付与版”に自動変換するスクリプトも出します）。

---

必要なら次に、あなたの現状の `.cursor/settings.json` を前提に「**evaluate-session / python-after-edit / python-stop-checks** の3つだけ確実に動く最小 hooks セット（絶対パス＋フォールバック＋Windows配慮）」を提示します。
