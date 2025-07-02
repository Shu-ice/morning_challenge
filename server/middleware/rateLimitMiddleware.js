import rateLimit from 'express-rate-limit';
import { logger } from '../utils/logger.js';

/**
 * レート制限ミドルウェア
 * APIエンドポイントへの過剰なリクエストを防止
 */

/**
 * 一般的なAPI用のレート制限
 * 15分間に100リクエストまで
 */
export const generalApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分
  max: 100, // 最大100リクエスト
  message: {
    success: false,
    message: 'リクエストが多すぎます。15分後に再試行してください。',
    retryAfter: '15分'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('[RateLimit] 一般API制限違反:', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      url: req.originalUrl,
      userId: req.user?.id
    });
    
    res.status(429).json({
      success: false,
      message: 'リクエストが多すぎます。15分後に再試行してください。',
      retryAfter: '15分'
    });
  }
});

/**
 * 認証API用の厳格なレート制限
 * 15分間に5リクエストまで（ブルートフォース攻撃対策）
 */
export const authApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分
  max: 5, // 最大5リクエスト
  message: {
    success: false,
    message: 'ログイン試行回数が上限に達しました。15分後に再試行してください。',
    retryAfter: '15分'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // 成功したリクエストはカウントしない
  handler: (req, res) => {
    logger.error('[RateLimit] 認証API制限違反（ブルートフォース攻撃の可能性）:', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      url: req.originalUrl,
      timestamp: new Date().toISOString()
    });
    
    res.status(429).json({
      success: false,
      message: 'ログイン試行回数が上限に達しました。15分後に再試行してください。',
      isSecurityBlock: true,
      retryAfter: '15分'
    });
  }
});

/**
 * 問題取得API用のレート制限
 * 1分間に10リクエストまで
 */
export const problemApiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1分
  max: 10, // 最大10リクエスト
  message: {
    success: false,
    message: '問題取得の試行回数が上限に達しました。1分後に再試行してください。',
    retryAfter: '1分'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('[RateLimit] 問題API制限違反:', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: req.user?.id,
      difficulty: req.query?.difficulty
    });
    
    res.status(429).json({
      success: false,
      message: '問題取得の試行回数が上限に達しました。1分後に再試行してください。',
      retryAfter: '1分'
    });
  }
});

/**
 * 結果提出API用のレート制限
 * 1時間に3リクエストまで（不正な複数回提出を防止）
 */
export const submitResultLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1時間
  max: 3, // 最大3リクエスト
  message: {
    success: false,
    message: '結果提出の試行回数が上限に達しました。1時間後に再試行してください。',
    retryAfter: '1時間'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // ユーザーIDベースでレート制限（IPではなく）
    return req.user?.id || req.ip;
  },
  handler: (req, res) => {
    logger.error('[RateLimit] 結果提出制限違反（不正な複数回提出の可能性）:', {
      ip: req.ip,
      userId: req.user?.id,
      userAgent: req.get('User-Agent'),
      difficulty: req.body?.difficulty
    });
    
    res.status(429).json({
      success: false,
      message: '結果提出の試行回数が上限に達しました。1時間後に再試行してください。',
      isSuspiciousActivity: true,
      retryAfter: '1時間'
    });
  }
});

/**
 * 管理者API用の制限
 * 5分間に20リクエストまで
 */
export const adminApiLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5分
  max: 20, // 最大20リクエスト
  message: {
    success: false,
    message: '管理者APIの制限に達しました。5分後に再試行してください。',
    retryAfter: '5分'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('[RateLimit] 管理者API制限違反:', {
      ip: req.ip,
      userId: req.user?.id,
      userAgent: req.get('User-Agent'),
      url: req.originalUrl
    });
    
    res.status(429).json({
      success: false,
      message: '管理者APIの制限に達しました。5分後に再試行してください。',
      retryAfter: '5分'
    });
  }
});

/**
 * 登録API用の制限
 * 1時間に3回まで（スパム登録防止）
 */
export const registrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1時間
  max: 3, // 最大3リクエスト
  message: {
    success: false,
    message: 'ユーザー登録の試行回数が上限に達しました。1時間後に再試行してください。',
    retryAfter: '1時間'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('[RateLimit] 登録API制限違反（スパム登録の可能性）:', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      username: req.body?.username,
      email: req.body?.email
    });
    
    res.status(429).json({
      success: false,
      message: 'ユーザー登録の試行回数が上限に達しました。1時間後に再試行してください。',
      retryAfter: '1時間'
    });
  }
});

/**
 * 開発環境用の緩い制限
 * 1分間に1000リクエストまで
 */
export const developmentLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1分
  max: 1000, // 最大1000リクエスト
  message: {
    success: false,
    message: '開発環境でも制限に達しました。1分後に再試行してください。',
    retryAfter: '1分'
  },
  handler: (req, res) => {
    logger.debug('[RateLimit] 開発環境制限違反:', {
      ip: req.ip,
      url: req.originalUrl
    });
    
    res.status(429).json({
      success: false,
      message: '開発環境でも制限に達しました。1分後に再試行してください。',
      retryAfter: '1分'
    });
  }
});

/**
 * 環境に応じたレート制限を適用
 */
export const getEnvironmentLimiter = () => {
  if (process.env.NODE_ENV === 'development') {
    logger.info('[RateLimit] 開発環境用の緩い制限を適用');
    return developmentLimiter;
  }
  
  logger.info('[RateLimit] 本番環境用の制限を適用');
  return generalApiLimiter;
};

/**
 * 管理者ユーザーのレート制限をスキップ
 */
export const skipLimitForAdmin = (req, res, next) => {
  if (req.user && req.user.isAdmin) {
    logger.debug('[RateLimit] 管理者ユーザーのためレート制限をスキップ:', req.user.username);
    return next();
  }
  
  // 管理者でない場合は通常のレート制限を適用
  return getEnvironmentLimiter()(req, res, next);
};

export default {
  generalApiLimiter,
  authApiLimiter,
  problemApiLimiter,
  submitResultLimiter,
  adminApiLimiter,
  registrationLimiter,
  developmentLimiter,
  getEnvironmentLimiter,
  skipLimitForAdmin
};