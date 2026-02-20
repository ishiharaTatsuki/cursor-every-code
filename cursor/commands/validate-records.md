# /validate-records — records の整合性チェック（漏れ検知）

## 実行

```bash
python .cursor/scripts/ops.py validate
```

---

## これで検出するもの（例）

- 実装計画 / status ファイルの未検出
- Codex依頼書が未作成
- TODO プレースホルダ残り（status / plan / request）
