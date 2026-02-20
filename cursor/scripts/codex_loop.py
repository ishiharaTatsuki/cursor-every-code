#!/usr/bin/env python3
"""
codex_loop.py (v2)
- Implement via `codex exec`
- Verify via repo-recommended commands (tooling detector)
- Iterate to reach tests pass + coverage threshold
- Stop early if "blocked / cannot execute" failure repeats too many times
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Optional, Tuple, Dict, List


# -------------------------
# Utilities
# -------------------------

ANSI_RE = re.compile(r"\x1b\[[0-9;]*m")


def strip_ansi(s: str) -> str:
    return ANSI_RE.sub("", s or "")


def tail(s: str, n: int = 4000) -> str:
    s = s or ""
    return s[-n:]


def run_shell(cmd: str, cwd: Path, *, timeout: int = 1800) -> "CmdResult":
    """Run a shell command; never raises FileNotFoundError (converted to exit=127)."""
    try:
        p = subprocess.run(
            cmd,
            cwd=str(cwd),
            shell=True,
            text=True,
            capture_output=True,
            timeout=timeout,
        )
        return CmdResult(p.returncode, p.stdout, p.stderr)
    except subprocess.TimeoutExpired as e:
        return CmdResult(124, e.stdout or "", (e.stderr or "") + "\nTIMEOUT")
    except Exception as e:
        return CmdResult(1, "", f"EXCEPTION: {e}")


def run_args(
    args: List[str],
    cwd: Path,
    *,
    input_text: Optional[str] = None,
    timeout: int = 3600,
) -> "CmdResult":
    """Run a command by args; converts FileNotFoundError to exit=127."""
    try:
        p = subprocess.run(
            args,
            cwd=str(cwd),
            input=input_text,
            text=True,
            capture_output=True,
            timeout=timeout,
        )
        return CmdResult(p.returncode, p.stdout, p.stderr)
    except FileNotFoundError as e:
        return CmdResult(127, "", f"COMMAND NOT FOUND: {e}")
    except subprocess.TimeoutExpired as e:
        return CmdResult(124, e.stdout or "", (e.stderr or "") + "\nTIMEOUT")
    except Exception as e:
        return CmdResult(1, "", f"EXCEPTION: {e}")


def sha1(s: str) -> str:
    return hashlib.sha1((s or "").encode("utf-8")).hexdigest()


def ensure_git_repo(root: Path) -> None:
    r = run_shell("git rev-parse --is-inside-work-tree", root, timeout=30)
    if r.code != 0 or "true" not in (r.stdout or "").strip():
        raise SystemExit("ERROR: Not inside a git repository. Run from repo root.")


def git_worktree_fingerprint(root: Path) -> str:
    """
    Fingerprint current worktree state vs HEAD:
    - tracked diff (git diff)
    - status porcelain (includes untracked)
    Used to detect 'Codex ran but made no net change' stuck cases.
    """
    d = run_shell("git diff --no-color", root, timeout=30).stdout
    s = run_shell("git status --porcelain", root, timeout=30).stdout
    return sha1((d or "") + "\n---\n" + (s or ""))


def load_tooling(root: Path) -> dict:
    # Uses existing tooling detector in this repo
    r = run_shell("node .cursor/scripts/recommend-commands.js --json", root, timeout=60)
    if r.code != 0:
        raise SystemExit(f"ERROR: tooling detection failed.\nSTDERR:\n{r.stderr}")
    try:
        return json.loads(r.stdout)
    except json.JSONDecodeError:
        raise SystemExit(
            f"ERROR: tooling detector did not return JSON.\nSTDOUT:\n{r.stdout}"
        )


def parse_pytest_cov_percent(output: str) -> Optional[float]:
    """
    Parse pytest-cov terminal summary like:
    TOTAL  123  45  63%
    """
    out = strip_ansi(output or "")
    m = re.search(r"^TOTAL\s+\d+\s+\d+\s+(\d+(?:\.\d+)?)%\s*$", out, re.MULTILINE)
    if not m:
        m = re.search(r"\bTOTAL\b.*\b(\d+(?:\.\d+)?)%\b", out)
    if not m:
        return None
    try:
        return float(m.group(1))
    except ValueError:
        return None


# -------------------------
# Failure classification
# -------------------------


@dataclass
class CmdResult:
    code: int
    stdout: str
    stderr: str


@dataclass
class Failure:
    kind: str  # "codex" | "verify"
    category: str  # classified reason
    signature: str  # stable fingerprint string
    cmd: str  # command (verify) or "codex exec"
    exit_code: int
    coverage: Optional[float]
    stdout_tail: str
    stderr_tail: str


BLOCKED_CATEGORIES = {
    # environment / permissions / inability to execute
    "ENV_COMMAND_NOT_FOUND",
    "ENV_MISSING_NODE",
    "ENV_MISSING_CODEX",
    "ENV_MISSING_TEST_TOOL",
    "ENV_MISSING_PYTEST_COV",
    "PERMISSION_DENIED",
    "SANDBOX_DENIED",
    "APPROVAL_REQUIRED",
    "NO_TEST_COMMAND",
    "VERIFY_TIMEOUT",
    "CODEX_TIMEOUT",
    "NO_NET_CHANGE",
}


def extract_key_lines(text: str) -> str:
    """
    Pull a few lines likely to contain the core error, to make signatures stable.
    """
    t = strip_ansi(text or "")
    lines = [ln.strip() for ln in t.splitlines() if ln.strip()]
    keywords = (
        "permission",
        "denied",
        "not allowed",
        "approval",
        "sandbox",
        "command not found",
        "no module named",
        "unknown option",
        "error",
        "traceback",
        "refused",
        "forbidden",
        "unauthorized",
        "eacces",
        "eprem",
    )
    picked = []
    for ln in lines:
        low = ln.lower()
        if any(k in low for k in keywords):
            picked.append(ln)
        if len(picked) >= 8:
            break
    if not picked:
        picked = lines[:4]
    return "\n".join(picked)


def fingerprint_failure(kind: str, category: str, exit_code: int, key_text: str) -> str:
    base = f"{kind}|{category}|{exit_code}|{key_text}"
    return sha1(base)


def classify_codex(
    root: Path, r: CmdResult, before_fp: str, after_fp: str
) -> Tuple[str, str]:
    """
    Returns (category, key_text).
    """
    out = strip_ansi((r.stdout or "") + "\n" + (r.stderr or ""))
    low = out.lower()

    if r.code == 127 and "command not found" in low:
        return "ENV_MISSING_CODEX", extract_key_lines(out)
    if r.code == 124 or "timeout" in low:
        return "CODEX_TIMEOUT", extract_key_lines(out)
    if after_fp == before_fp:
        # Codex ran but produced no net change in worktree.
        # Often due to permissions/approval/sandbox restrictions.
        return "NO_NET_CHANGE", extract_key_lines(
            out
        ) or "No net changes after codex exec"

    if "approval" in low and ("required" in low or "needs" in low):
        return "APPROVAL_REQUIRED", extract_key_lines(out)
    if "sandbox" in low and ("denied" in low or "not allowed" in low):
        return "SANDBOX_DENIED", extract_key_lines(out)
    if (
        "permission denied" in low
        or "eacces" in low
        or "operation not permitted" in low
    ):
        return "PERMISSION_DENIED", extract_key_lines(out)

    # If codex exit is non-zero but not obviously blocked, still categorize as generic.
    if r.code != 0:
        return "CODEX_ERROR", extract_key_lines(out)

    return "OK", ""


def classify_verify(
    cmd: str, r: CmdResult, coverage: Optional[float]
) -> Tuple[str, str]:
    out = strip_ansi((r.stdout or "") + "\n" + (r.stderr or ""))
    low = out.lower()

    if r.code == 124 or "timeout" in low:
        return "VERIFY_TIMEOUT", extract_key_lines(out)

    # shell: 127 often means command not found
    if r.code == 127 or "command not found" in low:
        # Distinguish missing node/pytest/etc if possible
        if "node" in low:
            return "ENV_MISSING_NODE", extract_key_lines(out)
        return "ENV_MISSING_TEST_TOOL", extract_key_lines(out)

    # pytest-cov missing: "unknown option --cov" or similar
    if "--cov" in out and ("unknown option" in low or "unrecognized arguments" in low):
        return "ENV_MISSING_PYTEST_COV", extract_key_lines(out)

    # coverage parse failed while cmd *claims* to be coverage
    if coverage is None and ("--cov" in cmd or "coverage" in cmd.lower()):
        # Not always blocked, but often indicates tooling mismatch
        return "ENV_MISSING_PYTEST_COV", extract_key_lines(out)

    # normal failing tests
    if r.code != 0:
        return "TEST_FAILURE", extract_key_lines(out)

    # tests pass but coverage may be low (not blocked)
    return "OK", ""


def build_stop_report(
    *,
    reason: str,
    failure: Failure,
    repeats: int,
    max_repeats: int,
    logs_dir: Path,
    suggestions: List[str],
) -> str:
    cov_line = f"{failure.coverage:.1f}%" if failure.coverage is not None else "N/A"
    sug = (
        "\n".join(f"- {s}" for s in suggestions)
        if suggestions
        else "- (no suggestions)"
    )
    return f"""# codex-loop STOP REPORT

## Stop reason
- {reason}
- repeated: {repeats} / {max_repeats}
- failure fingerprint: `{failure.signature}`

## Failure summary
- kind: {failure.kind}
- category: {failure.category}
- cmd: {failure.cmd}
- exit_code: {failure.exit_code}
- coverage: {cov_line}

## Key logs (tail)
### STDOUT

{failure.stdout_tail}


### STDERR

{failure.stderr_tail}


## Suggestions
{sug}

## Logs directory
- {logs_dir.as_posix()}
"""


def suggestions_for_category(category: str) -> List[str]:
    # Keep concrete + operational.
    m = {
        "ENV_MISSING_CODEX": [
            "`codex` が見つかりません。Codex CLI をインストールし PATH を通してください。",
            "まず `codex --help` が通ることを確認してください。",
        ],
        "APPROVAL_REQUIRED": [
            "承認が必要なポリシーになっている可能性があります。",
            "`--ask-for-approval on-request` にして対話的に承認するか、運用方針に合わせてポリシーを変更してください。",
        ],
        "SANDBOX_DENIED": [
            "sandbox が書き込み/実行を拒否しています。",
            "`--sandbox workspace-write` など、必要最小限で許可される sandbox に調整してください。",
        ],
        "PERMISSION_DENIED": [
            "ファイル/ディレクトリ権限で拒否されています。",
            "対象パスの権限・所有者・read-only 属性を確認してください。",
        ],
        "ENV_MISSING_TEST_TOOL": [
            "検証コマンドが実行できません（依存不足/コマンド不在）。",
            "tooling が推奨するテストコマンドを手動で1回実行し、必要な依存を入れてください。",
        ],
        "ENV_MISSING_PYTEST_COV": [
            "`--cov` が認識されないため pytest-cov が無い/設定不整合の可能性があります。",
            "pytest-cov を導入するか、coverage計測コマンドをプロジェクトに合わせて変更してください。",
        ],
        "NO_TEST_COMMAND": [
            "テストコマンドを特定できませんでした。",
            "`.cursor/scripts/lib/tooling.js` かプロジェクトの設定に tests / coverage コマンドを定義してください。",
        ],
        "VERIFY_TIMEOUT": [
            "検証がタイムアウトしています。テストがハングしていないか、対象範囲が大きすぎないか確認してください。",
            "必要なら `--verify-timeout` のような設定を追加してください（拡張案）。",
        ],
        "CODEX_TIMEOUT": [
            "codex exec がタイムアウトしています。タスク分割（UoW縮小）を検討してください。",
        ],
        "NO_NET_CHANGE": [
            "codex exec を実行しても差分が変わりません（実質ノーオペ）。",
            "承認/権限/ポリシーで書き込みが止まっている可能性が高いです。sandbox と approval 設定を確認してください。",
        ],
    }
    return m.get(category, [])


# -------------------------
# Codex prompt building
# -------------------------


def read_request_text(request_path: Path) -> str:
    if not request_path.exists():
        raise SystemExit(f"ERROR: request file not found: {request_path}")
    return request_path.read_text(encoding="utf-8")


def build_followup_prompt(
    request_path: Path,
    cycle: int,
    verify_cmd: str,
    test_stdout: str,
    test_stderr: str,
    coverage: Optional[float],
    min_coverage: float,
) -> str:
    cov_line = (
        f"Coverage: {coverage:.1f}% (target >= {min_coverage:.1f}%)"
        if coverage is not None
        else f"Coverage: (could not parse; target >= {min_coverage:.1f}%)"
    )
    return f"""You are continuing an implementation defined by:
- REQUEST: {request_path.as_posix()}

We attempted implementation. Verification failed in cycle {cycle}.

Verification command:
{verify_cmd}

Result:
- {cov_line}

Please:
1) Read the REQUEST file and follow its constraints (no scope expansion).
2) Fix failing tests and/or add tests to reach coverage target.
3) Keep changes minimal.
4) STOP (outer loop reruns verification).

Failure logs (tail):
--- STDOUT ---
{tail(test_stdout)}
--- STDERR ---
{tail(test_stderr)}
"""


def codex_exec(
    root: Path,
    prompt: str,
    *,
    sandbox: str,
    ask_for_approval: str,
    output_last_message: Path,
    timeout: int = 3600,
) -> CmdResult:
    output_last_message.parent.mkdir(parents=True, exist_ok=True)
    args = [
        "codex",
        "exec",
        "--sandbox",
        sandbox,
        "--ask-for-approval",
        ask_for_approval,
        "-o",
        str(output_last_message),
        "-",
    ]
    return run_args(args, root, input_text=prompt, timeout=timeout)


# -------------------------
# Main loop
# -------------------------


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--request", required=True, help="Path to codex_request_*.md")
    ap.add_argument("--min-coverage", type=float, default=80.0)

    # NEW: separate caps
    ap.add_argument(
        "--max-quality-cycles",
        type=int,
        default=25,
        help="Max cycles for test/coverage improvement",
    )
    ap.add_argument(
        "--max-blocked-repeats",
        type=int,
        default=5,
        help="Stop if same blocked failure repeats N times",
    )
    ap.add_argument(
        "--repeat-guard-scope",
        choices=["blocked", "all"],
        default="blocked",
        help="Count repeats for blocked failures only (default) or for all failures",
    )

    ap.add_argument("--sandbox", default="workspace-write", help="codex exec --sandbox")
    ap.add_argument(
        "--ask-for-approval", default="never", help="codex exec --ask-for-approval"
    )
    ap.add_argument("--root", default=".", help="Repo root (default: .)")
    args = ap.parse_args()

    root = Path(args.root).resolve()
    request_path = Path(args.request).resolve()

    ensure_git_repo(root)

    tooling = load_tooling(root)
    py_cmds = (tooling.get("python", {}) or {}).get("commands", {}) or {}
    node_cmds = (tooling.get("node", {}) or {}).get("commands", {}) or {}

    # Choose verify command
    verify_cmd = py_cmds.get("testsCoverage") or py_cmds.get("tests")
    if not verify_cmd:
        # Node-only fallback (best effort)
        if node_cmds.get("test"):
            verify_cmd = node_cmds["test"]
        else:
            verify_cmd = ""

    logs_dir = root / ".cursor" / ".hook_state" / "codex_loop"
    logs_dir.mkdir(parents=True, exist_ok=True)

    base_request_text = read_request_text(request_path)

    # Counts for repeated failures (fingerprint -> count)
    repeat_counts: Dict[str, int] = {}

    last_followup_prompt = ""
    for cycle in range(1, args.max_quality_cycles + 1):
        print(f"\n=== Cycle {cycle}/{args.max_quality_cycles} ===", flush=True)

        # --- Codex exec
        before_fp = git_worktree_fingerprint(root)
        out_msg = logs_dir / f"cycle_{cycle:02d}_codex_last_message.md"
        prompt = base_request_text if cycle == 1 else last_followup_prompt

        print("-> codex exec", flush=True)
        cr = codex_exec(
            root,
            prompt,
            sandbox=args.sandbox,
            ask_for_approval=args.ask_for_approval,
            output_last_message=out_msg,
        )
        after_fp = git_worktree_fingerprint(root)

        (logs_dir / f"cycle_{cycle:02d}_codex_stdout.txt").write_text(
            cr.stdout, encoding="utf-8"
        )
        (logs_dir / f"cycle_{cycle:02d}_codex_stderr.txt").write_text(
            cr.stderr, encoding="utf-8"
        )

        codex_category, codex_key = classify_codex(root, cr, before_fp, after_fp)

        # If codex itself is blocked, apply repeat guard immediately (this matches your intent)
        if codex_category in BLOCKED_CATEGORIES or (
            args.repeat_guard_scope == "all" and codex_category != "OK"
        ):
            sig = fingerprint_failure("codex", codex_category, cr.code, codex_key)
            repeat_counts[sig] = repeat_counts.get(sig, 0) + 1

            if (
                codex_category in BLOCKED_CATEGORIES
                and repeat_counts[sig] >= args.max_blocked_repeats
            ):
                failure = Failure(
                    kind="codex",
                    category=codex_category,
                    signature=sig,
                    cmd="codex exec",
                    exit_code=cr.code,
                    coverage=None,
                    stdout_tail=tail(cr.stdout),
                    stderr_tail=tail(cr.stderr),
                )
                report = build_stop_report(
                    reason="REPEATED_BLOCKED_FAILURE",
                    failure=failure,
                    repeats=repeat_counts[sig],
                    max_repeats=args.max_blocked_repeats,
                    logs_dir=logs_dir,
                    suggestions=suggestions_for_category(codex_category),
                )
                (logs_dir / "final_report.md").write_text(report, encoding="utf-8")
                print(report)
                return

        # --- Verify
        if not verify_cmd.strip():
            # No test command found -> treat as blocked
            cat = "NO_TEST_COMMAND"
            key = "No verify command available"
            sig = fingerprint_failure("verify", cat, 0, key)
            repeat_counts[sig] = repeat_counts.get(sig, 0) + 1

            failure = Failure(
                kind="verify",
                category=cat,
                signature=sig,
                cmd="(none)",
                exit_code=0,
                coverage=None,
                stdout_tail="",
                stderr_tail="",
            )

            report = build_stop_report(
                reason="BLOCKED_NO_VERIFY_COMMAND",
                failure=failure,
                repeats=repeat_counts[sig],
                max_repeats=args.max_blocked_repeats,
                logs_dir=logs_dir,
                suggestions=suggestions_for_category(cat),
            )
            (logs_dir / "final_report.md").write_text(report, encoding="utf-8")
            print(report)
            return

        print(f"-> verify: {verify_cmd}", flush=True)
        vr = run_shell(verify_cmd, root, timeout=1800)
        (logs_dir / f"cycle_{cycle:02d}_verify_stdout.txt").write_text(
            vr.stdout, encoding="utf-8"
        )
        (logs_dir / f"cycle_{cycle:02d}_verify_stderr.txt").write_text(
            vr.stderr, encoding="utf-8"
        )

        cov = parse_pytest_cov_percent(vr.stdout + "\n" + vr.stderr)
        ok_cov = (cov is not None) and (cov >= args.min_coverage)
        ok_tests = vr.code == 0

        if ok_tests and ok_cov:
            print(
                f"\n✅ SUCCESS: tests pass and coverage {cov:.1f}% >= {args.min_coverage:.1f}%"
            )
            print(f"Logs: {logs_dir}")
            return

        verify_category, verify_key = classify_verify(verify_cmd, vr, cov)

        # Repeat guard applies to blocked verify failures
        is_blocked_verify = verify_category in BLOCKED_CATEGORIES
        if is_blocked_verify or (
            args.repeat_guard_scope == "all" and verify_category != "OK"
        ):
            sig = fingerprint_failure("verify", verify_category, vr.code, verify_key)
            repeat_counts[sig] = repeat_counts.get(sig, 0) + 1

            if is_blocked_verify and repeat_counts[sig] >= args.max_blocked_repeats:
                failure = Failure(
                    kind="verify",
                    category=verify_category,
                    signature=sig,
                    cmd=verify_cmd,
                    exit_code=vr.code,
                    coverage=cov,
                    stdout_tail=tail(vr.stdout),
                    stderr_tail=tail(vr.stderr),
                )
                report = build_stop_report(
                    reason="REPEATED_BLOCKED_FAILURE",
                    failure=failure,
                    repeats=repeat_counts[sig],
                    max_repeats=args.max_blocked_repeats,
                    logs_dir=logs_dir,
                    suggestions=suggestions_for_category(verify_category),
                )
                (logs_dir / "final_report.md").write_text(report, encoding="utf-8")
                print(report)
                return

        # Non-blocked failures proceed as normal improvement loop
        reason_parts = []
        if not ok_tests:
            reason_parts.append(f"tests failed (exit={vr.code})")
        if cov is None:
            reason_parts.append("coverage unknown (could not parse)")
        elif not ok_cov:
            reason_parts.append(f"coverage {cov:.1f}% < {args.min_coverage:.1f}%")
        print(f"\n❌ VERIFICATION FAILED: {', '.join(reason_parts)}")

        last_followup_prompt = build_followup_prompt(
            request_path=request_path,
            cycle=cycle,
            verify_cmd=verify_cmd,
            test_stdout=vr.stdout,
            test_stderr=vr.stderr,
            coverage=cov,
            min_coverage=args.min_coverage,
        )

    # Quality cycles exhausted
    failure = Failure(
        kind="verify",
        category="MAX_QUALITY_CYCLES_REACHED",
        signature=sha1("MAX_QUALITY_CYCLES_REACHED"),
        cmd=verify_cmd,
        exit_code=0,
        coverage=None,
        stdout_tail="",
        stderr_tail="",
    )
    report = build_stop_report(
        reason="MAX_QUALITY_CYCLES_REACHED",
        failure=failure,
        repeats=args.max_quality_cycles,
        max_repeats=args.max_quality_cycles,
        logs_dir=logs_dir,
        suggestions=[
            "UoW を小さく分割する（依頼書を分割）",
            "Coverage の対象範囲が広すぎる場合は対象を明確化する（DoD を調整）",
            "失敗テストが複数カテゴリに跨るなら、優先順位を付けて段階的に直す",
        ],
    )
    (logs_dir / "final_report.md").write_text(report, encoding="utf-8")
    print(report)


if __name__ == "__main__":
    main()
