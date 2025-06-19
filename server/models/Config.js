import mongoose from 'mongoose';

// 汎用設定を保存するコレクション
// key: 設定識別子
// value: 任意 (Mixed)
// 例: { key: 'timeWindow', value: { startMinutes: 390, endMinutes: 480 } }
const ConfigSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  value: { type: mongoose.Schema.Types.Mixed, required: true },
  updatedAt: { type: Date, default: Date.now }
});

export default mongoose.models.Config || mongoose.model('Config', ConfigSchema); 