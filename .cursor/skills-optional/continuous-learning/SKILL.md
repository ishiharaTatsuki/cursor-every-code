---
name: continuous-learning
description: SessionEndでセッションメタデータを保存し、/learnで再利用可能パターンの抽出を促します（自動保存はしません）。
---

# Continuous Learning Skill

セッション終了時（SessionEnd）に **セッションメタデータを保存**し、十分な長さのセッションなら **/learn の実行を促す**ための仕組みです。

> このスキル自体は「自動で learned skill を生成して保存」しません。  
> 抽出・保存は `/learn` コマンドで人間が確認しながら行う想定です。

## How It Works

このスキルは `./.claude/settings.json` の **SessionEnd hook** として動きます。

1. **Transcript path を取得**  
   Hook input（`transcript_path` / `transcriptPath`）または環境変数（例: `CLAUDE_TRANSCRIPT_PATH`）から取得します。
2. **セッション長を評価**  
   transcript から user メッセージ数を数え、`min_session_length` 未満なら「短すぎる」と判断します。
3. **メタデータを書き出し**  
   `./.cursor/.sessions/evaluations/<session_id>.json` にメタ情報を保存します。
4. **/learn の推奨**  
   `min_session_length` 以上なら「/learn で再利用可能パターンを抽出しよう」と案内します。

## Configuration

`config.json` でカスタマイズできます。

```json
{
  "min_session_length": 10,
  "extraction_threshold": "medium",
  "auto_approve": false,
  "learned_skills_path": "./.cursor/skills/learned/",
  "patterns_to_detect": [
    "error_resolution",
    "user_corrections",
    "workarounds",
    "debugging_techniques",
    "project_specific"
  ],
  "ignore_patterns": [
    "simple_typos",
    "one_time_fixes",
    "external_api_issues"
  ]
}
```

現状 `evaluate-session.js` が参照するのは主に以下です:

- `min_session_length`
- `learned_skills_path`

それ以外は将来の自動抽出拡張用の予約フィールドです（必要なら /learn の手順に反映して運用してください）。

## Hook Setup

設定は `./.claude/settings.json` に置きます（Cursor の third-party hooks を想定）。

```json
{
  "hooks": {
    "SessionEnd": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "node \"$CLAUDE_PROJECT_DIR/.cursor/scripts/hooks/evaluate-session.js\""
          }
        ]
      }
    ]
  }
}
```

## Pattern Types (for /learn)

`/learn` を実行する際の「抽出候補」のカテゴリ例です。

| Pattern | Description |
|---------|-------------|
| `error_resolution` | 特定エラーの再発防止の手順 |
| `user_corrections` | ユーザー訂正から得た運用ルール |
| `workarounds` | 依存ライブラリ/環境の癖への回避策 |
| `debugging_techniques` | 効いたデバッグ手順の型 |
| `project_specific` | リポジトリ固有の規約・判断 |

## Related

- `/learn` command - 手動でパターンを抽出して `./.cursor/skills/learned/` に保存します
