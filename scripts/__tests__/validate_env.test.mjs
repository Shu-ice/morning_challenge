#!/usr/bin/env node

/**
 * validate_env.mjs のユニットテスト
 * 環境変数検証ロジックの動作確認
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const scriptPath = join(__dirname, '../validate_env.mjs');

// テスト用の環境変数をクリーンアップ
function cleanEnv() {
  delete process.env.NODE_ENV;
  delete process.env.MONGODB_MOCK;
  delete process.env.JWT_SECRET;
  delete process.env.MONGODB_URI;
  delete process.env.ADMIN_EMAIL;
  delete process.env.ADMIN_DEFAULT_PASSWORD;
  delete process.env.VERCEL;
  delete process.env.VERCEL_ENV;
  delete process.env.SKIP_ENV_VALIDATION;
}

// スクリプト実行ヘルパー
function runValidateEnv(env = {}) {
  const envString = Object.entries(env)
    .map(([key, value]) => `${key}="${value}"`)
    .join(' ');
  
  try {
    const output = execSync(`${envString} node ${scriptPath}`, {
      encoding: 'utf8',
      timeout: 10000
    });
    return { success: true, output, exitCode: 0 };
  } catch (error) {
    return { 
      success: false, 
      output: error.stdout || error.message, 
      exitCode: error.status || 1 
    };
  }
}

describe('validate_env.mjs Tests', () => {
  beforeEach(() => {
    cleanEnv();
  });

  afterEach(() => {
    cleanEnv();
  });

  describe('Vercel Mock Mode', () => {
    it('Vercel環境でMONGODB_MOCK=trueの場合、緩い検証で成功する', () => {
      const result = runValidateEnv({
        VERCEL: '1',
        MONGODB_MOCK: 'true',
        NODE_ENV: 'production'
      });
      
      assert.strictEqual(result.success, true, `Expected success but got: ${result.output}`);
      assert.match(result.output, /Vercel環境でモックモード検出/);
      assert.match(result.output, /Environment validation passed.*Vercel Mock Mode/);
    });

    it('Vercel環境でプレビューモードの場合、適切に処理される', () => {
      const result = runValidateEnv({
        VERCEL: '1',
        VERCEL_ENV: 'preview',
        MONGODB_MOCK: 'true',
        NODE_ENV: 'preview'
      });
      
      assert.strictEqual(result.success, true);
      assert.match(result.output, /Vercelプレビュー環境/);
    });

    it('SKIP_ENV_VALIDATION=trueで正常終了（非推奨警告あり）', () => {
      const result = runValidateEnv({
        SKIP_ENV_VALIDATION: 'true'
      });
      
      assert.strictEqual(result.success, true);
      assert.match(result.output, /deprecated, use MONGODB_MOCK=true instead/);
    });
  });

  describe('Development Environment', () => {
    it('開発環境で最小限の環境変数があれば成功する', () => {
      const result = runValidateEnv({
        NODE_ENV: 'development',
        MONGODB_MOCK: 'true',
        JWT_SECRET: 'development_secret_key_32_characters_minimum',
        MONGODB_URI: 'mongodb://localhost:27017/test'
      });
      
      assert.strictEqual(result.success, true);
      assert.match(result.output, /Environment validation passed/);
    });

    it('JWT_SECRETが短すぎる場合エラーになる', () => {
      const result = runValidateEnv({
        NODE_ENV: 'development',
        MONGODB_MOCK: 'true',
        JWT_SECRET: 'short',
        MONGODB_URI: 'mongodb://localhost:27017/test'
      });
      
      assert.strictEqual(result.success, false);
      assert.match(result.output, /JWT_SECRET must be at least 32 characters/);
    });

    it('MONGODB_URIが無効な形式の場合エラーになる', () => {
      const result = runValidateEnv({
        NODE_ENV: 'development',
        MONGODB_MOCK: 'false',
        JWT_SECRET: 'development_secret_key_32_characters_minimum',
        MONGODB_URI: 'invalid-uri'
      });
      
      assert.strictEqual(result.success, false);
      assert.match(result.output, /MONGODB_URI must be a valid MongoDB connection string/);
    });
  });

  describe('Production Environment', () => {
    it('本番環境では管理者設定も必須になる', () => {
      const result = runValidateEnv({
        NODE_ENV: 'production',
        MONGODB_MOCK: 'false',
        JWT_SECRET: 'production_secret_key_64_characters_minimum_for_security_reasons',
        MONGODB_URI: 'mongodb+srv://user:pass@cluster.mongodb.net/db'
      });
      
      // 管理者設定が不足してエラーになることを確認
      assert.strictEqual(result.success, false);
      assert.match(result.output, /Missing required environment variable: ADMIN_EMAIL|ADMIN_DEFAULT_PASSWORD/);
    });

    it('本番環境で全ての必須変数があれば成功する', () => {
      const result = runValidateEnv({
        NODE_ENV: 'production',
        MONGODB_MOCK: 'false',
        JWT_SECRET: 'production_secret_key_64_characters_minimum_for_security_reasons',
        MONGODB_URI: 'mongodb+srv://user:pass@cluster.mongodb.net/db',
        ADMIN_EMAIL: 'admin@company.com',
        ADMIN_DEFAULT_PASSWORD: 'SecurePassword123'
      });
      
      assert.strictEqual(result.success, true);
      assert.match(result.output, /本番環境: 全環境変数の厳密チェック/);
      assert.match(result.output, /Environment validation passed/);
    });

    it('本番環境でMONGODB_MOCK=trueの場合、セキュリティ警告が出る', () => {
      const result = runValidateEnv({
        NODE_ENV: 'production',
        MONGODB_MOCK: 'true',
        JWT_SECRET: 'production_secret_key_64_characters_minimum_for_security_reasons',
        MONGODB_URI: 'mongodb+srv://user:pass@cluster.mongodb.net/db',
        ADMIN_EMAIL: 'admin@company.com',
        ADMIN_DEFAULT_PASSWORD: 'SecurePassword123'
      });
      
      assert.strictEqual(result.success, true);
      assert.match(result.output, /MONGODB_MOCK=true in production environment/);
    });
  });

  describe('Error Handling', () => {
    it('必須環境変数が不足している場合、適切なエラーメッセージが出る', () => {
      const result = runValidateEnv({
        NODE_ENV: 'development'
        // JWT_SECRET, MONGODB_URI が不足
      });
      
      assert.strictEqual(result.success, false);
      assert.match(result.output, /Environment validation failed/);
      assert.match(result.output, /Missing required environment variable/);
      assert.match(result.output, /How to fix/);
    });

    it('管理者メールアドレスの形式が無効な場合エラーになる', () => {
      const result = runValidateEnv({
        NODE_ENV: 'production',
        MONGODB_MOCK: 'false',
        JWT_SECRET: 'production_secret_key_64_characters_minimum_for_security_reasons',
        MONGODB_URI: 'mongodb+srv://user:pass@cluster.mongodb.net/db',
        ADMIN_EMAIL: 'invalid-email',
        ADMIN_DEFAULT_PASSWORD: 'SecurePassword123'
      });
      
      assert.strictEqual(result.success, false);
      assert.match(result.output, /ADMIN_EMAIL must be a valid email address/);
    });
  });

  describe('Security Checks', () => {
    it('弱いJWT_SECRETの場合、セキュリティ警告が出る', () => {
      const result = runValidateEnv({
        NODE_ENV: 'development',
        MONGODB_MOCK: 'true',
        JWT_SECRET: 'fallback-secret-key-32-characters', // 弱いシークレット
        MONGODB_URI: 'mongodb://localhost:27017/test'
      });
      
      assert.strictEqual(result.success, true);
      assert.match(result.output, /JWT_SECRET appears to be a weak or default value/);
    });

    it('本番環境でSSLを使わないMongoDBの場合、セキュリティ警告が出る', () => {
      const result = runValidateEnv({
        NODE_ENV: 'production',
        MONGODB_MOCK: 'false',
        JWT_SECRET: 'production_secret_key_64_characters_minimum_for_security_reasons',
        MONGODB_URI: 'mongodb+srv://user:pass@cluster.mongodb.net/db', // ssl=true なし
        ADMIN_EMAIL: 'admin@company.com',
        ADMIN_DEFAULT_PASSWORD: 'SecurePassword123'
      });
      
      assert.strictEqual(result.success, true);
      assert.match(result.output, /MongoDB URI should use SSL in production/);
    });
  });
});

// テスト実行
console.log('🧪 Running validate_env.mjs tests...');