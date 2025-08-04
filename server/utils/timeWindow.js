import { DateTime } from 'luxon';

const TZ = 'Asia/Tokyo';

export function nowJST() {
  return DateTime.now().setZone(TZ);
}

export function getDateKeyJST(dt = nowJST()) {
  return dt.toFormat('yyyy-LL-dd');
}

export function inMorningWindow(dt = nowJST()) {
  const s = dt.set({ hour: 5, minute: 15, second: 0, millisecond: 0 });
  const e = dt.set({ hour: 7, minute: 15, second: 0, millisecond: 0 });
  return dt >= s && dt <= e;
}

export function inBonusWindow(dt = nowJST()) {
  const s = dt.set({ hour: 16, minute: 0, second: 0, millisecond: 0 });
  const e = dt.set({ hour: 17, minute: 0, second: 0, millisecond: 0 });
  return dt >= s && dt <= e;
}

export function isoWeekKey(dt = nowJST()) {
  const { weekYear, weekNumber } = dt;
  return `${weekYear}-W${String(weekNumber).padStart(2, '0')}`;
}

// Legacy compatibility
export function getTimeWindow() {
  return {
    startMinutes: 5 * 60 + 15, // 05:15
    endMinutes: 7 * 60 + 15 // 07:15
  };
}

export function setTimeWindow(startMinutes, endMinutes) {
  // No-op for compatibility
} 