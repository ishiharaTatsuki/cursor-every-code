# /codex-request — Codex 依頼書だけ生成する

## 目的

- 指定した Task ID の Codex 依頼書（`codex_request_<TASK>.md`）を作る
- ファイルパス・雛形ミスを **スクリプトで固定化**する

---

## 実行（推奨）

```bash
python .cursor/scripts/ops.py codex-request --task-id <TASK_ID> --title "<TITLE>"
```

例:

```bash
python .cursor/scripts/ops.py codex-request --task-id WP1.6 --title "レジームラベリング検証"
```

---

## 出力先

- `records/<project>/requests/codex_request_<TASK_ID>.md`

---

## 次にやること

1) 生成された依頼書の TODO を埋める  
2) Codex CLI に投入  
3) 司令塔がローカルでテスト → 不具合があれば追依頼 → コミット
