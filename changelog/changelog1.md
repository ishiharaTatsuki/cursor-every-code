了解です。**`vendor/ecc` を削除できる**ように、次の2点を確実に満たす「完成版」を出します。

* `vendor/ecc/scripts/**` を **`.cursor/scripts/**` にコピー**
* hooks 側の `${CLAUDE_PLUGIN_ROOT}` を  **`./.cursor` に置換** （＝`vendor/ecc` に依存しない）

さらに重要な点として、Cursor は **Claude Code の `.cursor/settings.json` を “第三者フック” としてそのまま利用できる**ので、hooks は `.cursor/hooks.json` ではなく **`.cursor/settings.json` として配置**します（互換性が高い）。([Cursor](https://cursor.com/docs/agent/third-party-hooks?utm_source=chatgpt.com "Third Party Hooks | Cursor Docs"))
（Cursor ネイティブ hooks は `.cursor/hooks.json` ですが、今回の「完全移植」では Claude Code 互換の方が再現度が上がります。([Cursor](https://cursor.com/docs/agent/hooks?utm_source=chatgpt.com "Hooks | Cursor Docs"))）

---

# 1) 完成版スクリプト `scripts/sync_ecc_to_cursor.py`

> そのままコピペで保存して実行してください。
> ※実行すると `.cursor/{commands,agents,skills,rules,scripts}` を **丸ごと上書き**します（バックアップを自動作成）。
> ※hooks は `.cursor/settings.json` を生成します（こちらもバックアップ作成）。

```python
#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import shutil
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any

DEFAULT_VENDOR = "vendor/ecc"


@dataclass(frozen=True)
class SyncPaths:
    project: Path
    vendor: Path

    @property
    def cursor(self) -> Path:
        return self.project / ".cursor"

    @property
    def claude(self) -> Path:
        return self.project / ".cursor"


def timestamp() -> str:
    return datetime.now().strftime("%Y%m%d-%H%M%S")


def backup_if_exists(path: Path) -> None:
    if path.exists():
        bak = path.with_name(path.name + f".bak-{timestamp()}")
        if path.is_dir():
            shutil.copytree(path, bak)
        else:
            bak.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(path, bak)


def replace_dir(src: Path, dst: Path) -> None:
    if not src.exists():
        return
    dst.parent.mkdir(parents=True, exist_ok=True)
    if dst.exists():
        shutil.rmtree(dst)
    shutil.copytree(src, dst)


def copy_glob_files(src_dir: Path, pattern: str, dst_dir: Path) -> None:
    if not src_dir.exists():
        return
    dst_dir.mkdir(parents=True, exist_ok=True)
    for p in src_dir.glob(pattern):
        if p.is_file():
            shutil.copy2(p, dst_dir / p.name)


def ensure_rule_mdc(src_md: Path, dst_mdc: Path, description: str) -> None:
    """
    Convert rules/*.md -> .cursor/rules/*.mdc with Cursor frontmatter.
    """
    body = src_md.read_text(encoding="utf-8")
    frontmatter = (
        "---\n"
        f"description: {description}\n"
        "alwaysApply: true\n"
        "globs:\n"
        "  - \"**/*\"\n"
        "---\n\n"
    )
    dst_mdc.parent.mkdir(parents=True, exist_ok=True)
    dst_mdc.write_text(frontmatter + body, encoding="utf-8")


def deep_replace_in_json(obj: Any, needle: str, repl: str) -> Any:
    """
    Recursively replace substrings inside every string in a JSON-like structure.
    """
    if isinstance(obj, str):
        return obj.replace(needle, repl)
    if isinstance(obj, list):
        return [deep_replace_in_json(x, needle, repl) for x in obj]
    if isinstance(obj, dict):
        return {k: deep_replace_in_json(v, needle, repl) for k, v in obj.items()}
    return obj


def write_cursor_mcp_placeholder(dst: Path) -> None:
    if dst.exists():
        return
    dst.parent.mkdir(parents=True, exist_ok=True)
    dst.write_text("{\n  \"mcpServers\": {}\n}\n", encoding="utf-8")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--vendor", default=DEFAULT_VENDOR, help="Path to everything-claude-code checkout")
    ap.add_argument("--project", default=".", help="Project root (where .cursor/.cursor will be created)")
    args = ap.parse_args()

    paths = SyncPaths(
        project=Path(args.project).resolve(),
        vendor=Path(args.vendor).resolve(),
    )

    if not paths.vendor.exists():
        raise SystemExit(f"Vendor path does not exist: {paths.vendor}")

    # ========== Backup existing configs ==========
    backup_if_exists(paths.cursor)
    backup_if_exists(paths.cursor / "settings.json")

    # ========== 1) Cursor Commands ==========
    copy_glob_files(paths.vendor / "commands", "*.md", paths.cursor / "commands")

    # ========== 2) Cursor Agents (Subagents) ==========
    copy_glob_files(paths.vendor / "agents", "*.md", paths.cursor / "agents")

    # ========== 3) Cursor Skills ==========
    replace_dir(paths.vendor / "skills", paths.cursor / "skills")

    # ========== 4) Cursor Rules (.md -> .mdc) ==========
    rules_src = paths.vendor / "rules"
    rules_dst = paths.cursor / "rules"
    if rules_src.exists():
        if rules_dst.exists():
            shutil.rmtree(rules_dst)
        rules_dst.mkdir(parents=True, exist_ok=True)
        for md in sorted(rules_src.glob("*.md")):
            desc = md.stem.replace("-", " ")
            ensure_rule_mdc(md, rules_dst / f"{md.stem}.mdc", description=desc)

    # ========== 5) Copy scripts into .cursor/scripts ==========
    # Hooks in everything-claude-code call Node scripts; keep them local so vendor can be removed.
    replace_dir(paths.vendor / "scripts", paths.cursor / "scripts")

    # ========== 6) Third-party hooks (Claude Code format) into .cursor/settings.json ==========
    # Cursor can load Claude Code hooks from .cursor/settings.json automatically (third-party hooks).
    src_hooks_settings = paths.vendor / "hooks" / "hooks.json"
    if src_hooks_settings.exists():
        raw = src_hooks_settings.read_text(encoding="utf-8")
        data = json.loads(raw)

        # Replace ${CLAUDE_PLUGIN_ROOT} so it points to .cursor (relative to project root)
        # Example in upstream: node "${CLAUDE_PLUGIN_ROOT}/scripts/hooks/session-start.js"
        # We make it:        node "./.cursor/scripts/hooks/session-start.js"
        data = deep_replace_in_json(
            data,
            needle="${CLAUDE_PLUGIN_ROOT}",
            repl="./.cursor",
        )

        dst_settings = paths.cursor / "settings.json"
        dst_settings.parent.mkdir(parents=True, exist_ok=True)
        dst_settings.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    # ========== 7) MCP placeholder ==========
    write_cursor_mcp_placeholder(paths.cursor / "mcp.json")

    print("✅ Synced everything-claude-code into .cursor/ and .cursor/")
    print("✅ You can now delete vendor/ecc if you don't need to resync.")
    print("   (To resync later, re-clone vendor/ecc and re-run this script.)")


if __name__ == "__main__":
    main()
```

---

# 2) 実行手順（最短）

```bash
# 一時的に upstream を取得（submoduleでもcloneでもOK）
git clone https://github.com/affaan-m/everything-claude-code vendor/ecc

# 同期（.cursor と .cursor を生成/上書き）
python scripts/sync_ecc_to_cursor.py --vendor vendor/ecc --project .

# Cursor 再起動 / Reload Window 推奨
```

> なお、`everything-claude-code` は hooks / scripts を Node.js で動かす前提です（Node が必要）。([GitHub](https://github.com/affaan-m/everything-claude-code?utm_source=chatgpt.com "affaan-m/everything-claude-code"))
> また upstream の hooks 設定内で `${CLAUDE_PLUGIN_ROOT}` が使われています。([GitHub](https://github.com/affaan-m/everything-claude-code/raw/refs/heads/main/hooks/hooks.json "raw.githubusercontent.com"))

---

# 3) `vendor/ecc` は削除して良い？

はい、この完成版では **同期後に `vendor/ecc` を削除してOK** です。

理由はシンプルで、

* hooks が呼ぶスクリプト実体を **`.cursor/scripts/**` にコピー済み**
* hooks の `${CLAUDE_PLUGIN_ROOT}` を **`./.cursor` に置換済み**

なので、 **実行時に `vendor/ecc` を参照しません** 。

ただし、将来 upstream 更新を反映したい場合は、もう一度 `vendor/ecc` を取得して同期し直す必要があります。

---

# 4) フォルダ構成（同期後 / vendor削除後）

同期が終わって `vendor/ecc` を消したあとの “残るべき構成” はこうなります：

```text
<project-root>/
├── .cursor/
│   └── settings.json                 # ← upstream hooks/hooks.json を移植（third-party hooks）
│
├── .cursor/
│   ├── agents/                       # ← vendor/ecc/agents/*.md をコピー
│   │   ├── architect.md
│   │   ├── code-reviewer.md
│   │   └── ...
│   │
│   ├── commands/                     # ← vendor/ecc/commands/*.md をコピー
│   │   ├── plan.md
│   │   ├── tdd.md
│   │   └── ...
│   │
│   ├── rules/                        # ← vendor/ecc/rules/*.md → *.mdc 変換
│   │   ├── security.mdc
│   │   ├── testing.mdc
│   │   └── ...
│   │
│   ├── skills/                       # ← vendor/ecc/skills/** をコピー
│   │   └── ...
│   │
│   ├── scripts/                      # ← vendor/ecc/scripts/** をコピー（重要）
│   │   └── hooks/
│   │       ├── session-start.js
│   │       ├── session-end.js
│   │       ├── pre-compact.js
│   │       ├── suggest-compact.js
│   │       ├── check-console-log.js
│   │       └── evaluate-session.js
│   │
│   └── mcp.json                      # ← 空のプレースホルダ（必要に応じて設定）
│
├── scripts/
│   └── sync_ecc_to_cursor.py
│
└── (your project files...)
```

※ `.cursor/rules/*.mdc` の `alwaysApply` などは Cursor の rules 仕様に沿っています。([Cursor](https://cursor.com/ja/docs/context/rules?utm_source=chatgpt.com "Rules | Cursor Docs"))
※ `.cursor/settings.json` を Cursor がそのまま読める（third-party hooks）点は Cursor Docs 側の説明に基づきます。([Cursor](https://cursor.com/docs/agent/third-party-hooks?utm_source=chatgpt.com "Third Party Hooks | Cursor Docs"))

---

必要なら次は、「Python中心に合わせて hooks を強化（ruff/pytest/mypy を afterFileEdit/stop 相当で走らせる）」まで、上の `.cursor/settings.json` に追加するパッチもこちらで用意できます。
