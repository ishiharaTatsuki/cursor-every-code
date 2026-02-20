# {title}

**作成日**: {today}  
**司令塔承認**: {approval_status}

---

## 背景 / 参照（SSOT）

- 実装計画: @{implementation_plan_path}
- ステータス: @{status_path}

---

## 依頼（Unit of Work）

### 目的

{purpose}

### 非目的（やらないこと）

{non_goals}

### 制約（厳守）

- **作業ディレクトリ**: {repo_root}（相対パスで指定）
- **Sandbox**: {sandbox}
- **Approval Policy**: {approval_policy}
- **Network**: {network_access}
- **シェルコマンド実行**: {shell_policy}
  - `pytest / python -m / pip / npm / make` 等は **実行しない**（必要なら「提案」だけ）
- **依存関係**: 新規追加しない（必要があれば理由を添えて相談）
- **既存仕様の破壊禁止**: 既存の入出力・型・挙動を変える場合は明示して相談
- **セキュリティ**: 機密情報を出力しない。危険な操作は提案止まり。

---

## 対象範囲（編集してよい/読むだけ）

### 追加・編集してよいファイル

{editable_files}

### 読むべきファイル（参照）

{reference_files}

---

## 実装タスク

{tasks}

---

## DoD（受け入れ条件）

{dod}

---

## テスト方針（TDD 推奨）

{tests}

---

## レビュー観点

- 変更差分の自己レビュー（命名、責務、例外、境界値）
- セキュリティレビュー（入力検証、パス操作、シリアライズ、ログ）
- 既存挙動の回帰がないこと

---

## 完了時の出力

- 変更ファイル一覧
- 追加したテスト一覧
- DoD の各項目に対する達成状況
- 追加で必要な作業（あれば）
