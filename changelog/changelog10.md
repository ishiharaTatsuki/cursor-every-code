[ダウンロード: cursor-every-code-main_THSpatched.zip](sandbox:/mnt/data/cursor-every-code-main_THSpatched.zip)

上記zipは、あなたが選択した修正内容 **P1-1〜5 + P2-2** をすべて反映して再パッケージしたものです（既存プロジェクトへ上書き差し替えできます）。

---

## 反映内容（指定どおり）

### ✅ P1-1) Go系コマンドの参照パス統一（`.cursor/agents/...` & `.cursor/skills/...`）

対象:

* `.cursor/commands/go-build.md`
* `.cursor/commands/go-test.md`
* `.cursor/commands/go-review.md`

変更:

* `agents/...` → `.cursor/agents/...`
* `skills/...` → `.cursor/skills/...`

---

### ✅ P1-2) Python成果物（`__pycache__` / `*.pyc`）をzipから削除 + `.gitignore` 追加

実施:

* 削除:
  * `.cursor/skills/continuous-learning-v2/scripts/__pycache__/`（配下の `.pyc` 含む）
* 追加（`.gitignore`）:
  * `__pycache__/`
  * `*.pyc`

---

### ✅ P1-3) `evaluate-session.js` の userメッセージ数カウントを堅牢化

対象:

* `.cursor/scripts/hooks/evaluate-session.js`

変更:

* 旧: `/"type":"user"/g`
* 新: `/"type"\s*:\s*"user"/g`

（JSON内のスペース有無に依存しないカウントに修正）

---

### ✅ P1-4) `python-after-edit` / `python-stop-checks` の ruff未導入ノイズを抑制

対象:

* `.cursor/scripts/hooks/python-after-edit.js`
* `.cursor/scripts/hooks/python-stop-checks.js`

変更:

* 実行前に **ruff の存在を probe（runner / venv / python -m / 直接）**
* **ruff が見つからない場合は無言でスキップ** （stderr汚染しない）

※ 既存の挙動は維持しつつ、「入ってない環境で毎回エラーが出る」問題だけを止めています。

---

### ✅ P1-5) `instinct-cli.py` に `observe` サブコマンドを実装

対象:

* `.cursor/skills/continuous-learning-v2/scripts/instinct-cli.py`

追加:

* `observe` サブコマンド（stdinのJSONを受けて観測ログへ反映可能）
* **軽量デデュープ** （直前行と同一イベントなら追記しない）
  → `observe.sh` 側が先に追記していても、CLI側で重複追記しにくい設計

オプション:

* `observe --event <name>`
* `observe --file <path>`
* `observe --print`（デバッグ用途）

---

### ✅ P2-2) `.cursor/scripts/hooks/` の未参照スクリプト整理

`.claude/settings.json` から参照されていない以下を **削除**しました（ディレクトリの見通し改善）:

削除したファイル:

* `posttool-build-analysis.js`
* `posttool-console-log-warn.js`
* `posttool-pr-create-log.js`
* `posttool-prettier.js`
* `posttool-tsc.js`
* `pretool-block-dev-server.js`
* `pretool-block-doc-write.js`
* `pretool-git-push-reminder.js`
* `pretool-tmux-reminder.js`

現在の `.cursor/scripts/hooks/` は、`.claude/settings.json` で参照されているスクリプトのみ残る状態です。

---

## 変更後のセルフチェック（手元でも再現できます）

プロジェクトルートで:

```bash
node .cursor/scripts/ci/validate-agents.js
node .cursor/scripts/ci/validate-commands.js
node .cursor/scripts/ci/validate-hooks.js
node .cursor/scripts/ci/validate-rules.js
node .cursor/scripts/ci/validate-skills.js
```

---

必要なら次の段階として、「`.claude/settings.json` に実際に載っている hooks だけを一覧化した README（運用者向け）」や、「hooks の目的別フォルダ分割」まで含めた整理もできますが、今回は依頼範囲（P1/P2選択分）に限定して確実に反映しています。
