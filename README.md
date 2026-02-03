# cursor-every-code（Cursor 用ワークフロー・自動化テンプレート）

このリポジトリは、[everything-claude-code](https://github.com/affaan-m/everything-claude-code)を**Cursorで使用するためのツール**を管理するためのベースです。

 **Agent を「チーム運用できる形」に寄せるための設定・自動化一式**です。
Project Rules / Commands / Skills / Subagents に加え、**Claude Code 互換の hooks（`.claude/settings.json`）**を同梱し、編集・実行のガードレールや自動チェックを提供します。

> ⚠️ hooks はあなたのローカル環境で **あなたの権限**でコマンドを実行します。導入前に `.claude/settings.json` と `.cursor/scripts/hooks/` の内容を必ず確認してください。

---

## 何が入っているか

- **Project Rules**: `.cursor/rules/*.mdc`コーディング規約、セキュリティ、テスト方針、hook の運用ルールなど。
- **Commands（スラッシュコマンド）**: `.cursor/commands/*.md`チャット入力で `/` から呼び出せる、再利用可能なワークフロー集。
- **Skills**: `.cursor/skills/*/SKILL.md`Agent に渡す「知識＋手順＋スクリプト」をパッケージ化。
- **Subagents**: `.cursor/agents/*.md`役割特化のサブエージェント定義（レビュー/設計/検証など）。
- **Hooks（Claude Code 互換）**: `.claude/settings.json`PreToolUse/PostToolUse/Stop/SessionStart/SessionEnd/PreCompact で自動実行されるガード・チェック群。

* settings.jsonなどhook系はnode.jsで記述しています。Nodeをインストールしてください。

---

## 最小運用ルール
* .cursor, .claude, AGENTS.mdはプロジェクト配下に設置 (pythonの.venvなども同じ階層)
* 現在のmodelはinheritで記述。IDEなどで検索・置換でmodelを変更する。
* 重要な変更は `CHANGELOG.md` に記録（推奨）
* clone後はchangelogフォルダを削除
* 公開/共有する場合は `LICENSE` を必ず明示
* 外部コントリビューションを受ける場合は `CONTRIBUTING.md` / `CODE_OF_CONDUCT.md` / `SECURITY.md` を用意（推奨）

---



# Python プロジェクトで「使いこなす」ための実践セット

ここからが運用の肝です。**“入れただけ”**だと、Commands/Skills が TS 寄りの例を含むので、Python現場でズレます。ズレを吸収する具体策を出します。

## 1) まず toolchain を確定させる（uv/poetry/pdm/pipenv/pip）

このテンプレは Python ランナーを「リポジトリの強いシグナル」で推定します（例：`uv.lock` があれば uv、`poetry.lock` があれば poetry、など）。

**おすすめ手順：**

1. プロジェクトの採用ツールを決める（uv or poetry が多い）
2. lockfile を必ず置く（推定精度が上がる）
3. Cursor を起動する前に、その環境で `ruff/pytest/mypy` が引けるようにする
   * venv 運用なら「その venv が有効なシェルから Cursor を起動」するのが安全です

---



## 2) “推奨コマンド”を自動生成してチーム標準にする

このテンプレには **tooling 検出スクリプト**があり、Python/Node の推奨コマンドを出せます。

<pre class="overflow-visible! px-0!" data-start="6880" data-end="6942"><div class="contain-inline-size rounded-2xl corner-superellipse/1.1 relative bg-token-sidebar-surface-primary"><div class="sticky top-[calc(var(--sticky-padding-top)+9*var(--spacing))]"><div class="absolute end-0 bottom-0 flex h-9 items-center pe-2"><div class="bg-token-bg-elevated-secondary text-token-text-secondary flex items-center gap-4 rounded-sm px-2 font-sans text-xs"></div></div></div><div class="overflow-y-auto p-4" dir="ltr"><code class="whitespace-pre! language-bash"><span><span>node .cursor/scripts/recommend-commands.js --write
</span></span></code></div></div></pre>

* `.cursor/.hook_state/tooling.json` にスナップショット保存
* `/tooling` コマンドも用意されています（このスクリプトを走らせる運用）。

> ここを最初に固めると、/verify やレビュー時の「何のコマンド回す？」がブレなくなります。
>



## クイックスタート

1) このリポジトリをクローン（または **`.cursor/` と `.claude/` を自分のプロジェクトへコピー**）
2) Cursor でプロジェクトを開く
3) Cursor 側で **Third-party hooks（Claude Code互換）**を有効化
   - `.claude/settings.json` をそのまま読み込ませる想定です
4) **Node.js** をインストール（hooks の実体は Node スクリプト）
5) （任意）Python プロジェクトでは **Python / ruff / pytest / mypy** を入れると自動チェックが活きます
   - ruff が無い環境では、Python 関連 hook は **無言でスキップ**する設計です

---

## 使い方

### Commands（`/` で呼び出す）

Cursor のチャット入力で `/` を打つと、`.cursor/commands/` のコマンドが候補に出ます。

- 例: `/plan` `/code-review` `/tdd` `/verify` `/learn` など
- 実体は Markdown なので、チームで Git 管理しやすいです

> 追加・編集したい場合は `.cursor/commands/` を見てください。

---

### Skills（フル運用がデフォルト）

このリポジトリは **full（全スキル有効）**で動くように構成されています。

- 有効: `./.cursor/skills/`
- 無効（退避）: `./.cursor/skills-optional/`

切り替え:

```bash
# パック一覧
node .cursor/scripts/apply-skill-pack.js --list

# 全スキル有効（full）
node .cursor/scripts/apply-skill-pack.js --pack full

# 最小構成（ノイズ低減）
node .cursor/scripts/apply-skill-pack.js --pack python-node-minimal
```

定義ファイル: `./.cursor/skill-packs/*.json`

---

### Subagents（役割特化）

`.cursor/agents/` に定義されています。必要に応じて、レビュー/設計/検証などをサブエージェントへ切り出す用途を想定しています。

---

## Hooks（`.claude/settings.json`）でやっていること

> `.claude/settings.json` は `$CLAUDE_PROJECT_DIR` を使って、**どこから実行されてもプロジェクト内スクリプトを参照できる**形にしています。

### PreToolUse（Bash）

- `bash-danger-guard.js`明らかに危険なコマンド（例: `rm -rf /`、`curl|sh`、`sudo`、`dd` 等）を **デフォルトでブロック**
- `tmux-reminder.js`長時間になりがちなコマンドを tmux/screen で回すように **注意喚起（スロットリングあり）**
- `dev-server-guard.js``npm run dev` などの dev server を検知して **警告**（設定でブロックにも可能）
- `git-push-reminder.js``git push` を検知して注意。force push は設定で **ブロック**可能
- `suggest-compact.js`
  ツール呼び出し回数をカウントし、節目で `/compact` を提案

### PreToolUse（Write/Edit/MultiEdit）

- `doc-file-guard.js`ドキュメント（`.md/.txt`）への書き込みを検知（デフォルトOFF、warn/block 切替可能）
- `suggest-compact.js`

### PostToolUse（Write/Edit/MultiEdit）

- `python-after-edit.js``.py/.pyi` 編集後に ruff（format/check）を **ベストエフォート**で実行（ruff無ければ無言スキップ）
- `js-after-edit.js`
  JS/TS/JSON/YAML 編集後に Prettier を **ベストエフォート**で実行（tsc は opt-in）

### PostToolUse（Bash）

- `gh-pr-status.js`
  Bash 出力から GitHub PR URL を検知してヒント表示（`gh` があれば詳細取得も可）

### Stop（応答ごと）

- `check-console-log.js`
  変更された JS/TS ファイルから `console.log` / `debugger` を検知して警告（**WARNのみ**）

### SessionStart / SessionEnd

- `session-start.js`最近のセッションログやパッケージマネージャの検出結果を表示
- `session-end.js`セッションメモ（`.cursor/.sessions/*-session.tmp`）を作成・更新
- `evaluate-session.js`（continuous-learning）transcript を見て「/learn 実行候補」を判定し、評価メタデータを保存
- `python-stop-checks.js`
  そのセッションで触った Python ファイルに対して ruff/mypy/pytest を **可能な範囲で**実行

### PreCompact

- `pre-compact.js`
  コンテキスト圧縮のタイミングをログ化・セッションメモへ注記

---

## 環境変数（主なスイッチ）

> すべて任意。未設定なら「安全寄り・控えめな自動化」になります。

### 安全ガード（Bash）

- `ECC_DISABLE_BASH_GUARD=1` … bash-danger-guard を無効化
- `ECC_ALLOW_CURL_PIPE_SHELL=1` … `curl|sh` / `wget|sh` のブロックを解除（非推奨）
- `ECC_ALLOW_SUDO=1` … `sudo/doas` のブロックを解除
- `ECC_ALLOW_DISK_TOOLS=1` … `dd/mkfs` ブロック解除
- `ECC_ALLOW_POWER_COMMANDS=1` … `shutdown/reboot/halt` ブロック解除

### dev server

- `ECC_DISABLE_DEV_SERVER_GUARD=1` … dev-server-guard を無効化
- `ECC_REQUIRE_TMUX_FOR_DEV_SERVER=1` … tmux/screen なしの dev server を **ブロック**

### git push

- `ECC_DISABLE_GIT_PUSH_REMINDER=1`
- `ECC_BLOCK_FORCE_PUSH=1` … force push を **ブロック**

### docs ガード

- `ECC_DOC_GUARD=off|warn|block`（デフォルト: off）

### JS/TS after edit

- `ECC_DISABLE_JS_AFTER_EDIT=1`
- `ECC_JS_FORMAT_ON_SAVE=0` … Prettier を無効化
- `ECC_JS_TSC_ON_SAVE=1` … `tsc --noEmit` を有効化（遅い場合あり）
- `ECC_ALLOW_NPX_INSTALL=1` … npx の依存インストールを許可（デフォルトは `--no-install`）
- `ECC_JS_AFTER_EDIT_VERBOSE=1` … 失敗時の詳細ログ

### Python hooks

- `ECC_PY_RUNNER="uv run" | "poetry run" | ...` … 実行ランナーの上書き
- `ECC_SKIP_RUFF=1` / `ECC_RUFF_FIX=1`
- `ECC_SKIP_MYPY=1`
- `ECC_SKIP_PYTEST=1`
- `ECC_PYTEST_ARGS="..."`

### その他

- `ECC_DISABLE_CONSOLE_LOG_CHECK=1`
- `ECC_CONSOLE_LOG_CHECK_LIMIT=25` … Stop hook の走査上限
- `ECC_DISABLE_GH_PR_STATUS=1`
- `ECC_GH_PR_STATUS=1` … PR URL 検出時に `gh pr view` を試す（要 gh + auth）
- `COMPACT_THRESHOLD=50` … `/compact` 提案の初回閾値

---

## リポジトリ内で生成されるローカル状態（Git 管理しない）

`.gitignore` で除外済みです。

- `.cursor/.hook_state/` … hook の内部状態（変更ファイルの記録など）
- `.cursor/.sessions/` … セッションメモ/評価メタデータ
- `.cursor/skills/learned/` … `/learn` の成果物置き場（運用に応じて）
- `.claude/homunculus/` … continuous-learning-v2 のデータ領域
- `__pycache__/`, `*.pyc`, `.venv` など

---

## 開発者向け：検証スクリプト

```bash
node .cursor/scripts/ci/validate-agents.js
node .cursor/scripts/ci/validate-commands.js
node .cursor/scripts/ci/validate-hooks.js
node .cursor/scripts/ci/validate-rules.js
node .cursor/scripts/ci/validate-skills.js
```

---

## トラブルシューティング

### hooks が動かない / 何も表示されない

- Cursor 側で **Third-party hooks（Claude Code互換）**が有効になっているか確認
- `node` が PATH に入っているか確認（hooks は Node スクリプトを実行します）
- `.claude/settings.json` がプロジェクト直下にあるか確認
- `CLAUDE_PROJECT_DIR` 参照のパスが存在するか確認（例: `.cursor/scripts/hooks/`）

### Python の自動チェックが走らない

- ruff 未導入の場合は **無言スキップ**がデフォルトです（意図した設計）
- `ECC_SKIP_RUFF=1` 等の環境変数で無効化していないか確認
- `ECC_PY_RUNNER` を指定している場合は、そのランナーで ruff/pytest が実行できるか確認

### `/` で Commands が出ない

- `.cursor/commands/` がプロジェクト内にあるか確認
- Cursor を再起動して再読込（キャッシュされる場合があります）

## 参考（公式ドキュメント）

- Cursor Docs
  - Third Party Hooks: https://cursor.com/docs/agent/third-party-hooks
  - Hooks: https://cursor.com/docs/agent/hooks
  - Rules: https://cursor.com/docs/context/rules
  - Commands: https://cursor.com/docs/context/commands
  - Skills: https://cursor.com/docs/context/skills
  - Subagents: https://cursor.com/docs/context/subagents
- Claude Code Docs
  - Hooks reference: https://code.claude.com/docs/en/hooks （日本語: https://code.claude.com/docs/ja/hooks）
  - Hooks guide: https://code.claude.com/docs/en/hooks-guide （日本語: https://code.claude.com/docs/ja/hooks-guide）
  - Settings: https://code.claude.com/docs/en/settings

---

## クレジット

- ベースコンセプト: everything-claude-code（Claude Code 向けの知識・運用セット）
  - https://github.com/affaan-m/everything-claude-code

---

## License

MIT（`LICENSE` を参照）

Copyright (c) 2026 Affaan Mustafa [@affaanmustafa](https://x.com/affaanmustafa)
