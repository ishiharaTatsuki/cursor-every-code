#!/usr/bin/env python3
"""
ops.py — Cursor運用（Records → Plan → Codex依頼 → 検証 → 引き継ぎ）をスクリプト化するツール。

目的:
- 毎回の「ファイルパス指定」「雛形作成」「漏れチェック」を自動化し、人的ミスを減らす。
- Cursor Commands / Skills / Agents と組み合わせて、Unit of Work を安定運用する。

依存:
- Python 標準ライブラリのみ（追加インストール不要）

使い方（例）:
  python .cursor/scripts/ops.py init --project trademaster
  python .cursor/scripts/ops.py codex-request --task WP1.6 --title "レジームラベリング検証"
  python .cursor/scripts/ops.py uow
  python .cursor/scripts/ops.py validate
  python .cursor/scripts/ops.py handover

注意:
- 既存ファイルは原則上書きしません（--force で上書き）。
"""

from __future__ import annotations

import argparse
import datetime as _dt
import json
import os
import re
import shutil
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple


DEFAULT_CONFIG: Dict[str, Any] = {
    "records_root": "records",
    "default_project": "",
    "implementation_plan_candidates": [
        "records/{project}/{project}_implementation_plan.md",
        "records/{project}/implementation_plan.md",
        "records/**/implementation_plan*.md",
    ],
    "status_candidates": [
        "records/{project}/status.md",
        "records/{project}/STATUS.md",
        "records/**/status*.md",
    ],
    "codex_requests_dirname": "requests",
    "handover_dirname": "handover",
    "decisions_dirname": "decisions",
    "date_format": "%Y-%m-%d",
    "task_id_patterns": [
        r"WP\d+(?:\.\d+)+",
        r"P\d+-T\d+(?:\.\d+)+",
        r"T\d+(?:\.\d+)+",
    ],
    "codex_request_filename_template": "codex_request_{task_id}.md",
    "codex_request_title_template": "Codex 依頼: {task_id} — {title}",
    "shell_execution_policy_default": "forbid",
    "network_access_default": "disabled",
    "sandbox_default": "workspace-write",
    "approval_policy_default": "never",
    "language": "ja",
}


@dataclass(frozen=True)
class RepoContext:
    repo_root: Path
    cursor_root: Path
    config_path: Path
    config: Dict[str, Any]


def _now_local(date_format: str) -> str:
    # タイムゾーン依存ライブラリを使わない（標準ライブラリのみ）ので、
    # OSローカルタイムをそのまま採用する。
    return _dt.datetime.now().strftime(date_format)


def _find_repo_root(start: Path) -> Path:
    """
    .cursor があるディレクトリを「リポジトリルート」とみなす。
    なければ .git、さらに無ければ start を返す。
    """
    cur = start.resolve()
    for _ in range(20):
        if (cur / ".cursor").is_dir():
            return cur
        if (cur / ".git").exists():
            return cur
        if cur.parent == cur:
            break
        cur = cur.parent
    return start.resolve()


def _load_json(path: Path) -> Optional[Dict[str, Any]]:
    try:
        if path.exists():
            return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None
    return None


def _merge_config(base: Dict[str, Any], override: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    if not override:
        return dict(base)
    merged = dict(base)
    for k, v in override.items():
        merged[k] = v
    return merged


def get_repo_context(cwd: Optional[Path] = None) -> RepoContext:
    cwd = cwd or Path.cwd()
    repo_root = _find_repo_root(cwd)
    cursor_root = repo_root / ".cursor"
    config_path = cursor_root / "scripts" / "ops_config.json"
    override = _load_json(config_path)
    config = _merge_config(DEFAULT_CONFIG, override)
    return RepoContext(repo_root=repo_root, cursor_root=cursor_root, config_path=config_path, config=config)


def _format_candidates(candidates: Iterable[str], project: str) -> List[str]:
    out: List[str] = []
    for c in candidates:
        try:
            out.append(c.format(project=project))
        except Exception:
            out.append(c)
    return out


def _expand_globs(repo_root: Path, patterns: Iterable[str]) -> List[Path]:
    results: List[Path] = []
    for pat in patterns:
        # glob は repo_root 起点
        results.extend(sorted(repo_root.glob(pat)))
    # 重複排除（順序維持）
    seen = set()
    uniq: List[Path] = []
    for p in results:
        rp = str(p.resolve())
        if rp in seen:
            continue
        seen.add(rp)
        uniq.append(p)
    return uniq


def _first_existing(paths: Iterable[Path]) -> Optional[Path]:
    for p in paths:
        if p.exists() and p.is_file():
            return p
    return None


def _detect_projects(records_root: Path) -> List[str]:
    if not records_root.exists():
        return []
    return sorted([p.name for p in records_root.iterdir() if p.is_dir() and not p.name.startswith(".")])


def _pick_project(ctx: RepoContext, arg_project: Optional[str]) -> str:
    cfg_default = str(ctx.config.get("default_project") or "").strip()
    if arg_project:
        return arg_project.strip()
    if cfg_default:
        return cfg_default
    # auto detect if only one project exists
    records_root = ctx.repo_root / str(ctx.config.get("records_root", "records"))
    projects = _detect_projects(records_root)
    if len(projects) == 1:
        return projects[0]
    # fallback
    return "project"


def _resolve_plan_and_status(ctx: RepoContext, project: str) -> Tuple[Optional[Path], Optional[Path]]:
    plan_candidates = _format_candidates(ctx.config.get("implementation_plan_candidates", []), project)
    status_candidates = _format_candidates(ctx.config.get("status_candidates", []), project)

    plan_paths = _expand_globs(ctx.repo_root, plan_candidates)
    status_paths = _expand_globs(ctx.repo_root, status_candidates)

    plan = _first_existing(plan_paths)
    status = _first_existing(status_paths)
    return plan, status


def _read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def _write_text(path: Path, content: str, force: bool = False) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists() and not force:
        raise FileExistsError(f"File exists: {path}")
    path.write_text(content, encoding="utf-8")


def _render_template(template_path: Path, **kwargs: Any) -> str:
    raw = template_path.read_text(encoding="utf-8")
    return raw.format(**kwargs)


def _safe_task_id(task_id: str) -> str:
    # ファイル名に使うため、危険文字を置換
    t = task_id.strip()
    t = re.sub(r"[^\w.\-]+", "_", t)
    return t


def _compile_task_patterns(patterns: Iterable[str]) -> List[re.Pattern]:
    out: List[re.Pattern] = []
    for p in patterns:
        try:
            out.append(re.compile(p))
        except re.error:
            continue
    return out


def _extract_next_task_from_status(status_text: str, patterns: List[re.Pattern]) -> Tuple[Optional[str], Optional[str]]:
    """
    status.md の Now/Next から次のタスクIDを推測する。
    - 最初に見つかった未チェックの行（- [ ]）を優先
    - 行から task_id を抽出し、タイトルっぽい残りを返す
    """
    lines = status_text.splitlines()
    candidate_lines: List[str] = []
    for ln in lines:
        if re.search(r"^\s*-\s*\[\s*\]\s+", ln):
            candidate_lines.append(ln)

    def pick_from_line(line: str) -> Tuple[Optional[str], Optional[str]]:
        for pat in patterns:
            m = pat.search(line)
            if m:
                task_id = m.group(0)
                # タイトル: task_id を除いた残り（記号を軽く掃除）
                title = line.replace(task_id, "")
                title = re.sub(r"^\s*-\s*\[\s*\]\s*", "", title)
                title = title.strip(" -—–:\t")
                return task_id, title or None
        return None, None

    for ln in candidate_lines:
        tid, title = pick_from_line(ln)
        if tid:
            return tid, title

    # fallback: status 全体から最初にマッチ
    for pat in patterns:
        m = pat.search(status_text)
        if m:
            return m.group(0), None

    return None, None


def cmd_init(ctx: RepoContext, args: argparse.Namespace) -> int:
    project = _pick_project(ctx, args.project)
    records_root = ctx.repo_root / str(ctx.config.get("records_root", "records"))
    proj_root = records_root / project

    # テンプレート配置
    templates_root = ctx.cursor_root / "scripts" / "templates"
    records_tpl = templates_root / "records"

    today = _now_local(str(ctx.config.get("date_format", "%Y-%m-%d")))

    if not records_tpl.exists():
        print(f"[ERR] templates not found: {records_tpl}")
        print("      このテンプレパックが壊れている可能性があります。")
        return 2

    # ディレクトリ作成
    (proj_root / str(ctx.config.get("codex_requests_dirname", "requests"))).mkdir(parents=True, exist_ok=True)
    (proj_root / str(ctx.config.get("handover_dirname", "handover"))).mkdir(parents=True, exist_ok=True)
    (proj_root / str(ctx.config.get("decisions_dirname", "decisions"))).mkdir(parents=True, exist_ok=True)

    # status.md
    status_dst = proj_root / "status.md"
    if not status_dst.exists() or args.force:
        content = _render_template(records_tpl / "status.md", project=project, today=today)
        _write_text(status_dst, content, force=args.force)
        print(f"[OK] wrote {status_dst.relative_to(ctx.repo_root)}")
    else:
        print(f"[SKIP] exists {status_dst.relative_to(ctx.repo_root)}")

    # implementation_plan.md（既存が無い場合のみ）
    plan_dst = proj_root / f"{project}_implementation_plan.md"
    if not plan_dst.exists() or args.force:
        content = _render_template(records_tpl / "implementation_plan.md", project=project, today=today)
        _write_text(plan_dst, content, force=args.force)
        print(f"[OK] wrote {plan_dst.relative_to(ctx.repo_root)}")
    else:
        print(f"[SKIP] exists {plan_dst.relative_to(ctx.repo_root)}")

    # decision template
    decision_tpl_dst = proj_root / str(ctx.config.get("decisions_dirname", "decisions")) / "_TEMPLATE_decision.md"
    if not decision_tpl_dst.exists() or args.force:
        content = _render_template(records_tpl / "decision.md", project=project, decision_id="DEC-XXXX", today=today)
        _write_text(decision_tpl_dst, content, force=args.force)
        print(f"[OK] wrote {decision_tpl_dst.relative_to(ctx.repo_root)}")
    else:
        print(f"[SKIP] exists {decision_tpl_dst.relative_to(ctx.repo_root)}")

    # handover template
    handover_tpl_dst = proj_root / str(ctx.config.get("handover_dirname", "handover")) / "_TEMPLATE_handover.md"
    if not handover_tpl_dst.exists() or args.force:
        content = _render_template(records_tpl / "handover.md", project=project, today=today)
        _write_text(handover_tpl_dst, content, force=args.force)
        print(f"[OK] wrote {handover_tpl_dst.relative_to(ctx.repo_root)}")
    else:
        print(f"[SKIP] exists {handover_tpl_dst.relative_to(ctx.repo_root)}")

    print("\nNext:")
    print("  - status.md の Now/Next を埋める")
    print("  - 実装計画を {project}_implementation_plan.md に書く（Task: WP1.1 ... の形式推奨）")
    return 0


def cmd_codex_request(ctx: RepoContext, args: argparse.Namespace) -> int:
    project = _pick_project(ctx, args.project)
    plan_path, status_path = _resolve_plan_and_status(ctx, project)

    records_root = ctx.repo_root / str(ctx.config.get("records_root", "records"))
    proj_root = records_root / project
    requests_dir = proj_root / str(ctx.config.get("codex_requests_dirname", "requests"))
    requests_dir.mkdir(parents=True, exist_ok=True)

    patterns = _compile_task_patterns(ctx.config.get("task_id_patterns", []))

    task_id = args.task_id
    title = args.title

    # task_id 未指定なら status から拾う
    if not task_id and status_path and status_path.exists():
        tid, maybe_title = _extract_next_task_from_status(_read_text(status_path), patterns)
        task_id = tid
        if not title:
            title = maybe_title

    if not task_id:
        task_id = "TASK-UNKNOWN"

    if not title:
        title = "（タイトル未設定）"

    safe_tid = _safe_task_id(task_id)
    filename_tmpl = str(ctx.config.get("codex_request_filename_template", "codex_request_{task_id}.md"))
    out_name = filename_tmpl.format(task_id=safe_tid)
    out_path = requests_dir / out_name

    date_format = str(ctx.config.get("date_format", "%Y-%m-%d"))
    today = _now_local(date_format)

    title_line = str(ctx.config.get("codex_request_title_template", "Codex 依頼: {task_id} — {title}")).format(
        task_id=task_id, title=title
    )

    # 参照パス（markdown の @path 用に repo_root 相対へ）
    rel_plan = plan_path.relative_to(ctx.repo_root).as_posix() if plan_path else f"records/{project}/{project}_implementation_plan.md"
    rel_status = status_path.relative_to(ctx.repo_root).as_posix() if status_path else f"records/{project}/status.md"

    # テンプレート
    tpl_path = ctx.cursor_root / "scripts" / "templates" / "codex_request.md"
    if not tpl_path.exists():
        print(f"[ERR] template not found: {tpl_path}")
        return 2

    content = _render_template(
        tpl_path,
        title=title_line,
        today=today,
        approval_status="未承認",
        implementation_plan_path=rel_plan,
        status_path=rel_status,
        purpose=args.purpose or "TODO: このUoWの目的を1〜3行で",
        non_goals=args.non_goals or "- TODO: やらないこと",
        repo_root=".",
        sandbox=str(ctx.config.get("sandbox_default", "workspace-write")),
        approval_policy=str(ctx.config.get("approval_policy_default", "never")),
        network_access=str(ctx.config.get("network_access_default", "disabled")),
        shell_policy="禁止" if str(ctx.config.get("shell_execution_policy_default", "forbid")) == "forbid" else "許可（必要な場合のみ）",
        editable_files=args.editable_files or "- TODO: 編集対象ファイルを列挙（相対パス）",
        reference_files=args.reference_files or f"- @{rel_plan}\n- @{rel_status}",
        tasks=args.tasks or "- TODO: 実装ステップを箇条書き",
        dod=args.dod or "- [ ] TODO: 受け入れ条件（チェックリスト）",
        tests=args.tests or "- TODO: テスト追加/更新方針（TDD推奨）",
    )

    try:
        _write_text(out_path, content, force=args.force)
    except FileExistsError:
        print(f"[SKIP] exists {out_path.relative_to(ctx.repo_root)}  (use --force to overwrite)")
        return 0

    print(f"[OK] wrote {out_path.relative_to(ctx.repo_root)}")
    print("\nHints:")
    print("  - 依頼書の TODO を埋めてから Codex CLI に渡してください。")
    print("  - 例: codex exec - < records/.../requests/codex_request_XXX.md")
    return 0


def _scan_codex_requests(requests_dir: Path) -> List[Path]:
    if not requests_dir.exists():
        return []
    return sorted([p for p in requests_dir.glob("codex_request_*.md") if p.is_file()])


def cmd_handover(ctx: RepoContext, args: argparse.Namespace) -> int:
    project = _pick_project(ctx, args.project)
    plan_path, status_path = _resolve_plan_and_status(ctx, project)

    records_root = ctx.repo_root / str(ctx.config.get("records_root", "records"))
    proj_root = records_root / project
    handover_dir = proj_root / str(ctx.config.get("handover_dirname", "handover"))
    handover_dir.mkdir(parents=True, exist_ok=True)

    date_format = str(ctx.config.get("date_format", "%Y-%m-%d"))
    today = _now_local(date_format)

    out_path = handover_dir / f"handover_{today}.md"

    tpl_path = ctx.cursor_root / "scripts" / "templates" / "records" / "handover.md"
    if not tpl_path.exists():
        print(f"[ERR] template not found: {tpl_path}")
        return 2

    content = _render_template(tpl_path, project=project, today=today)

    try:
        _write_text(out_path, content, force=args.force)
    except FileExistsError:
        print(f"[SKIP] exists {out_path.relative_to(ctx.repo_root)}  (use --force to overwrite)")
        return 0

    print(f"[OK] wrote {out_path.relative_to(ctx.repo_root)}")

    # 参照情報も出す
    if plan_path:
        print(f"  plan   : {plan_path.relative_to(ctx.repo_root)}")
    if status_path:
        print(f"  status : {status_path.relative_to(ctx.repo_root)}")
    return 0


def cmd_validate(ctx: RepoContext, args: argparse.Namespace) -> int:
    project = _pick_project(ctx, args.project)
    plan_path, status_path = _resolve_plan_and_status(ctx, project)

    records_root = ctx.repo_root / str(ctx.config.get("records_root", "records"))
    proj_root = records_root / project
    requests_dir = proj_root / str(ctx.config.get("codex_requests_dirname", "requests"))

    problems: List[str] = []
    warnings: List[str] = []

    if not plan_path:
        problems.append("実装計画が見つかりません（config の candidates を確認）")
    if not status_path:
        problems.append("status.md が見つかりません（config の candidates を確認）")

    # requests
    reqs = _scan_codex_requests(requests_dir)
    if not reqs:
        warnings.append("Codex依頼書（codex_request_*.md）がまだありません")

    # status TODO 検知
    if status_path and status_path.exists():
        st = _read_text(status_path)
        if "TODO" in st:
            warnings.append("status.md に TODO が残っています（運用開始前に埋める推奨）")

    # plan TODO 検知
    if plan_path and plan_path.exists():
        pl = _read_text(plan_path)
        if "TODO" in pl:
            warnings.append("実装計画に TODO が残っています（必要に応じて）")

    # request TODO 検知（最新3件だけ）
    for rp in reqs[-3:]:
        txt = _read_text(rp)
        if "TODO" in txt or "（タイトル未設定）" in txt or "TASK-UNKNOWN" in txt:
            warnings.append(f"{rp.relative_to(ctx.repo_root)} に未埋めのプレースホルダが残っています")

    # 出力
    if problems:
        print("[FAIL] problems:")
        for p in problems:
            print(f"  - {p}")
    if warnings:
        print("[WARN] warnings:")
        for w in warnings:
            print(f"  - {w}")
    if not problems and not warnings:
        print("[OK] records looks consistent")

    return 1 if problems else 0


def cmd_uow(ctx: RepoContext, args: argparse.Namespace) -> int:
    """
    Unit of Work の最短導線:
    - 次のタスクを status から推測
    - Codex依頼書を生成
    - handover を生成
    - validate を軽く走らせる
    """
    # codex request
    rc1 = cmd_codex_request(ctx, args)
    if rc1 != 0:
        return rc1

    # handover
    rc2 = cmd_handover(ctx, args)
    if rc2 != 0:
        return rc2

    # validate
    _ = cmd_validate(ctx, args)

    print("\nNext:")
    print("  1) 生成された codex_request_*.md の TODO を埋める")
    print("  2) Codex CLI に依頼（例: codex exec - < records/.../requests/codex_request_XXX.md）")
    print("  3) 司令塔がローカルでテスト実行 → 修正依頼 → コミット")
    return 0


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="ops.py", description="Cursor運用テンプレ用の補助スクリプト")
    sub = p.add_subparsers(dest="cmd", required=True)

    def add_common(sp: argparse.ArgumentParser) -> None:
        sp.add_argument("--project", help="records 配下のプロジェクト名（省略時は自動/設定）")
        sp.add_argument("--force", action="store_true", help="既存ファイルを上書き")

    # init
    sp_init = sub.add_parser("init", help="records テンプレを作成（初期化）")
    add_common(sp_init)

    # codex-request
    sp_req = sub.add_parser("codex-request", help="Codex依頼書を生成")
    add_common(sp_req)
    sp_req.add_argument("--task-id", dest="task_id", help="Task ID（例: WP1.6）")
    sp_req.add_argument("--title", help="タスクタイトル（短く）")
    sp_req.add_argument("--purpose", help="目的（任意）")
    sp_req.add_argument("--non-goals", dest="non_goals", help="非目的（任意）")
    sp_req.add_argument("--editable-files", dest="editable_files", help="編集対象ファイル（箇条書き文字列）")
    sp_req.add_argument("--reference-files", dest="reference_files", help="参照ファイル（箇条書き文字列）")
    sp_req.add_argument("--tasks", help="実装タスク（箇条書き文字列）")
    sp_req.add_argument("--dod", help="DoD（チェックリスト文字列）")
    sp_req.add_argument("--tests", help="テスト方針（箇条書き文字列）")

    # validate
    sp_val = sub.add_parser("validate", help="records の整合性チェック")
    add_common(sp_val)

    # handover
    sp_ho = sub.add_parser("handover", help="handover テンプレを生成")
    add_common(sp_ho)

    # uow
    sp_uow = sub.add_parser("uow", help="UoW: 依頼書+handover+validate をまとめて実行")
    add_common(sp_uow)
    sp_uow.add_argument("--task-id", dest="task_id", help="Task ID（省略時は status から推測）")
    sp_uow.add_argument("--title", help="タスクタイトル（省略時は status から推測）")
    sp_uow.add_argument("--purpose", help="目的（任意）")
    sp_uow.add_argument("--non-goals", dest="non_goals", help="非目的（任意）")
    sp_uow.add_argument("--editable-files", dest="editable_files", help="編集対象ファイル（箇条書き文字列）")
    sp_uow.add_argument("--reference-files", dest="reference_files", help="参照ファイル（箇条書き文字列）")
    sp_uow.add_argument("--tasks", help="実装タスク（箇条書き文字列）")
    sp_uow.add_argument("--dod", help="DoD（チェックリスト文字列）")
    sp_uow.add_argument("--tests", help="テスト方針（箇条書き文字列）")

    return p


def main() -> int:
    ctx = get_repo_context()
    parser = build_parser()
    args = parser.parse_args()

    if args.cmd == "init":
        return cmd_init(ctx, args)
    if args.cmd == "codex-request":
        return cmd_codex_request(ctx, args)
    if args.cmd == "validate":
        return cmd_validate(ctx, args)
    if args.cmd == "handover":
        return cmd_handover(ctx, args)
    if args.cmd == "uow":
        return cmd_uow(ctx, args)

    print(f"[ERR] unknown cmd: {args.cmd}")
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
