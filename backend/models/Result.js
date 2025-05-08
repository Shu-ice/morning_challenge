import mongoose from 'mongoose';
import { DifficultyRank } from '../constants/difficulty.js';

// 問題単位の結果のサブスキーマ
const ProblemResultSchema = new mongoose.Schema({
  id: Number,
  question: String,
  userAnswer: Number,
  correctAnswer: Number,
  isCorrect: Boolean,
  timeSpent: Number // 各問題にかかった時間（秒）
});

// 問題一式の結果スキーマ
const ResultSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  username: {
    type: String,
    required: true
  },
  difficulty: {
    type: String,
    enum: ['beginner', 'intermediate', 'advanced', 'expert'],
    required: true
  },
  date: {
    type: String, // "YYYY-MM-DD" 形式
    required: true
  },
  timeSpent: {
    type: Number, // 秒単位
    required: true
  },
  totalTime: {
    type: Number, // ミリ秒単位（フロントエンドとの一貫性のため）
    required: false
  },
  correctAnswers: {
    type: Number,
    required: true
  },
  incorrectAnswers: {
    type: Number,
    required: true
  },
  unanswered: {
    type: Number,
    required: true
  },
  totalProblems: {
    type: Number,
    required: true
  },
  score: {
    type: Number,
    required: true
  },
  grade: {
    type: Number,
    required: false
  },
  // 連続達成日数（ユーザーテーブルとの冗長保存）
  streak: {
    type: Number,
    default: 0,
    required: false
  },
  problems: [ProblemResultSchema], // 個々の問題の結果
  // ランキング情報（オプション）
  rank: {
    type: Number,
    required: false
  }
}, {
  timestamps: true
});

// インデックスを作成（ユーザーID、日付、難易度の組み合わせでユニーク）
ResultSchema.index({ userId: 1, date: 1, difficulty: 1 }, { unique: true });

const Result = mongoose.model('Result', ResultSchema);
export default Result;