const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, 'ユーザー名は必須です'],
    unique: true,
    trim: true,
    minlength: [3, 'ユーザー名は3文字以上必要です'],
    maxlength: [20, 'ユーザー名は20文字以内にしてください']
  },
  password: {
    type: String,
    required: [true, 'パスワードは必須です'],
    minlength: [6, 'パスワードは6文字以上必要です'],
    select: false // クエリでパスワードを取得しない
  },
  grade: {
    type: Number,
    required: [true, '学年は必須です'],
    min: 1,
    max: 6
  },
  avatar: {
    type: String,
    default: '😊'
  },
  points: {
    type: Number,
    default: 0
  },
  streak: {
    type: Number,
    default: 0
  },
  lastActivity: {
    type: Date,
    default: Date.now
  },
  items: [{
    name: String,
    description: String,
    acquiredDate: {
      type: Date,
      default: Date.now
    }
  }],
  records: [{
    date: {
      type: Date,
      default: Date.now
    },
    score: Number,
    correctAnswers: Number,
    timeSpent: Number,
    grade: Number
  }]
}, {
  timestamps: true
});

// パスワードハッシュ化のミドルウェア
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    next();
  }
  
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// パスワード検証メソッド
UserSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// 連続ログイン更新メソッド
UserSchema.methods.updateStreak = function() {
  const now = new Date();
  const lastDate = this.lastActivity;
  
  // 時間をリセットして日付だけで比較
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const lastDay = new Date(lastDate.getFullYear(), lastDate.getMonth(), lastDate.getDate());
  
  if (lastDay.getTime() === yesterday.getTime()) {
    // 昨日のアクティビティがあれば連続日数を増やす
    this.streak += 1;
  } else if (lastDay.getTime() < yesterday.getTime()) {
    // 1日以上あいていれば連続日数をリセット
    this.streak = 1;
  }
  
  this.lastActivity = now;
  return this.save();
};

module.exports = mongoose.model('User', UserSchema);
