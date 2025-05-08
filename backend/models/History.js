import mongoose from 'mongoose';

const HistorySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  },
  difficulty: {
    type: String,
    required: true,
    enum: ['beginner', 'intermediate', 'advanced', 'expert'] // 例: 難易度
  },
  grade: {
    type: Number, // 問題の学年
    required: false
  },
  totalProblems: {
    type: Number,
    required: true
  },
  correctAnswers: {
    type: Number,
    required: true
  },
  score: {
    type: Number,
    required: true
  },
  timeSpent: { // 解答にかかった時間 (秒)
    type: Number, 
    required: true
  },
  problems: [{ // 解答した問題の詳細 (オプション)
    problem: String, // 問題文
    userAnswer: String, // ユーザーの解答
    correctAnswer: String, // 正解
    isCorrect: Boolean // 正誤
  }],
  timestamp: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model('History', HistorySchema); 