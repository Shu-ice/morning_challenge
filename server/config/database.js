import mongoose from 'mongoose';
import { logger } from '../utils/logger.js';
import bcrypt from 'bcryptjs';
import dayjs from 'dayjs';

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
    
    ['beginner', 'intermediate', 'advanced', 'expert'].forEach((difficulty, diffIndex) => {
      const problemSetId = i * 4 + diffIndex + 1;
      
      let problems = [];
      // 各難易度に応じた問題を生成
      if (difficulty === 'beginner') {
        problems = [
          { id: `mock_${difficulty}_${i+1}_1`, question: '23 + 45 = ?', correctAnswer: 68, options: [66, 67, 68, 69] },
          { id: `mock_${difficulty}_${i+1}_2`, question: '87 - 34 = ?', correctAnswer: 53, options: [51, 52, 53, 54] },
          { id: `mock_${difficulty}_${i+1}_3`, question: '56 + 29 = ?', correctAnswer: 85, options: [83, 84, 85, 86] },
          { id: `mock_${difficulty}_${i+1}_4`, question: '74 - 28 = ?', correctAnswer: 46, options: [44, 45, 46, 47] },
          { id: `mock_${difficulty}_${i+1}_5`, question: '234 + 56 = ?', correctAnswer: 290, options: [288, 289, 290, 291] },
          { id: `mock_${difficulty}_${i+1}_6`, question: '389 - 67 = ?', correctAnswer: 322, options: [320, 321, 322, 323] },
          { id: `mock_${difficulty}_${i+1}_7`, question: '567 + 89 = ?', correctAnswer: 656, options: [654, 655, 656, 657] },
          { id: `mock_${difficulty}_${i+1}_8`, question: '7 × 8 = ?', correctAnswer: 56, options: [54, 55, 56, 57] },
          { id: `mock_${difficulty}_${i+1}_9`, question: '9 × 6 = ?', correctAnswer: 54, options: [52, 53, 54, 55] },
          { id: `mock_${difficulty}_${i+1}_10`, question: '8 × 9 = ?', correctAnswer: 72, options: [70, 71, 72, 73] }
        ];
      } else if (difficulty === 'intermediate') {
        problems = [
          { id: `mock_${difficulty}_${i+1}_1`, question: '25 + 47 = ?', correctAnswer: 72, options: [70, 71, 72, 73] },
          { id: `mock_${difficulty}_${i+1}_2`, question: '93 - 58 = ?', correctAnswer: 35, options: [33, 34, 35, 36] },
          { id: `mock_${difficulty}_${i+1}_3`, question: '12 × 8 = ?', correctAnswer: 96, options: [94, 95, 96, 97] },
          { id: `mock_${difficulty}_${i+1}_4`, question: '144 ÷ 12 = ?', correctAnswer: 12, options: [10, 11, 12, 13] },
          { id: `mock_${difficulty}_${i+1}_5`, question: '67 + 29 = ?', correctAnswer: 96, options: [94, 95, 96, 97] },
          { id: `mock_${difficulty}_${i+1}_6`, question: '85 - 37 = ?', correctAnswer: 48, options: [46, 47, 48, 49] },
          { id: `mock_${difficulty}_${i+1}_7`, question: '15 × 6 = ?', correctAnswer: 90, options: [88, 89, 90, 91] },
          { id: `mock_${difficulty}_${i+1}_8`, question: '108 ÷ 9 = ?', correctAnswer: 12, options: [10, 11, 12, 13] },
          { id: `mock_${difficulty}_${i+1}_9`, question: '74 + 56 = ?', correctAnswer: 130, options: [128, 129, 130, 131] },
          { id: `mock_${difficulty}_${i+1}_10`, question: '156 - 89 = ?', correctAnswer: 67, options: [65, 66, 67, 68] }
        ];
      } else if (difficulty === 'advanced') {
        problems = [
          { id: `mock_${difficulty}_${i+1}_1`, question: '234 + 567 = ?', correctAnswer: 801, options: [799, 800, 801, 802] },
          { id: `mock_${difficulty}_${i+1}_2`, question: '1000 - 347 = ?', correctAnswer: 653, options: [651, 652, 653, 654] },
          { id: `mock_${difficulty}_${i+1}_3`, question: '23 × 45 = ?', correctAnswer: 1035, options: [1033, 1034, 1035, 1036] },
          { id: `mock_${difficulty}_${i+1}_4`, question: '1728 ÷ 24 = ?', correctAnswer: 72, options: [70, 71, 72, 73] },
          { id: `mock_${difficulty}_${i+1}_5`, question: '456 + 789 = ?', correctAnswer: 1245, options: [1243, 1244, 1245, 1246] },
          { id: `mock_${difficulty}_${i+1}_6`, question: '2000 - 678 = ?', correctAnswer: 1322, options: [1320, 1321, 1322, 1323] },
          { id: `mock_${difficulty}_${i+1}_7`, question: '34 × 56 = ?', correctAnswer: 1904, options: [1902, 1903, 1904, 1905] },
          { id: `mock_${difficulty}_${i+1}_8`, question: '2016 ÷ 36 = ?', correctAnswer: 56, options: [54, 55, 56, 57] },
          { id: `mock_${difficulty}_${i+1}_9`, question: '789 + 654 = ?', correctAnswer: 1443, options: [1441, 1442, 1443, 1444] },
          { id: `mock_${difficulty}_${i+1}_10`, question: '3000 - 1234 = ?', correctAnswer: 1766, options: [1764, 1765, 1766, 1767] }
        ];
      } else if (difficulty === 'expert') {
        problems = [
          { id: `mock_${difficulty}_${i+1}_1`, question: '2³ + 5² = ?', correctAnswer: 33, options: [31, 32, 33, 34] },
          { id: `mock_${difficulty}_${i+1}_2`, question: '√144 + √81 = ?', correctAnswer: 21, options: [19, 20, 21, 22] },
          { id: `mock_${difficulty}_${i+1}_3`, question: '67 × 89 = ?', correctAnswer: 5963, options: [5961, 5962, 5963, 5964] },
          { id: `mock_${difficulty}_${i+1}_4`, question: '4096 ÷ 64 = ?', correctAnswer: 64, options: [62, 63, 64, 65] },
          { id: `mock_${difficulty}_${i+1}_5`, question: '3⁴ - 2⁵ = ?', correctAnswer: 49, options: [47, 48, 49, 50] },
          { id: `mock_${difficulty}_${i+1}_6`, question: '√225 × √16 = ?', correctAnswer: 60, options: [58, 59, 60, 61] },
          { id: `mock_${difficulty}_${i+1}_7`, question: '123 × 456 = ?', correctAnswer: 56088, options: [56086, 56087, 56088, 56089] },
          { id: `mock_${difficulty}_${i+1}_8`, question: '9999 ÷ 99 = ?', correctAnswer: 101, options: [99, 100, 101, 102] },
          { id: `mock_${difficulty}_${i+1}_9`, question: '5! ÷ 3! = ?', correctAnswer: 20, options: [18, 19, 20, 21] },
          { id: `mock_${difficulty}_${i+1}_10`, question: '2⁶ + 3³ = ?', correctAnswer: 91, options: [89, 90, 91, 92] }
        ];
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
    });
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

const connectDB = async () => {
  const isMongoMock = process.env.MONGODB_MOCK === 'true';
  
  if (isMongoMock) {
    logger.info('🗂️  InMemoryデータベースモードで起動');
    await initializeMockData();
    return true;
  }

  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/morning_challenge';
    logger.info(`🔗 MongoDB接続試行: ${mongoURI}`);
    
    await mongoose.connect(mongoURI);
    logger.info('✅ MongoDB接続成功');
    return true;
  } catch (error) {
    logger.error(`❌ MongoDB接続エラー: ${error.message}`);

    // === 変更点 ===
    // Vercel などの本番環境では自動でモック DB に切り替えない
    // 明示的に USE_MOCK_DB=true が指定されている場合のみモックに切替
    const allowMock = process.env.USE_MOCK_DB === 'true';
    const isVercel = !!process.env.VERCEL; // Vercel 環境では VERCEL=1 が自動付与される

    if (allowMock && !isVercel) {
      logger.warn('🧪 USE_MOCK_DB=true のため InMemory モック DB に切替');
      process.env.MONGODB_MOCK = 'true';
      await initializeMockData();
      return true;
    }

    // 本番環境で接続できない場合は致命的エラーとして終了
    logger.error('❌ 本番環境で MongoDB に接続できません。MONGODB_URI を確認してください。');
    throw error;
  }
};

// モックデータのゲッター関数（_id安全性チェック付き）
const getMockUsers = () => {
  // 全てのユーザーが有効な_idを持っていることを確認
  const validUsers = mockUsers.filter(user => {
    if (!user || !user._id) {
      logger.warn(`[getMockUsers] 無効なユーザーを検出: ${JSON.stringify(user)}`);
      return false;
    }
    return true;
  });
  
  if (validUsers.length !== mockUsers.length) {
    logger.warn(`[getMockUsers] ${mockUsers.length - validUsers.length}個の無効なユーザーを除外しました`);
  }
  
  return validUsers;
};
const getMockResults = () => {
  // 全ての結果レコードでuserIdが文字列であることを確認
  const validResults = mockResults.map(result => ({
    ...result,
    userId: String(result.userId) // 文字列に統一
  }));
  return validResults;
};
const getMockDailyProblemSets = () => {
  logger.debug(`[database.js] getMockDailyProblemSets called, returning ${mockDailyProblemSets.length} sets`);
  return mockDailyProblemSets;
};

// モックデータの操作関数
const addMockResult = (result) => {
  // userIdを必ず文字列に統一
  result.userId = String(result.userId);
  result._id = result._id || (mockResults.length + 1).toString();
  result.createdAt = result.createdAt || new Date();
  result.updatedAt = result.updatedAt || new Date();
  
  mockResults.push(result);
  logger.debug(`[addMockResult] 新しい結果レコードを追加: userId=${result.userId}, grade=${result.grade}`);
  return result;
};

const addMockUser = (user) => {
  // _idが未設定または無効な場合は新しいIDを生成
  if (!user._id || typeof user._id !== 'string') {
    user._id = (mockUsers.length + 1).toString();
  }
  
  // _idの重複チェック
  while (mockUsers.some(existingUser => existingUser._id === user._id)) {
    const numericId = parseInt(user._id) || mockUsers.length + 1;
    user._id = (numericId + 1).toString();
  }
  
  // 必須フィールドのデフォルト値設定
  user.createdAt = user.createdAt || new Date();
  user.updatedAt = user.updatedAt || new Date();
  user.grade = user.grade ?? 1;
  user.avatar = user.avatar || '😊';
  user.isAdmin = user.isAdmin || false;
  
  mockUsers.push(user);
  logger.debug(`[addMockUser] 新しいユーザーを追加: ${user.username} (ID: ${user._id})`);
  return user;
};

const findMockUser = (query) => {
  logger.debug(`🔥🔥🔥 [findMockUser] 検索クエリ: ${JSON.stringify(query)}`);
  logger.debug(`🔥🔥🔥 [findMockUser] 現在のmockUsers数: ${mockUsers.length}`);
  
  if (query.email) {
    const user = mockUsers.find(user => user.email === query.email);
    logger.debug(`🔥🔥🔥 [findMockUser] email検索結果: ${user ? user.username : 'null'}`);
    if (user) {
      logger.debug(`🔥🔥🔥 [findMockUser] ユーザー詳細:`);
      logger.debug(`🔥🔥🔥 [findMockUser]   - username: ${user.username}`);
      logger.debug(`🔥🔥🔥 [findMockUser]   - email: ${user.email}`);
      logger.debug(`🔥🔥🔥 [findMockUser]   - isAdmin: ${user.isAdmin}`);
      logger.debug(`🔥🔥🔥 [findMockUser]   - typeof isAdmin: ${typeof user.isAdmin}`);
    }
    return user;
  }
  if (query._id) {
    const user = mockUsers.find(user => user._id === query._id);
    logger.debug(`🔥🔥🔥 [findMockUser] _id検索結果: ${user ? user.username : 'null'}`);
    return user;
  }
  logger.debug(`🔥🔥🔥 [findMockUser] 無効なクエリ`);
  return null;
};

const updateMockUser = (id, updates) => {
  logger.debug(`[updateMockUser] 更新処理開始: id=${id}, updates=`, updates);
  const userIndex = mockUsers.findIndex(user => user._id === id);
  logger.debug(`[updateMockUser] ユーザーインデックス: ${userIndex}`);
  
  if (userIndex !== -1) {
    const beforeUpdate = { ...mockUsers[userIndex] };
    mockUsers[userIndex] = { ...mockUsers[userIndex], ...updates, updatedAt: new Date() };
    logger.debug(`[updateMockUser] 更新前grade: ${beforeUpdate.grade}, 更新後grade: ${mockUsers[userIndex].grade}`);
    logger.debug(`[updateMockUser] 更新完了:`, mockUsers[userIndex]);
    return mockUsers[userIndex];
  }
  logger.debug(`[updateMockUser] ユーザーが見つかりません: id=${id}`);
  return null;
};

// 問題セット操作関数
const addMockDailyProblemSet = (problemSet) => {
  problemSet._id = mockDailyProblemSets.length + 1;
  problemSet.createdAt = problemSet.createdAt || new Date();
  problemSet.updatedAt = problemSet.updatedAt || new Date();
  mockDailyProblemSets.push(problemSet);
  logger.debug(`[database.js] addMockDailyProblemSet: 追加後の総数=${mockDailyProblemSets.length}`);
  return problemSet;
};

const findMockDailyProblemSet = (query) => {
  logger.debug(`[database.js] findMockDailyProblemSet: ${JSON.stringify(query)}`);
  const result = mockDailyProblemSets.find(set => {
    if (query.date && set.date !== query.date) return false;
    if (query.difficulty && set.difficulty !== query.difficulty) return false;
    if (query._id && set._id !== query._id) return false;
    return true;
  });
  logger.debug(`[database.js] findMockDailyProblemSet result: ${result ? 'found' : 'not found'}`);
  return result;
};

export { 
  connectDB,
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