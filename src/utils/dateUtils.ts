/**
 * フロントエンド用日付・時間ユーティリティ
 * アプリケーション全体で一貫した日付・時間処理を提供
 */

/**
 * JSTタイムゾーンで日付をYYYY-MM-DD形式の文字列に変換
 * @param date - 変換する日付（オプション、デフォルトは現在時刻）
 * @returns YYYY-MM-DD形式の文字列（JSTタイムゾーン）
 */
export const getFormattedDate = (date: Date = new Date()): string => {
  // UTC → JST 変換してから YYYY-MM-DD 抽出
  const jstDate = new Date(date.getTime() + 9*60*60*1000);
  return jstDate.toISOString().slice(0, 10);
};

/**
 * 旧関数（ローカルタイムゾーン版）- 後方互換性のため残す
 * @param date - 変換する日付
 * @returns YYYY-MM-DD形式の文字列（ローカルタイムゾーン）
 */
export const getFormattedDateLocal = (date: Date): string => {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

/**
 * JSTタイムゾーンで現在の日付をYYYY-MM-DD形式で取得
 * @returns JSTでの今日の日付のYYYY-MM-DD形式の文字列
 */
export const getTodayFormatted = (): string => {
  return getFormattedDate();
};

/**
 * ミリ秒を秒単位の文字列に変換
 * @param milliseconds - 変換するミリ秒
 * @returns 秒単位の文字列（小数点以下2桁）
 */
export const formatTime = (milliseconds: number | undefined): string => {
  if (milliseconds === undefined || milliseconds === null || isNaN(milliseconds)) {
    return '0.00秒';
  }
  
  const totalSeconds = milliseconds / 1000;
  return `${totalSeconds.toFixed(2)}秒`;
};

/**
 * ミリ秒を分:秒形式の文字列に変換
 * @param milliseconds - 変換するミリ秒
 * @returns 分:秒形式の文字列
 */
export const formatTimeMinutes = (milliseconds: number | undefined): string => {
  if (milliseconds === undefined || milliseconds === null || isNaN(milliseconds)) {
    return '0:00';
  }
  
  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

/**
 * ミリ秒を時:分:秒形式の文字列に変換
 * @param milliseconds - 変換するミリ秒
 * @returns 時:分:秒形式の文字列
 */
export const formatTimeHours = (milliseconds: number | undefined): string => {
  if (milliseconds === undefined || milliseconds === null || isNaN(milliseconds)) {
    return '0:00:00';
  }
  
  const totalSeconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  
  return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

/**
 * 日付の差分を日数で計算
 * @param date1 - 比較する日付1
 * @param date2 - 比較する日付2
 * @returns 日数の差分（date1 - date2）
 */
export const daysDifference = (date1: Date, date2: Date): number => {
  const timeDiff = date1.getTime() - date2.getTime();
  return Math.ceil(timeDiff / (1000 * 3600 * 24));
};

/**
 * 日付文字列が有効かチェック
 * @param dateString - チェックする日付文字列（YYYY-MM-DD形式）
 * @returns 有効な場合true
 */
export const isValidDateString = (dateString: string): boolean => {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateString)) return false;
  
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date.getTime());
};

/**
 * JSTタイムゾーンで日付が今日かチェック
 * @param date - チェックする日付
 * @returns JSTでの今日の場合true
 */
export const isToday = (date: Date): boolean => {
  const todayJST = getFormattedDate();
  const dateJST = getFormattedDate(date);
  return todayJST === dateJST;
};

/**
 * ローカルタイムゾーンで日付が今日かチェック（旧関数）
 * @param date - チェックする日付
 * @returns ローカルでの今日の場合true
 */
export const isTodayLocal = (date: Date): boolean => {
  const today = new Date();
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
};

/**
 * 日付が過去かチェック
 * @param date - チェックする日付
 * @returns 過去の場合true
 */
export const isPastDate = (date: Date): boolean => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date.getTime() < today.getTime();
};

/**
 * 日付が未来かチェック
 * @param date - チェックする日付
 * @returns 未来の場合true
 */
export const isFutureDate = (date: Date): boolean => {
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  return date.getTime() > today.getTime();
};

export const getTodayJST = (): string => {
  const jst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return getFormattedDate(jst);
}; 