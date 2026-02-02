#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import re
import shlex
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Optional, Tuple

EXCLUDES = {
    ".git", ".hg", ".svn",
    ".venv", "venv",
    "node_modules",
    "__pycache__",
    ".mypy_cache", ".pytest_cache", ".ruff_cache",
    ".cursor/.hook_state",
}

TEXT_EXT_ALLOWLIST = {
    ".md", ".mdc", ".txt", ".json", ".yaml", ".yml", ".toml",
    ".sh", ".bash", ".zsh", ".ps1",
    ".js", ".cjs", ".mjs", ".ts",
    ".py",
}

# --- patterns we care about ---
HOME_PATTERNS = [
    (re.compile(r"(^|[^A-Za-z0-9_])~/"), "tilde_slash"),
    (re.compile(r"\$HOME\b"), "HOME_env"),
    (re.compile(r"\$\{HOME\}"), "HOME_env_braced"),
    (re.compile(r"(^|[^A-Za-z0-9_])/Users/[^/\s]+/"), "mac_absolute_home"),
    (re.compile(r"(?i)\bC:\\Users\\[^\\]+\\", re.IGNORECASE), "win_absolute_home"),
]

ESCAPE_PATTERNS = [
    (re.compile(r"(^|[^A-Za-z0-9_])\./\.\."), "dotdot_escape"),
    (re.compile(r"(^|[^A-Za-z0-9_])\.\./"), "parent_relative"),
]

# Extract likely file paths from command strings:
# - node "path"
# - bash -lc "..."
# - sh path
# - python path
CMD_FILE_HINTS = re.compile(
    r"""
    (?:
      \bnode\b\s+(?:"([^"]+)"|'([^']+)'|([^\s]+))
    |
      \bpython\b\s+(?:"([^"]+)"|'([^']+)'|([^\s]+))
    |
      \bsh\b\s+(?:"([^"]+)"|'([^']+)'|([^\s]+))
    |
      \bbash\b\s+(?:"([^"]+)"|'([^']+)'|([^\s]+))
    )
    """,
    re.VERBOSE
)

@dataclass
class Finding:
    file: Path
    kind: str
    line_no: int
    excerpt: str

@dataclass
class HookCommandCheck:
    where: str
    command: str
    referenced_path: Optional[str]
    exists: Optional[bool]
    note: str

def is_excluded(path: Path, root: Path) -> bool:
    rel = path.relative_to(root)
    rel_str = str(rel).replace(os.sep, "/")
    parts = rel.parts
    if any(p in EXCLUDES for p in parts):
        return True
    for ex in EXCLUDES:
        if "/" in ex and rel_str.startswith(ex.rstrip("/") + "/"):
            return True
    return False

def likely_text_file(p: Path) -> bool:
    if p.suffix.lower() in TEXT_EXT_ALLOWLIST:
        return True
    # also allow files with no extension under .cursor/.claude
    if p.suffix == "" and (".cursor" in p.parts or ".claude" in p.parts):
        return True
    return False

def read_text_safe(p: Path) -> Optional[str]:
    try:
        data = p.read_bytes()
        if b"\x00" in data:
            return None
        return data.decode("utf-8", errors="replace")
    except Exception:
        return None

def iter_files(root: Path) -> Iterable[Path]:
    for p in root.rglob("*"):
        if not p.is_file():
            continue
        if p.is_symlink():
            continue
        if is_excluded(p, root):
            continue
        if not likely_text_file(p):
            continue
        yield p

def scan_file(root: Path, p: Path) -> list[Finding]:
    text = read_text_safe(p)
    if text is None:
        return []
    findings: list[Finding] = []
    for i, line in enumerate(text.splitlines(), start=1):
        for rx, kind in HOME_PATTERNS:
            if rx.search(line):
                findings.append(Finding(p.relative_to(root), kind, i, line.strip()[:200]))
        for rx, kind in ESCAPE_PATTERNS:
            if rx.search(line):
                findings.append(Finding(p.relative_to(root), kind, i, line.strip()[:200]))
    return findings

def parse_hooks_settings(root: Path) -> tuple[Optional[dict], Optional[str]]:
    settings = root / ".claude" / "settings.json"
    if not settings.exists():
        return None, f"missing: {settings}"
    text = read_text_safe(settings)
    if text is None:
        return None, f"unreadable/binary: {settings}"
    try:
        return json.loads(text), None
    except Exception as e:
        return None, f"invalid JSON in {settings}: {e}"

def extract_script_path_from_command(cmd: str) -> Optional[str]:
    m = CMD_FILE_HINTS.search(cmd)
    if not m:
        return None
    groups = [g for g in m.groups() if g]
    if not groups:
        return None
    candidate = groups[0]
    # if bash -lc "..." we can't reliably extract; return None
    if candidate in ("-lc", "-c"):
        return None
    return candidate

def check_hook_commands(root: Path, data: dict) -> list[HookCommandCheck]:
    out: list[HookCommandCheck] = []
    hooks = data.get("hooks", {})
    if not isinstance(hooks, dict):
        return out

    for event, rules in hooks.items():
        if not isinstance(rules, list):
            continue
        for idx, rule in enumerate(rules):
            rule_where = f"hooks.{event}[{idx}]"
            hooks_list = rule.get("hooks", [])
            if not isinstance(hooks_list, list):
                continue
            for j, h in enumerate(hooks_list):
                if not isinstance(h, dict):
                    continue
                if h.get("type") != "command":
                    continue
                cmd = h.get("command", "")
                if not isinstance(cmd, str) or not cmd.strip():
                    continue
                ref = extract_script_path_from_command(cmd)
                exists = None
                note = ""
                if ref:
                    # normalize relative paths like "./.cursor/..."
                    ref_path = (root / ref).resolve() if not os.path.isabs(ref) else Path(ref)
                    exists = ref_path.exists()
                    if not exists:
                        note = f"referenced path does not exist: {ref}"
                else:
                    note = "could not extract referenced script path (e.g., bash -lc ...)."
                out.append(HookCommandCheck(
                    where=f"{rule_where}.hooks[{j}]",
                    command=cmd,
                    referenced_path=ref,
                    exists=exists,
                    note=note
                ))
    return out

def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", default=".", help="repo root")
    ap.add_argument("--max", type=int, default=200, help="max findings to print per category")
    args = ap.parse_args()

    root = Path(args.root).resolve()

    # 1) scan files for risky paths
    findings: list[Finding] = []
    for f in iter_files(root):
        findings.extend(scan_file(root, f))

    # summarize
    by_kind: dict[str, list[Finding]] = {}
    for x in findings:
        by_kind.setdefault(x.kind, []).append(x)

    print("=== Path Audit Summary ===")
    for kind, xs in sorted(by_kind.items(), key=lambda kv: (-len(kv[1]), kv[0])):
        print(f"- {kind}: {len(xs)}")

    # 2) hooks settings parse & command checks
    data, err = parse_hooks_settings(root)
    if err:
        print("\n=== Hooks settings check ===")
        print(f"!! {err}")
    else:
        checks = check_hook_commands(root, data)
        bad = [c for c in checks if c.exists is False]
        unknown = [c for c in checks if c.exists is None]
        print("\n=== Hooks command references ===")
        print(f"- total command hooks: {len(checks)}")
        print(f"- missing referenced scripts: {len(bad)}")
        print(f"- unknown (couldn't extract path): {len(unknown)}")

        if bad:
            print("\n-- Missing scripts (first few) --")
            for c in bad[: args.max]:
                print(f"* {c.where}: {c.command}")
                print(f"  -> missing: {c.referenced_path}")

    # print sample findings
    def show(kind: str):
        xs = by_kind.get(kind, [])
        if not xs:
            return
        print(f"\n=== {kind} (showing up to {args.max}) ===")
        for x in xs[: args.max]:
            print(f"{x.file}:{x.line_no} :: {x.excerpt}")

    # most important first
    show("tilde_slash")
    show("HOME_env")
    show("HOME_env_braced")
    show("mac_absolute_home")
    show("win_absolute_home")
    show("dotdot_escape")
    show("parent_relative")

    print("\nDone.")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
