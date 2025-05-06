import mongoose from 'mongoose';
import { DifficultyRank } from '../utils/problemGenerator.js';

// 個々の問題の結果（DailyProblemSet内で使用）
const problemResultSchema = new mongoose.Schema({
    id: { type: String, required: true }, // ★ 問題ID (フロントエンドと合わせる)
    question: { type: String, required: true },
    correctAnswer: { type: Number, required: true },
    options: [{ type: Number }], // 生成された選択肢
    // ユーザー固有の回答は別コレクション（例: challenge_results）に保存する方が良い
}, { _id: false });

const dailyProblemSetSchema = new mongoose.Schema({
  date: {
    type: String, // YYYY-MM-DD 形式
    required: true,
    index: true, // 日付での検索を高速化
  },
  difficulty: {
    type: String, // 'beginner', 'intermediate', 'advanced', 'expert'
    required: true,
    enum: Object.values(DifficultyRank),
  },
  problems: {
    type: [problemResultSchema],
    required: true,
  },
  // 管理者が問題を編集したかどうかのフラグ (任意)
  isEdited: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: true,
  // 日付と難易度の組み合わせでユニークにする複合インデックス
  index: { date: 1, difficulty: 1 },
  unique: true,
});

const DailyProblemSet = mongoose.model('DailyProblemSet', dailyProblemSetSchema);

export default DailyProblemSet; 