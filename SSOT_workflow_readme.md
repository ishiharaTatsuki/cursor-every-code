以下、「**実装計画 plan.md まで完成している**」前提で、いま作った `.cursor` の **skills / agents / commands / scripts** を **いつ・どの順で使うか**を、実運用に耐える粒度で整理します。
（例として、あなたのWP1.6依頼書の構造も織り込みます。 ）

---

## 0. 前提：plan.md が完成した＝“実装フェーズ入口”の合図

plan.md が出来た時点で、司令塔としては次の状態に入ります。

* **計画（plan.md）をSSOTとして固定**
* **実装はUoW（Unit of Work）単位**に分割して **Codex依頼書（契約書MD）** を作る
* **依頼書→実装→テスト→検収→コミット** のループを高速で回す

この“入口”に入った直後から、skills/commands を使い始めるのがベストタイミングです。

---

## 1. まず最初に1回だけやること（プロジェクト初期化）

### 1-1. Skillsが使えるか確認（Cursor環境）

Cursorの **Agent Skills は Nightly チャネル限定**の旨が公式ブログに書かれています。
もしあなたの環境で skills が効かない場合は、**commands + scripts + agents** だけで運用できます（ワークフローは同じ）。 ([Cursor][1])

### 1-2. records の雛形とSSOTの置き場を作る

* 目的：**status / decisions / requests / handover** の場所を先に確定して、迷子をゼロにする

推奨手順（scripts併用）

```bash
python .cursor/scripts/ops.py init --project <project>
```

> ※ これで `records/<project>/status.md` と `records/<project>/decisions/decision_log.md` を最低限作ります。

---

## 2. plan.md 完成後の「標準ワークフロー」（毎回これ）

ここが質問の本体：**いつ何を叩くか**です。

### A. セッション開始（5分で状況復元するフェーズ）

**使うもの：`records-validator`（skill） or `/validate-records`（command） + ops-commander（agent）**

1. **records整合性チェック**（迷子防止）

```bash
python .cursor/scripts/ops.py validate --project <project>
```

* plan が見つからない
* status のNowが空
* Nowにあるタスクの依頼書が無い
  …などを早期に炙ります。

2. **司令塔に状態をロード**

* サブエージェントは `.cursor/agents/*.md` のYAML frontmatterで定義します。 ([Cursor][2])
* 使い方は、エージェントに「ops-commanderに委譲して」と指示する運用が安定です（Cursorの委譲型を想定）。

**ここでやること（ops-commanderの仕事）**

* `records/<project>/status.md` を読む
* plan.md を読む（対象フェーズ/タスク）
* decision_log を確認（曖昧点が残っていたら止める）

---

### B. 次のUoWを選ぶ（このセッションで終わらせる最小単位）

**使うもの：`records-orchestrator`（skill） or `/uow`（command）**

UoWにする基準（鉄板）

* 変更ファイル 1〜5（多くても7）
* テストを必ず追加できる
* 依頼書に **Goal / I/O / DoD / Decisions** が書ける
* 1往復でレビューできるサイズ

この時点で「次にやるTask ID」だけ確定すればOKです。
（あなたのWP1.6なら **P1 / 1.6** がこのTask ID相当です。 ）

---

### C. Codex依頼書を生成する（“ファイル指定ミス”を潰す核心）

**使うもの：`codex-request-gen`（skill） or `/codex-request`（commanファイルを指示するのが面倒・ミスが起きる」を潰すポイントです。
**依頼書の生成を機械化**し、あなたは “決定” と “品質” に集中します。

```bash
python .cursor/scripts/ops.py uow --project <project> --task <TASK-ID>
```

`uow` がやること（最低限）

* `records/<project>/requests/codex_request_<TASK-ID>.md` を生成
* status.md の Now にタスクを追加（簡易）
* validate をもう一度回す

---

### D. 依頼書の品質監査（ここをケチると手戻りで減速する）

**使うもの：`request-auditor`（agent）**

Codex依頼書は「契約書」なので、委任前に必ず監査します。
WP1.6の依頼書にも、目的、入力形式、出力形式、仕様、テスト、制約、検証コマンドが揃っていて良い例です。

監査で必ず潰す項目（Stop条件）

* **仕様分岐が残っている**（例：「window不足はAまたはB」）
  → ADRにして **どちらかに固定**してか
* 検証コマンドが具体でない（pytest対象が曖昧）
* 探索範囲が広い（どこまで触っていいか不明）

---ェーズ）
**使うもの：依頼書MD（成果物）**

ここは Cursor機能というより運用ですが、あなたのフローで一番重要な“ゲート”です。

Codexに必ず要求すること（あなたの依頼書にも含まれている思想）

* TDD（RED→GREEN→REFACTOR）
* 自己コードレビュー
* セキュリティレビュー（入力検証、NaN/空DF、例外メッセージ等）

---

### F. 返ってきた成果を検収（ここで品質が確定する）

**使うもの：ops-commander（agent） + `/validate-records`**

1. 依頼書に書いたテストを実行ら `pytest -q tests/market_gan_adapters/test_perp_regime_labeler.py` が明記されています。

2. 失敗したら分岐

* **実装バグ**：ログを貼って差分再依頼
* **仕様不足**：decision_logにADR追記 → 依頼書更新 → 再依頼
* **テスト不足**：テストケース追加をUoWとし（最低限）
* status.md：Nowのチェック、Changelog追記、Next更新
* decision_log：今回固定した仕様があればADR追記

---

### G. コミット（完了の証跡）

**使うもの：運用ルール**

* コミットメッセージに Task ID を入れる（検索性が爆上がり）

---

### H. セッション終了 / スレッド移動（引き継ぎ）

**使うもの：`/handover`（command） or scripts**

```bash
python .cursor/scripts/ops.py handover --project <project>
```

* Now/Next/Blocked
* 重要な決定（ADR番号）
* 失敗ログ（貼れる範囲）
* 次にやること（1〜3個）

ここまで残っていると、モデルやスレッドが変わっても減速しません。

---

## 3. いつ「skills」を使うべきか（タイミング早見表）

> Commandsは `.cursor/commands` に置いたMarkdownを `/` で呼び出せるのが基本です。 ([Cursor][3])
> Subagentsは `.cursor/agents/*.md` にYAML frontmatterで定義します。 ([Cursor][2])
> Skillsは `.cursor/skills/<skill>/SKILL.md` 形式が一般的に紹介されています。 ([Zenn][4])

| タイミング             | 使うもの                                      | 目的                  |
| ----------------- | ----------------------------------------- | ------------------- |
| plan.md完成直後（実装入口） | `records-orchestrator` / `/uow`           | UoW分解→依頼書生成の定常運用に入る |
| セッション開始           | `records-validator` / `/validate-records` | 迷子防止（SSOT健全性）       |
| Codex委任直前         | `codex-request-gen` + `request-auditor`   | 依頼書の穴・仕様分岐をゼロにする    |
| Codex成果が返った直後     | `ops-commander` + `/validate-records`     | 検収、手戻り分類、次指示        |
| コミット前             | `/validate-records`                       | 抜け漏れ検出              |
| スレッド移行/文脈が薄い      | `/handover`                               | 完璧な引き継ぎ             |

---

## 4. WP1.6（あなたの依頼書）の流れに当てはめると

* plan.md（`records/trademaster/trademaster_implementation_plan.md`）に **Phase1 Task1.6** がある
* `/uow` → `codex_request_P1-T1.6.md`（または WP1.6）を生成
* 依頼書に以下を固定（WP1.6の内容をそのまま契約化）

  * 新規ファイル：`Market-GAN-main/adapters/perp_regime_labeler.py`
  * テスト：`tests/market_gan_adapters/test_perp_regime_labeler.py`
  * 制約：シェル禁止、依存追加禁止、探索範囲限定
* `request-audiを ADR で固定してから委任（ここが手戻りの芽）
* Codex実装→pytest検収→status更新→コミット

---

##全体フロー（簡略）
/uow 実行時:
  1. 進捗確認 → 2. ops.py uow で依頼書生成 → 3. TODO 記入
  4. codex_loop.py で実装〜検証を coverage 80% まで自動ループ
  5. records 更新


