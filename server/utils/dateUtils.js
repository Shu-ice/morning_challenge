/**
 * 日付処理ユーティリティ
 * アプリケーション全体で一貫した日付処理を提供
 */

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