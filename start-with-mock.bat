@echo off
echo ============================================
echo Morning Challenge - Mock Database Mode
echo ============================================

echo 🔧 環境設定を設定中...
set MONGODB_MOCK=true
set JWT_SECRET=morning-challenge-super-secret-key
set ADMIN_DEFAULT_PASSWORD=admin123
set NODE_ENV=development
set BACKEND_PORT=5003

echo 🗂️  モックデータベースモードで起動中...
echo.
echo 👤 利用可能アカウント:
echo    管理者: admin@example.com / admin123
echo    テスト: test@example.com / test123  
echo.

cd server
npm start 