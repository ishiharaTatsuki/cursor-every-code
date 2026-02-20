# Safe Commit Command

安全に `git commit` するための手順（Secrets/不要データ混入を防ぐ）。

## 目的

- **機密情報**（APIキー/トークン/パスワード/秘密鍵/ニーモニック/`.env` 等）をコミットしない
- **不要データ**（ティック/CSV/生成物/`reports/` 等）をコミットしない
- **意図しないファイル**をステージしない（原則「明示 add」）
- コミットメッセージを `.cursor/rules/git-workflow.mdc` の形式に揃える

## 実行フロー（この順番で）

1. **差分の把握（必須）**
   - `git status`
   - `git diff`（未ステージ）
   - `git diff --cached`（ステージ済み）
   - `git log -5 --oneline`（メッセージ流儀確認）

2. **混入ガード（必須・ブロック条件）**
   - **Secrets**:
     - `.env` / `*.env` / `.*env` / `credentials.*` / `*.pem` / `id_rsa` 等が含まれていないこと
     - 差分に `api_key`, `private_key`, `secret`, `token`, `password`, `mnemonic`, `Authorization: Bearer` 等が含まれていないこと
   - **データ/生成物**:
     - `reports/`, `data_pipeline_output*`, `logs/`, 大きなCSV/Parquet などが含まれていないこと
   - **例外**（含める必要がある場合）: 理由を明記し、コミットメッセージ本文に「なぜ必要か」を書く

3. **最小ステージング（必須）**
   - `git add` は **ファイルを明示指定**（`git add .` を避ける）
   - `git status` で “Changes to be committed” を再確認

4. **軽量検証（推奨）**
   - Python 例: `pytest -q tests/bots/test_*.py`（変更に近い範囲）
   - 失敗したら **コミットしない**。修正してから再実行。

5. **コミット**
   - メッセージ形式:
     - 1行目: `<type>: <description>`
     - 2行目以降: 変更理由/影響/検証コマンド
   - 例:
     - `feat: ...` / `fix: ...` / `docs: ...` / `test: ...`

6. **事後確認（必須）**
   - `git status` が clean
   - 直前コミット内容: `git show --stat`
   - **push は別操作**（必要時のみ）

## 出力フォーマット（推奨）

```
COMMIT READY: [YES/NO]

Staged files: X
Secrets scan: [OK/NG]
Data artifacts: [OK/NG]
Tests: [command + PASS/FAIL]

Commit message:
<type>: <desc>
```

## Arguments

$ARGUMENTS:
- `message="<type>: <desc>"`（指定が無ければ差分から提案し、ユーザーに確認してから実行）
- `scope=code|code+records`（デフォルト: code+records）
- `verify=none|quick`（デフォルト: quick）
