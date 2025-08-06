import jwt from 'jsonwebtoken';
import User from '../models/User.js';
// 🔧 統一: 環境設定はenvironment.jsで一元管理
import environmentConfig from '../config/environment.js';
import { getJSTTimeInfo } from '../utils/dateUtils.js';
import { logger } from '../utils/logger.js';

const JWT_SECRET = environmentConfig.jwtSecret;
if (!JWT_SECRET) {
    logger.error('[Auth Middleware] エラー: JWT_SECRET 環境変数が設定されていません。');
    throw new Error('JWT_SECRET is not defined in environment variables'); 
}
// 🔐 セキュリティ修正: JWT_SECRETをログに出力しない
logger.info('[Auth Middleware] JWT_SECRET successfully loaded');

// 認証保護ミドルウェア
const protect = async (req, res, next) => {
    let token;
    logger.debug('[Protect Middleware] Attempting authentication...');

    // Cookie から jwt トークンを読み取る
    if (req.cookies && req.cookies.jwt) {
        token = req.cookies.jwt;
        logger.debug('[Protect Middleware] JWT Cookie found');
    }

    // Authorizationヘッダーからもトークンを読み取る (Bearer token)
    if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
        logger.debug('[Protect Middleware] Using Authorization header token');
    }

    if (token) {
        try {
            logger.debug('[Protect Middleware] Verifying token...');
            
            // トークンを検証
            const decoded = jwt.verify(token, JWT_SECRET);
            logger.debug('[Protect Middleware] Token decoded successfully. User ID:', decoded.userId);

            // トークンからユーザーIDを取得し、ユーザー情報をDBから取得 (-password でパスワードを除く)
            const user = await User.findById(decoded.userId).select('-password');

            if (!user) {
                // ユーザーが存在しない場合 (トークンは有効だがユーザーが削除されたなど)
                logger.warn('[Auth Middleware] User not found for token ID:', decoded.userId);
                return res.status(401).json({ success: false, message: '認証情報が無効です。再度ログインしてください。' });
            }
            
            // ユーザー情報をリクエストに追加
            req.user = user;
            
            // ユーザー情報が取得できたら次のミドルウェアへ
            logger.debug(`[Auth Middleware] User authenticated: ${req.user.username}, isAdmin: ${req.user.isAdmin}`);
            next();
        } catch (error) {
            logger.warn('[Auth Middleware] Token verification failed:', error.message);
            // トークンが無効な場合 (期限切れ、改ざんなど)
            res.status(401).json({ success: false, message: 'セッションが無効か期限切れです。再度ログインしてください。' });
        }
    } else {
        // トークンが存在しない場合
        logger.debug('[Auth Middleware] No token provided');
        res.status(401).json({ success: false, message: '認証が必要です。ログインしてください。' });
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
    // 🚀 環境変数によるグローバル時間制限無効化
    if (process.env.DISABLE_TIME_CHECK === 'true') {
      logger.debug('[TimeRestriction] DISABLE_TIME_CHECK=true により時間制限をスキップします');
      return next();
    }
    
    // 🔐 セキュリティ強化: 管理者または開発環境のみskipTimeCheckを許可
    const skipTimeCheck = req.query.skipTimeCheck === 'true';
    
    if (skipTimeCheck) {
      // 管理者または開発環境のみ許可
      if (req.user?.isAdmin || process.env.NODE_ENV === 'development') {
        logger.warn(`🔑 時間制限をスキップします: 管理者=${req.user?.isAdmin}, 開発環境=${process.env.NODE_ENV === 'development'}`);
        return next();
      } else {
        logger.warn(`⚠️ 一般ユーザーによる不正なskipTimeCheckアクセスを拒否: ${req.user?.username}`);
        return res.status(403).json({
          success: false,
          message: '時間制限のスキップは管理者のみ許可されています。'
        });
      }
    }
    
    // 管理者ユーザーの場合は時間制限をスキップ
    if (req.user && req.user.isAdmin) {
      logger.info('[TimeRestriction] 管理者ユーザーのため時間制限をスキップします:', req.user.username);
      return next();
    }
    
    // 🔧 修正: JST基準での時刻チェック
    const jstTimeInfo = getJSTTimeInfo();
    const { hours, minutes, currentTime, timeString } = jstTimeInfo;
    
    // 6:30-8:00の間のみアクセス許可
    if (currentTime < 6.5 || currentTime > 8.0) {
      return res.status(403).json({
        success: false,
        message: '朝の計算チャレンジは、朝6:30から8:00の間のみ挑戦できます。またの挑戦をお待ちしています！',
        isTimeRestricted: true,
        currentTime: timeString,
        allowedTime: '6:30-8:00',
        debug: process.env.NODE_ENV !== 'production' ? {
          jstTime: jstTimeInfo.jstDate.toISOString(),
          utcTime: jstTimeInfo.utcDate.toISOString()
        } : undefined
      });
    }
    
    next();
  } catch (error) {
    logger.error('時間制限チェックエラー:', error);
    res.status(500).json({
      success: false,
      message: 'サーバーエラーが発生しました。'
    });
  }
};

export { protect, admin, timeRestriction };
