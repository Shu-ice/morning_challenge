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

// === パフォーマンス最適化インデックス ===

// 1. ユニーク制約: ユーザーID、日付、難易度でユニーク（1日1難易度1回）
ResultSchema.index({ userId: 1, date: 1, difficulty: 1 }, { unique: true });

// 2. ランキング表示用（最重要）- 難易度・日付別でスコア順ソート
ResultSchema.index({ difficulty: 1, date: 1, score: -1 });

// 3. ユーザー履歴表示用 - 特定ユーザーの履歴を日付順で取得
ResultSchema.index({ userId: 1, date: -1 });

// 4. 統計分析用 - 時間ベースのパフォーマンス分析
ResultSchema.index({ timeSpent: 1, score: -1 });

// 5. 管理者分析用 - 日付期間での集計
ResultSchema.index({ date: 1, createdAt: 1 });

export default mongoose.model('Result', ResultSchema); 