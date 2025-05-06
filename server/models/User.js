import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const UserSchema = new mongoose.Schema({
  // ユーザー名はプロフィール表示やUI表示用
  username: {
    type: String,
    required: [true, 'ユーザー名は必須です'],
    unique: true,
    trim: true,
    minlength: [3, 'ユーザー名は3文字以上である必要があります'],
    maxlength: [20, 'ユーザー名は20文字以下である必要があります']
  },
  // メールアドレスはログイン用
  email: {
    type: String,
    required: [true, 'メールアドレスは必須です'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/, '有効なメールアドレスを入力してください']
  },
  // ★ password フィールド
  password: {
    type: String,
    required: [true, 'パスワードは必須です'],
    minlength: [6, 'パスワードは6文字以上である必要があります'],
    select: false, // APIでユーザー情報を取得する際にデフォルトでパスワードを含めない
  },
  grade: {
    type: Number,
    required: [true, '学年は必須です'],
    min: 1,
    max: 6,
    default: 1
  },
  avatar: {
    type: String,
    default: '😊' // デフォルトアバター
  },
  // 管理者フラグ
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
    type: String, // YYYY-MM-DD形式
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true }); // timestamps: true で createdAt と updatedAt が自動追加される

// ★ パスワードハッシュ化 (保存前処理)
UserSchema.pre('save', async function(next) {
  // パスワードが変更されていない場合は何もしない
  if (!this.isModified('password')) {
    next();
    return;
  }
  // パスワードをハッシュ化
  try {
    const salt = await bcrypt.genSalt(10); // ソルトを生成 (10はコスト係数)
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    // エラー発生時のログを強化
    console.error(`Error hashing password for user ${this._id || '(new user)'}:`, error);
    console.error(`Password length before hash attempt: ${this.password ? this.password.length : 'undefined'}`);
    next(error); // エラーがあれば Express のエラーハンドラに渡す
  }
});

// ★ パスワード比較メソッド
UserSchema.methods.matchPassword = async function(enteredPassword) {
  // enteredPassword が undefined や null の場合、bcrypt.compare がエラーを出す可能性がある
  if (typeof enteredPassword !== 'string' || enteredPassword.length === 0 || typeof this.password !== 'string' || this.password.length === 0) {
      console.error('[matchPassword] Error: enteredPassword or this.password is missing or invalid.');
      console.log(`[matchPassword] enteredPassword: "${enteredPassword}" (type: ${typeof enteredPassword}), this.password exists: ${!!this.password} (type: ${typeof this.password}, length: ${this.password ? this.password.length : 'N/A'})`);
      return false; 
  }
  try {
    console.log(`[matchPassword] Comparing entered password (type: ${typeof enteredPassword}, length: ${enteredPassword.length}) with stored hash (type: ${typeof this.password}, length: ${this.password.length})`);
    const result = await bcrypt.compare(enteredPassword, this.password);
    console.log(`[matchPassword] bcrypt.compare result: ${result}`);
    return result;
  } catch (error) {
    console.error('[matchPassword] Error during bcrypt.compare:', error);
    return false; // エラー時は false を返す
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
    // 初めてのアクティビティ
    this.streak = 1;
  } else if (lastActivityDate.getTime() === yesterday.getTime()) {
    // 昨日もアクティブだった
    this.streak += 1;
  } else if (lastActivityDate.getTime() < yesterday.getTime()) {
    // 1日以上空いた
    this.streak = 1;
  }
  // 今日すでにアクティブなら何もしない
  
  this.lastActivity = now;
  await this.save();
  
  return this.streak;
};

const User = mongoose.model('User', UserSchema);

export default User; 