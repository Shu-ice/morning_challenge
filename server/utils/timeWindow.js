// Utility to cache time-window configuration in memory
let timeWindow = {
  startMinutes: 6 * 60 + 30, // 06:30 default
  endMinutes: 8 * 60 // 08:00 default
};

export function getTimeWindow() {
  return timeWindow;
}

export function setTimeWindow(startMinutes, endMinutes) {
  timeWindow = { startMinutes, endMinutes };
} 