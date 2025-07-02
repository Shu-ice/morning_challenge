import { logger } from './logger.js';

/**
 * エラーハンドリングユーティリティ
 * 統一されたエラー処理とログ記録を提供
 */

/**
 * カスタムエラークラス
 */
export class AppError extends Error {
  constructor(message, statusCode = 500, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.timestamp = new Date().toISOString();
    
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * バリデーションエラークラス
 */
export class ValidationError extends AppError {
  constructor(message, field = null, value = null) {
    super(message, 400);
    this.type = 'ValidationError';
    this.field = field;
    this.value = value;
  }
}

/**
 * 認証エラークラス
 */
export class AuthenticationError extends AppError {
  constructor(message = '認証が必要です') {
    super(message, 401);
    this.type = 'AuthenticationError';
  }
}

/**
 * 権限エラークラス
 */
export class AuthorizationError extends AppError {
  constructor(message = '権限が不足しています') {
    super(message, 403);
    this.type = 'AuthorizationError';
  }
}

/**
 * リソース未発見エラークラス
 */
export class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource}が見つかりません`, 404);
    this.type = 'NotFoundError';
    this.resource = resource;
  }
}

/**
 * データベースエラークラス
 */
export class DatabaseError extends AppError {
  constructor(message = 'データベースエラーが発生しました', originalError = null) {
    super(message, 500);
    this.type = 'DatabaseError';
    this.originalError = originalError;
  }
}

/**
 * レート制限エラークラス
 */
export class RateLimitError extends AppError {
  constructor(message = 'リクエスト制限に達しました', retryAfter = null) {
    super(message, 429);
    this.type = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

/**
 * 時間制限エラークラス
 */
export class TimeRestrictionError extends AppError {
  constructor(message = '現在の時間帯ではアクセスできません', allowedTime = null) {
    super(message, 403);
    this.type = 'TimeRestrictionError';
    this.allowedTime = allowedTime;
  }
}

/**
 * エラーの分類と処理
 */
export const classifyError = (error) => {
  // MongoDBエラー
  if (error.name === 'MongoError' || error.name === 'MongoServerError') {
    return new DatabaseError('データベース接続エラー', error);
  }
  
  // Mongoose バリデーションエラー
  if (error.name === 'ValidationError') {
    const field = Object.keys(error.errors)[0];
    const message = error.errors[field]?.message || 'バリデーションエラー';
    return new ValidationError(message, field);
  }
  
  // Mongoose CastError (無効なObjectId等)
  if (error.name === 'CastError') {
    return new ValidationError(`無効な${error.path}形式: ${error.value}`);
  }
  
  // JWT エラー
  if (error.name === 'JsonWebTokenError') {
    return new AuthenticationError('無効なトークンです');
  }
  
  if (error.name === 'TokenExpiredError') {
    return new AuthenticationError('トークンの有効期限が切れています');
  }
  
  // 既存のAppErrorはそのまま返す
  if (error instanceof AppError) {
    return error;
  }
  
  // その他のエラーは汎用エラーとして処理
  return new AppError(
    process.env.NODE_ENV === 'production' 
      ? 'サーバーエラーが発生しました' 
      : error.message,
    500,
    false
  );
};

/**
 * エラーレスポンスの生成
 */
export const generateErrorResponse = (error, req = null) => {
  const classifiedError = classifyError(error);
  
  // ログ記録
  const logContext = {
    error: {
      message: classifiedError.message,
      type: classifiedError.type || 'UnknownError',
      statusCode: classifiedError.statusCode,
      stack: classifiedError.stack
    },
    request: req ? {
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: req.user?.id
    } : null,
    timestamp: classifiedError.timestamp
  };
  
  if (classifiedError.statusCode >= 500) {
    logger.error('[ErrorHandler] サーバーエラー:', logContext);
  } else if (classifiedError.statusCode >= 400) {
    logger.warn('[ErrorHandler] クライアントエラー:', logContext);
  } else {
    logger.info('[ErrorHandler] 情報エラー:', logContext);
  }
  
  // レスポンス構築
  const response = {
    success: false,
    message: classifiedError.message,
    timestamp: classifiedError.timestamp
  };
  
  // エラータイプ固有の情報を追加
  if (classifiedError instanceof ValidationError) {
    response.field = classifiedError.field;
    response.type = 'validation';
  } else if (classifiedError instanceof TimeRestrictionError) {
    response.isTimeRestricted = true;
    response.allowedTime = classifiedError.allowedTime;
    response.type = 'time_restriction';
  } else if (classifiedError instanceof RateLimitError) {
    response.retryAfter = classifiedError.retryAfter;
    response.type = 'rate_limit';
  } else if (classifiedError instanceof NotFoundError) {
    response.resource = classifiedError.resource;
    response.type = 'not_found';
  }
  
  // 開発環境では詳細情報を追加
  if (process.env.NODE_ENV === 'development') {
    response.debug = {
      originalError: error.message,
      stack: classifiedError.stack,
      type: classifiedError.constructor.name
    };
  }
  
  return {
    statusCode: classifiedError.statusCode,
    response
  };
};

/**
 * Express エラーハンドリングミドルウェア
 */
export const globalErrorHandler = (error, req, res, next) => {
  const { statusCode, response } = generateErrorResponse(error, req);
  
  // ヘッダー送信済みの場合はデフォルトハンドラーに移譲
  if (res.headersSent) {
    return next(error);
  }
  
  res.status(statusCode).json(response);
};

/**
 * 404エラーハンドラー
 */
export const notFoundHandler = (req, res, next) => {
  const error = new NotFoundError(`Route ${req.originalUrl}`);
  next(error);
};

/**
 * 非同期エラーキャッチヘルパー
 */
export const catchAsync = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * プロセス未処理例外ハンドラー
 */
export const setupProcessErrorHandlers = () => {
  process.on('uncaughtException', (error) => {
    logger.error('[ProcessError] 未処理例外:', {
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    
    // 安全なシャットダウン
    process.exit(1);
  });
  
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('[ProcessError] 未処理Promise拒否:', {
      reason: reason?.message || reason,
      promise: promise.toString(),
      timestamp: new Date().toISOString()
    });
    
    // 安全なシャットダウン
    process.exit(1);
  });
  
  // Graceful shutdown on SIGTERM
  process.on('SIGTERM', () => {
    logger.info('[ProcessError] SIGTERM受信、安全なシャットダウンを開始');
    // ここでクリーンアップ処理を実行
    process.exit(0);
  });
  
  // Graceful shutdown on SIGINT (Ctrl+C)
  process.on('SIGINT', () => {
    logger.info('[ProcessError] SIGINT受信、安全なシャットダウンを開始');
    // ここでクリーンアップ処理を実行
    process.exit(0);
  });
};

/**
 * エラー統計の収集
 */
class ErrorStats {
  constructor() {
    this.stats = {
      total: 0,
      byType: {},
      byStatusCode: {},
      lastHour: []
    };
  }
  
  record(error) {
    const now = new Date();
    this.stats.total++;
    
    // タイプ別統計
    const type = error.type || 'Unknown';
    this.stats.byType[type] = (this.stats.byType[type] || 0) + 1;
    
    // ステータスコード別統計
    const statusCode = error.statusCode || 500;
    this.stats.byStatusCode[statusCode] = (this.stats.byStatusCode[statusCode] || 0) + 1;
    
    // 直近1時間の記録
    this.stats.lastHour.push({
      timestamp: now,
      type,
      statusCode,
      message: error.message
    });
    
    // 1時間より古い記録を削除
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    this.stats.lastHour = this.stats.lastHour.filter(
      record => record.timestamp > oneHourAgo
    );
  }
  
  getStats() {
    return {
      ...this.stats,
      recentCount: this.stats.lastHour.length
    };
  }
  
  reset() {
    this.stats = {
      total: 0,
      byType: {},
      byStatusCode: {},
      lastHour: []
    };
  }
}

export const errorStats = new ErrorStats();

export default {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  DatabaseError,
  RateLimitError,
  TimeRestrictionError,
  classifyError,
  generateErrorResponse,
  globalErrorHandler,
  notFoundHandler,
  catchAsync,
  setupProcessErrorHandlers,
  errorStats
};