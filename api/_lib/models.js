// 🚀 一元化されたMongooseモデル定義
// Vercel Serverless環境での最適化済み

const mongoose = require('mongoose');

// ========================================
// 1. DailyProblemSet モデル
// ========================================
const dailyProblemSetSchema = new mongoose.Schema({
  date: { type: String, required: true, index: true },
  difficulty: { 
    type: String, 
    required: true, 
    enum: ['beginner', 'intermediate', 'advanced', 'expert'],
    index: true 
  },
  problems: { type: Array, required: true },
  isEdited: { type: Boolean, default: false }
}, { 
  timestamps: true,
  collection: 'dailyp problemsets'
});

// ========================================
// 2. User モデル
// ========================================
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, index: true },
  email: { type: String, required: true, unique: true, index: true },
  password: { type: String, required: true },
  grade: { type: Number, default: 1, index: true },
  avatar: { type: String, default: '😊' },
  isAdmin: { type: Boolean, default: false, index: true },
  points: { type: Number, default: 0 },
  streak: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now, index: true },
  updatedAt: { type: Date, default: Date.now }
}, {
  collection: 'users'
});

// ========================================
// 3. Result モデル
// ========================================
const resultSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false, index: true },
  username: { type: String, required: true, index: true },
  grade: { type: Number, required: false, default: 0, index: true },
  difficulty: { 
    type: String, 
    required: true, 
    enum: ['beginner', 'intermediate', 'advanced', 'expert'], 
    index: true 
  },
  date: { type: String, required: true, index: true },
  totalProblems: { type: Number, required: true },
  correctAnswers: { type: Number, required: true },
  incorrectAnswers: { type: Number, required: true },
  unanswered: { type: Number, required: true },
  score: { type: Number, required: true, index: true },
  timeSpent: { type: Number, required: true },
  totalTime: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now, index: true },
  timestamp: { type: Date, default: Date.now }
}, {
  collection: 'results'
});

// ========================================
// 4. Config モデル
// ========================================
const configSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  value: { type: mongoose.Schema.Types.Mixed, required: true },
  description: { type: String },
  updatedAt: { type: Date, default: Date.now }
}, {
  collection: 'configs'
});

// ========================================
// 5. モデルエクスポート（重複定義防止）
// ========================================
const DailyProblemSet = mongoose.models.DailyProblemSet || mongoose.model('DailyProblemSet', dailyProblemSetSchema);
const User = mongoose.models.User || mongoose.model('User', userSchema);
const Result = mongoose.models.Result || mongoose.model('Result', resultSchema);
const Config = mongoose.models.Config || mongoose.model('Config', configSchema);

// ========================================
// 6. モデル検証・ヘルパー関数
// ========================================
function validateModelDefinitions() {
  const models = [DailyProblemSet, User, Result, Config];
  const modelNames = models.map(model => model.modelName);
  
  console.log('✅ Loaded models:', modelNames);
  
  // 重複チェック
  const uniqueNames = [...new Set(modelNames)];
  if (uniqueNames.length !== modelNames.length) {
    throw new Error('Duplicate model names detected');
  }
  
  return true;
}

// ========================================
// 7. エクスポート
// ========================================
module.exports = {
  // モデル
  DailyProblemSet,
  User,
  Result,
  Config,
  
  // スキーマ（必要に応じて）
  dailyProblemSetSchema,
  userSchema,
  resultSchema,
  configSchema,
  
  // ヘルパー
  validateModelDefinitions
}; 