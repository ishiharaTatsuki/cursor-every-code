以下、**zip全体を再レビュー → 追加修正まで反映済み**です。
差し替え用のzipも作成しました（下のリンクからダウンロードできます）。

[ダウンロード: cursor-every-code-main_patched.zip](sandbox:/mnt/data/cursor-every-code-main_patched.zip)

---

## 差し替え手順（最短）

1. いまのプロジェクトを別名でバックアップ（任意）
2. 上のzipを展開
3. 展開された `cursor-every-code-main/` の中身を、既存プロジェクトに**上書きコピー**
4. Cursor側で third-party hooks を有効化している場合は、そのまま動きます（追加の設定不要）

---

## 精密レビュー結果（今回見つかった「残りの問題」→ 修正内容）

### 1) `.claude/settings.json` の matcher 記法が Claude Code 仕様とズレていて、Cursor側で「動いているように見えて実は効いていない」状態になり得る

**問題**

* `tool == "Bash"` のような“式” matcher は Claude Code の matcher 仕様と一致しません（イベントごとに決まった matcher 文字列を使う必要があります）。([Claude Code](https://code.claude.com/docs/ja/hooks "https://code.claude.com/docs/ja/hooks"))
* その結果、**PreToolUse/PostToolUse が期待通りに発火しない**可能性がありました。

**対応（反映済み）**

* `.claude/settings.json` を **Claude Code互換の matcher** に全面整理（例: `Bash`, `Write|Edit|MultiEdit`）。([Claude Code](https://code.claude.com/docs/ja/hooks "https://code.claude.com/docs/ja/hooks"))
* 未ドキュメント/非対応になりがちな `async` などのフィールドは削除して、**安全側に倒した構成**に統一。

---

### 2) `Stop` の意味を「セッション終了」と誤認している箇所があり、フックの実効性が落ちていた

**問題**

* `Stop` は「セッション終了」ではなく、**メインエージェントが“応答を終えるたび”に呼ばれる**イベントです。([Claude Code](https://code.claude.com/docs/ja/hooks "https://code.claude.com/docs/ja/hooks"))
* 「セッション末尾で1回だけ走らせたい」系は `SessionEnd` の方が適切です。([Claude Code](https://code.claude.com/docs/ja/hooks "https://code.claude.com/docs/ja/hooks"))
* これが原因で、設計意図（例: “セッションの最後にまとめて学習評価”）とトリガーがズレていました。

**対応（反映済み）**

* ルール文書（`.cursor/rules/hooks.mdc`）を修正し、 **Stop と SessionEnd の役割を明確化** 。([Claude Code](https://code.claude.com/docs/ja/hooks "https://code.claude.com/docs/ja/hooks"))
* **学習評価は `SessionEnd`** 、軽いチェックは `Stop` に寄せる整理を実施。

---

### 3) 危険なBashコマンド対策が弱く、Cursor環境だと事故りやすい

**問題**

* リポジトリ内に危険系コマンド例（`rm -rf` など）があり、現状のフックでは**実行前に止められない**状態。

**対応（反映済み）**

* **`bash-danger-guard.js` を新設**し、以下をデフォルトでブロック:
  * `rm -rf /` や `rm --no-preserve-root`
  * `sudo`/`doas`
  * `curl|sh` / `wget|sh`
  * `mkfs`, `dd`
  * `shutdown`/`reboot`/`halt`
* どうしても必要な場合は環境変数で明示的に解除できるようにしています（例: `ECC_ALLOW_SUDO=1`）。

> 追加したファイル:
> `./.cursor/scripts/hooks/bash-danger-guard.js`

---

### 4) `suggest-compact` が **PreCompact** に入っていて、カウント設計が崩れていた

**問題**

* `suggest-compact.js` は「**PreToolUseでツール回数をカウント**して閾値で促す」設計なのに、設定上 `PreCompact` で呼ばれており、意図通りに動きませんでした。

**対応（反映済み）**

* `.claude/settings.json` で `suggest-compact.js` を  **PreToolUse側（Bash と Write/Edit）に移動** 。
* `.cursor/skills/strategic-compact/SKILL.md` も、古い記法（式 matcher）を捨てて内容を現実の実装に合わせて全面書き換え。

---

### 5) `check-console-log.js` が Hook入力JSONをそのまま出力しており、フック出力として危険

**問題**

* `echo "$input"` により、Stop hookの標準出力に**巨大な入力JSONが混入**していました。
* フックの stdout はイベントによって「制御JSON」として解釈される可能性があり、余計な出力は事故源です。([Claude Code](https://code.claude.com/docs/ja/hooks "https://code.claude.com/docs/ja/hooks"))

**対応（反映済み）**

* `check-console-log.js` を作り直し:
  * **入力JSONを一切出さない**
  * git差分（unstaged/staged/untracked）から JS/TS だけを最大N件スキャン
  * `console.log` / `debugger` を見つけたら  **警告のみ** （ブロックはしない）

---

### 6) `continuous-learning` の `evaluate-session.js` が「設定ファイルの参照パス」と「transcriptの取得方法」が壊れていた

**問題**

* config 参照が `scriptDir` 基準でズレており、実質読めていませんでした。
* transcript も env 依存になっていましたが、Hook入力JSONには `transcript_path` が渡されます。([Claude Code](https://code.claude.com/docs/ja/hooks "https://code.claude.com/docs/ja/hooks"))

**対応（反映済み）**

* `evaluate-session.js` を全面修正:
  * config を **プロジェクト直下** `./.cursor/skills/continuous-learning/config.json` から読む
  * transcript を Hook入力JSON (`transcript_path`) から取得（fallbackで env も参照）
  * 学習結果は「自動抽出」ではなく、**評価メタデータ（JSON）を `.cursor/.sessions/evaluations/` に保存**して `/learn` につなげる方式に整理
* learned skills 保存先を Cursorで扱える `./.cursor/skills/learned/` に統一（※gitignore済み）

---

### 7) `continuous-learning-v2` の observe.sh に **コードインジェクションの芽**

**問題**

* 旧 `observe.sh` が JSON を Python 文字列に埋め込む形で扱っており、**入力によっては壊れる/注入が起き得る**構造でした。

**対応（反映済み）**

* `observe.sh` を作り直し:
  * Hook入力JSONは  **stdinでPythonに渡して parse** （埋め込みを廃止）
  * ログには tool_input のうち安全なキーだけを抜粋（巨大なcontentを避ける）
* さらに `instinct-cli.py` 側も、**プロジェクト配下 `.claude/homunculus` を自動検出**するように修正
  （env `HOMUNCULUS_DIR` / `ECC_HOMUNCULUS_DIR` の明示指定も可能、見つからなければ home fallback）

---

### 8) 参照パスの不整合（`.claude/agents` / `.claude/skills` を指していて実体が `.cursor` にある）

**問題**

* コマンド/ルール/スキル文書の一部が **`.claude/...` を参照**していましたが、実体は `.cursor/...` にあり、導線が切れていました。

**対応（反映済み）**

* `.cursor/commands/*`, `.cursor/rules/*`, `.cursor/skills/*` の参照を、実体に合わせて修正。
* さらに **存在しない `tdd-workflow` スキル参照**があったため、最小のスキルを新設して参照を成立させました。

> 新規追加: `./.cursor/skills/tdd-workflow/SKILL.md`

---

### 9) CI/検証スクリプトが現状構成とズレていた

**問題**

* `validate-rules.js` が `.md` を対象にしていた（実際は `.mdc`）
* `validate-hooks.js` が存在しない `./.cursor/hooks/hooks.json` を参照していた

**対応（反映済み）**

* `validate-rules.js`: `.mdc` 前提で再実装（独自walkで再帰対応）
* `validate-hooks.js`: `./.claude/settings.json` を検証する形に変更（matcher必須イベントのみ必須扱い）

---

### 10) ルールがJS/TS前提で Pythonプロジェクトだとノイズになりやすい

**問題**

* `coding-style.mdc` / `patterns.mdc` が全ファイルに常時適用される形で、Python中心だとノイズ/矛盾が起きやすい。

**対応（反映済み）**

* JS/TSルールは `globs: **/*.{js,jsx,ts,tsx}` にスコープ
* Python用に `python-style.mdc` を新設（`ruff/pytest` 前提の現実的な内容）
* `performance.mdc` は特定モデル名を排除してツール非依存の内容に書き換え

---

## 追加で入れたもの（差し替え後に増えるファイル）

* `./.cursor/scripts/lib/hook-input.js`（Hook入力の揺れ吸収）
* `./.cursor/scripts/hooks/`
  * `bash-danger-guard.js`
  * `tmux-reminder.js`
  * `dev-server-guard.js`
  * `git-push-reminder.js`
  * `doc-file-guard.js`
  * `js-after-edit.js`
  * `gh-pr-status.js`
* `./.cursor/rules/python-style.mdc`
* `./.cursor/skills/tdd-workflow/SKILL.md`
* `./.gitignore`（ローカル状態をコミットしないため）

---

## 補足（意図的に残したもの）

* `changelog/` 配下の過去ログは、過去経緯として `.claude/...` 記述が残っている箇所があります（導線として使うものではないため、今回は大改修していません）。

---

必要なら次の段階として、**「Pythonプロジェクト用に hooks をさらに絞る（JS系を完全OFFにする）」**や、`bash-danger-guard` の許可リスト（例: `rm -rf node_modules` は許可）なども設計できますが、今回は「安全＆Cursorで破綻しない」を優先して固めています。

まずは上のzipで差し替えてください。
