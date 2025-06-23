import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { logger } from '../utils/logger.js';

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
    type: Number,
    required: [true, '学年は必須です'],
    validate: {
      validator: function(value) {
        const validGrades = [1, 2, 3, 4, 5, 6, 7, 999];
        return validGrades.includes(value);
      },
      message: '学年は1-6、7(その他)、または999(ひみつ)である必要があります'
    },
    default: 1
  },
  avatar: {
    type: String,
    default: '😊'
  },
  isAdmin: {
    type: Boolean,
    default: false
  },
  streak: {
    type: Number,
    default: 0
  },
  lastActivity: {
    type: Date,
    default: Date.now
  },
  points: {
    type: Number,
    default: 0
  },
  currentStreak: {
    type: Number,
    default: 0
  },
  lastChallengeDate: {
    type: String
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

const User = mongoose.model('User', UserSchema);

export default User; 