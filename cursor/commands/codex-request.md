# /codex-request — Codex 依頼書の生成と実装実行

## 目的

- 指定した Task ID の Codex 依頼書（`codex_request_<TASK>.md`）を作る
- ファイルパス・雛形ミスを **スクリプトで固定化**する

---

## 1. 依頼書を生成

```bash
python .cursor/scripts/ops.py codex-request --task-id <TASK_ID> --title "<TITLE>"
# または
python .cursor/scripts/ops.py uow
```

## 2. 依頼書の TODO を埋める（必須）

- 目的 / 非目的、対象ファイル、DoD、テスト方針、制約
- 監査（任意）: `@request-auditor`

## 3. 実装〜検証を実行（自動ループ推奨）

```bash
python .cursor/scripts/codex_loop.py \
  --request records/<project>/image/codex_request/codex_request_<TASK_ID>.md \
  --min-coverage 80 --max-quality-cycles 25 --max-blocked-repeats 5
```

- 1回だけ: `codex exec - < records/<project>/image/codex_request/codex_request_<TASK>.md`

---

## 出力先

- `records/<project>/image/codex_request/codex_request_<TASK_ID>.md`
