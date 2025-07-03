#!/usr/bin/env node

/**
 * 環境変数バリデータ
 * ビルド前に必須環境変数をチェックし、不足があれば早期終了
 */

import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// 簡易dotenv実装（組み込みモジュールのみ使用）
function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;
  
  const content = readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#')) continue;
    
    const [key, ...valueParts] = trimmed.split('=');
    if (key && valueParts.length > 0) {
      const value = valueParts.join('=').replace(/^["']|["']$/g, ''); // クォート除去
      if (!process.env[key]) { // 既存の環境変数を上書きしない
        process.env[key] = value;
      }
    }
  }
}

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
    loadEnvFile(envPath);
  }
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
  const varsToCheck = { ...REQUIRED_VARS };
  
  // 本番環境の場合は追加チェック
  if (nodeEnv === 'production') {
    Object.assign(varsToCheck, PRODUCTION_REQUIRED_VARS);
  }
  
  for (const [varName, config] of Object.entries(varsToCheck)) {
    const value = process.env[varName];
    
    // デバッグ出力
    if (varName === 'ADMIN_EMAIL') {
      console.log(`DEBUG - ${varName}: "${value}" (type: ${typeof value})`);
    }
    
    // 必須チェック
    if (config.required && !value) {
      errors.push(`❌ Missing required environment variable: ${varName}`);
      errors.push(`   Description: ${config.description}`);
      if (config.defaultValue) {
        errors.push(`   Suggested value: ${config.defaultValue}`);
      }
      continue;
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
  
  // エラーがある場合は終了
  if (errors.length > 0) {
    console.log('\\n💥 Environment validation failed:');
    errors.forEach(error => console.log(error));
    
    console.log('\\n📖 How to fix:');
    console.log('1. Create .env file in project root');
    console.log('2. Add missing environment variables');
    console.log('3. For production deployment, set variables in Vercel dashboard');
    
    process.exit(1);
  }
  
  console.log('\\n🎉 Environment validation passed!');
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