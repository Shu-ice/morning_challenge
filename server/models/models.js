// 履歴モデルの作成（問題解答履歴の保存）
const ResultSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  username: {
    type: String,
    required: true
  },
  difficulty: {
    type: String,
    enum: Object.values(DifficultyRank),
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
  problems: [{
    id: Number,
    question: String,
    userAnswer: Number,
    correctAnswer: Number,
    isCorrect: Boolean,
    timeSpent: Number // 各問題の解答にかかった時間（秒）
  }],
  rank: {
    type: Number,
    required: false
  }
}, {
  timestamps: true
}); 