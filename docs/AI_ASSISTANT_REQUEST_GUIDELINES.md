## AIアシスタント（o3 / Claude など）への依頼時のチェックリスト

次回同様のタスクを依頼するときに参照できるよう、最低限確認すべきポイントをまとめました。

### 1. 目的・ゴールを明確に伝える
- 例）「Express サーバを Vercel Serverless へ完全移行し、DB 永続化を含めて整合を取る」
- 機能追加かバグ修正か、優先順位と期限も共有する。

### 2. システム構成を最初に共有
- 現在のアーキテクチャ（Express + MongoDB / Serverless Functions など）
- 使用中サービス（Vercel プラン上限、MongoDB Atlas URI など）
- ローカルと本番で差がある場合は必ず明示。

### 3. Single Source of Truth を宣言
- **どちらの実装が正とするのか**（例：`api/` 側 Serverless が正）
- 重複ロジックが存在する場合は片方を削除・マージする方針を伝える。

### 4. データ永続化要件を必ず説明
- どのコレクションに何を保存するか（`dailyproblemsets` / `results` など）
- 保存しない一時データの場合でもその理由をコメントで残す。

### 5. テスト & 監視要件を添付
- `jest`, `supertest`, `playwright` などでの自動テスト方針
- ステージング環境での検証フロー
- 監視・ログ（Vercel Logs, Slack 通知など）の有無

### 6. プラン・制約を明示
- Vercel Hobby なら「Serverless Functions 12 本まで」など
- 長時間実行不可・メモリ上限なども共有

### 7. 成果物の形式を指定
- 「コードは file edit で」「ドキュメントは docs/ 配下に Markdown」
- README/CHANGELOG 更新範囲

### 8. リリース手順を確認
- `git add -A && git commit` → `vercel --prod --yes` など
- ロールバック手順もあれば共有

---
これらを依頼メッセージに添えておくと、AI が誤った前提で作業を進めるリスクを減らせます。 