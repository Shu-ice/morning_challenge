import dotenv from 'dotenv';
const { logger } = require('../utils/logger');

// .envファイルを読み込み
dotenv.config();

/**
 * 環境設定管理クラス
 */
class EnvironmentConfig {
  constructor() {
    this.environment = process.env.NODE_ENV || 'development';
    this.port = parseInt(process.env.PORT || process.env.BACKEND_PORT || '5003', 10);
    this.frontendPort = parseInt(process.env.FRONTEND_PORT || '3004', 10);
    this.jwtSecret = process.env.JWT_SECRET;
    this.jwtExpiresIn = process.env.JWT_EXPIRES_IN || '30d';
    this.mongodbUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/morning_challenge';
    this.mongodbMock = process.env.MONGODB_MOCK === 'true';
    this.disableTimeCheck = process.env.DISABLE_TIME_CHECK === 'true';
    this.logLevel = process.env.LOG_LEVEL || 'info';
    
    this.validateConfig();
  }

  /**
   * 必須設定項目の検証
   */
  validateConfig() {
    if (!this.jwtSecret) {
      throw new Error('JWT_SECRET環境変数が設定されていません');
    }
    
    if (this.jwtSecret.length < 32) {
      logger.warn('⚠️ JWT_SECRETが短すぎます。セキュリティのため32文字以上を推奨します。');
    }
    
    if (this.environment === 'production' && this.mongodbMock) {
      logger.warn('⚠️ 本番環境でモックデータベースが有効になっています。');
    }
  }

  /**
   * 開発環境かどうか
   */
  isDevelopment() {
    return this.environment === 'development';
  }

  /**
   * 本番環境かどうか
   */
  isProduction() {
    return this.environment === 'production';
  }

  /**
   * テスト環境かどうか
   */
  isTest() {
    return this.environment === 'test';
  }

  /**
   * CORS設定を取得
   */
  getCorsOrigin() {
    if (this.isDevelopment()) {
      return [`http://localhost:${this.frontendPort}`, 'http://localhost:3000'];
    }
    
    // 本番環境では環境変数から取得
    return process.env.CORS_ORIGIN?.split(',') || false;
  }

  /**
   * データベース接続文字列を取得
   */
  getDatabaseUrl() {
    return this.mongodbUri;
  }

  /**
   * 設定情報を表示（機密情報はマスク）
   */
  displayConfig() {
    logger.info('📋 現在の設定:');
    logger.info(`   環境: ${this.environment}`);
    logger.info(`   ポート: ${this.port}`);
    logger.info(`   フロントエンドポート: ${this.frontendPort}`);
    logger.info(`   JWT有効期限: ${this.jwtExpiresIn}`);
    logger.info(`   MongoDB URI: ${this.mongodbUri.replace(/\/\/.*@/, '//***:***@')}`); // パスワードをマスク
    logger.info(`   モックDB: ${this.mongodbMock}`);
    logger.info(`   時間制限無効: ${this.disableTimeCheck}`);
    logger.info(`   ログレベル: ${this.logLevel}`);
  }
}

export default new EnvironmentConfig(); 