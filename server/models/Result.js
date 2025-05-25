import mongoose from 'mongoose';

const ProblemResultSchema = new mongoose.Schema({
  question: { type: String, required: true },
  userAnswer: { type: Number, default: null }, // ユーザーの回答 (数値 or null)
  correctAnswer: { type: Number, required: true },
  isCorrect: { type: Boolean, required: true },
  // id: { type: Number, required: true }, // 個々の問題IDは不要かも
}, { _id: false }); // ProblemResult には独自の _id を不要とする

const ResultSchema = new mongoose.Schema({
  // ユーザーへの参照（ObjectId）- これを必ず使用すべき
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true,
    index: true 
  },
  // 表示用ユーザー名（変更される可能性がある）
  username: { 
    type: String, 
    required: true, 
    index: true 
  },
  difficulty: {
    type: String,
    required: true,
    enum: ['beginner', 'intermediate', 'advanced', 'expert'], // DifficultyRank と合わせる
    index: true,
  },
  date: {
    type: String, // 'YYYY-MM-DD' 形式
    required: true,
    index: true,
  },
  totalProblems: { type: Number, required: true },
  correctAnswers: { type: Number, required: true },
  incorrectAnswers: { type: Number, required: true },
  unanswered: { type: Number, required: true },
  score: { type: Number, required: true },
  timeSpent: { type: Number, required: true }, // 秒単位
  totalTime: { type: Number, required: true }, // ミリ秒単位 (フロントが使っていたもの)
  problems: [ProblemResultSchema], // 個々の問題の結果
  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
  // ★ timestamp フィールドを追加
  timestamp: {
    type: Date,
    default: Date.now // デフォルトで現在時刻を設定
  },
});

// ユーザーID、日付での複合ユニークインデックス (難易度に関わらず1日1回)
ResultSchema.index({ userId: 1, date: 1 }, { unique: true }); // ← こちらを有効化

// 新しい複合ユニークインデックス: ユーザーID、日付、難易度でユニーク
// ResultSchema.index({ userId: 1, date: 1, difficulty: 1 }, { unique: true }); // ← こちらをコメントアウト

export default mongoose.model('Result', ResultSchema); 