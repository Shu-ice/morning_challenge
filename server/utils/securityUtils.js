import crypto from 'crypto';
import { logger } from './logger.js';

/**
 * 安全なランダムパスワードを生成
 * @param {number} length - パスワードの長さ（最小12文字）
 * @returns {string} 生成された安全なパスワード
 */
export const generateSecurePassword = (length = 16) => {
  const minLength = 12;
  const actualLength = Math.max(length, minLength);
  
  // 文字セット定義
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';
  
  const allChars = lowercase + uppercase + numbers + symbols;
  
  let password = '';
  
  // 各文字種から最低1文字ずつ含める
  password += lowercase[crypto.randomInt(lowercase.length)];
  password += uppercase[crypto.randomInt(uppercase.length)];
  password += numbers[crypto.randomInt(numbers.length)];
  password += symbols[crypto.randomInt(symbols.length)];
  
  // 残りの文字をランダムに生成
  for (let i = 4; i < actualLength; i++) {
    password += allChars[crypto.randomInt(allChars.length)];
  }
  
  // パスワードをシャッフル
  return password.split('').sort(() => crypto.randomInt(3) - 1).join('');
};

/**
 * パスワード強度をチェック
 * @param {string} password - チェックするパスワード
 * @returns {object} 強度情報
 */
export const checkPasswordStrength = (password) => {
  const checks = {
    length: password.length >= 8,
    lowercase: /[a-z]/.test(password),
    uppercase: /[A-Z]/.test(password),
    numbers: /[0-9]/.test(password),
    symbols: /[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password)
  };
  
  const score = Object.values(checks).filter(Boolean).length;
  
  let strength = 'weak';
  if (score >= 4) strength = 'strong';
  else if (score >= 3) strength = 'medium';
  
  return { checks, score, strength };
};

/**
 * 環境変数から安全にパスワードを取得または生成
 * @param {string} envKey - 環境変数のキー
 * @param {number} fallbackLength - フォールバック時のパスワード長
 * @returns {object} パスワード情報
 */
export const getOrGeneratePassword = (envKey, fallbackLength = 16) => {
  const envPassword = process.env[envKey];
  
  if (envPassword && envPassword.length >= 8) {
    const strength = checkPasswordStrength(envPassword);
    if (strength.strength === 'weak') {
      logger.warn(`⚠️ 環境変数 ${envKey} のパスワード強度が弱いです。より強力なパスワードを設定してください。`);
    }
    return {
      password: envPassword,
      isGenerated: false,
      strength: strength.strength
    };
  }
  
  const generatedPassword = generateSecurePassword(fallbackLength);
  logger.warn(`🔐 環境変数 ${envKey} が設定されていないため、安全なパスワードを自動生成しました。`);
  
  return {
    password: generatedPassword,
    isGenerated: true,
    strength: 'strong'
  };
};

/**
 * セキュリティログ用のマスキング関数
 * @param {string} sensitive - マスキングする機密情報
 * @param {number} visibleChars - 表示する文字数
 * @returns {string} マスキングされた文字列
 */
export const maskSensitive = (sensitive, visibleChars = 4) => {
  if (!sensitive || typeof sensitive !== 'string') return '***';
  if (sensitive.length <= visibleChars) return '*'.repeat(sensitive.length);
  
  const start = sensitive.substring(0, Math.floor(visibleChars / 2));
  const end = sensitive.substring(sensitive.length - Math.floor(visibleChars / 2));
  const middle = '*'.repeat(Math.max(3, sensitive.length - visibleChars));
  
  return `${start}${middle}${end}`;
}; 