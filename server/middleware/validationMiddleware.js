import { body, query, param, validationResult } from 'express-validator';
import { logger } from '../utils/logger.js';
import { DifficultyRank } from '../constants/difficultyRank.js';
import { isValidDateString } from '../utils/dateUtils.js';

/**
 * バリデーションエラーハンドリングミドルウェア
 * express-validatorによるバリデーション結果を処理
 */
export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(error => ({
      field: error.path || error.param,
      message: error.msg,
      value: error.value
    }));
    
    logger.warn('[Validation] リクエストバリデーションエラー:', {
      url: req.originalUrl,
      method: req.method,
      errors: errorMessages,
      userId: req.user?.id
    });
    
    return res.status(400).json({
      success: false,
      message: 'リクエストデータに問題があります',
      errors: errorMessages
    });
  }
  
  next();
};

/**
 * 問題取得API用のバリデーション
 */
export const validateGetProblems = [
  query('difficulty')
    .optional()
    .isIn(Object.values(DifficultyRank))
    .withMessage(`難易度は次のいずれかである必要があります: ${Object.values(DifficultyRank).join(', ')}`),
  
  query('date')
    .optional()
    .custom((value) => {
      if (!isValidDateString(value)) {
        throw new Error('日付はYYYY-MM-DD形式である必要があります');
      }
      return true;
    }),
  
  query('skipTimeCheck')
    .optional()
    .isBoolean()
    .withMessage('skipTimeCheckはboolean値である必要があります'),
  
  query('userId')
    .optional()
    .isMongoId()
    .withMessage('userIdは有効なMongoDBのIDである必要があります'),
  
  handleValidationErrors
];

/**
 * 結果提出API用のバリデーション
 */
export const validateSubmitResult = [
  body('answers')
    .isArray({ min: 1, max: 20 })
    .withMessage('answersは1〜20個の配列である必要があります'),
  
  body('answers.*')
    .isInt({ min: -999999, max: 999999 })
    .withMessage('各回答は-999999から999999の整数である必要があります'),
  
  body('difficulty')
    .isIn(Object.values(DifficultyRank))
    .withMessage(`難易度は次のいずれかである必要があります: ${Object.values(DifficultyRank).join(', ')}`),
  
  body('date')
    .optional()
    .custom((value) => {
      if (!isValidDateString(value)) {
        throw new Error('日付はYYYY-MM-DD形式である必要があります');
      }
      return true;
    }),
  
  body('timeTaken')
    .isInt({ min: 1, max: 7200 })
    .withMessage('所要時間は1秒から2時間（7200秒）の間である必要があります'),
  
  handleValidationErrors
];

/**
 * ユーザー登録API用のバリデーション
 */
export const validateUserRegistration = [
  body('username')
    .isLength({ min: 3, max: 20 })
    .withMessage('ユーザー名は3文字以上20文字以下である必要があります')
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage('ユーザー名は英数字、ハイフン、アンダースコアのみ使用できます'),
  
  body('email')
    .isEmail()
    .withMessage('有効なメールアドレスを入力してください')
    .normalizeEmail(),
  
  body('password')
    .isLength({ min: 6, max: 128 })
    .withMessage('パスワードは6文字以上128文字以下である必要があります')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('パスワードは大文字、小文字、数字をそれぞれ含む必要があります'),
  
  body('grade')
    .isInt({ min: 1, max: 12 })
    .withMessage('学年は1年生から12年生の間で選択してください'),
  
  handleValidationErrors
];

/**
 * ユーザーログインAPI用のバリデーション
 */
export const validateUserLogin = [
  body('username')
    .isLength({ min: 1, max: 50 })
    .withMessage('ユーザー名を入力してください')
    .trim(),
  
  body('password')
    .isLength({ min: 1, max: 128 })
    .withMessage('パスワードを入力してください'),
  
  handleValidationErrors
];

/**
 * 管理者API用のバリデーション
 */
export const validateAdminUserUpdate = [
  param('userId')
    .isMongoId()
    .withMessage('有効なユーザーIDを指定してください'),
  
  handleValidationErrors
];

/**
 * 時間設定API用のバリデーション
 */
export const validateTimeWindow = [
  body('startHour')
    .isInt({ min: 0, max: 23 })
    .withMessage('開始時間は0時から23時の間で指定してください'),
  
  body('startMinute')
    .isInt({ min: 0, max: 59 })
    .withMessage('開始分は0分から59分の間で指定してください'),
  
  body('endHour')
    .isInt({ min: 0, max: 23 })
    .withMessage('終了時間は0時から23時の間で指定してください'),
  
  body('endMinute')
    .isInt({ min: 0, max: 59 })
    .withMessage('終了分は0分から59分の間で指定してください'),
  
  body('isEnabled')
    .isBoolean()
    .withMessage('有効/無効はboolean値で指定してください'),
  
  handleValidationErrors
];

/**
 * 汎用的なMongoID検証
 */
export const validateMongoId = (paramName = 'id') => [
  param(paramName)
    .isMongoId()
    .withMessage(`${paramName}は有効なMongoDBのIDである必要があります`),
  
  handleValidationErrors
];

/**
 * 日付範囲検証
 */
export const validateDateRange = [
  query('startDate')
    .optional()
    .custom((value) => {
      if (!isValidDateString(value)) {
        throw new Error('開始日はYYYY-MM-DD形式である必要があります');
      }
      return true;
    }),
  
  query('endDate')
    .optional()
    .custom((value) => {
      if (!isValidDateString(value)) {
        throw new Error('終了日はYYYY-MM-DD形式である必要があります');
      }
      return true;
    }),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage('制限値は1から1000の間で指定してください'),
  
  query('offset')
    .optional()
    .isInt({ min: 0 })
    .withMessage('オフセットは0以上の値である必要があります'),
  
  handleValidationErrors
];

/**
 * リクエストサイズ制限チェック
 */
export const validateRequestSize = (req, res, next) => {
  const contentLength = parseInt(req.get('Content-Length'));
  const maxSize = 1024 * 1024; // 1MB
  
  if (contentLength && contentLength > maxSize) {
    logger.warn('[Validation] リクエストサイズ制限超過:', {
      contentLength,
      maxSize,
      url: req.originalUrl,
      userId: req.user?.id
    });
    
    return res.status(413).json({
      success: false,
      message: 'リクエストサイズが大きすぎます（最大1MB）'
    });
  }
  
  next();
};

/**
 * SQLインジェクション対策のための基本的なサニタイゼーション
 */
export const sanitizeInput = (req, res, next) => {
  const sanitizeValue = (value) => {
    if (typeof value === 'string') {
      // 基本的な危険文字を除去/エスケープ
      return value
        .replace(/[<>]/g, '') // XSS対策
        .replace(/['";\\]/g, '') // SQLインジェクション対策
        .trim();
    }
    return value;
  };
  
  const sanitizeObject = (obj) => {
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        if (typeof obj[key] === 'object' && obj[key] !== null) {
          sanitizeObject(obj[key]);
        } else {
          obj[key] = sanitizeValue(obj[key]);
        }
      }
    }
  };
  
  // クエリパラメータとボディをサニタイズ
  if (req.query) sanitizeObject(req.query);
  if (req.body) sanitizeObject(req.body);
  
  next();
};

export default {
  handleValidationErrors,
  validateGetProblems,
  validateSubmitResult,
  validateUserRegistration,
  validateUserLogin,
  validateAdminUserUpdate,
  validateTimeWindow,
  validateMongoId,
  validateDateRange,
  validateRequestSize,
  sanitizeInput
};