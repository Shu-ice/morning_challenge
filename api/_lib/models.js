// 🚀 統合されたMongooseモデル定義
// server/models からインポートして重複定義を解消

// スキーマ重複防止: server/models から既存のモデルを再利用
try {
  // ES modules からの動的インポート（CommonJS環境用）
  const User = require('../../server/models/User.js').default;
  const DailyProblemSet = require('../../server/models/DailyProblemSet.js').default;
  const Result = require('../../server/models/Result.js').default;
  
  module.exports = {
    User,
    DailyProblemSet, 
    Result
  };
} catch (esModuleError) {
  // ES modules インポートが失敗した場合のフォールバック
  console.warn('[Models] ES modules import failed, using fallback schema definitions');
  
  const mongoose = require('mongoose');

  // ========================================
  // フォールバック User スキーマ（server/models/User.js と同期）
  // ========================================
  const userSchema = new mongoose.Schema({
    username: { 
      type: String, 
      required: true, 
      unique: true, 
      trim: true,
      minlength: 3,
      maxlength: 20,
      index: true 
    },
    email: { 
      type: String, 
      required: true, 
      unique: true, 
      lowercase: true,
      trim: true,
      index: true 
    },
    password: { 
      type: String, 
      required: true,
      minlength: 6,
      select: false  // 🔒 セキュリティ: デフォルトでパスワードを除外
    },
    grade: { 
      type: Number, 
      default: 1, 
      index: true,
      validate: {
        validator: function(value) {
          return [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,99].includes(value);
        }
      }
    },
    avatar: { type: String, default: '😊' },
    isAdmin: { type: Boolean, default: false, index: true },
    points: { type: Number, default: 0 },
    streak: { type: Number, default: 0 },
    currentStreak: { type: Number, default: 0 },
    lastActivity: { type: Date, default: Date.now },
    lastChallengeDate: { type: String },
    createdAt: { type: Date, default: Date.now, index: true }
  }, { 
    timestamps: true,
    collection: 'users'
  });

  // ========================================
  // フォールバック DailyProblemSet スキーマ  
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
    collection: 'dailyproblemsets'
  });

  // ========================================
  // フォールバック Result スキーマ
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

  // モデル作成（重複防止）
  const User = mongoose.models.User || mongoose.model('User', userSchema);
  const DailyProblemSet = mongoose.models.DailyProblemSet || mongoose.model('DailyProblemSet', dailyProblemSetSchema);
  const Result = mongoose.models.Result || mongoose.model('Result', resultSchema);

  // ========================================
  // モデル検証・ヘルパー関数
  // ========================================
  function validateModelDefinitions() {
    const models = [User, DailyProblemSet, Result];
    const modelNames = models.map(model => model.modelName);
    
    console.log('✅ Loaded fallback models:', modelNames);
    
    // 重複チェック
    const uniqueNames = [...new Set(modelNames)];
    if (uniqueNames.length !== modelNames.length) {
      throw new Error('Duplicate model names detected');
    }
    
    return true;
  }

  // フォールバック エクスポート
  module.exports = {
    User,
    DailyProblemSet,
    Result,
    validateModelDefinitions
  };
} 