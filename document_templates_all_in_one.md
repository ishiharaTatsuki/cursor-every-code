# FILE: 00_README_records_TEMPLATE.md

# Records テンプレートパック v1（恒久運用向け）

このパックは、**設計 → 計画 → 実装委任（Codex）→ 統合 → リリース** を長期運用するための「記録（records）」テンプレ群です。  
あなたの運用（MD依頼書＝契約書、司令塔が分割し Codex に委任）を前提に、**モデル間の翻訳摩擦を減らす“共通中間表現（CIR）”** と、**状態管理（status/decisions/risks）** を標準化します。

---

## 推奨ディレクトリ構成（例）

> 既存の `@records/` 配下に、そのまま取り込める構成です。  
> プロジェクトが複数ある場合は `<project>/` を切ってください。

```text
records/
  <project>/
    status.md
    charter.md
    architecture.md
    implementation_plan.md
    phase_plans/
      P1.md
      P2.md
    requests/
      codex_request_<TASK-ID>.md
    decisions/
      decision_log.md
    risks/
      risk_register.md
    test_strategy.md
    release_checklist.md
    handover/
      handover_<YYYYMMDD>.md

  _templates/   # ←このテンプレ群を置く場所（任意）
```

---

## 運用の基本原則（恒久化のための “3つのSSOT”）

- **SSOT #1: 状態（status.md）**  
  今なにをしていて、次に何をするか、ブロッカーは何か。
- **SSOT #2: 計画（implementation_plan.md / phase_plans/）**  
  タスクID・入出力・DoD・依存関係・受入テスト。  
  *“設計判断” は計画/決定ログへ。実装者が埋めない。*
- **SSOT #3: 決定（decisions/decision_log.md）**  
  揺れやすい判断（仕様の固定、閾値、例外方針、データ定義）を、後から追える形で残す。

---

## タスクID（推奨）

- **Phase/Task形式**: `P{phase}-T{major}.{minor}`（例: `P1-T1.6`）
- もしくは **WP形式**: `WP1.6`  
  どちらでも良いですが、**計画・依頼書・テスト・コミットメッセージで同じIDを使う**と、検索性が跳ね上がります。

---

## モデル間の減速を減らすためのルール（CIR）

**ロジック → 計画 → 依頼書 → 実装** で表現が変わるほど、手戻りが増えます。  
このテンプレ群では、各タスクを必ず次の “CIRフィールド” で固定することを推奨します。

- Goal（このタスクで何ができるようになるか）
- Inputs / Outputs（入出力の型・列・フォーマット・例）
- In / Out（実装範囲と非対象）
- DoD（受入基準：テスト、レビュー、セキュリティ、ドキュメント）
- Decisions（曖昧点の固定。未確定なら「質問」扱いで止める）
- Files（作成/編集するファイル一覧）
- Tests（追加/更新するテスト一覧）

---

## 使い方（最短手順）

1. `records/<project>/` を作る
2. `status.md` を起点にして、`charter.md` / `implementation_plan.md` を埋める
3. フェーズ作業に入ったら `phase_plans/P1.md` を埋める
4. Codex に委任する単位になったら `requests/codex_request_<TASK-ID>.md` を作る
5. 判断が揺れたら `decisions/decision_log.md` に追記してから進める
6. 区切りで `handover/handover_<YYYYMMDD>.md` を作り、次スレ/次モデルに引き継ぐ

---

## このパックに含まれるファイル

- `00_README_records_TEMPLATE.md`
- `01_Project_Charter_TEMPLATE.md`
- `02_Architecture_Overview_TEMPLATE.md`
- `03_Implementation_Plan_TEMPLATE.md`
- `04_Phase_Plan_TEMPLATE.md`
- `05_Codex_Request_TEMPLATE.md`
- `06_Status_Board_TEMPLATE.md`
- `07_Decision_Log_ADR_TEMPLATE.md`
- `08_Risk_Register_TEMPLATE.md`
- `09_Test_Strategy_TEMPLATE.md`
- `10_Security_Review_TEMPLATE.md`
- `11_Release_Checklist_TEMPLATE.md`
- `12_Handover_TEMPLATE.md`
- `13_Commander_Operating_Manual_TEMPLATE.md`
- `14_Model_Handoff_Rules_TEMPLATE.md`


---

# FILE: 01_Project_Charter_TEMPLATE.md

---
project: "<PROJECT_NAME>"
created: "<YYYY-MM-DD>"
updated: "<YYYY-MM-DD>"
owner: "<OWNER>"
repo_root: "<ABS_OR_REL_PATH_TO_REPO_ROOT>"
---

# プロジェクト憲章（Project Charter）

## 1. 問題設定（Problem Statement）
- 何が困っているのか（現象）
- その原因は何だと考えているか（仮説）
- これが解決されないと何が起きるか（影響）

## 2. 目的（Goals）※測定可能に
- G1:
- G2:
- G3:

### 成功指標（Success Metrics）
- 指標:
- 目標値:
- 測定方法:
- 測定頻度:

## 3. 非目的（Non-Goals）
- NG1:
- NG2:
- NG3:

## 4. スコープ（Scope）
### In（対象）
- 
### Out（非対象）
- 

## 5. 制約（Constraints）
- コスト:
- 納期/タイムボックス:
- 依存追加:
- 実行環境:
- 言語/規約:
- セキュリティ:

## 6. 前提（Assumptions）
- A1:
- A2:

## 7. 利害関係者（Stakeholders）
- Owner:
- Reviewer:
- Users:
- Others:

## 8. 既存資産（Existing Assets）
- 既存コード:
- 既存ドキュメント:
- 既存データ:
- 既存テスト:

## 9. 主要リスク（Top Risks）
> 詳細は `risks/risk_register.md` に記載
- R1:
- R2:

## 10. オープンクエスチョン（Open Questions）
> 決まったら `decisions/decision_log.md` に残す
- Q1:
- Q2:

## 11. 用語集（Glossary）
- 用語: 定義

## 12. リンク
- `records/<project>/status.md`
- `records/<project>/implementation_plan.md`
- `records/<project>/decisions/decision_log.md`


---

# FILE: 02_Architecture_Overview_TEMPLATE.md

---
project: "<PROJECT_NAME>"
created: "<YYYY-MM-DD>"
updated: "<YYYY-MM-DD>"
owner: "<OWNER>"
---

# アーキテクチャ概要（Architecture Overview）

## 1. コンテキスト
- 対象領域:
- ユーザー/利用者:
- 主要ユースケース:
- 既存システムとの関係:

## 2. 制約・設計原則
- 制約（コスト、依存、実行環境）:
- 設計原則（例: 単一責任、疎結合、テスト容易性、セキュリティ最小権限）:

## 3. 全体構成（System Context）
> ASCIIでOK。画像が必要なら別ファイル/リンクで。
```text
[User/Caller]
   |
   v
[API/CLI] --> [Service Layer] --> [Data Layer]
                 |                   |
                 v                   v
             [Adapters]         [Storage/Files]
```

## 4. コンポーネント責務
| Component | Responsibility | Inputs | Outputs | Notes |
|---|---|---|---|---|
| API/CLI |  |  |  |  |
| Service |  |  |  |  |
| Adapter |  |  |  |  |
| Storage |  |  |  |  |

## 5. データモデル / スキーマ
- 主要エンティティ:
- 重要フィールド:
- 不変条件（invariants）:
- 例（サンプル）:

## 6. インタフェース
### Public API
- エンドポイント/関数:
- I/O:
- エラー:

### 内部インタフェース
- 依存関係:
- 例外方針:

## 7. エラーハンドリング方針
- 入力検証:
- 例外の分類（recoverable / non-recoverable）:
- リトライ:
- フォールバック:

## 8. 非機能要件
- 性能（スループット/レイテンシ）:
- スケール（データ量/銘柄数/期間）:
- 監視（ログ/メトリクス/トレース）:
- 運用（設定、リリース、ロールバック）:

## 9. セキュリティ
- 取り扱う機密:
- 最小権限:
- 入力の信頼境界:
- 監査ログ:

## 10. 依存関係
- 外部:
- 内部:
- バージョン/互換性:

## 11. 未決事項（Open）
-


---

# FILE: 03_Implementation_Plan_TEMPLATE.md

---
project: "<PROJECT_NAME>"
created: "<YYYY-MM-DD>"
updated: "<YYYY-MM-DD>"
owner: "<OWNER>"
task_id_scheme: "P{phase}-T{major}.{minor} (例: P1-T1.6)"
---

# 実装計画（Implementation Plan）

## 0. この計画の使い方（固定ルール）
- **タスクは必ずIDを持つ**（検索/レビュー/コミットに使う）
- **タスクの“設計判断”は決定ログへ**（実装者が勝手に埋めない）
- **タスクはCIR（共通中間表現）で書く**（下記の Task Card 形式）

---

## 1. フェーズ概要
| Phase | Goal | Deliverables | Dependencies | Exit Criteria |
|---|---|---|---|---|
| P1 |  |  |  |  |
| P2 |  |  |  |  |
| P3 |  |  |  |  |

---

## 2. タスクリスト（インデックス）
> 詳細は `phase_plans/P{n}.md` に書く運用でもOK

| Task ID | Title | Phase | Status | Owner | Links |
|---|---|---:|---|---|---|
| P1-T1.1 |  | P1 | Not started |  |  |
| P1-T1.2 |  | P1 |  |  |  |

---

## 3. Task Card（CIR）テンプレ（ここをコピペして各タスクに使う）

### Task: <TASK-ID> — <TITLE>

**Goal（このタスクで実現すること）**
- 

**Background / Context**
- 関連資料:
  - `records/<project>/architecture.md`
  - `records/<project>/decisions/decision_log.md`
  - `records/<project>/status.md`

**Inputs（入力）**
- 型/形式:
- 例:
- 前提:
- バリデーション:

**Outputs（出力）**
- 型/形式:
- 例:
- 不変条件:

**In Scope（実装範囲）**
- 

**Out of Scope（非対象）**
- 

**Decisions（仕様固定点）**
- D1:
- D2:
> 迷う点が残るなら「質問」にして止める（決定ログに回す）

**Acceptance Tests（受入テスト/DoD）**
- テスト:
- レビュー:
- セキュリティ:
- ドキュメント:
- 互換性:

**Files（作成/編集）**
- Create:
  - 
- Modify:
  - 

**Dependencies**
- 先行タスク:
- 外部依存:

**Risks**
- リスク:
- 回避策:

**Owner / Execution**
- 司令塔:
- 実装（Codex等）:
- レビュー:
- 統合テスト:

---

## 4. 共通チェックリスト（全タスク共通）
- [ ] 入力検証（空/NaN/欠損/型/ソート）
- [ ] 例外方針（例外型/メッセージ）
- [ ] テスト（正常系/異常系/境界）
- [ ] セキュリティ（機密/注入/パス/ログ）
- [ ] ドキュメント更新（records, docstring）
- [ ] status.md 更新（開始/終了/次アクション）


---

# FILE: 04_Phase_Plan_TEMPLATE.md

---
project: "<PROJECT_NAME>"
phase: "P<PHASE_NUMBER>"
created: "<YYYY-MM-DD>"
updated: "<YYYY-MM-DD>"
owner: "<OWNER>"
---

# フェーズ計画（Phase Plan）: P<PHASE_NUMBER> — <PHASE_TITLE>

## 1. フェーズゴール
- 目的:
- 完了条件（Exit Criteria）:

## 2. 主要成果物
- 
- 

## 3. タスク一覧（このフェーズ内）
| Task ID | Title | Priority | Dependencies | DoD | Owner | Notes |
|---|---|---:|---|---|---|---|
| P<PHASE>-T<MAJOR>.<MINOR> |  | High |  |  |  |  |

---

## 4. タスク詳細（CIR）
> `Implementation Plan` の Task Card をここに並べる。

### Task: <TASK-ID> — <TITLE>
**Goal**
- 

**Inputs**
- 

**Outputs**
- 

**In / Out**
- In:
- Out:

**Decisions（仕様固定点）**
- 

**Acceptance / DoD**
- 

**Files**
- 

**Tests**
- 

**Risks**
- 

---

## 5. フェーズ内の運用ルール
- タスクをCodexへ委任する場合は `requests/codex_request_<TASK-ID>.md` を作る
- 仕様が揺れたら `decisions/decision_log.md` を更新してから進める
- status.md は「開始前」「委任前」「完了時」に更新する


---

# FILE: 05_Codex_Request_TEMPLATE.md

---
project: "<PROJECT_NAME>"
task_id: "<TASK-ID>"
title: "<TASK-ID> — <TITLE>"
created: "<YYYY-MM-DD>"
requester: "<COMMANDER/OWNER>"
assignee: "codex-cli"
approval: "pending | approved | not_required"
path_policy:
  repo_root: "<ABS_OR_REL_PATH_TO_REPO_ROOT>"
  use: "relative_from_repo_root | absolute"
constraints:
  shell_execution: "forbidden"   # 実行は提案のみ
  dependencies: "no_new_deps"
  workspace: "workspace-write"
  approval_policy: "never"
---

# Codex 依頼書（永続テンプレ）

> 目的：**モデル間の解釈ズレを防ぐため、ここを“契約書”として扱う。**  
> 実装者（Codex）は **本書に書かれていない設計判断を勝手に埋めない**。曖昧点は「質問」として返す。

---

## 0. 参照（SSOT）
- 状態: `records/<project>/status.md`
- 計画: `records/<project>/implementation_plan.md`（または `phase_plans/Px.md`）
- 決定ログ: `records/<project>/decisions/decision_log.md`
- 関連コード/仕様:
  - `<PATH_TO_RELEVANT_CODE>`
  - `<PATH_TO_SPEC_DOC>`

---

## 1. 背景（Why）
- 現状:
- 解決したい問題:
- 期待する価値:

---

## 2. 対象（What）
- 対象タスク: `<TASK-ID>`
- 対象フェーズ: `<PHASE>`
- 目的（Goal）:
  - 

### 成果物（Deliverables）
- [ ] 実装（コード反映）
- [ ] テスト（追加/更新）
- [ ] レビュー（自己レビュー/コードレビュー観点の指摘）
- [ ] セキュリティレビュー（入力検証・例外・ログ・パス等）
- [ ] 変更点サマリ（何を変えたか、どこを見ればよいか）

---

## 3. 仕様（CIR）

### 3.1 入力（Inputs）
- 形式/型:
- 必須フィールド:
- 前提（ソート、単位、タイムゾーンなど）:
- バリデーション（欠損/NaN/空/型）:

### 3.2 出力（Outputs）
- 形式/型:
- 追加/変更フィールド:
- 不変条件（invariants）:
- 例:

### 3.3 実装範囲（In）
1. 
2. 

### 3.4 非対象（Out）
- 
- 

### 3.5 仕様固定点（Decisions）
> ここが曖昧なままだと手戻りが増える。未確定なら「質問」にして止める。
- D1:
- D2:
- D3:

---

## 4. 実装指示（How）

### 4.1 変更対象ファイル
> パスは `path_policy` に従う。迷うなら **相対パス（repo root基準）** + **フルパス（repo_root補足）** を併記。
- Create:
  - `<path/to/new_file.py>`
- Modify:
  - `<path/to/existing_file.py>`

### 4.2 実装詳細（必要なら擬似コード/関数シグネチャ）
- 主要クラス/関数:
  - `def ...(...) -> ...:`
- アルゴリズム:
- 例外/エラー:
- ログ方針:

### 4.3 テスト（TDD）
- 追加するテストファイル:
  - `<tests/.../test_xxx.py>`
- 最低限のテストケース:
  - 正常系:
  - 境界:
  - 異常系:
  - 複数エンティティ混在（例: tic）:

### 4.4 検証手順（司令塔が実行）
> **シェルコマンドは実行しない**。提案のみ。
```bash
pytest -q <tests/.../test_xxx.py>
```

---

## 5. 制約（Constraints）
- [ ] シェル実行禁止（pytest/pip/python -m は提案のみ）
- [ ] 依存追加禁止（既存依存のみ）
- [ ] 変更範囲は必要最小限（探索範囲を限定）
- [ ] セキュリティ（入力検証、パス操作、ログに機密を出さない）
- [ ] 互換性（既存I/Oを壊さない、破壊変更は明記）

---

## 6. セルフレビュー観点（提出時にチェック）
- [ ] 仕様固定点と実装が一致している
- [ ] 例外メッセージが具体（原因特定できる）
- [ ] テストが「仕様」を固定している（偶然通るテストになっていない）
- [ ] 境界条件（空/NaN/ソート/単位）を扱っている
- [ ] 変更点が小さく読める（無関係な差分がない）

---

## 7. 返却フォーマット（Codex → 司令塔）
1. 変更ファイル一覧（Create/Modify）
2. 実装サマリ（3〜8行）
3. テストサマリ（ケース一覧）
4. 既知の懸念点/要確認点
5. status.md / decision_log.md を更新すべき点（提案）

---

## 8. 質問（ブロック時）
> 不明点が出たら、勝手に補完せず、ここに質問を書いて止める。
- Q1:
- Q2:


---

# FILE: 06_Status_Board_TEMPLATE.md

---
project: "<PROJECT_NAME>"
updated: "<YYYY-MM-DD>"
owner: "<OWNER>"
---

# ステータスボード（Status）

## 0. サマリ（1〜5行）
- 現在のフェーズ:
- いまやっていること:
- 次にやること:
- ブロッカー:
- リスク（上位）:

---

## 1. 現在のフォーカス（Now）
- [ ] <TASK-ID>: <TITLE>
- [ ] <TASK-ID>: <TITLE>

## 2. ブロッカー（Blocked）
| Blocker | Owner | Impact | Next Action | ETA(任意) |
|---|---|---|---|---|
|  |  |  |  |  |

## 3. タスク一覧（抜粋）
| Task ID | Title | Status | Owner | Branch/PR | Last Update | Notes |
|---|---|---|---|---|---|---|
| P1-T1.1 |  | Not started |  |  |  |  |
| P1-T1.2 |  | In progress |  |  |  |  |
| P1-T1.3 |  | Blocked |  |  |  |  |
| P1-T1.4 |  | Done |  |  |  |  |

## 4. 直近の変更ログ（Changelog）
- <YYYY-MM-DD> <TASK-ID> : 何を進めた/決めた

## 5. 次のアクション（Next）
> “次に何をするか” が 1〜3個で書けていないと、司令塔が迷って減速しやすい。
1. 
2. 
3.


---

# FILE: 07_Decision_Log_ADR_TEMPLATE.md

---
project: "<PROJECT_NAME>"
created: "<YYYY-MM-DD>"
updated: "<YYYY-MM-DD>"
---

# 決定ログ（Decision Log / ADR Index）

> 仕様の揺れ・迷い・モデル間ブレを **“決定” として固定**する。  
> ADR（Architecture Decision Record）形式を推奨。

---

## ADR 一覧
| ADR ID | Date | Title | Status | Links |
|---|---|---|---|---|
| ADR-0001 | <YYYY-MM-DD> | <TITLE> | Accepted |  |
| ADR-0002 | <YYYY-MM-DD> |  | Proposed |  |

---

# ADR テンプレ（この下をコピペして追記）

## ADR-XXXX: <TITLE>
- Date: <YYYY-MM-DD>
- Status: Proposed | Accepted | Superseded | Rejected
- Related: <TASK-ID> / <PR> / <Issue>

### Context（背景）
- 

### Decision（決定）
- 

### Alternatives（代替案）
- A:
- B:

### Consequences（影響/トレードオフ）
- 良い点:
- 悪い点:
- 影響範囲:

### Validation（検証/受入）
- テスト:
- メトリクス:
- ロールバック:

### Notes
-


---

# FILE: 08_Risk_Register_TEMPLATE.md

---
project: "<PROJECT_NAME>"
created: "<YYYY-MM-DD>"
updated: "<YYYY-MM-DD>"
owner: "<OWNER>"
---

# リスク登録簿（Risk Register）

| Risk ID | Description | Likelihood | Impact | Mitigation | Trigger/Signal | Owner | Status |
|---|---|---|---|---|---|---|---|
| R-0001 |  | Low/Med/High | Low/Med/High |  |  |  | Open |
| R-0002 |  |  |  |  |  |  |  |

## 運用ルール
- 仕様が揺れる/データ品質が怪しい/性能が不安、はリスクとして登録
- 重大リスクは `status.md` のサマリに反映
- 収束したリスクは Closed にして「なぜ閉じたか」一言書く


---

# FILE: 09_Test_Strategy_TEMPLATE.md

---
project: "<PROJECT_NAME>"
created: "<YYYY-MM-DD>"
updated: "<YYYY-MM-DD>"
owner: "<OWNER>"
---

# テスト戦略（Test Strategy）

## 1. 目的
- 何を保証したいか:
- 何を保証しないか（限界）:

## 2. テストピラミッド（推奨）
- Unit（関数/クラス）
- Integration（I/O、アダプタ、DB/ファイル）
- E2E（主要ユースケース）
- Regression（過去バグの再発防止）

## 3. 対象範囲
### In
- 
### Out
- 

## 4. 品質ゲート（Quality Gates）
- [ ] Unit tests: pass
- [ ] Integration tests: pass
- [ ] Lint/Format（任意）:
- [ ] Security checks（任意）:
- [ ] Coverage（任意）:

## 5. テストデータ方針
- フィクスチャ:
- 乱数/seed:
- 実データ利用可否:
- PII/機密の扱い:

## 6. 主要テストケース（抜粋）
- 正常系:
- 境界:
- 異常系:
- 性能/スケール:

## 7. 実行方法（例）
```bash
pytest -q
```

## 8. 失敗時の切り分け手順
1. 
2. 
3. 

## 9. 継続運用
- 追加するたびに「何を固定したテストか」をテスト名/コメントで明示


---

# FILE: 10_Security_Review_TEMPLATE.md

---
project: "<PROJECT_NAME>"
created: "<YYYY-MM-DD>"
updated: "<YYYY-MM-DD>"
owner: "<OWNER>"
---

# セキュリティレビュー（Security Review Checklist）

> 実装タスクごとに **“入力・境界・ログ・依存・権限”** をチェックする。

## 1. スレッドモデル（簡易）
- 資産（守るもの）:
- 攻撃者モデル:
- 信頼境界（trusted/untrusted）:

## 2. チェックリスト（必須）
### 入力検証
- [ ] 欠損/NaN/空の扱いが明確
- [ ] 型の検証（数値/文字/日付）
- [ ] ソート前提があるなら強制 or 検証
- [ ] 異常入力で安全に失敗する（例外が握り潰されない）

### 依存・実行
- [ ] 新規依存を増やしていない（増やすなら明記）
- [ ] 外部I/O（ネットワーク/ファイル）が増えていない（増えるなら許可を取る）

### ログ
- [ ] 機密（キー/トークン/個人情報）をログに出さない
- [ ] 例外時に原因が追える最小限の情報は残す

### パス/コマンド
- [ ] パス結合が安全（相対パス注入に注意）
- [ ] ユーザー入力をコマンドに渡していない

## 3. 追加観点（任意）
- [ ] レート制限/DoS
- [ ] 認証/認可
- [ ] データ整合性（改ざん検知）

## 4. レビュー結果
- 重大:
- 中:
- 低:
- 対応方針:


---

# FILE: 11_Release_Checklist_TEMPLATE.md

---
project: "<PROJECT_NAME>"
created: "<YYYY-MM-DD>"
updated: "<YYYY-MM-DD>"
owner: "<OWNER>"
---

# リリースチェックリスト（Release Checklist）

## 0. リリース概要
- バージョン/タグ:
- 対象ブランチ:
- 影響範囲:
- ロールバック手順:

---

## 1. 事前チェック（Pre-Release）
- [ ] status.md の Now/Next が整理されている
- [ ] 主要テストがグリーン（unit/integration/e2e）
- [ ] 既存API/出力の互換性確認
- [ ] 重要な決定が decision_log に反映されている
- [ ] 変更点がドキュメントに反映されている（README/records）
- [ ] 機密がコミットされていない（キー、トークン、.env 等）
- [ ] 設定変更（env/feature flag）があるなら手順を明記

## 2. リリース手順
1. 
2. 
3. 

## 3. 事後チェック（Post-Release）
- [ ] 主要動作のスモークテスト
- [ ] ログ/メトリクスの監視ポイント確認
- [ ] 既知の問題と回避策を handover に記載
- [ ] 次の改善タスクを計画に反映

## 4. 変更点サマリ（Changelog）
- Added:
- Changed:
- Fixed:
- Deprecated:


---

# FILE: 12_Handover_TEMPLATE.md

---
project: "<PROJECT_NAME>"
created: "<YYYY-MM-DD>"
from: "<WHO>"
to: "<WHO>"
context_window: "次スレ/別モデルに渡す前提で、必要十分に要約する"
---

# 引き継ぎ（Handover）

## 0. 3行サマリ
- 何を作っているか:
- いまの状態:
- 次にやること:

---

## 1. 現在の状態（SSOTへのリンク）
- status: `records/<project>/status.md`
- plan: `records/<project>/implementation_plan.md` / `phase_plans/Px.md`
- decisions: `records/<project>/decisions/decision_log.md`
- risks: `records/<project>/risks/risk_register.md`

---

## 2. 完了済み
- ✅ <TASK-ID> : <概要>

## 3. 進行中 / 未完了
- ⏳ <TASK-ID> : <何が残っているか>（次アクション）

## 4. 重要な決定（Decision）
- ADR-XXXX: <内容>（理由/影響）

## 5. 既知の問題（Known Issues）
- Issue:
  - 症状:
  - 再現手順:
  - 回避策:
  - 参考:

## 6. 実行/検証方法
```bash
pytest -q
```

## 7. 次のスプリント候補
-


---

# FILE: 13_Commander_Operating_Manual_TEMPLATE.md

---
role: "Commander / Orchestrator"
version: "v1"
applies_to: "Composer / 司令塔モデル"
---

# 司令塔 運用マニュアル（テンプレ）

> 目的：**迷い・手戻り・指示待ち**を減らし、Codex委任で最速に品質を担保する。

---

## 0. 司令塔の責務（最重要）
1. **状況把握**：作業開始前に `@records/` を読んで進捗・ブロッカーを理解する  
2. **計画準拠**：実装計画（`implementation_plan.md` / `phase_plans/`）から逸脱しない  
3. **分割統治**：フェーズ内タスクを“切りの良い作業単位”に分割し、依頼書化する  
4. **委任管理**：Codexの成果（実装/テスト/レビュー/セキュリティ）を検収し、漏れを指摘する  
5. **記録**：状態（status）と決定（decision）を更新し、次スレ/次モデルへ引き継げる形にする

---

## 1. 作業開始チェック（毎回）
- [ ] `records/<project>/status.md` を読む（Now/Next/Blockers）
- [ ] `implementation_plan.md` / `phase_plans/` を読む（対象タスクのCIR確認）
- [ ] 未決事項があれば `decision_log.md` を確認
- [ ] “今やる1タスク” を決め、DoD を明文化する

---

## 2. タスク分割の基準（Codex委任単位）
次の条件を満たす単位に分割する：
- 変更ファイルが **少数**（目安: 1〜5ファイル）
- 入出力・仕様固定点が **依頼書に書ける**
- テストが **追加できる**
- 1回の往復でレビュー可能なサイズ

---

## 3. Codex依頼書の作り方（必須）
- `records/<project>/requests/codex_request_<TASK-ID>.md` を作る
- 依頼書は **CIR（Goal / I/O / In-Out / DoD / Decisions / Files / Tests）** を必ず含める
- 曖昧点を残さない。残るなら “質問” として止める（勝手に埋めない）

---

## 4. Codexの検収（返ってきたら必ず）
- [ ] 変更ファイル一覧がある
- [ ] 実装が依頼書の仕様固定点に一致
- [ ] テストが仕様を固定している（境界/異常がある）
- [ ] セキュリティ観点（入力検証/ログ/パス）が確認されている
- [ ] 依頼範囲外の変更がない
- [ ] 必要なら `status.md` / `decision_log.md` 更新提案がある

---

## 5. 統合テスト（司令塔がやる）
- Codexが書いたテストを実行し、統合観点でも確認する
- 失敗したら：
  1) 失敗ログを記録
  2) 原因を分類（仕様不足 / 実装バグ / テスト誤り）
  3) 必要なら decision_log に追記
  4) Codexへ“差分”で再依頼

---

## 6. 記録ルール（コンテキスト枯渇対策）
- タスク開始・委任前・完了時に `status.md` を更新
- 仕様の揺れは必ず `decision_log.md` に残す
- スレッド/モデルを切り替える直前に `handover_YYYYMMDD.md` を作る


---

# FILE: 14_Model_Handoff_Rules_TEMPLATE.md

---
version: "v1"
---

# モデル間ハンドオフ規約（恒久テンプレ）

> 目的：モデルを跨いでも、**成果物の品質とスピードを落とさない**。

---

## 1. 役割定義（例）
- **GPT系（レビュー/仕様固め）**：論理矛盾、境界条件、セキュリティ、DoD、依存、受入の網羅
- **計画モデル（実装計画化）**：フェーズ分割、タスクID付与、依存関係、DoD/テスト設計
- **司令塔（オーケストレーター）**：状態管理、タスク分割、依頼書化、Codex検収、引き継ぎ記録
- **Codex（実装）**：依頼書に沿った実装とテスト、自己レビュー、セキュリティ観点

---

## 2. 受け渡しに必須の成果物（Artifact Contract）
ハンドオフ時に最低限この4つが揃っていれば、次のモデルが迷わない。

1. `status.md`：Now/Next/Blockers が明確
2. `implementation_plan.md`（または phase plan）：対象タスクのCIRが明確
3. `decision_log.md`：仕様固定点が決まっている
4. `codex_request_<TASK-ID>.md`：実装委任の契約書

---

## 3. “曖昧さ” の扱いルール
- **曖昧さは“決定ログ”へ**：実装者が補完しない
- 決められない場合は：
  - 影響範囲
  - 選択肢
  - 推奨
  - 検証方法
  を書いて、レビューに回す

---

## 4. レビュー規約（差分レビュー推奨）
- 大規模変更：フルレビュー
- 小規模変更：差分レビュー（変更点、破壊変更、DoD、リスクだけ）

---

## 5. コミット規約（例）
- コミットメッセージに Task ID を含める  
  例: `P1-T1.6 Add slope-based regime labeling`

---

## 6. 典型的な失敗と予防策
- 仕様固定点が未確定 → decision_log に書くまで止める
- I/Oが曖昧 → 例（サンプル）を依頼書に必ず書く
- テストが弱い → 境界/異常/混在（複数tic等）を最低限入れる
- 依頼範囲外の変更 → “探索範囲” を依頼書で限定する
