import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { getMockUsers, findMockUser, addMockUser, updateMockUser } from '../config/database.js';
import { logger } from '../utils/logger.js';

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
    validate: {
      validator: function(value) {
        // 有効な学年: 1-6(小学生), 7(その他), 999(ひみつ)
        const validGrades = [1, 2, 3, 4, 5, 6, 7, 999];
        return validGrades.includes(value);
      },
      message: '学年は1-6、7(その他)、または999(ひみつ)である必要があります'
    },
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
    // 🔐 セキュリティ修正: パスワード長もログから除外
    next(error); // エラーがあれば Express のエラーハンドラに渡す
  }
});

// ★ パスワード比較メソッド
UserSchema.methods.matchPassword = async function(enteredPassword) {
  // 🔐 セキュリティ修正: パスワードを一切ログに出力しない
  if (typeof enteredPassword !== 'string' || enteredPassword.length === 0 || typeof this.password !== 'string' || this.password.length === 0) {
      return false; 
  }
  try {
    const result = await bcrypt.compare(enteredPassword, this.password);
    return result;
  } catch (error) {
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

// モック機能対応のユーザーモデル
class UserModel {
  constructor() {
    this.mongooseModel = mongoose.model('User', UserSchema);
  }

  // モック機能チェック
  get isUsingMock() {
    return process.env.MONGODB_MOCK === 'true';
  }

  // 一つのユーザーを検索（モック環境での直接検索）
  async findOneSimple(query) {
    if (this.isUsingMock) {
      logger.debug(`[UserModel] モック環境でfindOneSimple検索: ${JSON.stringify(query)}`);
      const user = findMockUser(query);
      logger.debug(`[UserModel] findOneSimple検索結果: ${user ? user.username : 'null'}`);
      return user;
    }
    return this.mongooseModel.findOne(query);
  }

  // 一つのユーザーを検索
  findOne(query) {
    if (this.isUsingMock) {
      logger.debug(`[UserModel] モック環境でfindOne検索: ${JSON.stringify(query)}`);
      
      // selectメソッドが呼ばれることを前提とせず、直接Promise<User>を返す
      const user = findMockUser(query);
      logger.debug(`[UserModel] モック検索結果: ${user ? user.username : 'null'}`);
      
      // selectメソッドも含むオブジェクトを返すが、awaitした場合は直接userが返される
      const mockQuery = {
        async then(resolve, reject) {
          // thenメソッドを実装してPromiseライクにする
          resolve(user);
        },
        async select(fields) {
          logger.debug(`[UserModel] モック環境でselect実行: ${fields}`);
          if (user && fields === '+password') {
            // パスワードを含めて返す
            const userWithMethod = {
              ...user,
              matchPassword: async function(enteredPassword) {
                logger.debug(`[UserModel] パスワード比較実行: ${user.username}`);
                if (typeof enteredPassword !== 'string' || enteredPassword.length === 0) return false;
                if (typeof this.password !== 'string' || this.password.length === 0) return false;
                try {
                  const result = await bcrypt.compare(enteredPassword, this.password);
                  logger.debug(`[UserModel] パスワード比較結果: ${result}`);
                  return result;
                } catch (error) {
                  logger.debug(`[UserModel] パスワード比較エラー: ${error.message}`);
                  return false;
                }
              }
            };
            logger.debug(`[UserModel] 🔥🔥🔥 パスワード付きユーザー返却:`);
            logger.debug(`[UserModel] 🔥🔥🔥 Username: ${userWithMethod.username}`);
            logger.debug(`[UserModel] 🔥🔥🔥 Email: ${userWithMethod.email}`);
            logger.debug(`[UserModel] 🔥🔥🔥 isAdmin: ${userWithMethod.isAdmin}`);
            logger.debug(`[UserModel] 🔥🔥🔥 All user properties:`, Object.keys(userWithMethod));
            return userWithMethod;
          }
          logger.debug(`[UserModel] 🔥🔥🔥 Returning user without password processing:`, user);
          return user;
        }
      };
      
      return mockQuery;
    }
    return this.mongooseModel.findOne(query);
  }

  // ユーザー作成
  async create(userData) {
    if (this.isUsingMock) {
      // パスワードハッシュ化
      if (userData.password) {
        const salt = await bcrypt.genSalt(10);
        userData.password = await bcrypt.hash(userData.password, salt);
      }
      return addMockUser(userData);
    }
    return this.mongooseModel.create(userData);
  }

  // ID検索（select対応）
  findById(id) {
    if (this.isUsingMock) {
      logger.debug(`[UserModel] モック環境でfindById検索: ${id}`);
      // ベースとなるユーザーオブジェクト (見つからない場合は null)
      const baseUser = findMockUser({ _id: id });

      // save／matchPassword などインスタンスに必要なメソッドを追加
      const enrichUser = (rawUser = null) => {
        if (!rawUser) return null;

        return {
          ...rawUser,
          async save() {
            logger.debug(`[UserModel] モックユーザーの保存開始: ${this.username}, grade=${this.grade}`);
            const beforeUpdate = findMockUser({ _id: this._id });
            logger.debug(`[UserModel] 保存前のgrade: ${beforeUpdate?.grade}`);
            
            const result = updateMockUser(this._id, this);
            logger.debug(`[UserModel] updateMockUser実行結果:`, result);
            logger.debug(`[UserModel] 保存後のgrade: ${result?.grade}`);
            
            // 更新後のユーザー情報をログ出力
            const afterUpdate = findMockUser({ _id: this._id });
            logger.debug(`[UserModel] 最終確認 - 更新後のgrade: ${afterUpdate?.grade}`);
            
            return this;
          },
          async matchPassword(enteredPassword) {
            if (!enteredPassword || !this.password) return false;
            return bcrypt.compare(enteredPassword, this.password);
          }
        };
      };

      const userResolved = enrichUser(baseUser);

      // Promise ライク (await 対応) オブジェクトを返却
      return {
        // await された場合に userResolved を返す
        async then(resolve, reject) {
          resolve(userResolved);
        },
        // select チェーン用
        select: (fields) => {
          logger.debug(`[UserModel] モック環境でfindById.select実行: ${fields}`);
          const user = enrichUser(baseUser);
          logger.debug(`[UserModel] findById検索結果: ${user ? user.username : 'null'}`);
          if (user && fields === '-password') {
            // パスワードを除外して返す
            const { password, ...userWithoutPassword } = user;
            logger.debug(`[UserModel] パスワード除外ユーザー返却: ${userWithoutPassword.username}`);
            return Promise.resolve(userWithoutPassword);
          }
          if (user && fields === '+password') {
            // パスワードを含めて返し、matchPasswordメソッドも追加
            logger.debug(`[UserModel] パスワード付きユーザー返却: ${user.username}`);
            return Promise.resolve(user);
          }
          return Promise.resolve(user);
        },
        lean: () => {
          logger.debug(`[UserModel] モック環境でfindById.lean実行`);
          const user = baseUser;
          logger.debug(`[UserModel] findById.lean検索結果: ${user ? user.username : 'null'}`);
          return Promise.resolve(user);
        }
      };
    }
    return this.mongooseModel.findById(id);
  }

  // 全ユーザー検索
  async find(query = {}, projection = null) {
    if (this.isUsingMock) {
      let users = getMockUsers();
      // 簡単なクエリフィルタリング
      if (query.email) {
        users = users.filter(user => user.email === query.email);
      }
      if (query._id) {
        if (Array.isArray(query._id.$in)) {
          users = users.filter(user => query._id.$in.includes(user._id));
        } else {
          users = users.filter(user => user._id === query._id);
        }
      }
      return users;
    }
    return this.mongooseModel.find(query, projection);
  }

  // findByIdAndUpdate()メソッド対応
  async findByIdAndUpdate(id, update, options = {}) {
    if (this.isUsingMock) {
      logger.debug(`[UserModel] モック環境でfindByIdAndUpdate実行: ${id}`);
      logger.debug(`[UserModel] 更新データ: ${JSON.stringify(update)}`);
      
      // 現在のユーザーを取得
      const currentUser = findMockUser({ _id: id });
      if (!currentUser) {
        logger.debug(`[UserModel] ユーザーが見つかりません: ${id}`);
        return null;
      }
      
      // 更新データをマージ
      const updatedData = { ...currentUser, ...update, updatedAt: new Date() };
      
      // モックデータを更新
      const updatedUser = updateMockUser(id, updatedData);
      logger.debug(`[UserModel] findByIdAndUpdate完了: ${updatedUser ? updatedUser.username : 'null'}`);
      
      // newオプションがtrueの場合は更新後のデータを返す（デフォルト）
      return options.new !== false ? updatedUser : currentUser;
    }
    return this.mongooseModel.findByIdAndUpdate(id, update, options);
  }

  // lean()メソッド対応
  lean() {
    const self = this;
    return {
      async find(query = {}, projection = null) {
        if (self.isUsingMock) {
          return self.find(query, projection);
        }
        return self.mongooseModel.find(query, projection).lean();
      }
    };
  }
}

const User = new UserModel();

export default User; 