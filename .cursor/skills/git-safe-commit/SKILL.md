---
name: git-safe-commit
description: 安全なステージングとコミット手順（Secrets/不要データ混入ガード、最小ステージング、軽量検証）を提供する。
---

# Git Safe Commit Skill

このスキルは「**安全にコミットする**」ための固定手順を提供します。  
目的は **Secrets 混入の防止** と **不要データ（ティック/生成物）の混入防止** です。

## When to Use

- ユーザーから「コミットして」と依頼されたとき
- 大きめの変更の区切りで、PR前に粒度の良いコミットを作りたいとき
- `records/` 更新が多く、コミット範囲を間違えやすいとき

## Hard Rules（ブロック条件）

- `.env`, `*.env`, `.*env`, `credentials.*`, `*.pem`, `id_rsa` など **Secrets の可能性が高いファイルはコミットしない**
- `reports/`, `data_pipeline_output*`, 大きなCSV/Parquet 等の **データ/生成物はコミットしない**
- 差分中に Secrets っぽい値（`api_key`, `private_key`, `secret`, `token`, `password`, `mnemonic` など）が見つかったら **そこで止めて除外/マスク/移動**

## Workflow（推奨手順）

### 1) 変更把握（必須）

- `git status`
- `git diff`（未ステージ）
- `git diff --cached`（ステージ済み）
- `git log -5 --oneline`（メッセージ流儀）

### 2) 変更ファイルの分類（必須）

- **コード**: `bots/`, `tests/`, `scripts/` など
- **ドキュメント/records**: `docs/`, `records/` など
- **出力/データ**: `reports/`, `data_pipeline_output*`, `logs/` など → 原則除外

### 3) Secrets スキャン（必須）

最低限、以下の観点でチェック（該当があればコミットしない）:

- **ファイル名**: `.env`, `*env*`, `*secret*`, `*key*`, `credentials*`
- **差分内容**:
  - `api_key`, `private_key`, `secret`, `token`, `password`, `mnemonic`
  - `Authorization: Bearer`
  - `BEGIN PRIVATE KEY`

### 4) 明示ステージング（必須）

`git add .` を避け、**コミットしたいファイルだけ**を `git add <file>` で追加します。  
最後に `git status` で “Changes to be committed” を必ず確認します。

### 5) 軽量検証（推奨）

最小の自信が得られる範囲だけ実行します。

- Python 例:
  - `pytest -q tests/bots/test_fetch_funding_data.py`
  - 可能なら `pytest -q tests/bots -p no:ethpm`

### 6) コミット（必須）

`.cursor/rules/git-workflow.mdc` の形式に従う:

```
<type>: <description>

<optional body>
```

Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `ci`

本文には次を残すと安全:
- 何を変えたか（Why）
- どのコマンドで検証したか（How to verify）

### 7) 事後確認（必須）

- `git status` が clean
- `git show --stat` で想定ファイルだけ入っている
- push は **別途ユーザー指示があるときだけ**

## Integration

- 事前に `/code-review` を回すと、Secrets/品質観点の漏れが減ります
- 事前に `/verify pre-commit` を回すと、最低限の品質ゲートを通せます
