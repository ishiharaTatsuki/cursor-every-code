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
        return self.project / ".claude"


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
    ap.add_argument("--project", default=".", help="Project root (where .cursor/.claude will be created)")
    args = ap.parse_args()

    paths = SyncPaths(
        project=Path(args.project).resolve(),
        vendor=Path(args.vendor).resolve(),
    )

    if not paths.vendor.exists():
        raise SystemExit(f"Vendor path does not exist: {paths.vendor}")

    # ========== Backup existing configs ==========
    backup_if_exists(paths.cursor)
    backup_if_exists(paths.claude / "settings.json")

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

    # ========== 6) Third-party hooks (Claude Code format) into .claude/settings.json ==========
    # Cursor can load Claude Code hooks from .claude/settings.json automatically (third-party hooks).
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

        dst_settings = paths.claude / "settings.json"
        dst_settings.parent.mkdir(parents=True, exist_ok=True)
        dst_settings.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    # ========== 7) MCP placeholder ==========
    write_cursor_mcp_placeholder(paths.cursor / "mcp.json")

    print("✅ Synced everything-claude-code into .cursor/ and .claude/")
    print("✅ You can now delete vendor/ecc if you don't need to resync.")
    print("   (To resync later, re-clone vendor/ecc and re-run this script.)")


if __name__ == "__main__":
    main()
