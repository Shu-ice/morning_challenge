import Config from '../models/Config.js';
import { getTimeWindow, setTimeWindow } from '../utils/timeWindow.js';
import { logger } from '../utils/logger.js';

// GET /api/admin/time-window
export const getTimeWindowConfig = async (req, res) => {
  try {
    let doc = await Config.findOne({ key: 'timeWindow' }).lean();
    if (!doc) {
      // 初期値を保存
      doc = await Config.create({ key: 'timeWindow', value: getTimeWindow() });
    }
    return res.json({ success: true, data: doc.value });
  } catch (err) {
    logger.error('[Config] getTimeWindow error:', err);
    res.status(500).json({ success: false, message: '設定取得に失敗しました' });
  }
};

// PUT /api/admin/time-window  { start: '06:30', end: '08:00' }
export const updateTimeWindowConfig = async (req, res) => {
  try {
    const { start, end } = req.body;
    if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) {
      return res.status(400).json({ success: false, message: 'HH:MM 形式で入力してください' });
    }
    const [sH, sM] = start.split(':').map(Number);
    const [eH, eM] = end.split(':').map(Number);
    const startMinutes = sH * 60 + sM;
    const endMinutes = eH * 60 + eM;
    if (startMinutes >= endMinutes) {
      return res.status(400).json({ success: false, message: '開始時刻は終了時刻より前である必要があります' });
    }
    // DB 更新
    const value = { startMinutes, endMinutes };
    const doc = await Config.findOneAndUpdate({ key: 'timeWindow' }, { value, updatedAt: new Date() }, { new: true, upsert: true });
    // メモリキャッシュ更新
    setTimeWindow(startMinutes, endMinutes);
    logger.info(`[Config] Time window updated: ${start} - ${end}`);
    res.json({ success: true, data: doc.value });
  } catch (err) {
    logger.error('[Config] updateTimeWindow error:', err);
    res.status(500).json({ success: false, message: '設定更新に失敗しました' });
  }
}; 