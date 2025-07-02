# 🌅 Morning Math Challenge

朝の計算チャレンジアプリ - React + Node.js + MongoDB で構築されたフルスタック数学練習プラットフォーム

## 📋 **プロジェクト概要**

毎朝6:30-8:00の時間帯に数学問題にチャレンジできるWebアプリケーションです。
- 難易度別の問題生成
- **1日、1回のチャレンジ制限** (管理者は除く)
- リアルタイムランキング
- 学習履歴の管理
- 管理者機能

## 🚀 **技術スタック**

### フロントエンド
- **React 19** + **TypeScript**
- **Vite** (開発サーバー)
- **Tailwind CSS** (スタイリング)
- **React Router** (ルーティング)
- **TanStack Query** (状態管理・API通信)

### バックエンド
- **Node.js** + **Express** (ES6モジュール)
- **MongoDB** + **Mongoose** (データベース)
- **JWT** (認証)
- **bcryptjs** (パスワードハッシュ)

### 開発環境
- **TypeScript** (型安全性)
- **ESLint** (コード品質)
- **concurrently** (同時実行)

## 🔧 **セットアップ**

### 1. 依存関係のインストール
```bash
# ルートディレクトリ
npm install

# サーバー側の依存関係
cd server && npm install
```

### 2. 環境変数の設定
```bash
# env.example をコピーして .env ファイルを作成
cp env.example .env

# server/.env ファイルを作成
cd server
cp ../env.example .env
```

### 3. 開発サーバーの起動
```bash
# フロントエンド + バックエンド同時起動
npm run dev

# 個別起動
npm run dev:frontend  # フロントエンド (Vite)
npm run dev:backend   # バックエンド (Node.js)
```

### 4. アクセス
- **フロントエンド**: http://localhost:3004 (または自動割り当てポート)
- **バックエンドAPI**: http://localhost:5003
- **管理者アカウント**: admin@example.com / admin123

## 📝 **スクリプト**

```bash
# 開発
npm run dev              # フロント+バック同時起動
npm run dev:frontend     # フロントエンドのみ
npm run dev:backend      # バックエンドのみ

# ビルド
npm run build            # プロダクションビルド
npm run preview          # ビルド結果のプレビュー

# 品質管理
npm run lint             # ESLintチェック
npm run lint:fix         # ESLint自動修正
npm run type-check       # TypeScript型チェック

# クリーンアップ
npm run clean            # キャッシュクリア
```

## 🏗️ **プロジェクト構造**

```
morning_challenge/
├── src/                    # フロントエンド (React/TypeScript)
│   ├── components/         # 再利用可能なコンポーネント
│   ├── pages/             # ページコンポーネント
│   ├── contexts/          # React Context
│   ├── hooks/             # カスタムフック
│   ├── services/          # API サービス
│   ├── types/             # TypeScript型定義
│   └── utils/             # ユーティリティ関数
├── server/                # バックエンド (Node.js/ES6)
│   ├── config/           # 設定ファイル
│   ├── controllers/      # API コントローラー
│   ├── middleware/       # Express ミドルウェア
│   ├── models/           # MongoDB モデル
│   ├── routes/           # API ルート
│   └── utils/            # ユーティリティ関数
├── public/               # 静的ファイル
└── dist/                 # ビルド出力
```

## 🎯 **主要機能**

### ユーザー機能
- ✅ ユーザー登録・ログイン
- ✅ 難易度別問題チャレンジ（beginner/intermediate/advanced/expert）
- ✅ リアルタイムタイマー
- ✅ 即座の結果表示とランキング
- ✅ 過去の学習履歴閲覧

### 管理者機能
- ✅ 問題の生成・編集
- ✅ ユーザー管理
- ✅ ランキング管理
- ✅ システム設定

### 技術的特徴
- ✅ 時間制限機能（朝6:30-8:00のみ）
- ✅ インメモリDB対応（開発環境）
- ✅ 自動問題生成
- ✅ レスポンシブデザイン

## 🛠️ **最近の改善**

### 2025年7月
- ✅ **管理者ダッシュボードの時刻表示バグ修正**: timeSpent値の桁ずれ問題解決（26422秒 → 26.42秒）
- ✅ **System Health パネルの機能強化**: メモリ使用状況、環境設定、エラー統計、コンポーネント別ヘルス状態の詳細表示
- ✅ **モックデータの一貫性修正**: 実際のDBと同じミリ秒単位に統一
- ✅ **包括的テストケース追加**: timeSpent関連機能の単体テスト実装
- ✅ **型定義の改善**: Vitest環境でのTypeScript型エラー解決

### 2025年6月
- ✅ ES6モジュールへの統一
- ✅ TypeScript型安全性の向上
- ✅ 環境設定管理の改善
- ✅ ポート競合問題の解決
- ✅ API型定義の整備

## 🔒 **セキュリティ**

- JWT トークンベース認証
- パスワードのbcryptハッシュ化
- CORS設定
- 入力値検証

## 📊 **監視・ログ**

- リクエストロギング
- エラーハンドリング
- パフォーマンス監視

## 🔧 **メンテナンス・管理**

### 学年データの一括更新（バックフィル）

ユーザーの学年変更後、過去の結果レコードの学年を一括で更新する場合：

```bash
# モック環境での実行
MONGODB_MOCK=true node server/scripts/backfillGrades.js

# MongoDB環境での実行
node server/scripts/backfillGrades.js
```

**実行内容：**
- 全ユーザーの現在の学年を取得
- 対応する結果レコード（Result）の学年フィールドを一括更新
- 更新前後の統計情報を表示

**使用ケース：**
- プロフィール更新機能追加前の既存データの整合性確保
- 学年システム変更時のデータマイグレーション
- ランキング表示の学年情報を最新に統一

### テスト実行

```bash
# 全テスト実行
cd server && npm test

# 学年同期機能の単体テスト
cd server && npm test -- gradeSync.test.js

# ランキングAPI関連テスト
cd server && npm test -- ranking.test.js
```

## 🤝 **開発に参加**

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if needed
5. Submit a pull request

## 📄 **ライセンス**

MIT License

---

**作成者**: Your Name  
**最終更新**: 2025年6月17日
