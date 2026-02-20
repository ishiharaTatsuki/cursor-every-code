---
name: records-validator
description: records/ の整合性をチェックして、迷子・漏れ・テンプレ未埋め・リンク切れを早期検知する。
---

# records-validator（records整合性チェック）

records/ をSSOTとして運用すると、強い一方で「未更新」「TODO残り」「リンク切れ」が発生すると一気に迷子になります。
このスキルは、機械的チェックと人間向けチェックリストで **劣化を早期発見** します。

---

## 1) 機械的チェック（推奨）

```bash
python .cursor/scripts/ops.py validate
```

検出例:

- 実装計画/ステータスファイルが見つからない（候補パスのズレ）
- codex_request_*.md が無い（依頼書運用が破綻）
- TODO プレースホルダ残り（status/plan/request）

---

## 2) 人間向けチェックリスト（毎回）

- status の Now は **1つだけ**か？
- 実装計画に、直近の変更が反映されているか？
- 重要な判断は decisions に残っているか？
- 依頼書は「目的/非目的/DoD/制約」が揃っているか？
- スレッド移行が近いなら handover が更新されているか？

---

## 3) 直し方（よくあるケース）

- plan/status が見つからない  
  → `.cursor/scripts/ops_config.json` の candidates を追加し、SSOTパスを固定する

- TODO が残り続ける  
  → TODO を「不確実事項」か「次のUoW」に落とす（放置しない）

- Now が複数になる  
  → 司令塔が1つに絞る（コンテキストを薄くしない）

