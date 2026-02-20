# /uow — 次の Unit of Work を切って Codex 依頼書を作る（SSOT: records）

あなたは「司令塔」です。以下を **漏れなく** 実行してください。

## 0. まず確認（SSOT）

1) `@records/<project>/handover/` で引継ぎを確認
2) 1) で特定出来なかったら `@records/` を確認し、進捗と「次の1件」を特定  
3) 迷ったら実装計画（implementation plan）へ戻る  
4) **1回のUoWは小さく**（テスト追加→実装→自己レビュー→受け入れ確認まで完結）

---

## 1. UoWを確定

- status の `Now` が空なら、`Next` から **1つだけ**選んで `Now` に置く
- そのタスクを **Task ID**（例: `WP1.6`）として扱う

---

## 2. Codex依頼書を生成（ミス防止）

可能ならスクリプトで生成（推奨）:

```bash
python .cursor/scripts/ops.py uow
```

- 生成物:
  - `records/<project>/image/codex_request/codex_request_<TASK>.md`
  - `records/<project>/handover/handover_<YYYY-MM-DD>.md`（引き継ぎの種）

---

## 3. 依頼書の TODO を埋める（必須）

`codex_request_*.md` の以下を必ず埋める:

- 目的 / 非目的
- 対象ファイル（編集OK/参照）
- 実装タスク
- DoD（チェックリスト）
- テスト方針（TDD推奨）
- 制約（シェル禁止、依存追加禁止など）

---

## 4. Codex CLI に依頼（自動ループ推奨）

> 依頼書を渡し、実装〜テスト〜修正を coverage 80% まで自動で回す。

```bash
python .cursor/scripts/codex_loop.py \
  --request records/<project>/image/codex_request/codex_request_<TASK>.md \
  --min-coverage 80 --max-quality-cycles 25 --max-blocked-repeats 5
```

- 1回だけ実行する場合: `codex exec - < records/<project>/image/codex_request/codex_request_<TASK>.md`

---

## 5. records を更新

- `status.md` の Now/Next/Blocked/Done を更新
- 意思決定が発生したら `records/<project>/decisions/` に残す
- 別スレッド移行が近ければ `handover_*.md` も更新

---

## 完了条件（このコマンドのDoD）

- [ ] 次のUoWが明確（status Now が1件）
- [ ] codex_request_*.md が生成され、TODO が埋まっている
- [ ] records に必要な更新（status/decisions/handover）が反映されている
