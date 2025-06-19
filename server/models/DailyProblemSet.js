import mongoose from 'mongoose';
import { DifficultyRank } from '../constants/difficultyRank.js';
import { getMockDailyProblemSets, addMockDailyProblemSet, findMockDailyProblemSet } from '../config/database.js';
import { logger } from '../utils/logger.js';

// モック用のインメモリストレージ（database.jsと共有）
let mockProblemSetIdCounter = 1;

// 個々の問題の結果（DailyProblemSet内で使用）
const problemResultSchema = new mongoose.Schema({
    id: { type: String, required: true }, // ★ 問題ID (フロントエンドと合わせる)
    question: { type: String, required: true },
    correctAnswer: { type: Number, required: true },
    options: [{ type: Number }], // 生成された選択肢
    // ユーザー固有の回答は別コレクション（例: challenge_results）に保存する方が良い
}, { _id: false });

const dailyProblemSetSchema = new mongoose.Schema({
  date: {
    type: String, // YYYY-MM-DD 形式
    required: true,
    index: true, // 日付での検索を高速化
  },
  difficulty: {
    type: String, // 'beginner', 'intermediate', 'advanced', 'expert'
    required: true,
    enum: Object.values(DifficultyRank),
  },
  problems: {
    type: [problemResultSchema],
    required: true,
  },
  // 管理者が問題を編集したかどうかのフラグ (任意)
  isEdited: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: true,
  // 日付と難易度の組み合わせでユニークにする複合インデックス
  index: { date: 1, difficulty: 1 },
  unique: true,
});

// モック用のDailyProblemSetModelクラス
class DailyProblemSetModel {
  constructor(data = {}) {
    // インスタンス用のプロパティを設定
    Object.assign(this, data);
    this.updatedAt = new Date();
  }

  // findOne メソッドのモック実装
  static async findOne(query) {
    if (process.env.MONGODB_MOCK === 'true') {
      logger.debug(`[DailyProblemSetModel] モック環境でfindOne検索: ${JSON.stringify(query)}`);
      
      // database.jsの統一関数を使用
      const result = findMockDailyProblemSet(query);
      
      if (result) {
        logger.debug(`[DailyProblemSetModel] 見つかった問題セット: date=${result.date}, difficulty=${result.difficulty}, 問題数=${result.problems?.length}`);
        // 結果をDailyProblemSetModelインスタンスとして返す
        return new DailyProblemSetModel(result);
      } else {
        logger.debug(`[DailyProblemSetModel] 問題セットが見つかりません`);
      }
      return null;
    }
    
    // 通常のMongoose処理
    return mongoose.model('DailyProblemSet').findOne(query);
  }

  // findOneAndUpdate メソッドのモック実装（上書き生成用）
  static async findOneAndUpdate(query, update, options = {}) {
    if (process.env.MONGODB_MOCK === 'true') {
      logger.debug(`[DailyProblemSetModel] モック環境でfindOneAndUpdate: ${JSON.stringify(query)}, options: ${JSON.stringify(options)}`);
      
      const problemSets = getMockDailyProblemSets();
      const existingIndex = problemSets.findIndex(set => {
        if (query.date && set.date !== query.date) return false;
        if (query.difficulty && set.difficulty !== query.difficulty) return false;
        if (query._id && set._id !== query._id) return false;
        return true;
      });

      if (existingIndex >= 0) {
        // 既存レコードを更新
        logger.debug(`[DailyProblemSetModel] 既存問題セットを更新: インデックス=${existingIndex}`);
        const updatedSet = { 
          ...problemSets[existingIndex],
          ...update,
          updatedAt: new Date()
        };
        problemSets[existingIndex] = updatedSet;
        
        // optionsに応じて戻り値を決定
        const returnValue = options.new ? updatedSet : problemSets[existingIndex];
        return new DailyProblemSetModel(returnValue);
      } else if (options.upsert) {
        // 新規レコードを作成
        logger.debug(`[DailyProblemSetModel] upsertオプションで新規問題セット作成`);
        const newSet = {
          _id: problemSets.length + 1,
          ...query,
          ...update,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        problemSets.push(newSet);
        return new DailyProblemSetModel(newSet);
      } else {
        logger.debug(`[DailyProblemSetModel] 既存レコードが見つからず、upsertオプションなし`);
        return null;
      }
    }
    
    // 通常のMongoose処理
    return mongoose.model('DailyProblemSet').findOneAndUpdate(query, update, options);
  }

  // create メソッドのモック実装
  static async create(data) {
    if (process.env.MONGODB_MOCK === 'true') {
      logger.debug(`[DailyProblemSetModel] モック環境でcreate: ${JSON.stringify({ date: data.date, difficulty: data.difficulty, problemCount: data.problems?.length })}`);
      
      // database.jsの統一関数を使用
      const newProblemSet = addMockDailyProblemSet({
        date: data.date,
        difficulty: data.difficulty,
        problems: data.problems || [],
        isEdited: data.isEdited || false
      });
      
      logger.debug(`[DailyProblemSetModel] モック環境で問題セット作成完了: ID=${newProblemSet._id}`);
      return new DailyProblemSetModel(newProblemSet);
    }
    
    // 通常のMongoose処理
    return mongoose.model('DailyProblemSet').create(data);
  }

  // save メソッドのモック実装（インスタンスメソッド）
  async save() {
    if (process.env.MONGODB_MOCK === 'true') {
      logger.debug(`[DailyProblemSetModel] インスタンスsave実行: ID=${this._id}, date=${this.date}, difficulty=${this.difficulty}`);
      
      const problemSets = getMockDailyProblemSets();
      const existingIndex = problemSets.findIndex(set => set._id === this._id);
      
      if (existingIndex >= 0) {
        // 既存レコードを更新
        this.updatedAt = new Date();
        problemSets[existingIndex] = { ...this };
        logger.debug(`[DailyProblemSetModel] モック問題セット更新完了: インデックス=${existingIndex}`);
      } else {
        // 新規レコードを作成（通常はcreateを使うべきだが、念のため対応）
        this._id = problemSets.length + 1;
        this.createdAt = new Date();
        this.updatedAt = new Date();
        problemSets.push({ ...this });
        logger.debug(`[DailyProblemSetModel] モック問題セット新規作成: ID=${this._id}`);
      }
      
      return this;
    }
    
    // 通常のMongoose処理
    return this;
  }

  // countDocuments メソッドのモック実装
  static async countDocuments(query) {
    if (process.env.MONGODB_MOCK === 'true') {
      logger.debug(`[DailyProblemSetModel] モック環境でcountDocuments: ${JSON.stringify(query)}`);
      
      // database.jsの統一関数を使用してカウント
      const problemSets = getMockDailyProblemSets();
      const count = problemSets.filter(set => {
        if (query.date && set.date !== query.date) return false;
        if (query.difficulty && set.difficulty !== query.difficulty) return false;
        return true;
      }).length;
      
      logger.debug(`[DailyProblemSetModel] カウント結果: ${count}件`);
      return count;
    }
    
    // 通常のMongoose処理
    return mongoose.model('DailyProblemSet').countDocuments(query);
  }

  // aggregate メソッドのモック実装（基本的な統計処理用）
  static async aggregate(pipeline) {
    if (process.env.MONGODB_MOCK === 'true') {
      logger.debug(`[DailyProblemSetModel] モック環境でaggregate: 簡略実装`);
      // 基本的な統計のみサポート（完全実装は複雑すぎるため）
      return [];
    }
    
    // 通常のMongoose処理
    return mongoose.model('DailyProblemSet').aggregate(pipeline);
  }
}

const DailyProblemSet = mongoose.model('DailyProblemSet', dailyProblemSetSchema);

// モック環境では、DailyProblemSetModelを返す
const ExportedModel = process.env.MONGODB_MOCK === 'true' ? DailyProblemSetModel : DailyProblemSet;

export default ExportedModel; 