/**
 * dateUtils.ts のテストケース
 * 特に timeSpent 表示の桁ずれバグ対応をテスト
 */

import { formatTimeSpent, formatTime } from '../dateUtils';

describe('dateUtils', () => {
  describe('formatTimeSpent', () => {
    test('ミリ秒値（26422ms）を正しく26.42秒に変換', () => {
      expect(formatTimeSpent(26422)).toBe('26.42秒');
    });

    test('秒値（26.42s）をそのまま26.42秒として表示', () => {
      expect(formatTimeSpent(26.42)).toBe('26.42秒');
    });

    test('大きな値（10000以上）はミリ秒として扱う', () => {
      expect(formatTimeSpent(180000)).toBe('180.00秒'); // 180000ms = 180s = 3分
    });

    test('小さな値（10000未満）は秒として扱う', () => {
      expect(formatTimeSpent(180)).toBe('180.00秒'); // 180s = 3分
    });

    test('境界値のテスト', () => {
      expect(formatTimeSpent(9999)).toBe('9999.00秒'); // 秒として扱う
      expect(formatTimeSpent(10000)).toBe('10.00秒'); // ミリ秒として扱う
    });

    test('undefined/null/NaN値の処理', () => {
      expect(formatTimeSpent(undefined)).toBe('0.00秒');
      expect(formatTimeSpent(null as any)).toBe('0.00秒');
      expect(formatTimeSpent(NaN)).toBe('0.00秒');
    });

    test('ゼロ値の処理', () => {
      expect(formatTimeSpent(0)).toBe('0.00秒');
    });

    test('小数値の正確性', () => {
      expect(formatTimeSpent(26422.5)).toBe('26.42秒'); // ミリ秒として扱う
      expect(formatTimeSpent(26.425)).toBe('26.43秒'); // 秒として扱う（四捨五入）
    });
  });

  describe('formatTime（既存のミリ秒専用関数）', () => {
    test('ミリ秒を秒に正しく変換', () => {
      expect(formatTime(26422)).toBe('26.42秒');
      expect(formatTime(60000)).toBe('60.00秒');
      expect(formatTime(1500)).toBe('1.50秒');
    });

    test('undefined/null/NaN値の処理', () => {
      expect(formatTime(undefined)).toBe('0.00秒');
      expect(formatTime(null as any)).toBe('0.00秒');
      expect(formatTime(NaN)).toBe('0.00秒');
    });
  });
});