import jwt from 'jsonwebtoken';
import dotenv from 'dotenv'; // dotenv をインポート
import path from 'path';
import { fileURLToPath } from 'url';
import User from '../models/User.js';

// ESM環境で __dirname を再現
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// サーバーディレクトリの .env ファイルを読み込む
const envPath = path.resolve(__dirname, '../.env');
console.log(`[Auth Middleware] Loading .env from: ${envPath}`);
const dotenvResult = dotenv.config({ path: envPath });
if (dotenvResult.error) {
    console.error('[Auth Middleware] dotenv.config error:', dotenvResult.error);
} else {
    console.log('[Auth Middleware] dotenv.config successful');
}

// 環境変数からJWTシークレットを取得
console.log(`[Auth Middleware] All process.env keys: ${Object.keys(process.env).filter(key => key.includes('JWT') || key.includes('SECRET')).join(', ')}`);
console.log(`[Auth Middleware] process.env.JWT_SECRET value: "${process.env.JWT_SECRET}"`);
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    console.error('[Auth Middleware] エラー: JWT_SECRET 環境変数が設定されていません。');
    // ミドルウェア読み込み時点では process.exit(1) できないため、エラーを投げるか、起動時にチェックする
    throw new Error('JWT_SECRET is not defined in environment variables'); 
}
console.log(`[Auth Middleware] JWT_SECRET successfully loaded: ${JWT_SECRET.substring(0, 10)}...`);

// 認証保護ミドルウェア
const protect = async (req, res, next) => {
    let token;
    console.log('[Protect Middleware] Attempting authentication...');

    // Cookie から jwt トークンを読み取る
    if (req.cookies && req.cookies.jwt) {
        token = req.cookies.jwt;
        console.log(`[Protect Middleware] JWT Cookie found: ${token.substring(0, 20)}...`);
    }

    // Authorizationヘッダーからもトークンを読み取る (Bearer token)
    if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
        console.log(`[Protect Middleware] Using Authorization header token: ${token.substring(0, 20)}...`);
    }

    if (token) {
        try {
            console.log('[Protect Middleware] Verifying token with JWT_SECRET...');
            
            // トークンを検証
            const decoded = jwt.verify(token, JWT_SECRET);
            console.log('[Protect Middleware] Token decoded successfully. User ID:', decoded.userId);

            // トークンからユーザーIDを取得し、ユーザー情報をDBから取得 (-password でパスワードを除く)
            const user = await User.findById(decoded.userId).select('-password');

            if (!user) {
                // ユーザーが存在しない場合 (トークンは有効だがユーザーが削除されたなど)
                console.log('[Auth Middleware] User not found for token ID:', decoded.userId);
                // メッセージを少し具体的に
                return res.status(401).json({ success: false, message: '認証情報が無効です。再度ログインしてください。' });
            }
            
            // ユーザー情報をリクエストに追加
            req.user = user;
            
            // ユーザー情報が取得できたら次のミドルウェアへ
            console.log(`[Auth Middleware] User authenticated: ${req.user.username}, isAdmin: ${req.user.isAdmin}`);
            next();
        } catch (error) {
            console.error('[Auth Middleware] Token verification failed:', error.message);
            // トークンが無効な場合 (期限切れ、改ざんなど)
            res.status(401).json({ success: false, message: 'セッションが無効か期限切れです。再度ログインしてください。' }); // メッセージを修正
        }
    } else {
        // トークンが存在しない場合
        console.log('[Auth Middleware] No token provided');
        res.status(401).json({ success: false, message: '認証が必要です。ログインしてください。' }); // メッセージを修正
    }
};

// 管理者権限チェックミドルウェア
const admin = (req, res, next) => {
  if (req.user && req.user.isAdmin) {
    next();
  } else {
    res.status(403).json({
      success: false,
      message: '管理者権限が必要です。'
    });
  }
};

// 時間制限チェックミドルウェア
const timeRestriction = (req, res, next) => {
  try {
    // 開発モードでのスキップ設定
    const skipTimeCheck = req.query.skipTimeCheck === 'true';
    
    if (skipTimeCheck) {
      return next();
    }
    
    // 管理者ユーザーの場合は時間制限をスキップ
    if (req.user && req.user.isAdmin) {
      console.log('[TimeRestriction] 管理者ユーザーのため時間制限をスキップします:', req.user.username);
      return next();
    }
    
    // 現在時刻をチェック
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const currentTime = hours + minutes/60;
    
    // 6:30-8:00の間のみアクセス許可
    if (currentTime < 6.5 || currentTime > 8.0) {
      return res.status(403).json({
        success: false,
        message: '計算チャレンジは、朝6:30から8:00の間のみ挑戦できます！'
      });
    }
    
    next();
  } catch (error) {
    console.error('時間制限チェックエラー:', error);
    res.status(500).json({
      success: false,
      message: 'サーバーエラーが発生しました。'
    });
  }
};

export { protect, admin, timeRestriction };
