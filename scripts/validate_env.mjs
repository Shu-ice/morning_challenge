#!/usr/bin/env node

/**
 * 環境変数バリデータ
 * ビルド前に必須環境変数をチェックし、不足があれば早期終了
 */

import { config } from 'dotenv';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

// 環境別設定ファイル読み込み（既存の環境変数を上書きしない）
const nodeEnv = process.env.NODE_ENV || 'development';
const envFiles = [
  `.env.${nodeEnv}.local`,
  `.env.local`,
  `.env.${nodeEnv}`,
  '.env'
];

// .env ファイルを順番に読み込み（既存の環境変数を上書きしない）
for (const envFile of envFiles) {
  const envPath = join(rootDir, envFile);
  if (existsSync(envPath)) {
    console.log(`📋 Loading environment from: ${envFile}`);
    config({ path: envPath, override: false }); // 既存の環境変数を保持
  }
}

// ---- Vercel環境での適切な検証ロジック ----
const isVercel = process.env.VERCEL === '1';
const isVercelPreview = process.env.VERCEL_ENV === 'preview';
const isMockMode = process.env.MONGODB_MOCK === 'true';

// SKIP_ENV_VALIDATION (廃止予定) - 後方互換性のため一時的に残す
if (process.env.SKIP_ENV_VALIDATION === 'true') {
  console.log('⚠️  SKIP_ENV_VALIDATION=true (deprecated, use MONGODB_MOCK=true instead)');
  process.exit(0);
}

// Vercel環境でモックモードの場合は緩い検証
if (isVercel && isMockMode) {
  console.log(`🚀 Vercel環境でモックモード検出 (VERCEL_ENV=${process.env.VERCEL_ENV})`);
  console.log('📋 必須環境変数の最小限チェックのみ実行...');
}

// 必須環境変数定義
const REQUIRED_VARS = {
  // 全環境共通
  'NODE_ENV': {
    required: true,
    description: 'Node.js実行環境 (development, production, test)',
    defaultValue: 'development'
  },
  
  // セキュリティ関連
  'JWT_SECRET': {
    required: true,
    description: 'JWT署名用シークレットキー',
    validator: (value) => value && value.length >= 32,
    errorMessage: 'JWT_SECRET must be at least 32 characters long'
  },
  'JWT_EXPIRES_IN': {
    required: false,
    description: 'JWTトークン有効期限',
    defaultValue: '7d'
  },
  
  // データベース関連
  'MONGODB_URI': {
    required: true,
    description: 'MongoDB接続文字列',
    validator: (value) => value && (value.startsWith('mongodb://') || value.startsWith('mongodb+srv://')),
    errorMessage: 'MONGODB_URI must be a valid MongoDB connection string'
  },
  'MONGODB_MOCK': {
    required: false,
    description: 'MongoDB モック使用フラグ',
    defaultValue: 'false',
    validator: (value) => ['true', 'false'].includes(value),
    errorMessage: 'MONGODB_MOCK must be "true" or "false"'
  }
};

// 本番環境専用の必須変数
const PRODUCTION_REQUIRED_VARS = {
  'ADMIN_EMAIL': {
    required: true,
    description: '管理者メールアドレス',
    validator: (value) => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const isValid = value && emailRegex.test(value);
      console.log(`DEBUG - Email validation: "${value}" -> ${isValid}`);
      return isValid;
    },
    errorMessage: 'ADMIN_EMAIL must be a valid email address'
  },
  'ADMIN_DEFAULT_PASSWORD': {
    required: true,
    description: '管理者デフォルトパスワード',
    validator: (value) => value && value.length >= 8,
    errorMessage: 'ADMIN_DEFAULT_PASSWORD must be at least 8 characters long'
  }
};

// バリデーション実行
function validateEnvironment() {
  console.log(`🔍 Validating environment variables for: ${nodeEnv}`);
  
  const errors = [];
  const warnings = [];
  let varsToCheck = { ...REQUIRED_VARS };
  
  // Vercel環境でモックモードの場合は最小限の検証
  if (isVercel && isMockMode) {
    console.log('📋 Vercelモックモード: 必須変数のみチェック');
    varsToCheck = {
      'NODE_ENV': REQUIRED_VARS['NODE_ENV'],
      'MONGODB_MOCK': REQUIRED_VARS['MONGODB_MOCK']
    };
    
    // デフォルト値を設定
    if (!process.env.JWT_SECRET) {
      process.env.JWT_SECRET = 'vercel_build_dummy_secret_key_32_chars_min';
      warnings.push('📝 JWT_SECRET: Vercelビルド用ダミー値を設定');
    }
    if (!process.env.MONGODB_URI) {
      process.env.MONGODB_URI = 'mongodb://localhost:27017/mock_db';
      warnings.push('📝 MONGODB_URI: モック用ダミー値を設定');
    }
    if (!process.env.ADMIN_EMAIL) {
      process.env.ADMIN_EMAIL = 'admin@example.com';
      warnings.push('📝 ADMIN_EMAIL: デフォルト値を設定');
    }
    if (!process.env.ADMIN_DEFAULT_PASSWORD) {
      process.env.ADMIN_DEFAULT_PASSWORD = 'DefaultPass123';
      warnings.push('📝 ADMIN_DEFAULT_PASSWORD: デフォルト値を設定');
    }
  } else {
    // 通常環境: 本番環境の場合は追加チェック
    if (nodeEnv === 'production' && !isMockMode) {
      Object.assign(varsToCheck, PRODUCTION_REQUIRED_VARS);
      console.log('🔒 本番環境: 全環境変数の厳密チェック');
    } else if (isVercelPreview) {
      console.log('🔍 Vercelプレビュー環境: 緩い検証モード');
      // プレビュー環境では一部の検証を緩和
      varsToCheck = { ...REQUIRED_VARS };
    }
  }
  
  for (const [varName, config] of Object.entries(varsToCheck)) {
    const value = process.env[varName];
    
    // デバッグ出力
    if (varName === 'ADMIN_EMAIL') {
      console.log(`DEBUG - ${varName}: "${value}" (type: ${typeof value})`);
    }
    
    // 必須チェック (Vercelモックモードでは緩和)
    if (config.required && !value) {
      if (isVercel && isMockMode) {
        // Vercelモックモードでは警告のみ
        warnings.push(`⚠️  Missing ${varName} (will use default in mock mode)`);
      } else {
        errors.push(`❌ Missing required environment variable: ${varName}`);
        errors.push(`   Description: ${config.description}`);
        if (config.defaultValue) {
          errors.push(`   Suggested value: ${config.defaultValue}`);
        }
        continue;
      }
    }
    
    // デフォルト値設定
    if (!value && config.defaultValue) {
      process.env[varName] = config.defaultValue;
      warnings.push(`⚠️  Using default value for ${varName}: ${config.defaultValue}`);
      continue;
    }
    
    // カスタムバリデータチェック
    if (value && config.validator && !config.validator(value)) {
      errors.push(`❌ Invalid value for ${varName}: ${config.errorMessage || 'Invalid value'}`);
      continue;
    }
    
    // 成功
    if (value) {
      const displayValue = varName.includes('SECRET') || varName.includes('PASSWORD') 
        ? '***MASKED***' 
        : value;
      console.log(`✅ ${varName}: ${displayValue}`);
    }
  }
  
  // 警告表示
  if (warnings.length > 0) {
    console.log('\\n⚠️  Warnings:');
    warnings.forEach(warning => console.log(warning));
  }
  
  // エラーがある場合は終了 (Vercelモックモードでは許可)
  if (errors.length > 0) {
    if (isVercel && isMockMode) {
      console.log('\\n⚠️  Environment validation warnings (continuing in Vercel mock mode):');
      errors.forEach(error => console.log(error));
      console.log('\\n🚀 Continuing build with mock data...');
    } else {
      console.log('\\n💥 Environment validation failed:');
      errors.forEach(error => console.log(error));
      
      console.log('\\n📖 How to fix:');
      console.log('1. Create .env file in project root');
      console.log('2. Add missing environment variables');
      console.log('3. For production deployment, set variables in Vercel dashboard');
      console.log('4. For Vercel builds, set MONGODB_MOCK=true to use mock mode');
      
      process.exit(1);
    }
  }
  
  const modeText = isVercel && isMockMode ? ' (Vercel Mock Mode)' : '';
  console.log(`\\n🎉 Environment validation passed${modeText}!`);
  return true;
}

// セキュリティチェック
function securityCheck() {
  const securityWarnings = [];
  
  // JWT_SECRET 強度チェック
  const jwtSecret = process.env.JWT_SECRET;
  if (jwtSecret) {
    if (jwtSecret === 'fallback-secret' || jwtSecret.includes('secret') || jwtSecret.includes('password')) {
      securityWarnings.push('🔒 JWT_SECRET appears to be a weak or default value');
    }
    if (jwtSecret.length < 64) {
      securityWarnings.push('🔒 JWT_SECRET should be at least 64 characters for maximum security');
    }
  }
  
  // 本番環境セキュリティチェック
  if (nodeEnv === 'production') {
    if (process.env.MONGODB_MOCK === 'true') {
      securityWarnings.push('🔒 MONGODB_MOCK=true in production environment');
    }
    
    const mongoUri = process.env.MONGODB_URI;
    if (mongoUri && !mongoUri.includes('ssl=true')) {
      securityWarnings.push('🔒 MongoDB URI should use SSL in production');
    }
  }
  
  if (securityWarnings.length > 0) {
    console.log('\\n🛡️  Security Recommendations:');
    securityWarnings.forEach(warning => console.log(warning));
  }
}

// バリデーション実行
try {
  validateEnvironment();
  securityCheck();
  
  console.log(`\\n📊 Environment Summary:`);
  console.log(`   Node Environment: ${process.env.NODE_ENV}`);
  console.log(`   MongoDB Mock: ${process.env.MONGODB_MOCK}`);
  console.log(`   JWT Expires: ${process.env.JWT_EXPIRES_IN}`);
  
} catch (error) {
  console.error('💥 Environment validation script error:', error);
  process.exit(1);
}