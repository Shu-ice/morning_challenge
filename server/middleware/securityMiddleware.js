import { logger } from '../utils/logger.js';

/**
 * セキュリティヘッダーを設定するミドルウェア
 */
export const securityHeaders = (req, res, next) => {
  // XSS保護
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // コンテンツタイプスニッフィング防止
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // フレーム埋め込み防止
  res.setHeader('X-Frame-Options', 'DENY');
  
  // HTTPSリダイレクト強制（本番環境のみ）
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  
  // リファラー情報制限
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // コンテンツセキュリティポリシー
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // React開発時に必要
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self' http://localhost:* http://127.0.0.1:*", // 開発環境
    "object-src 'none'",
    "frame-ancestors 'none'"
  ].join('; ');
  
  res.setHeader('Content-Security-Policy', csp);
  
  logger.debug('[Security] Security headers applied');
  next();
};

/**
 * API Rate Limiting (簡易版)
 */
const requestCounts = new Map();
const RATE_LIMIT = 100; // 10分間に100リクエスト
const WINDOW_MS = 10 * 60 * 1000; // 10分

export const rateLimiter = (req, res, next) => {
  const clientId = req.ip || req.connection.remoteAddress || 'unknown';
  const now = Date.now();
  
  // 古いエントリをクリーンアップ
  if (Math.random() < 0.1) { // 10%の確率でクリーンアップ
    for (const [key, data] of requestCounts.entries()) {
      if (now - data.firstRequest > WINDOW_MS) {
        requestCounts.delete(key);
      }
    }
  }
  
  const clientData = requestCounts.get(clientId);
  
  if (!clientData) {
    requestCounts.set(clientId, {
      count: 1,
      firstRequest: now
    });
    next();
    return;
  }
  
  // ウィンドウをリセット
  if (now - clientData.firstRequest > WINDOW_MS) {
    requestCounts.set(clientId, {
      count: 1,
      firstRequest: now
    });
    next();
    return;
  }
  
  clientData.count++;
  
  if (clientData.count > RATE_LIMIT) {
    logger.warn(`[Security] Rate limit exceeded for ${clientId}: ${clientData.count} requests`);
    res.status(429).json({
      success: false,
      message: 'リクエスト数が上限を超えました。しばらく待ってから再試行してください。',
      retryAfter: Math.ceil((WINDOW_MS - (now - clientData.firstRequest)) / 1000)
    });
    return;
  }
  
  next();
};

/**
 * 入力値サニタイゼーション
 */
export const sanitizeInput = (req, res, next) => {
  const sanitizeString = (str) => {
    if (typeof str !== 'string') return str;
    
    // SQLインジェクション防止
    str = str.replace(/['"]/g, '');
    
    // XSS防止
    str = str.replace(/[<>]/g, '');
    
    return str.trim();
  };
  
  const sanitizeObject = (obj) => {
    if (typeof obj !== 'object' || obj === null) return obj;
    
    for (const key in obj) {
      if (typeof obj[key] === 'string') {
        obj[key] = sanitizeString(obj[key]);
      } else if (typeof obj[key] === 'object') {
        obj[key] = sanitizeObject(obj[key]);
      }
    }
    
    return obj;
  };
  
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }
  
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }
  
  next();
}; 