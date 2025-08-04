import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { logger } from '../utils/logger.js';

const EarnedAchievementSchema = new mongoose.Schema({
  achievementId: { type: mongoose.Schema.Types.ObjectId, ref: 'Achievement', required: true },
  earnedAt: { type: Date, required: true, default: Date.now }
}, { _id: false });

const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, 'ユーザー名は必須です'],
    unique: true,
    trim: true,
    minlength: [3, 'ユーザー名は3文字以上である必要があります'],
    maxlength: [20, 'ユーザー名は20文字以下である必要があります']
  },
  email: {
    type: String,
    required: [true, 'メールアドレスは必須です'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/, '有効なメールアドレスを入力してください']
  },
  password: {
    type: String,
    required: [true, 'パスワードは必須です'],
    minlength: [6, 'パスワードは6文字以上である必要があります'],
    select: false
  },
  grade: {
    type: String,
    enum: ['G1','G2','G3','G4','G5','G6','OTHER'],
    default: 'OTHER'
  },
  displayName: {
    type: String
  },
  avatar: {
    type: String,
    default: '😊'
  },
  isAdmin: {
    type: Boolean,
    default: false
  },
  // Gamification
  currentStreak: {
    type: Number,
    default: 0
  },
  bestStreak: {
    type: Number,
    default: 0
  },
  lastChallengeDate: {
    type: String,
    default: null
  },
  weeklyFreezeUsedAt: {
    type: String,
    default: null
  },
  points: {
    type: Number,
    default: 0
  },
  level: {
    type: Number,
    default: 1
  },
  achievements: {
    type: [EarnedAchievementSchema],
    default: []
  },
  // Subscription
  membershipTier: {
    type: String,
    enum: ['UME','TAKE','MATSU'],
    default: 'UME'
  },
  stripeCustomerId: {
    type: String,
    default: null
  },
  stripeSubscriptionId: {
    type: String,
    default: null
  },
  // Preferences
  notifMorning: {
    type: Boolean,
    default: true
  },
  notifAfternoon: {
    type: Boolean,
    default: true
  },
  parentEmail: {
    type: String,
    default: null
  },
  // Legacy fields kept for compatibility
  streak: {
    type: Number,
    default: 0
  },
  lastActivity: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

// パスワードハッシュ化
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    next();
    return;
  }
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// パスワード比較メソッド
UserSchema.methods.matchPassword = async function(enteredPassword) {
  if (typeof enteredPassword !== 'string' || enteredPassword.length === 0 || 
      typeof this.password !== 'string' || this.password.length === 0) {
      return false; 
  }
  try {
    const result = await bcrypt.compare(enteredPassword, this.password);
    return result;
  } catch (error) {
    return false;
  }
};

// ログインストリークの更新
UserSchema.methods.updateStreak = async function() {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  const lastActivityDate = this.lastActivity ? 
    new Date(this.lastActivity.getFullYear(), this.lastActivity.getMonth(), this.lastActivity.getDate()) : 
    null;
  
  if (!lastActivityDate) {
    this.streak = 1;
  } else if (lastActivityDate.getTime() === yesterday.getTime()) {
    this.streak += 1;
  } else if (lastActivityDate.getTime() < yesterday.getTime()) {
    this.streak = 1;
  }
  
  this.lastActivity = now;
  await this.save();
  
  return this.streak;
};

// モック環境用のスタティックメソッドを追加
UserSchema.statics.findOneSimple = function(query) {
  // モック環境の場合は、モックデータから検索
  if (process.env.MONGODB_MOCK === 'true') {
    return new Promise((resolve) => {
      // モックユーザーデータから検索
      const mockUsers = [
        {
          _id: '64a7b8c9d1e2f3a4b5c6d7e8',
          username: 'admin',
          email: 'admin@example.com',
          password: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewPXvkrfM6W2Q4W.',  // admin123 hashed
          grade: 'OTHER',
          avatar: '😊',
          isAdmin: true,
          currentStreak: 5,
          bestStreak: 10,
          points: 150,
          level: 3,
          membershipTier: 'UME',
          achievements: [],
          matchPassword: function(password) {
            return password === 'admin123';  // For mock environment, simple comparison
          }
        },
        {
          _id: '64a7b8c9d1e2f3a4b5c6d7e9',
          username: 'test',
          email: 'test@example.com',
          password: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewPXvkrfM6W2Q4W.',  // test123 hashed
          grade: 'G5',
          avatar: '😊',
          isAdmin: false,
          currentStreak: 3,
          bestStreak: 7,
          points: 80,
          level: 2,
          membershipTier: 'UME',
          achievements: [],
          matchPassword: function(password) {
            return password === 'test123';
          }
        },
        {
          _id: '64a7b8c9d1e2f3a4b5c6d7ea',
          username: 'kanri',
          email: 'kanri@example.com',
          password: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewPXvkrfM6W2Q4W.',  // kanri123 hashed
          grade: 'OTHER',
          avatar: '🔧',
          isAdmin: true,
          currentStreak: 2,
          bestStreak: 5,
          points: 60,
          level: 1,
          membershipTier: 'UME',
          achievements: [],
          matchPassword: function(password) {
            return password === 'kanri123';
          }
        }
      ];
      
      let foundUser = null;
      if (query.email) {
        const emailRegex = query.email.$regex ? query.email.$regex : new RegExp(`^${query.email}$`, 'i');
        foundUser = mockUsers.find(user => emailRegex.test(user.email));
      } else if (query.username) {
        foundUser = mockUsers.find(user => user.username === query.username);
      }
      
      resolve(foundUser);
    });
  } else {
    // 本番環境では、通常のfindOneを使用
    return this.findOne(query).select('+password');
  }
};

const User = mongoose.model('User', UserSchema);

export default User; 