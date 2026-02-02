# この zip（cursor-every-code）で得られるもの

この zip は、`affaan-m/everything-claude-code` を **Cursor のプロジェクト構造（.cursor/）で運用できる形**に寄せた「 **AI開発チーム運用テンプレート** 」です。コード本体というより、

* **ルール（規約・方針）**
* **スラッシュコマンド（再利用ワークフロー）**
* **スキル（手順＋知識パッケージ）**
* **サブエージェント（役割分担）**
* **hooks（ガードレール＆自動チェック）**

を同梱して、Cursor 上の Agent 開発を **“プロセス化”** するのが主目的です。ベースの発想は upstream の everything-claude-code です。 ([GitHub](https://github.com/affaan-m/everything-claude-code?utm_source=chatgpt.com "affaan-m/everything-claude-code"))

---

# 用語の定義（まずここを押さえる）

## Rules（.cursor/rules/*.mdc）

* **常時/条件付きで Agent に渡る「規約・方針」** （例：Pythonコーディング規約、テスト方針、セキュリティ方針）
* Cursor は `.md` と `.mdc` を扱え、`.mdc` は frontmatter（description / globs / alwaysApply）で適用条件を制御できます。 ([Cursor](https://cursor.com/docs/context/rules?utm_source=chatgpt.com "Rules | Cursor Docs"))

## Commands（.cursor/commands/*.md）

* チャットで `/` を打つと出てくる **“定型ワークフロー呼び出し”**
* Cursor は `/` メニューでコマンドを自動検出して挿入できる仕様です。 ([Cursor](https://cursor.com/docs/context/commands?utm_source=chatgpt.com "Commands | Cursor Docs"))

## Skills（.cursor/skills/*/SKILL.md）

* **「知識＋手順＋（必要なら）コマンド」を束ねたスキルパッケージ**
* Cursor 2.4 以降の説明だと、Skills は `SKILL.md` で定義され、**rules（常時適用）より “動的な文脈発見/手順” に向く**とされています。 ([Cursor](https://cursor.com/changelog/2-4 "Subagents, Skills, and Image Generation · Cursor"))

## Subagents（.cursor/agents/*.md）

* **役割特化のサブエージェント定義** （planner / reviewer / architect 等）
* Cursor 2.4 の説明では、サブエージェントは並列実行でき、独自コンテキストで動作し、カスタムプロンプトやツール権限などを持てます。 ([Cursor](https://cursor.com/changelog/2-4 "Subagents, Skills, and Image Generation · Cursor"))

## Hooks（.claude/settings.json ＋ .cursor/scripts/hooks/*）

* Claude Code 互換の hook 形式（イベント駆動でスクリプト実行）
* Claude Code の hooks は **SessionStart/PreToolUse/PostToolUse/Stop/PreCompact/SessionEnd** などのタイミングで発火し、stdin の JSON を読み、exit code や stdout JSON で制御できます。 ([Claude Code](https://code.claude.com/docs/en/hooks "Hooks reference - Claude Code Docs"))
* 特に **exit code 2** は「止める（ブロック）」の合図で、`PreToolUse` はツール呼び出し自体をブロックできます。 ([Claude Code](https://code.claude.com/docs/en/hooks "Hooks reference - Claude Code Docs"))

---

# ディレクトリ構成（zip 内の“設計図”）

プロジェクト直下に置く前提で、コアはこの2つです。

* `.cursor/` … Cursor の文脈注入・運用の本体
* `.claude/settings.json` … 「Claude Code 互換 hooks」を Cursor 側で読ませるための設定

主要サブツリー：

* `.cursor/rules/` … 常時/条件付きルール（Python規約、テスト、hooks運用ルール等）
* `.cursor/commands/` … `/plan` `/tdd` `/verify` `/learn` などのコマンド
* `.cursor/skills/` … スキル本体（SKILL.md）
* `.cursor/skills-optional/` … 無効化退避用
* `.cursor/skill-packs/*.json` … “どのスキルを有効化するか” のパック定義
* `.cursor/agents/` … サブエージェント定義
* `.cursor/scripts/hooks/` … hook の実装（Nodeスクリプト、依存なし）
* `.cursor/scripts/ci/` … 定義ファイル検証（validate-*）
* `.gitignore` … `.cursor/.hook_state/` `.cursor/.sessions/` など生成物を除外

---

# 導入手順（プロジェクトで確実に動かす）

## 1) まず「コピーするもの」を決める

基本は **プロジェクト直下に** 次を配置します。

* `.cursor/`（丸ごと）
* `.claude/settings.json`
* `.gitignore` の該当行（既存 .gitignore にマージ）

> changelog/ 配下の Python スクリプト群は「移植・同期用の作業ログ/ユーティリティ」なので、通常運用では不要です（README でも削除推奨）。

## 2) Cursor 側で “Third-party hooks（Claude Code互換）” を有効化

このテンプレは `.claude/settings.json` を Cursor に読ませて hooks を動かす設計です。
Cursor Docs の Third Party Hooks では、**設定で Third-party を有効化すること、settings.json が valid JSON であること、再起動**などがトラブルシュートに挙がっています。 ([Cursor](https://cursor.com/docs/agent/third-party-hooks?utm_source=chatgpt.com "Third Party Hooks | Cursor Docs"))

## 3) Node.js を入れる（必須）

hooks の実体が Node スクリプトなので、**node が PATH にある**ことが前提です。

## 4) Python プロジェクトなら（推奨）

このテンプレの Python 自動チェックは「あるなら回す、なければ黙ってスキップ」設計です。最大限活かすなら：

* `ruff`（format + lint）
* `pytest`（テスト）
* `mypy`（型チェック：使うなら）

を導入しておくと hooks が効きます。

---

# “Rules / Commands / Skills / Subagents / Hooks” の使い分け（運用設計）

同じ「AIに指示」でも役割が違います。ここを混ぜると破綻しやすいです。

* **Rules** ：不変の方針（規約・安全・品質ゲート）。短く、常時効かせる。
* **Commands** ：人が意図して呼ぶ手順（/plan → /tdd → /verify）。
* **Skills** ：状況に応じて使う “手順の塊”（例：TDDの回し方、検証ループ、検索パターン）。
* **Subagents** ：並列化・役割分担（設計レビュー、セキュリティレビュー等）。
* **Hooks** ：人が忘れる前提の「自動ガード」＆「自動チェック」（危険コマンド遮断、format、セッションメモ等）。

Cursor 2.4 の説明でも、Skills は rules より手順・動的コンテキスト向き、Subagents は並列・分業向き、という整理です。 ([Cursor](https://cursor.com/changelog/2-4 "Subagents, Skills, and Image Generation · Cursor"))

---

# Hooks の精密解説（この zip の“自動化の心臓部”）

このテンプレは `.claude/settings.json` に hook を宣言し、実体を `.cursor/scripts/hooks/*.js` に置いています。

## Hook イベントの意味（重要）

Claude Code hooks の定義に沿うと：

* **PreToolUse** ：ツール実行前（ブロック可能）
* **PostToolUse** ：ツール実行後（整形・軽いチェック向き）
* **Stop** ：エージェントが1回応答を終えるたび
* **SessionStart / SessionEnd** ：セッション開始/終了
* **PreCompact** ：コンテキスト圧縮直前

…のように「いつ走るか」が厳密に決まっています。 ([Claude Code](https://code.claude.com/docs/en/hooks "Hooks reference - Claude Code Docs"))

また、**exit code 2 は“ブロック”**です。`PreToolUse` ならツール呼び出しを止められます。 ([Claude Code](https://code.claude.com/docs/en/hooks "Hooks reference - Claude Code Docs"))

---

## PreToolUse（Bash）— “事故防止レイヤ”

### bash-danger-guard.js（デフォルトでブロック）

* `rm -rf /`、`curl|sh`、`sudo`、`dd`、`mkfs`、`shutdown` 系などを高確度で遮断
* “止める”実装は exit code 2 相当の挙動で成立します（Claude Code hooks の仕様）。 ([Claude Code](https://code.claude.com/docs/en/hooks "Hooks reference - Claude Code Docs"))

主な解除/調整（環境変数）：

* `ECC_DISABLE_BASH_GUARD=1`
* `ECC_ALLOW_SUDO=1`
* `ECC_ALLOW_CURL_PIPE_SHELL=1`（非推奨）
* `ECC_ALLOW_DISK_TOOLS=1`
* `ECC_ALLOW_POWER_COMMANDS=1`

### tmux-reminder.js（WARN）

* 長時間系コマンド（pip install / pytest / ruff 等）を検知して tmux/screen 推奨
* 15分スロットリング（`.cursor/.hook_state/` に状態）

### dev-server-guard.js（WARN、設定でBLOCK）

* `uvicorn` / `flask run` / `python -m http.server` / `npm run dev` 等を検知
* `ECC_REQUIRE_TMUX_FOR_DEV_SERVER=1` なら tmux/screen なしをブロック

### git-push-reminder.js（WARN、設定でBLOCK）

* `git push` の注意喚起
* `ECC_BLOCK_FORCE_PUSH=1` なら force push ブロック

### suggest-compact.js（WARN）

* ツール呼び出し回数を数えて `/compact` を提案
* Claude Code hooks でも PreCompact があり、圧縮前後の取り扱いが仕様化されています。 ([Claude Code](https://code.claude.com/docs/en/hooks "Hooks reference - Claude Code Docs"))

---

## PreToolUse（Write/Edit/MultiEdit）— “文書破壊/コンテキスト肥大化”対策

### doc-file-guard.js（デフォルトOFF）

* `.md/.txt` への書き込みを検知して warn/block
* `ECC_DOC_GUARD=off|warn|block` で制御

---

## PostToolUse（Write/Edit/MultiEdit）— “保存後の自動整形・軽量チェック”

### python-after-edit.js（ベストエフォート）

* `.py/.pyi` を編集した直後に
  * `ruff format <files>`
  * `ruff check <files>`（`ECC_RUFF_FIX=1` なら `--fix`）
* **ruff が無いなら黙ってスキップ** （ノイズ低減）

ポイント（Python運用で効く所）：

* セッション中に触った Python ファイルが `.cursor/.hook_state/py_changed_files.json` に蓄積され、後述の SessionEnd でまとめてチェックできます（“編集時は軽く、終了時に重く”の設計）。

### js-after-edit.js（Python中心なら多くは不要）

* Prettier を「存在すれば」実行
* `tsc --noEmit` は opt-in（`ECC_JS_TSC_ON_SAVE=1`）

---

## Stop（応答ごと）

### check-console-log.js（WARN）

* 変更された JS/TS から `console.log` / `debugger` を検知して警告
* Python中心なら影響は限定的（ただしフロント同居なら効く）

---

## SessionStart / SessionEnd（継続学習＆まとめ処理）

### session-start.js

* 直近セッションメモの存在を知らせる
* パッケージマネージャ検出結果を表示

### session-end.js

* `.cursor/.sessions/*-session.tmp` にセッションメモを更新

### evaluate-session.js

* transcript を見て「/learn 候補」を判定し、評価メタデータを保存

### python-stop-checks.js（Python運用の最重要）

* セッション中に触った Python ファイル群に対して、可能な範囲で
  * ruff（format/check）
  * mypy（あれば）
  * pytest（あれば）
    を実行

調整用 env：

* `ECC_PY_RUNNER="uv run" | "poetry run" | ...`（実行ランナー上書き）
* `ECC_SKIP_RUFF=1`
* `ECC_SKIP_MYPY=1`
* `ECC_SKIP_PYTEST=1`
* `ECC_PYTEST_ARGS="..."`

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

## 2) “推奨コマンド”を自動生成してチーム標準にする

このテンプレには **tooling 検出スクリプト**があり、Python/Node の推奨コマンドを出せます。

```bash
node .cursor/scripts/recommend-commands.js --write
```

* `.cursor/.hook_state/tooling.json` にスナップショット保存
* `/tooling` コマンドも用意されています（このスクリプトを走らせる運用）。

> ここを最初に固めると、/verify やレビュー時の「何のコマンド回す？」がブレなくなります。

## 3) Skill Pack を Python 向けに絞る（ノイズ除去）

デフォルトは full（全スキル有効）ですが、Python中心なら最初は絞った方が安定します。

```bash
node .cursor/scripts/apply-skill-pack.js --list
node .cursor/scripts/apply-skill-pack.js --pack python-node-minimal
```

これで `.cursor/skills/` と `.cursor/skills-optional/` の間をディレクトリ移動して、**有効スキルを切り替え**ます。

---

# 典型ワークフロー（Python開発での具体例）

## 例：FastAPI のエンドポイント追加（事故らず速く回す）

1. **/plan**
   * 仕様確認 → 変更点 → テスト方針 → 影響範囲、を先に出させる
2. **/tdd** （または tdd-workflow skill）

* pytest で RED → GREEN → REFACTOR

1. 実装中：Write/Edit が走るたびに **python-after-edit が ruff を当てる**
2. セッション終わりに **python-stop-checks がまとめて pytest/mypy を試行**
3. **/code-review** （code-reviewer subagent）

* diff ベースでレビュー

1. **/verify**
   * “PR前の総合チェック”として使う（必要なら Python 用に verify.md を軽く改造すると良い）

---

# まず最初にやるべき「プロジェクト適応」3点（精度が一気に上がる）

## A. /verify を Python 実態に合わせる

現状の `verify.md` は “Build/Type/Lint/Test” を汎用に並べています。Python現場では、

* Build：パッケージングがあるなら `python -m build`、無いなら省略
* Types：`mypy .`（採用してなければスキップ）
* Lint/Format：`ruff format .` → `ruff check .`
* Tests：`pytest`（必要なら `-q --maxfail=1` など）

に合わせるとブレません。

## B. ルール（.cursor/rules/）に「プロジェクト固有」を1枚足す

例：`./.cursor/rules/project.mdc` を追加して

* ディレクトリ構造（src 配下の責務）
* 例外設計（独自例外 vs ValueError 等）
* ログ方針（structlog 等）
* テスト分類（unit/integration）
* DB/外部I/Oのモック指針

を短く書く。ここが薄いと、AIが毎回 “普通のPython” を前提に動いてズレます。

## C. hooks の “ブロック系”はチーム方針を決めて env で固定

たとえば CI や本番運用の都合で

* force push は絶対禁止 → `ECC_BLOCK_FORCE_PUSH=1`
* dev server は tmux 必須 → `ECC_REQUIRE_TMUX_FOR_DEV_SERVER=1`

のように “事故りやすい所” を最初から固めるのが効果的です。

---

# 生成物・状態ファイルの扱い（地味に重要）

Claude Code settings のスコープには「ユーザー/プロジェクト/ローカル」があり、チーム共有する設定と個人用を分けられます。 ([Claude Code](https://code.claude.com/docs/en/settings "Claude Code settings - Claude Code Docs"))

このテンプレは `.gitignore` で次を除外しています（＝チーム共有しない設計）：

* `.cursor/.hook_state/`（変更ファイル記録など）
* `.cursor/.sessions/`（セッションメモ/評価）
* `.cursor/skills/learned/`（/learn の成果物置き場）
* `.venv`、`__pycache__/` 等

もし **learned スキルをチームで共有したい**なら、`.gitignore` から外す判断もあり得ます。ただし *機密（障害ログ、鍵、内部URL等）が混入しやすい* ので運用ルールが必要です。

---

# 検証・保守（壊れにくくする）

このテンプレには定義検証が入っています。導入直後と、カスタムした後に回すと安全です。

```bash
node .cursor/scripts/ci/validate-agents.js
node .cursor/scripts/ci/validate-commands.js
node .cursor/scripts/ci/validate-hooks.js
node .cursor/scripts/ci/validate-rules.js
node .cursor/scripts/ci/validate-skills.js
```

---

# トラブルシューティング（発生頻度が高い順）

## hooks が動かない

* Cursor 側の Third-party hooks（Claude Code互換）が有効か
* `.claude/settings.json` が valid JSON か
* `node` が PATH にあるか
  （Cursor Docs 側のチェック項目としても類似の指摘があります） ([Cursor](https://cursor.com/docs/agent/third-party-hooks?utm_source=chatgpt.com "Third Party Hooks | Cursor Docs"))

## Python 自動チェックが走らない

* `ruff/pytest/mypy` がその環境で実行できるか（venvの有効化漏れが多い）
* `ECC_SKIP_*` を設定していないか
* 必要なら `ECC_PY_RUNNER` で強制（例：`ECC_PY_RUNNER="uv run"`）

## `/` で Commands が出ない

* `.cursor/commands/` がプロジェクト内にあるか
* Cursor 再起動（キャッシュの可能性）

---

# まとめ：この zip を “使いこなす” 最短ルート

1. **Third-party hooks を有効化**し、Node を入れる（ここで hooks が生きる） ([Cursor](https://cursor.com/docs/agent/third-party-hooks?utm_source=chatgpt.com "Third Party Hooks | Cursor Docs"))
2. Python の実行基盤（uv/poetry 等）を確定し、**ruff/pytest/mypy** を整える
3. `python-node-minimal` pack に絞って運用開始（ノイズを減らす）
4. `/verify` と「プロジェクト固有ルール」を Python 実態に合わせて1回だけ調整
5. あとは **/plan → /tdd → /code-review → /verify** を儀式化して回す

---

必要なら、あなたの  **実プロジェクトの構成** （FastAPI/CLI/バッチ、uv/poetry、src レイアウト、テスト構成）に合わせて、

* `/verify` を Python専用に最適化
* `.cursor/rules/project.mdc` の雛形作成
* 使わない skills/agents の整理（skill-pack 再設計）
  まで「このテンプレの思想を崩さずに」具体案を出せます。
