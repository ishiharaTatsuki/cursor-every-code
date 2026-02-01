#!/usr/bin/env python3
from __future__ import annotations

import argparse
import os
from dataclasses import dataclass
from pathlib import Path
import shutil
import sys
from typing import Iterable


DEFAULT_EXCLUDES = {
    ".git",
    ".hg",
    ".svn",
    ".idea",
    ".vscode",
    ".venv",
    "venv",
    "__pycache__",
    "node_modules",
    "dist",
    "build",
    ".mypy_cache",
    ".pytest_cache",
    ".ruff_cache",
    ".cursor/.hook_state",
}


@dataclass(frozen=True)
class Result:
    file: Path
    occurrences: int
    changed: bool
    skipped_reason: str | None = None


def is_excluded(path: Path, root: Path, excludes: set[str]) -> bool:
    rel = path.relative_to(root)
    parts = rel.parts

    if any(p in excludes for p in parts):
        return True

    rel_str = str(rel).replace(os.sep, "/")
    for ex in excludes:
        if "/" in ex and rel_str.startswith(ex.rstrip("/") + "/"):
            return True

    return False


def is_probably_binary(data: bytes) -> bool:
    return b"\x00" in data


def iter_files(root: Path, excludes: set[str]) -> Iterable[Path]:
    for p in root.rglob("*"):
        if not p.is_file():
            continue
        if p.is_symlink():
            continue
        if is_excluded(p, root, excludes):
            continue
        yield p


def backup_file(src: Path) -> Path:
    bak = src.with_suffix(src.suffix + ".bak")
    if bak.exists():
        i = 1
        while True:
            bak2 = src.with_suffix(src.suffix + f".bak{i}")
            if not bak2.exists():
                bak = bak2
                break
            i += 1
    shutil.copy2(src, bak)
    return bak


def process_file(
    p: Path,
    needle: bytes,
    repl: bytes,
    apply: bool,
    make_backup: bool,
    max_bytes: int,
) -> Result:
    try:
        st = p.stat()
        if st.st_size > max_bytes:
            return Result(file=p, occurrences=0, changed=False, skipped_reason=f"too_large(>{max_bytes})")
        data = p.read_bytes()
    except Exception as e:
        return Result(file=p, occurrences=0, changed=False, skipped_reason=f"read_error({e})")

    if needle not in data:
        return Result(file=p, occurrences=0, changed=False)

    occ = data.count(needle)
    if is_probably_binary(data):
        return Result(file=p, occurrences=occ, changed=False, skipped_reason="binary")

    new = data.replace(needle, repl)
    if new == data:
        return Result(file=p, occurrences=occ, changed=False)

    if apply:
        try:
            if make_backup:
                backup_file(p)

            tmp = p.with_name(p.name + ".tmp")
            tmp.write_bytes(new)
            tmp.replace(p)
        except Exception as e:
            return Result(file=p, occurrences=occ, changed=False, skipped_reason=f"write_error({e})")

    return Result(file=p, occurrences=occ, changed=True)


def main() -> int:
    ap = argparse.ArgumentParser(
        description="Replace occurrences of a pattern in all text files under a project directory (dry-run by default)."
    )
    ap.add_argument("--root", default=".", help="Project root directory (default: current dir)")
    ap.add_argument("--apply", action="store_true", help="Actually modify files (default: dry-run)")
    ap.add_argument("--backup", action="store_true", help="Create .bak backups before writing")
    ap.add_argument("--pattern", default="./", help='Pattern to find (default: "./")')
    ap.add_argument("--replacement", default="./", help='Replacement (default: "./")')
    ap.add_argument("--max-bytes", type=int, default=5_000_000, help="Skip files larger than this (default: 5MB)")
    ap.add_argument(
        "--exclude",
        action="append",
        default=[],
        help="Additional exclude directory/file segment (can be used multiple times)",
    )

    args = ap.parse_args()
    root = Path(args.root).resolve()

    excludes = set(DEFAULT_EXCLUDES)
    excludes.update(args.exclude)

    needle = args.pattern.encode("utf-8")
    repl = args.replacement.encode("utf-8")

    if not root.exists() or not root.is_dir():
        print(f"Root directory not found: {root}", file=sys.stderr)
        return 2

    results: list[Result] = []
    for f in iter_files(root, excludes):
        r = process_file(
            f,
            needle=needle,
            repl=repl,
            apply=args.apply,
            make_backup=args.backup,
            max_bytes=args.max_bytes,
        )
        results.append(r)

    skipped = [r for r in results if r.skipped_reason is not None]
    would_change = [r for r in results if (r.occurrences > 0 and r.skipped_reason is None)]
    changed = [r for r in results if r.changed and r.skipped_reason is None]

    if args.apply:
        print(f"APPLY mode: replaced {args.pattern!r} -> {args.replacement!r} in {len(changed)} files.")
    else:
        print(f"DRY-RUN mode: would replace {args.pattern!r} -> {args.replacement!r} in {len(would_change)} files.")

    def show(rs: list[Result], title: str, limit: int = 200):
        if not rs:
            return
        print(f"\n{title} (showing up to {limit}):")
        for r in rs[:limit]:
            rel = r.file.relative_to(root)
            extra = f"  [{r.skipped_reason}]" if r.skipped_reason else ""
            print(f"- {rel}  occurrences={r.occurrences}{extra}")
        if len(rs) > limit:
            print(f"... and {len(rs) - limit} more")

    if args.apply:
        show(changed, "Modified files")
    else:
        show(would_change, "Files that would be modified")

    show(skipped, "Skipped files")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
