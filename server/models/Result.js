import mongoose from 'mongoose';

// モック用のインメモリストレージ
let mockResults = [];
let mockResultIdCounter = 1;

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
  // 表示用学年
  grade: { 
    type: Number, 
    required: false, 
    default: 0 
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

// モック機能対応のResultモデル
class ResultModel {
  constructor() {
    this.mongooseModel = mongoose.model('Result', ResultSchema);
  }

  // モック機能チェック
  get isUsingMock() {
    return process.env.MONGODB_MOCK === 'true';
  }

  // 結果を検索
  find(query = {}) {
    if (this.isUsingMock) {
      console.log(`[ResultModel] モック環境でfind検索: ${JSON.stringify(query)}`);
      let results = [...mockResults];
      
      // 基本的なクエリフィルタリング
      if (query.userId) {
        results = results.filter(result => result.userId?.toString() === query.userId?.toString());
      }
      if (query.date) {
        results = results.filter(result => result.date === query.date);
      }
      if (query.difficulty) {
        results = results.filter(result => result.difficulty === query.difficulty);
      }
      
      console.log(`[ResultModel] モック検索結果: ${results.length}件`);
      
      // メソッドチェーンオブジェクトを返す
      return {
        sort: (sortOptions) => {
          console.log(`[ResultModel] モック環境でsort実行: ${JSON.stringify(sortOptions)}`);
          results.sort((a, b) => {
            for (const [key, order] of Object.entries(sortOptions)) {
              const aVal = a[key];
              const bVal = b[key];
              if (aVal < bVal) return order === 1 ? -1 : 1;
              if (aVal > bVal) return order === 1 ? 1 : -1;
            }
            return 0;
          });
          return {
            limit: (limitNum) => {
              console.log(`[ResultModel] モック環境でlimit実行: ${limitNum}`);
              return {
                populate: (path, select) => {
                  console.log(`[ResultModel] モック環境でpopulate実行: ${path}, ${select}`);
                  return {
                    lean: () => {
                      console.log(`[ResultModel] モック環境でlean実行`);
                      return Promise.resolve(results.slice(0, limitNum));
                    }
                  };
                },
                lean: () => {
                  console.log(`[ResultModel] モック環境でlean実行（limit後）`);
                  return Promise.resolve(results.slice(0, limitNum));
                }
              };
            },
            populate: (path, select) => {
              console.log(`[ResultModel] モック環境でpopulate実行（sort後）: ${path}, ${select}`);
              return {
                lean: () => {
                  console.log(`[ResultModel] モック環境でlean実行（populate後）`);
                  return Promise.resolve(results);
                }
              };
            },
            lean: () => {
              console.log(`[ResultModel] モック環境でlean実行（sort後）`);
              return Promise.resolve(results);
            }
          };
        },
        limit: (limitNum) => {
          console.log(`[ResultModel] モック環境でlimit実行（直接）: ${limitNum}`);
          return {
            lean: () => {
              console.log(`[ResultModel] モック環境でlean実行（limit後）`);
              return Promise.resolve(results.slice(0, limitNum));
            }
          };
        },
        lean: () => {
          console.log(`[ResultModel] モック環境でlean実行（直接）`);
          return Promise.resolve(results);
        }
      };
    }
    return this.mongooseModel.find(query);
  }

  // 一つの結果を検索
  findOne(query) {
    if (this.isUsingMock) {
      console.log(`[ResultModel] モック環境でfindOne検索: ${JSON.stringify(query)}`);
      const result = mockResults.find(result => {
        return Object.keys(query).every(key => {
          if (key === 'userId') {
            return result.userId?.toString() === query.userId?.toString();
          }
          return result[key] === query[key];
        });
      });
      console.log(`[ResultModel] findOne検索結果: ${result ? 'found' : 'not found'}`);
      return Promise.resolve(result || null);
    }
    return this.mongooseModel.findOne(query);
  }

  // 結果の更新/作成
  findOneAndUpdate(query, update, options = {}) {
    if (this.isUsingMock) {
      console.log(`[ResultModel] モック環境でfindOneAndUpdate: ${JSON.stringify(query)}`);
      
      // 既存の結果を検索
      const existingIndex = mockResults.findIndex(result => {
        return Object.keys(query).every(key => {
          if (key === 'userId') {
            return result.userId?.toString() === query.userId?.toString();
          }
          return result[key] === query[key];
        });
      });

      if (existingIndex >= 0) {
        // 既存レコードを更新
        console.log(`[ResultModel] 既存レコードを更新`);
        const updatedResult = { 
          ...mockResults[existingIndex], 
          ...update.$set,
          updatedAt: new Date()
        };
        mockResults[existingIndex] = updatedResult;
        return Promise.resolve(updatedResult);
      } else if (options.upsert) {
        // 新規レコードを作成
        console.log(`[ResultModel] 新規レコードを作成`);
        const newResult = {
          _id: mockResultIdCounter++,
          ...query,
          ...update.$set,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        mockResults.push(newResult);
        return Promise.resolve(newResult);
      } else {
        return Promise.resolve(null);
      }
    }
    return this.mongooseModel.findOneAndUpdate(query, update, options);
  }

  // 件数をカウント
  countDocuments(query = {}) {
    if (this.isUsingMock) {
      console.log(`[ResultModel] モック環境でcountDocuments: ${JSON.stringify(query)}`);
      let results = mockResults;
      
      // 基本的なクエリフィルタリング
      if (query.userId) {
        results = results.filter(result => result.userId?.toString() === query.userId?.toString());
      }
      if (query.date) {
        results = results.filter(result => result.date === query.date);
      }
      if (query.difficulty) {
        results = results.filter(result => result.difficulty === query.difficulty);
      }
      
      return Promise.resolve(results.length);
    }
    return this.mongooseModel.countDocuments(query);
  }

  // distinct
  distinct(field, query = {}) {
    if (this.isUsingMock) {
      console.log(`[ResultModel] モック環境でdistinct: ${field}, ${JSON.stringify(query)}`);
      let results = mockResults;
      
      // 基本的なクエリフィルタリング
      if (query.date) {
        results = results.filter(result => result.date === query.date);
      }
      
      const distinctValues = [...new Set(results.map(result => result[field]))];
      return Promise.resolve(distinctValues);
    }
    return this.mongooseModel.distinct(field, query);
  }

  // Aggregate
  aggregate(pipeline) {
    if (this.isUsingMock) {
      console.log(`[ResultModel] モック環境でaggregate: ${JSON.stringify(pipeline)}`);
      // 簡単な集計処理をシミュレート
      return Promise.resolve([]);
    }
    return this.mongooseModel.aggregate(pipeline);
  }
}

const Result = new ResultModel();

export default Result; 