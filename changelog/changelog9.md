了解です。いま貼り替え済みの **cursor-every-code-main.zip** をベースに、指定の選択（full運用 / docは実装寄せ）＋「次のアクション」反映まで入れて修正しました。

修正版はこちらから差し替え用にダウンロードできます：

[ダウンロード: cursor-every-code-main_full_default_patched.zip](sandbox:/mnt/data/cursor-every-code-main_full_default_patched.zip)

---

## 反映した修正（ご指定どおり）

### ✅ P0-2：skills 重複 → **full運用**に修正

* デフォルトを **full** として成立する状態に整理しました。
  * `./.cursor/skills/`：**全スキル有効（22個）**
  * `./.cursor/skills-optional/`：**空（gitkeepのみ）**
* これで「同名スキルの二重配置」は解消され、`apply-skill-pack` の切替が正しく動作します。

### ✅ P1-2：ドキュメントと実装の齟齬 → **実装に寄せて doc を修正**

以下を「実際の挙動」に合わせて修正しました（コード側は“仕様変更”せず、説明を実態に合わせる方針）：

* `./.cursor/skills/continuous-learning/SKILL.md`
  * **自動で learned skill を生成する**と誤読される表現を削除
  * 実態どおり「SessionEndでメタデータ保存＋`/learn`促し」に変更
  * `config.json` のうち **実際に使っているキー（min_session_length / learned_skills_path）**を明示
* `./.cursor/skills/strategic-compact/SKILL.md`
  * **cooldown 等の記述を削除**し、`suggest-compact.js` の実挙動（threshold到達＋以降25回ごと）に合わせて修正
* `./.cursor/rules/hooks.mdc`
  * `suggest-compact` の説明から **cooldown** を除去し、実際どおり “threshold + interval” に修正
* `./.cursor/skills/continuous-learning-v2/SKILL.md`
  * v1 の観測トリガーを **Stop** としている箇所を、現構成（SessionEndでの評価）に合わせて修正
  * “Stop hookがv2にfeedする”系の誤解表現を、実態どおり独立扱いに修正
  * manual installの例は **$CLAUDE_PROJECT_DIR** 参照に寄せました（方針維持）

---

## 「次のアクション」から反映したもの（必要分だけ）

### ✅ P0-1：apply-skill-pack.js が実行不能 → 修正

* `./.cursor/scripts/apply-skill-pack.js` 先頭の不正文字（`\`）を除去し、**Nodeで正常実行**できる状態にしました。
* ついでに **skills/ と skills-optional/ の二重配置を検出したらエラー終了**するガードを追加（再発防止）。

### ✅ P1-1：gitignore 強化

* `.gitignore` に以下を追加して、セッション生成物が混入しないようにしました。
  * `.cursor/.sessions/`
  * `.cursor/skills/learned/`

### ✅ README に full デフォルトの導線を追加

* ルート `README.md` に「スキルパック（fullがデフォルト）」の案内と切替コマンドを追記しました。

---

## ご指定により「変更しなかった」もの

* ✅ `.claude/settings.json` の command が `$CLAUDE_PROJECT_DIR` 前提
  → **維持**しています（変更していません）。
* ✅ `changelog` の多重ネスト
  →  **触っていません** （ユーザー側で修正とのことなので除外）。

---

## 動作確認（こちらで実施済み）

* `node .cursor/scripts/apply-skill-pack.js --list` ✅
* `node .cursor/scripts/apply-skill-pack.js --pack python-node-minimal --dry-run` ✅（disable対象が17件と想定どおり）
* `node .cursor/scripts/ci/validate-*.js` 一式 ✅（agents/commands/rules/skills/hooks）

---

必要なら次に、**「full運用時にノイズになりやすいスキル群（例：Spring/Java/Go系）を rules 側の globs/alwaysApply 設計で抑える」**みたいな“fullのまま快適にする”調整も入れられます。
