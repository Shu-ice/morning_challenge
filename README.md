# MongoDB起動
# Windowsの場合
# 管理者権限でコマンドプロンプトを開き、以下を実行
# "C:\Program Files\MongoDB\Server\{version}\bin\mongod.exe" --dbpath="C:\data\db"

# macOSの場合
# brew services start mongodb-community

# サーバー起動手順
# サーバーディレクトリに移動し、以下を実行
cd server
npm install
npm run dev

# 別のターミナルでクライアント起動
cd ..
npm install
npm start

# 完全に開発モードで動かしたい場合（時間制限を無視する）
# 問題取得APIに?skipTimeCheck=trueを追加
# 例: GET /api/problems?skipTimeCheck=true
