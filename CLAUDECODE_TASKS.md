# ClaudeCode への依頼タスクリスト

以下のタスクは現在の「Morning Challenge」リポジトリ（Vercel Hobby プラン）に対して、API の 404 問題・パフォーマンス課題・エンドポイント整理を中心に解決するためのものです。

---

## 1. 解答提出 `/api/problems` 404 の修正
1. `api/problems.js` を `api/problems/index.js` にリネームし、フォルダとルートの競合を解消する。
2. 既存の `api/problems/generate.js` と `api/problems/edit.js` はそのまま同フォルダ配下に残し、インポートパスの修正が不要かを確認。
3. Vercel 上でのデプロイ後に `curl -X POST https://<deployment>/api/problems` で 200 応答を確認。

## 2. ランキング API 404 の修正
1. フロントエンド `src/api/index.ts`・`src/hooks/useApiQuery.ts` 内の `/rankings/daily` などの呼び出しを **`/rankings`** へ統一。
2. 不要になった `/rankings/daily`・`/rankings/weekly` などのコード分岐を削除し、日付・difficulty・limit をクエリパラメータで指定する形に一本化。
3. E2E テスト: `curl https://<deployment>/api/rankings?date=YYYY-MM-DD&difficulty=beginner` が期待通りの JSON を返すことを確認。

## 3. Vercel 関数数(12) の最適化
1. 今回リネームしたことでルート競合は解決するが、ファイル数が 12 を超えないか `vercel build` で確認。
2. もし超える場合は、`api/problems/{generate,edit}.js` のロジックを `index.js` にマージし、`req.query.action` でルーティングする案を検討。

## 4. MongoDB 接続の高速化
1. すべての serverless function で `global.mongoose` or `global.mongoClient` を再利用する実装に変更し、Cold Start を削減。
2. 使い回しの実装後、Vercel Metrics で応答時間が改善しているかを確認。

## 5. 不要ログの削減
1. `api/problems/index.js`, `api/rankings.js` で `console.log` の冗長出力を `process.env.VERCEL` 判定で抑制。
2. 特に `generateProblemSet` ループ内の warn を削減。

## 6. 統合 E2E テストスクリプト
1. `scripts/full_e2e_test.js` を更新し、
    - 問題取得 → 解答提出 → ランキング取得 の流れを本番 URL で実行。
    - 成功ステータスと主要フィールドの存在をアサート。

---

### 完了基準
- `/api/problems` POST が 200 を返し、フロントの回答送信が成功する。
- `/api/rankings` GET が 200 を返し、フロントのランキング表示が機能する。
- Vercel のデプロイが Function 12 個以内で成功し、Cold Start が体感で短縮される。
- `scripts/full_e2e_test.js` がローカル・本番の両方でパスする。

---

*このファイルはプロジェクト管理用です。作業 PR ごとに該当タスク ID をコメントに含めてください。* 