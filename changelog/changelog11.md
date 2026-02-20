変更内容
.cursor/commands/uow.md
4番を「Codex CLI に依頼（自動ループ推奨）」に変更
推奨を codex_loop.py に変更
代替として codex exec を記載
.cursor/scripts/ops.py
cmd_uow の Next: codex_loop.py を推奨に変更（パスは config の codex_requests_dirname を使用）
cmd_codex_request の Hints: 自動ループ推奨に変更
.cursor/agents/ops-commander.md
典型フロー 4・5 を「codex_loop.py で実装〜検証を自動ループ」に変更
.cursor/skills/records-orchestrator/SKILL.md
手順 6 を「codex_loop.py を推奨、1回だけの場合は codex exec を代替」に変更
.cursor/commands/codex-request.md
タイトルを「Codex 依頼書の生成と実装実行」に変更
流れを「1. 依頼書生成 → 2. TODO 記入 → 3. 自動ループ実行」に整理
