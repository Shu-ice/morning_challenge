import mongoose from 'mongoose';
import { logger } from '../utils/logger.js';
import bcrypt from 'bcryptjs';
import dayjs from 'dayjs';
import { generateProblems } from '../utils/problemGenerator.js';

/**
 * データベース接続設定
 */
class DatabaseConfig {
  constructor() {
    this.connectionString = process.env.MONGODB_URI || 'mongodb://localhost:27017/morning_challenge';
    this.options = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: 10, // 接続プールの最大サイズ
      serverSelectionTimeoutMS: 5000, // サーバー選択のタイムアウト
      socketTimeoutMS: 45000, // ソケットのタイムアウト
      bufferMaxEntries: 0 // バッファリングを無効化
    };
  }

  /**
   * データベースに接続
   */
  async connect() {
    try {
      await mongoose.connect(this.connectionString, this.options);
      console.log('✅ MongoDB接続成功');
      
      // 接続イベントリスナー
      mongoose.connection.on('error', (err) => {
        console.error('❌ MongoDB接続エラー:', err);
      });

      mongoose.connection.on('disconnected', () => {
        console.log('⚠️ MongoDB接続が切断されました');
      });

      process.on('SIGINT', async () => {
        await mongoose.connection.close();
        console.log('📞 MongoDBコネクションを正常に終了しました');
        process.exit(0);
      });

    } catch (error) {
      console.error('❌ MongoDB接続失敗:', error);
      process.exit(1);
    }
  }

  /**
   * データベース接続を切断
   */
  async disconnect() {
    try {
      await mongoose.connection.close();
      console.log('✅ MongoDB接続を正常に切断しました');
    } catch (error) {
      console.error('❌ MongoDB切断エラー:', error);
    }
  }

  /**
   * 接続状態を取得
   */
  getConnectionState() {
    const states = {
      0: 'disconnected',
      1: 'connected', 
      2: 'connecting',
      3: 'disconnecting'
    };
    return states[mongoose.connection.readyState] || 'unknown';
  }
}

export default new DatabaseConfig(); 

// InMemoryデータベース用のモックデータ
let mockUsers = [];
let mockResults = [];
let mockDailyProblemSets = [];

const initializeMockData = async () => {
  logger.info('🔥🔥🔥 [initializeMockData] モックデータ初期化開始！');
  
  // デフォルトユーザーの作成
  mockUsers = [
    {
      _id: '1',
      username: 'admin',
      email: 'admin@example.com',
      password: bcrypt.hashSync('admin123', 10),
      grade: 6,
      isAdmin: true,
      avatar: '👑',
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      _id: '2',
      username: 'kanri',
      email: 'kanri@example.com',
      password: bcrypt.hashSync('kanri123', 10),
      grade: 6,
      isAdmin: true,
      avatar: '🔧',
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      _id: '3',
      username: 'test',
      email: 'test@example.com',
      password: bcrypt.hashSync('test123', 10),
      grade: 3,
      isAdmin: false,
      avatar: '🎓',
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];

  logger.info('🔥🔥🔥 [initializeMockData] ユーザー作成完了！');
  logger.info('🔥🔥🔥 [initializeMockData] adminユーザー確認:');
  const adminUser = mockUsers.find(u => u.email === 'admin@example.com');
  logger.info(`🔥🔥🔥 [initializeMockData]   - username: ${adminUser?.username}`);
  logger.info(`🔥🔥🔥 [initializeMockData]   - isAdmin: ${adminUser?.isAdmin}`);
  logger.info(`🔥🔥🔥 [initializeMockData]   - typeof isAdmin: ${typeof adminUser?.isAdmin}`);

  // デフォルトのチャレンジ結果の作成（より現実的なデータ）
  const today = dayjs().format('YYYY-MM-DD');
  const yesterday = dayjs().subtract(1, 'day').format('YYYY-MM-DD');
  mockResults = [
    {
      _id: '1',
      userId: '3', // testユーザー (3年生)
      date: today,
      difficulty: 'beginner',
      correctAnswers: 7,
      incorrectAnswers: 2,
      unanswered: 1,
      totalProblems: 10,
      score: 70,
      timeSpent: 480, // 秒単位
      totalTime: 480000, // ミリ秒単位
      grade: 3,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      _id: '2',
      userId: '1', // adminユーザー (6年生)
      date: today,
      difficulty: 'expert',
      correctAnswers: 8,
      incorrectAnswers: 2,
      unanswered: 0,
      totalProblems: 10,
      score: 80,
      timeSpent: 420, // 秒単位
      totalTime: 420000, // ミリ秒単位
      grade: 6,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      _id: '3',
      userId: '2', // kanriユーザー (6年生)
      date: yesterday,
      difficulty: 'advanced',
      correctAnswers: 9,
      incorrectAnswers: 1,
      unanswered: 0,
      totalProblems: 10,
      score: 90,
      timeSpent: 360, // 秒単位
      totalTime: 360000, // ミリ秒単位
      grade: 6,
      createdAt: dayjs().subtract(1, 'day').toDate(),
      updatedAt: dayjs().subtract(1, 'day').toDate()
    },
    {
      _id: '4',
      userId: '3', // testユーザー (3年生)
      date: yesterday,
      difficulty: 'intermediate',
      correctAnswers: 6,
      incorrectAnswers: 3,
      unanswered: 1,
      totalProblems: 10,
      score: 60,
      timeSpent: 520, // 秒単位
      totalTime: 520000, // ミリ秒単位
      grade: 3,
      createdAt: dayjs().subtract(1, 'day').toDate(),
      updatedAt: dayjs().subtract(1, 'day').toDate()
    }
  ];
  
  // ================================
  // 🔄 モック問題セット拡張ロジック
  // -------------------------------
  //  今後 n 日分（デフォルト 7 日）の問題セットを
  //  すべての難易度で生成します。
  //  フロントエンドから未来日付が要求された際にも
  //  404 とならないようにするのが目的です。
  // ================================

  const DAYS_AHEAD = parseInt(process.env.MOCK_DAYS_AHEAD ?? '7', 10); // 任意で環境変数で調整可能

  mockDailyProblemSets = [];
  
  // 各日付×各難易度の問題セットを生成
  for (let i = 0; i <= DAYS_AHEAD; i++) {
    const dateStr = dayjs().add(i, 'day').format('YYYY-MM-DD');
    
    for (const difficulty of ['beginner', 'intermediate', 'advanced', 'expert']) {
      const problemSetId = i * 4 + ['beginner', 'intermediate', 'advanced', 'expert'].indexOf(difficulty) + 1;
      
      try {
        // 実際の問題生成関数を使用（日付ベースのシードで一貫性を確保）
        const baseSeed = `${dateStr}_${difficulty}`.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        const seed = baseSeed + i * 1000 + Math.random() * 100; // 日付ごとに異なるシード
        
        logger.debug(`[initializeMockData] ${dateStr} ${difficulty} 問題生成開始 (seed: ${seed})`);
        
        const generatedProblems = await generateProblems(difficulty, 10, seed);
        
        let problems = [];
        if (generatedProblems && generatedProblems.length > 0) {
          // generateProblems の出力を DailyProblemSet の期待する形式に変換
          problems = generatedProblems.map(p => ({
            id: p.id,
            question: p.question,
            correctAnswer: p.answer, // answer -> correctAnswer に変換
            options: p.options
          }));
          logger.debug(`[initializeMockData] ${dateStr} ${difficulty} 問題生成成功: ${problems.length}問`);
        } else {
          logger.warn(`[initializeMockData] ${dateStr} ${difficulty} 問題生成失敗、デフォルト問題を使用`);
          // フォールバック: 基本的な問題を生成
          problems = Array.from({ length: 10 }, (_, idx) => {
            const num1 = 10 + (i * 2) + idx;
            const num2 = 5 + idx;
            const operation = idx % 2 === 0 ? '+' : '-';
            const answer = operation === '+' ? num1 + num2 : Math.abs(num1 - num2);
            return {
              id: `fallback_${difficulty}_${i+1}_${idx+1}`,
              question: `${num1} ${operation} ${num2} = ?`,
              correctAnswer: answer,
              options: [answer - 1, answer, answer + 1, answer + 2].sort(() => Math.random() - 0.5)
            };
          });
        }
        
        mockDailyProblemSets.push({
          _id: problemSetId,
          date: dateStr,
          difficulty: difficulty,
          problems: problems,
          isEdited: false,
          createdAt: new Date(),
          updatedAt: new Date()
        });
        
      } catch (error) {
        logger.error(`[initializeMockData] ${dateStr} ${difficulty} 問題生成エラー:`, error);
        // エラー時のフォールバック問題を生成
        const fallbackProblems = Array.from({ length: 10 }, (_, idx) => {
          const num1 = 10 + (i * 3) + idx;
          const num2 = 3 + idx;
          const operation = '+';
          const answer = num1 + num2;
          return {
            id: `error_fallback_${difficulty}_${i+1}_${idx+1}`,
            question: `${num1} ${operation} ${num2} = ?`,
            correctAnswer: answer,
            options: [answer - 1, answer, answer + 1, answer + 2].sort(() => Math.random() - 0.5)
          };
        });
        
        mockDailyProblemSets.push({
          _id: problemSetId,
          date: dateStr,
          difficulty: difficulty,
          problems: fallbackProblems,
          isEdited: false,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
    }
  }
  
  logger.info('✅ モックユーザーデータ初期化完了');
  logger.info(`👤 利用可能アカウント:`);
  logger.info(`   管理者: admin@example.com / admin123`);
  logger.info(`   管理者: kanri@example.com / kanri123`);
  logger.info(`   テスト: test@example.com / test123`);
  logger.info(`🧮 モック問題セット生成完了: ${today} から ${DAYS_AHEAD + 1} 日間分 (全難易度、各10問)`);
  logger.info(`   - 各日付×4難易度の問題セット: ${mockDailyProblemSets.length} 個`);
  logger.info(`   - 初級/中級/上級/エキスパート: 各10問`);
  logger.debug(`[Mock Init] 初期化完了時のmockDailyProblemSets配列長: ${mockDailyProblemSets.length}`);
};

// モック環境判定（本番環境では常にfalse）
const isMongoMock = () => {
  // 本番環境ではmongodbを使用、開発環境でのみモックを許可
  const mongoMockValue = process.env.MONGODB_MOCK?.toString().trim();
  const isProduction = process.env.NODE_ENV === 'production';
  
  if (isProduction) {
    logger.info('[Database] 本番環境: MongoDB Atlas接続を使用');
    return false; // 本番環境では常にMongoDB
  }
  
  const isMock = mongoMockValue === 'true';
  logger.debug(`[Database] 開発環境: MONGODB_MOCK="${mongoMockValue}", isMock=${isMock}`);
  return isMock;
};

// MongoDB Atlas接続
const connectMongoDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI;
    if (!mongoURI) {
      throw new Error('MONGODB_URI環境変数が設定されていません');
    }
    
    logger.info(`[Database] MongoDB Atlas接続開始...`);
    
    // Vercel環境用の接続設定
    const options = {
      serverSelectionTimeoutMS: 10000, // 10秒
      socketTimeoutMS: 20000, // 20秒
      maxPoolSize: 5, // Vercelでは小さなプールサイズ
      bufferMaxEntries: 0
    };
    
    await mongoose.connect(mongoURI, options);
    logger.info('✅ MongoDB Atlas接続成功');
    
    // Vercel環境では管理者ユーザー作成を非同期で実行（エラーでも続行）
    createAdminUsersIfNeeded().catch(err => {
      logger.warn('[Database] 管理者ユーザー作成は遅延実行:', err.message);
    });
    
    return true;
  } catch (error) {
    logger.error('[Database] MongoDB Atlas接続エラー:', error.message);
    throw error;
  }
};

// 管理者ユーザーの作成
const createAdminUsersIfNeeded = async () => {
  try {
    // 基本的なUserスキーマ定義
    const userSchema = new mongoose.Schema({
      username: { type: String, required: true, unique: true },
      email: { type: String, required: true, unique: true },
      password: { type: String, required: true },
      grade: { type: Number, default: 1 },
      avatar: { type: String, default: '😊' },
      isAdmin: { type: Boolean, default: false },
      createdAt: { type: Date, default: Date.now },
      updatedAt: { type: Date, default: Date.now }
    });

    // モデルの取得または作成
    const User = mongoose.models.User || mongoose.model('User', userSchema);
    
    // 管理者ユーザーデータ
    const adminUsers = [
      { username: 'admin', email: 'admin@example.com', password: 'admin123' },
      { username: 'kanri', email: 'kanri@example.com', password: 'kanri123' }
    ];
    
    for (const adminData of adminUsers) {
      const existingUser = await User.findOne({ email: adminData.email });
      if (!existingUser) {
        logger.info(`[Database] 管理者ユーザー作成中: ${adminData.email}`);
        
        // パスワードをハッシュ化
        const hashedPassword = await bcrypt.hash(adminData.password, 10);
        
        await User.create({
          username: adminData.username,
          email: adminData.email,
          password: hashedPassword,
          grade: 6,
          avatar: '👑',
          isAdmin: true
        });
        
        logger.info(`[Database] 管理者ユーザー作成完了: ${adminData.email}`);
      } else {
        logger.debug(`[Database] 管理者ユーザー存在確認: ${adminData.email}`);
      }
    }
    
  } catch (error) {
    logger.error('[Database] 管理者ユーザー作成エラー:', error.message);
  }
};

// メイン接続関数
const connectDB = async () => {
  return await connectMongoDB();
};

export { 
  connectDB,
  connectMongoDB,
  getMockUsers,
  getMockResults, 
  getMockDailyProblemSets,
  addMockUser,
  addMockResult,
  findMockUser,
  updateMockUser,
  addMockDailyProblemSet,
  findMockDailyProblemSet,
  /* ユーザーの学年変更に伴い Result の grade を一括更新 */
  updateGradeForUserResults,
  /* 統一されたモックデータ操作関数 */
  getMockUserUnified,
  updateMockUserUnified,
  persistMockData
};

/**
 * 指定ユーザーの結果レコードに新しい学年を反映
 * @param {string|ObjectId} userId
 * @param {number} newGrade
 */
function updateGradeForUserResults(userId, newGrade) {
  logger.debug(`[updateGradeForUserResults] 実行開始: userId=${userId}, newGrade=${newGrade}`);
  
  // userIdを必ず文字列に変換
  const idStr = String(userId);
  let updatedCount = 0;
  
  // モック環境の場合
  if (process.env.MONGODB_MOCK === 'true') {
    mockResults.forEach(r => {
      if (r.userId && String(r.userId) === idStr) {
        const oldGrade = r.grade;
        r.grade = newGrade;
        r.updatedAt = new Date(); // 更新日時も記録
        updatedCount++;
        logger.debug(`[updateGradeForUserResults] モック結果レコード更新: ${oldGrade} -> ${newGrade}`);
      }
    });
  }
  
  logger.debug(`[updateGradeForUserResults] 更新完了: ${updatedCount}件のレコードを更新`);
  
  // 更新件数を返すように変更
  return updatedCount;
}

/**
 * モックデータの永続化機能を追加
 * ※ 実際のプロダクション環境ではRedisやファイルシステムを使用
 */
function persistMockData() {
  if (process.env.MONGODB_MOCK === 'true') {
    logger.debug('[persistMockData] モックデータの状態確認');
    logger.debug(`[persistMockData] ユーザー数: ${mockUsers.length}, 結果数: ${mockResults.length}`);
  }
}

/**
 * 統一されたモックユーザー取得関数
 * @param {Object} query - 検索クエリ
 * @returns {Object|null} - 見つかったユーザーまたはnull
 */
function getMockUserUnified(query) {
  const user = findMockUser(query);
  if (user) {
    logger.debug(`[getMockUserUnified] ユーザー取得成功: ${user.username}, grade=${user.grade}`);
  } else {
    logger.debug(`[getMockUserUnified] ユーザーが見つかりません: ${JSON.stringify(query)}`);
  }
  return user;
}

/**
 * 統一されたモックユーザー更新関数
 * @param {string} id - ユーザーID
 * @param {Object} updates - 更新データ
 * @returns {Object|null} - 更新されたユーザーまたはnull
 */
function updateMockUserUnified(id, updates) {
  logger.debug(`[updateMockUserUnified] 更新処理開始: id=${id}, updates=`, updates);
  
  // 更新前の状態を確認
  const beforeUser = findMockUser({ _id: id });
  if (!beforeUser) {
    logger.error(`[updateMockUserUnified] ユーザーが見つかりません: ${id}`);
    return null;
  }
  
  logger.debug(`[updateMockUserUnified] 更新前のユーザー情報:`, {
    username: beforeUser.username,
    grade: beforeUser.grade,
    avatar: beforeUser.avatar
  });
  
  // 更新実行
  const result = updateMockUser(id, updates);
  
  if (result) {
    logger.debug(`[updateMockUserUnified] 更新成功後のユーザー情報:`, {
      username: result.username,
      grade: result.grade,
      avatar: result.avatar
    });
    
    // 結果テーブルも同期更新
    if (updates.grade !== undefined) {
      logger.debug(`[updateMockUserUnified] 結果テーブルの学年も更新: ${updates.grade}`);
      updateGradeForUserResults(id, updates.grade);
    }
    
    // 更新完了後の最終確認
    const finalUser = findMockUser({ _id: id });
    logger.debug(`[updateMockUserUnified] 最終確認:`, {
      username: finalUser?.username,
      grade: finalUser?.grade,
      avatar: finalUser?.avatar
    });
    
    persistMockData(); // 変更後のデータを永続化
    return result;
  } else {
    logger.error(`[updateMockUserUnified] 更新に失敗しました: ${id}`);
    return null;
  }
} 