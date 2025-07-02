/**
 * 日付処理ユーティリティ
 * アプリケーション全体で一貫した日付処理を提供
 * JST（日本標準時）対応で朝のチャレンジアプリに最適化
 */

import { logger } from './logger.js';

// JST（UTC+9）のオフセット（ミリ秒）
const JST_OFFSET = 9 * 60 * 60 * 1000;

// 現在の日付をYYYY-MM-DD形式で取得
export const getTodayDateString = () => {
  const now = new Date();
  return formatDateToISOString(now);
};

// 日付オブジェクトをYYYY-MM-DD形式に変換
export const formatDateToISOString = (date) => {
  return date.toISOString().split('T')[0];
};

// YYYY-MM-DD形式の文字列から日付オブジェクトを作成
export const parseISODateString = (dateString) => {
  if (!dateString || !/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    throw new Error('無効な日付形式です。YYYY-MM-DD形式である必要があります。');
  }
  return new Date(dateString + 'T00:00:00Z');
};

// 今日の日付範囲（開始と終了）を取得
export const getTodayDateRange = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  return {
    start: today,
    end: tomorrow,
    dateString: formatDateToISOString(today)
  };
};

// 週の日付範囲（開始と終了）を取得
export const getWeekDateRange = () => {
  const today = new Date();
  const day = today.getDay(); // 0 (日曜日) から 6 (土曜日)
  
  // 週の始まり（日曜日）を計算
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - day);
  startOfWeek.setHours(0, 0, 0, 0);
  
  // 週の終わり（土曜日）を計算
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 7);
  
  // 週の日付範囲をYYYY-MM-DD形式の配列として取得
  const dateRange = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(startOfWeek);
    date.setDate(startOfWeek.getDate() + i);
    dateRange.push(formatDateToISOString(date));
  }
  
  return {
    start: startOfWeek,
    end: endOfWeek,
    dateRange,
    startDateString: formatDateToISOString(startOfWeek),
    endDateString: formatDateToISOString(new Date(endOfWeek.getTime() - 1))
  };
};

// 月の日付範囲（開始と終了）を取得
export const getMonthDateRange = () => {
  const today = new Date();
  
  // 月の始まり
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  startOfMonth.setHours(0, 0, 0, 0);
  
  // 月の終わり
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  endOfMonth.setHours(23, 59, 59, 999);
  
  // 月の日付範囲をYYYY-MM-DD形式の配列として取得
  const dateRange = [];
  for (let i = 1; i <= endOfMonth.getDate(); i++) {
    const date = new Date(today.getFullYear(), today.getMonth(), i);
    dateRange.push(formatDateToISOString(date));
  }
  
  return {
    start: startOfMonth,
    end: new Date(endOfMonth.getTime() + 1),
    dateRange,
    startDateString: formatDateToISOString(startOfMonth),
    endDateString: formatDateToISOString(endOfMonth)
  };
};

// ===== JST（日本標準時）対応の新機能 =====

/**
 * 現在のJST日付を YYYY-MM-DD 形式で取得
 * @returns {string} YYYY-MM-DD 形式の日付文字列
 */
export const getTodayJST = () => {
  const now = new Date();
  const jstDate = new Date(now.getTime() + JST_OFFSET);
  const dateStr = jstDate.toISOString().split('T')[0];
  
  logger.debug(`[DateUtils] getTodayJST: UTC=${now.toISOString()}, JST=${jstDate.toISOString()}, result=${dateStr}`);
  return dateStr;
};

/**
 * JST時刻での時間チェック（朝の時間制限用）
 * @returns {Object} 時間情報オブジェクト
 */
export const getJSTTimeInfo = () => {
  const now = new Date();
  const jstDate = new Date(now.getTime() + JST_OFFSET);
  
  const hours = jstDate.getHours();
  const minutes = jstDate.getMinutes();
  const currentTime = hours + minutes / 60;
  
  const timeInfo = {
    hours,
    minutes,
    currentTime,
    dateString: jstDate.toISOString().split('T')[0],
    timeString: `${hours}:${String(minutes).padStart(2, '0')}`,
    isWithinMorningWindow: currentTime >= 6.5 && currentTime <= 8.0,
    jstDate,
    utcDate: now
  };
  
  logger.debug(`[DateUtils] getJSTTimeInfo:`, {
    jstTime: timeInfo.timeString,
    isWithinWindow: timeInfo.isWithinMorningWindow,
    date: timeInfo.dateString
  });
  return timeInfo;
};

/**
 * 指定日付をJSTベースの YYYY-MM-DD 形式で取得
 * @param {Date|string|number} date - 変換する日付
 * @returns {string} YYYY-MM-DD 形式の日付文字列
 */
export const getDateJST = (date) => {
  let targetDate;
  
  if (typeof date === 'string') {
    targetDate = new Date(date);
  } else if (typeof date === 'number') {
    targetDate = new Date(date);
  } else if (date instanceof Date) {
    targetDate = date;
  } else {
    targetDate = new Date();
  }
  
  const jstDate = new Date(targetDate.getTime() + JST_OFFSET);
  return jstDate.toISOString().split('T')[0];
};

/**
 * 日付文字列の検証
 * @param {string} dateStr - 検証する日付文字列
 * @returns {boolean} 有効な日付かどうか
 */
export const isValidDateString = (dateStr) => {
  if (typeof dateStr !== 'string') return false;
  
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateStr)) return false;
  
  const date = new Date(dateStr + 'T00:00:00.000Z');
  return !isNaN(date.getTime()) && date.toISOString().split('T')[0] === dateStr;
};

/**
 * 昨日のJST日付を取得
 * @returns {string} YYYY-MM-DD 形式の昨日の日付
 */
export const getYesterdayJST = () => {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  return getDateJST(yesterday);
};

/**
 * 明日のJST日付を取得
 * @returns {string} YYYY-MM-DD 形式の明日の日付
 */
export const getTomorrowJST = () => {
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  return getDateJST(tomorrow);
};

/**
 * 開発/テスト用のタイムゾーン情報表示
 */
export const debugTimezoneInfo = () => {
  const now = new Date();
  const utc = now.toISOString();
  const jst = new Date(now.getTime() + JST_OFFSET).toISOString();
  const local = now.toString();
  
  const info = {
    utc,
    jst,
    local,
    utcDate: utc.split('T')[0],
    jstDate: jst.split('T')[0],
    offset: now.getTimezoneOffset(),
    jstOffsetFromLocal: (now.getTimezoneOffset() * 60 * 1000) + JST_OFFSET
  };
  
  logger.info('[DateUtils] Timezone Debug Info:', info);
  return info;
}; 