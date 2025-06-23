# MongoDB Atlas 新規作成手順

## 🔥 完全新規MongoDB Atlasセットアップ

### 1. MongoDB Atlas新規アカウント作成
1. https://www.mongodb.com/cloud/atlas にアクセス
2. 「Try Free」ボタンをクリック
3. Googleアカウントまたはメールアドレスで登録

### 2. 新しいクラスター作成
1. 「Build a Database」をクリック
2. **M0 Sandbox**（無料プラン）を選択
3. **Provider**: AWS
4. **Region**: Asia Pacific (Tokyo) - ap-northeast-1
5. **Cluster Name**: `MorningChallenge`
6. 「Create」をクリック

### 3. データベースユーザー作成
1. 「Database Access」に移動
2. 「Add New Database User」をクリック
3. **Authentication Method**: Password
4. **Username**: `morninguser`
5. **Password**: `MorningChallenge2025!`
6. **Database User Privileges**: Atlas admin
7. 「Add User」をクリック

### 4. ネットワークアクセス設定
1. 「Network Access」に移動
2. 「Add IP Address」をクリック
3. 「Allow Access from Anywhere」を選択（0.0.0.0/0）
4. 「Confirm」をクリック

### 5. 接続文字列取得
1. 「Clusters」に戻る
2. 「Connect」ボタンをクリック
3. 「Drivers」を選択
4. **Driver**: Node.js
5. **Version**: 4.1 or later
6. 接続文字列をコピー

### 期待される接続文字列形式
```
mongodb+srv://morninguser:MorningChallenge2025!@morningchallenge.xxxxx.mongodb.net/?retryWrites=true&w=majority
```

### 6. Vercel環境変数更新
```bash
vercel env rm MONGODB_URI production
echo "mongodb+srv://morninguser:MorningChallenge2025!@morningchallenge.xxxxx.mongodb.net/?retryWrites=true&w=majority" | vercel env add MONGODB_URI production
```

### 7. 再デプロイ
```bash
vercel --prod
``` 