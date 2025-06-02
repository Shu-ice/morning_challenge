require('dotenv').config();

/**
 * 環境変数設定と検証
 */
class EnvironmentConfig {
  constructor() {
    this.validateRequiredEnvVars();
    this.config = {
      // サーバー設定
      NODE_ENV: process.env.NODE_ENV || 'development',
      PORT: parseInt(process.env.PORT) || 3001,
      HOST: process.env.HOST || 'localhost',

      // データベース設定
      MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/morning_challenge',

      // セキュリティ設定
      JWT_SECRET: process.env.JWT_SECRET || 'default-secret-change-in-production',
      BCRYPT_ROUNDS: parseInt(process.env.BCRYPT_ROUNDS) || 12,

      // CORS設定
      CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:5173',

      // レート制限設定
      RATE_LIMIT_WINDOW: parseInt(process.env.RATE_LIMIT_WINDOW) || 15 * 60 * 1000, // 15分
      RATE_LIMIT_MAX: parseInt(process.env.RATE_LIMIT_MAX) || 100,

      // ログ設定
      LOG_LEVEL: process.env.LOG_LEVEL || 'info',

      // 問題生成設定
      MAX_PROBLEMS_PER_REQUEST: parseInt(process.env.MAX_PROBLEMS_PER_REQUEST) || 10,
      CACHE_TTL: parseInt(process.env.CACHE_TTL) || 3600 // 1時間（秒）
    };
  }

  /**
   * 必須環境変数の検証
   */
  validateRequiredEnvVars() {
    const required = [];
    
    // 本番環境でのみ必須
    if (process.env.NODE_ENV === 'production') {
      required.push('JWT_SECRET', 'MONGODB_URI');
    }

    const missing = required.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
      console.error('❌ 必須の環境変数が設定されていません:', missing.join(', '));
      console.error('💡 .env.exampleファイルを参考にしてください');
      process.exit(1);
    }
  }

  /**
   * 設定を取得
   */
  get(key) {
    return this.config[key];
  }

  /**
   * 全設定を取得
   */
  getAll() {
    return { ...this.config };
  }

  /**
   * 開発環境かどうか
   */
  isDevelopment() {
    return this.config.NODE_ENV === 'development';
  }

  /**
   * 本番環境かどうか
   */
  isProduction() {
    return this.config.NODE_ENV === 'production';
  }

  /**
   * テスト環境かどうか
   */
  isTest() {
    return this.config.NODE_ENV === 'test';
  }

  /**
   * 設定情報をログ出力（機密情報は隠す）
   */
  logConfig() {
    const safeConfig = { ...this.config };
    
    // 機密情報をマスク
    if (safeConfig.JWT_SECRET) {
      safeConfig.JWT_SECRET = '***masked***';
    }
    if (safeConfig.MONGODB_URI && safeConfig.MONGODB_URI.includes('@')) {
      safeConfig.MONGODB_URI = safeConfig.MONGODB_URI.replace(/\/\/.*@/, '//***:***@');
    }

    console.log('🔧 環境設定:', JSON.stringify(safeConfig, null, 2));
  }
}

module.exports = new EnvironmentConfig(); 