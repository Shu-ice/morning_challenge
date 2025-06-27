# ClaudeCode 用プロンプト集

以下のプロンプトは、上記 `CLAUDECODE_TASKS.md` に記載のタスクを順次実装してもらうためのものです。各プロンプトは **1 つずつ** ClaudeCode に渡し、PR を分けて作成する想定です。

---

## Prompt 1: `/api/problems` 404 の修正
```
あなたは Vercel Serverless Functions の専門家です。
現状、`api/problems.js` と `api/problems/generate.js` などが競合し、`/api/problems` POST が 404 になります。

### 目的
- ルート競合を解消し、`/api/problems` GET/POST が機能するようにする。

### 要件
1. `api/problems.js` を `api/problems/index.js` にリネーム。
2. 依存 import は崩れないか確認。
3. デプロイ後 `curl -X POST https://<deployment>/api/problems` で 200 が返ることを CI 上でテスト。
4. function 数が 12 個を超えないことを `vercel build` でチェック。

### 受け入れ基準
- POST 送信で 200 かつ JSON `{ success: true }` が含まれること。
- `/api/problems/generate` と `/api/problems/edit` が引き続き動作する。
```

---

## Prompt 2: ランキング API 統一
```
あなたはフロント/バック統合エンジニアです。
現在、フロントは `/rankings/daily` を呼び出しますが、バックエンドは `/api/rankings` のみ実装されています。

### 目的
- フロントとバックのエンドポイント呼び出しを `/api/rankings` に統一。

### 要件
1. `src/api/index.ts` と関連 Hook を更新し、`/rankings/daily` → `/rankings` へ変更。
2. クエリパラメータ `date,difficulty,limit` を受け取る実装が既存関数で動作するようインターフェースを調整。
3. `api/rankings.js` には追加実装は不要。
4. E2E テスト更新。

### 完了基準
- フロント画面「ランキング」が 404 を出さずデータを表示できる。
```

---

## Prompt 3: MongoDB 接続キャッシュ
```
あなたは Node.js パフォーマンスの専門家です。
Serverless Function の Cold Start を削減するため、MongoDB 接続をグローバルキャッシュで共有してください。

### 手順指針
- `global.mongoClient` / `global.mongoose` を使い、接続済みなら再利用するコードにリファクタ。
- 影響範囲: `api/problems/index.js`, `api/rankings.js`, ほか DB 接続のある関数。
- 単体テストを更新し、接続が 1 回のみ行われることをアサート。
```

---

*必要に応じてタスクを分割・追加してください。* 