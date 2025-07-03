# 学習履歴API ページング機能テスト

## API エンドポイント
`GET /api/history`

## クエリパラメータ
- `limit`: 取得件数 (1-100, デフォルト: 10)
- `offset`: 開始位置 (0以上, デフォルト: 0)
- `userId`: 対象ユーザーID (管理者のみ他ユーザー指定可能)

## レスポンス例

```json
{
  "success": true,
  "count": 10,
  "total": 41,
  "totalCount": 41,
  "offset": 0,
  "limit": 10,
  "hasMore": true,
  "data": [
    {
      "_id": "...",
      "date": "2024-01-15",
      "difficulty": "intermediate",
      "username": "testuser",
      "grade": 5,
      "totalProblems": 10,
      "correctAnswers": 8,
      "timeSpent": 45.67,
      "rank": 3
    }
  ],
  "history": [...],
  "currentStreak": 0,
  "maxStreak": 0,
  "message": "履歴データ (10件/41件中)"
}
```

## テスト用 curl コマンド例

### 1. デフォルト（最初の10件取得）
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
     "http://localhost:5003/api/history"
```

### 2. limit/offset指定（21件目から10件取得）
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
     "http://localhost:5003/api/history?limit=10&offset=20"
```

### 3. 大量データ取得（最大100件）
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
     "http://localhost:5003/api/history?limit=100&offset=0"
```

### 4. 不正値テスト（limit=200, offset=-5）
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
     "http://localhost:5003/api/history?limit=200&offset=-5"
```
期待結果: limit=100, offset=0 に自動補正

### 5. 文字列パラメータテスト
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
     "http://localhost:5003/api/history?limit=abc&offset=xyz"
```
期待結果: limit=10, offset=0 に自動補正

## テスト観点

### 正常系
- [ ] **デフォルト動作**: パラメータなしで最初の10件取得
- [ ] **ページング**: limit=5, offset=10 で6-10件目を取得
- [ ] **最大件数**: limit=100 で最大件数まで取得
- [ ] **最終ページ**: hasMore=false になることを確認
- [ ] **空データ**: 履歴がない場合の動作

### 異常系・境界値
- [ ] **limit境界値**: limit=1, limit=100, limit=101
- [ ] **offset境界値**: offset=0, offset=総件数-1, offset=総件数
- [ ] **負の値**: limit=-1, offset=-1
- [ ] **文字列**: limit="abc", offset="xyz"
- [ ] **小数点**: limit=10.5, offset=5.7
- [ ] **null/undefined**: limit=null, offset=undefined

### レスポンス検証
- [ ] **count**: 実際に返された件数と一致
- [ ] **total/totalCount**: 総件数が正しく取得
- [ ] **hasMore**: (offset + limit) < total の計算結果と一致
- [ ] **data/history**: 両方に同じデータが含まれる
- [ ] **message**: 適切な件数表示

### パフォーマンス
- [ ] **大量データ**: 1000件以上のデータでの動作
- [ ] **MongoDB vs Mock**: 両環境での一貫性
- [ ] **レスポンス時間**: 100件取得が1秒以内

## 実装済み機能

✅ **パラメータ受け取り**: limit/offset クエリパラメータ対応
✅ **バリデーション**: 1≤limit≤100, 0≤offset の検証
✅ **MongoDB ページング**: .skip(offset).limit(limit) 実装
✅ **総件数取得**: countDocuments() で total 取得
✅ **hasMore計算**: 次ページ有無の正確な判定
✅ **Mock環境対応**: Array.slice() での同等機能
✅ **互換性**: data/history 両形式でレスポンス
✅ **エラーハンドリング**: 不正値の自動補正

## 注意事項

1. **認証必須**: 全てのリクエストに Bearer トークンが必要
2. **権限制御**: 非管理者は自分の履歴のみアクセス可能
3. **ソート順**: 日付降順（新しいものから）で固定
4. **デフォルト値**: limit=10, offset=0 で安全な動作
5. **最大制限**: limit=100 でメモリ使用量を制御