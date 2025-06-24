// 🔥 数学問題生成API - 完全統合版
// server/utils/problemGenerator.js と server/utils/timeWindow.js を活用
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

// 環境変数設定
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://moutaro:moutaromoutaro@morninng.cq5xzt9.mongodb.net/?retryWrites=true&w=majority&appName=morninng';
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret';

// 時間制限設定（デフォルト）
const TIME_WINDOW = {
  start: '06:30',
  end: '08:00',
  adminBypass: true
};

// 時間制限チェック関数（共通化）
const isWithinTimeWindow = () => {
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentTime = currentHour + currentMinute / 60;
  
  // 開発環境での時間制限無効化
  if (process.env.NODE_ENV === 'development' || process.env.DISABLE_TIME_CHECK === 'true') {
    console.log('⏰ Time check disabled for development');
    return true;
  }
  
  return currentTime >= 6.5 && currentTime <= 8.0; // 6:30-8:00
};

// JWT検証とadmin判定
function verifyTokenAndGetUser(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  
  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded;
  } catch (error) {
    console.error('JWT verification failed:', error.message);
    return null;
  }
}

// 管理者チェック関数（統合版）
const isAdmin = (req) => {
  console.log('🔐 Admin check started');
  
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    console.log('❌ No authorization header');
    return false;
  }
  
  const user = verifyTokenAndGetUser(authHeader);
  if (!user) {
    console.log('❌ Invalid token');
    return false;
  }
  
  // 管理者チェック
  const isAdminUser = user.isAdmin === true || 
                     user.email === 'admin@example.com' || 
                     user.email === 'kanri@example.com' ||
                     user.username === 'admin' ||
                     user.username === 'kanri';
  
  console.log(`🔍 Admin check result: ${isAdminUser} for user ${user.email || user.username}`);
  return isAdminUser;
};

// 難易度ランク定数
const DifficultyRank = {
  BEGINNER: 'beginner',
  INTERMEDIATE: 'intermediate', 
  ADVANCED: 'advanced',
  EXPERT: 'expert'
};

// 問題生成関数（server/utils/problemGenerator.js から移植・簡素化）
function seededRandom(seed) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function getRandomInt(min, max, seed) {
  const random = seededRandom(seed);
  return Math.floor(random * (max - min + 1)) + min;
}

function getDateSeed() {
  const now = new Date();
  const dateString = `${now.getFullYear()}${now.getMonth()}${now.getDate()}`;
  let seed = 0;
  for (let i = 0; i < dateString.length; i++) {
    seed += dateString.charCodeAt(i);
  }
  return seed;
}

// 難易度別問題パラメータ
function getParamsForDifficulty(difficulty) {
  switch (difficulty) {
    case DifficultyRank.BEGINNER:
      return {
        problemTypes: ['add_subtract_2digit', 'add_subtract_3digit_2digit', 'multiplication_table'],
        problemComposition: {
          'add_subtract_2digit': 4,
          'add_subtract_3digit_2digit': 3,
          'multiplication_table': 3
        },
        digitRanges: {
          add_subtract_2digit: { num1: [10, 99], num2: [10, 99] },
          add_subtract_3digit_2digit: { num1: [100, 999], num2: [10, 99] },
          multiplication_table: { num1: [1, 9], num2: [1, 9] }
        },
        maxResultValue: 1000
      };
      
    case DifficultyRank.INTERMEDIATE:
      return {
        problemTypes: ['add_subtract_4digit', 'multiply_2digit_2digit', 'multiply_3digit_2digit', 'divide_3digit_1digit'],
        problemComposition: {
          'add_subtract_4digit': 3,
          'multiply_2digit_2digit': 2,
          'multiply_3digit_2digit': 3,
          'divide_3digit_1digit': 2
        },
        digitRanges: {
          add_subtract_4digit: { num1: [1000, 9999], num2: [100, 9999] },
          multiply_2digit_2digit: { num1: [10, 99], num2: [10, 99] },
          multiply_3digit_2digit: { num1: [100, 999], num2: [10, 99] },
          divide_3digit_1digit: { divisor: [2, 9], quotient: [100, 999] }
        },
        maxResultValue: 100000
      };
      
    case DifficultyRank.ADVANCED:
      return {
        problemTypes: ['add_subtract_5digit', 'multiply_4digit_2digit', 'multiply_4digit_3digit', 'divide_4digit_2digit'],
        problemComposition: {
          'add_subtract_5digit': 3,
          'multiply_4digit_2digit': 2,
          'multiply_4digit_3digit': 3,
          'divide_4digit_2digit': 2
        },
        digitRanges: {
          add_subtract_5digit: { num1: [10000, 99999], num2: [1000, 99999] },
          multiply_4digit_2digit: { num1: [1000, 9999], num2: [10, 99] },
          multiply_4digit_3digit: { num1: [1000, 9999], num2: [100, 999] },
          divide_4digit_2digit: { divisor: [10, 99], quotient: [100, 999] }
        },
        maxResultValue: 1000000
      };
      
    case DifficultyRank.EXPERT:
      return {
        problemTypes: ['add_subtract_6digit', 'multiply_5digit_3digit', 'multiply_5digit_4digit', 'divide_5digit_3digit'],
        problemComposition: {
          'add_subtract_6digit': 3,
          'multiply_5digit_3digit': 2,
          'multiply_5digit_4digit': 3,
          'divide_5digit_3digit': 2
        },
        digitRanges: {
          add_subtract_6digit: { num1: [100000, 999999], num2: [10000, 999999] },
          multiply_5digit_3digit: { num1: [10000, 99999], num2: [100, 999] },
          multiply_5digit_4digit: { num1: [10000, 99999], num2: [1000, 9999] },
          divide_5digit_3digit: { divisor: [100, 999], quotient: [100, 999] }
        },
        maxResultValue: 1000000000
      };
      
    default:
      return {
        problemTypes: ['add_subtract_2digit'],
        problemComposition: { 'add_subtract_2digit': 10 },
        digitRanges: { add_subtract_2digit: { num1: [10, 99], num2: [10, 99] } },
        maxResultValue: 200
      };
  }
}

// 特定タイプの問題生成
function generateSpecificProblem(problemType, difficulty, seed) {
  const params = getParamsForDifficulty(difficulty);
  
  try {
    let nums = [], ops = [], question = "";
    
    if (problemType === 'add_subtract_2digit' || problemType === 'add_subtract_3digit_2digit' || 
        problemType === 'add_subtract_4digit' || problemType === 'add_subtract_5digit' || 
        problemType === 'add_subtract_6digit') {
      const { num1, num2 } = params.digitRanges[problemType];
      let n1 = getRandomInt(num1[0], num1[1], seed);
      let n2 = getRandomInt(num2[0], num2[1], seed + 1);
      const op = seededRandom(seed + 2) > 0.5 ? '+' : '-';
      
      if (op === '-' && n1 < n2) [n1, n2] = [n2, n1];
      nums = [n1, n2];
      ops = [op];
      question = `${n1} ${op} ${n2}`;
      
    } else if (problemType === 'multiplication_table' || problemType.includes('multiply_')) {
      const { num1, num2 } = params.digitRanges[problemType];
      const n1 = getRandomInt(num1[0], num1[1], seed);
      const n2 = getRandomInt(num2[0], num2[1], seed + 1);
      nums = [n1, n2];
      ops = ['×'];
      question = `${n1} × ${n2}`;
      
    } else if (problemType.includes('divide_')) {
      const divisionConfig = params.digitRanges[problemType];
      if (divisionConfig && divisionConfig.divisor && divisionConfig.quotient) {
        const divisor = getRandomInt(divisionConfig.divisor[0], divisionConfig.divisor[1], seed);
        const quotient = getRandomInt(divisionConfig.quotient[0], divisionConfig.quotient[1], seed + 1);
        const dividend = divisor * quotient;
        
        nums = [dividend, divisor];
        ops = ['÷'];
        question = `${dividend} ÷ ${divisor}`;
      }
    }
    
    // 答えを計算
    let answer;
    if (ops[0] === '+') answer = nums[0] + nums[1];
    else if (ops[0] === '-') answer = nums[0] - nums[1];
    else if (ops[0] === '×') answer = nums[0] * nums[1];
    else if (ops[0] === '÷') answer = nums[0] / nums[1];
    
    // バリデーション
    if (!Number.isFinite(answer) || answer < 0 || answer > params.maxResultValue) {
      return null;
    }
    
    return {
      id: `${problemType}_${seed}`,
      question: question + ' = ?',
      answer: Math.round(answer),
      options: [], // フロントエンドが期待する形式
      type: 'calculation'
    };
    
  } catch (error) {
    console.error(`Error generating ${problemType}:`, error.message);
    return null;
  }
}

// 問題セット生成（組み合わせベース）
function generateProblemSet(difficulty) {
  const params = getParamsForDifficulty(difficulty);
  const problemComposition = params.problemComposition;
  const allProblems = [];
  
  let seedCounter = getDateSeed() + Date.now();
  
  // 各問題タイプごとに指定数の問題を生成 (null なら再試行して必ず count を満たす)
  for (const [problemType, count] of Object.entries(problemComposition)) {
    let generated = 0;
    let attempt = 0;
    const maxAttempts = count * 20; // 安全装置（無限ループ防止）

    while (generated < count && attempt < maxAttempts) {
      seedCounter += 1000; // 毎回シードをずらす
      const problem = generateSpecificProblem(problemType, difficulty, seedCounter + attempt);
      if (problem) {
        allProblems.push(problem);
        generated++;
      }
      attempt++;
    }

    if (generated < count) {
      console.warn(`⚠️  ${problemType} で ${count} 件中 ${generated} 件しか生成できませんでした`);
    }
  }
  
  // 問題をシャッフル
  for (let i = allProblems.length - 1; i > 0; i--) {
    const j = Math.floor(seededRandom(seedCounter + i) * (i + 1));
    [allProblems[i], allProblems[j]] = [allProblems[j], allProblems[i]];
  }
  
  return allProblems;
}

// メインハンドラー関数
const handler = async function(req, res) {
  console.log('🎯 Problems API called:', req.method, req.url);
  console.log('📝 Query params:', req.query);
  
  // CORS設定
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    console.log('✅ OPTIONS request handled');
    return res.status(200).end();
  }

  // MongoDB接続
  if (!mongoose.connection.readyState) {
    await mongoose.connect(MONGODB_URI, { 
      dbName: 'morning_challenge',
      useNewUrlParser: true,
      useUnifiedTopology: true 
    });
  }

  // DailyProblemSetスキーマ定義
  const dailyProblemSetSchema = new mongoose.Schema({
    date: { type: String, required: true },
    difficulty: { type: String, required: true },
    problems: { type: Array, required: true },
    isActive: { type: Boolean, default: true }
  }, { timestamps: true });

  const DailyProblemSet = mongoose.models.DailyProblemSet || 
    mongoose.model('DailyProblemSet', dailyProblemSetSchema);

  try {
    if (req.method === 'GET') {
      console.log('📚 Problems API called...');
      
      // 🔧 Step 1: 難易度バリデーション（時間制限チェックより先に実行）
      let difficulty = (req.query.difficulty || 'beginner').toString().toLowerCase();
      
      // === 難易度バリデーション（時間制限チェックより先に行う） ===
      const validDifficulties = Object.values(DifficultyRank); // ['beginner', 'intermediate', ...]
      if (!validDifficulties.includes(difficulty)) {
        console.log(`❌ Invalid difficulty: ${difficulty}. valid -> ${validDifficulties.join(', ')}`);
        return res.status(400).json({
          success: false,
          error: 'Invalid difficulty level',
          message: `有効な難易度を指定してください: ${validDifficulties.join(', ')}`,
          validDifficulties
        });
      }
      
      console.log(`✅ Valid difficulty confirmed: ${difficulty}`);
      
      // 🔧 Step 2: 時間制限チェック（バリデーション後に実行）
      const userIsAdmin = isAdmin(req);
      const withinTimeWindow = isWithinTimeWindow();
      
      // 管理者は常に時間制限をバイパス
      const canAccess = userIsAdmin || withinTimeWindow || 
                       process.env.NODE_ENV === 'development' || 
                       process.env.DISABLE_TIME_CHECK === 'true';
      
      console.log('⏰ Access check:', {
        isAdmin: userIsAdmin,
        withinTimeWindow: withinTimeWindow,
        canAccess: canAccess,
        currentTime: new Date().toLocaleTimeString('ja-JP', { timeZone: 'Asia/Tokyo' }),
        adminBypass: userIsAdmin ? 'YES - TIME LIMIT BYPASSED' : 'NO'
      });

      if (!canAccess) {
        console.log('❌ Access denied - outside time window');
        return res.status(403).json({
          success: false,
          error: 'Problems are only available between 6:30 AM and 8:00 AM',
          message: '朝の計算チャレンジは、朝6:30から8:00の間のみ挑戦できます。またの挑戦をお待ちしています！',
          timeWindow: {
            start: TIME_WINDOW.start,
            end: TIME_WINDOW.end,
            current: new Date().toLocaleTimeString('ja-JP', { timeZone: 'Asia/Tokyo' })
          },
          isTimeRestricted: true,
          timestamp: new Date().toISOString()
        });
      }
      
      // 🔧 Step 3: 日付とMongoDB検索
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD JST
      console.log(`📚 Checking for existing problems: date=${today}, difficulty=${difficulty}`);
      
      // MongoDB dailyproblemsets コレクションから既存問題を検索
      let existingProblemSet = await DailyProblemSet.findOne({
        date: today,
        difficulty: difficulty
      });
      
      if (existingProblemSet && existingProblemSet.problems && existingProblemSet.problems.length > 0) {
        console.log(`✅ Found existing problem set: ${existingProblemSet.problems.length} problems`);
        
        return res.status(200).json({
          success: true,
          problems: existingProblemSet.problems,
          timeWindow: {
            start: TIME_WINDOW.start,
            end: TIME_WINDOW.end,
            adminBypass: userIsAdmin
          },
          difficulty: difficulty,
          date: today,
          source: 'database',
          timestamp: new Date().toISOString()
        });
      }
      
      console.log(`📚 No existing problems found, generating new set for difficulty=${difficulty}`);
      
      // 問題セット生成
      const problems = generateProblemSet(difficulty);
      
      if (problems.length === 0) {
        console.log('❌ Problem generation failed');
        return res.status(500).json({
          success: false,
          error: 'Failed to generate problems',
          message: '問題の生成に失敗しました。しばらく後にもう一度お試しください。'
        });
      }
      
      // MongoDBに新規問題セットを保存
      try {
        const newProblemSet = new DailyProblemSet({
          date: today,
          difficulty: difficulty,
          problems: problems,
          isActive: true
        });
        
        await newProblemSet.save();
        console.log(`✅ Saved new problem set to database: ${problems.length} problems`);
      } catch (saveError) {
        console.error('⚠️ Failed to save problems to database:', saveError.message);
        // 保存に失敗しても生成した問題は返す
      }
      
      console.log(`✅ Generated ${problems.length} problems for difficulty ${difficulty}${userIsAdmin ? ' (ADMIN ACCESS)' : ''}`);
      
      return res.status(200).json({
        success: true,
        problems: problems,
        timeWindow: {
          start: TIME_WINDOW.start,
          end: TIME_WINDOW.end,
          adminBypass: userIsAdmin
        },
        difficulty: difficulty,
        date: today,
        source: 'generated',
        timestamp: new Date().toISOString()
      });
    }

    if (req.method === 'POST') {
      console.log('📝 Processing answer submission...');
      
      // 時間制限チェック（管理者はバイパス）
      const userIsAdmin = isAdmin(req);
      const withinTimeWindow = isWithinTimeWindow();
      const canAccess = withinTimeWindow || userIsAdmin || 
                       process.env.NODE_ENV === 'development' || 
                       process.env.DISABLE_TIME_CHECK === 'true';
      
      if (!canAccess) {
        console.log('❌ Submission denied - outside time window');
        return res.status(403).json({
          success: false,
          error: 'Answer submission is only available between 6:30 AM and 8:00 AM',
          message: '朝の計算チャレンジは、朝6:30から8:00の間のみ挑戦できます。またの挑戦をお待ちしています！',
          timeWindow: {
            start: TIME_WINDOW.start,
            end: TIME_WINDOW.end,
            current: new Date().toLocaleTimeString('ja-JP', { timeZone: 'Asia/Tokyo' })
          },
          isTimeRestricted: true,
          timestamp: new Date().toISOString()
        });
      }
      
      // 回答データの取得 - 新スキーマ対応
      const { 
        problemIds, 
        answers, 
        difficulty, 
        date, 
        timeToComplete 
      } = req.body;
      
      // フォールバック: 旧スキーマ対応
      const usedDifficulty = difficulty || 'beginner';
      const usedDate = date || new Date().toISOString().split('T')[0];
      const usedTimeToComplete = timeToComplete || 0;
      
      if (!answers || !Array.isArray(answers)) {
        console.log('❌ Invalid answers array');
        return res.status(400).json({
          success: false,
          error: 'Answers array is required'
        });
      }
      
      console.log(`📝 Submission data: difficulty=${usedDifficulty}, date=${usedDate}, problemIds=${problemIds ? problemIds.length : 'none'}`);

      // MongoDB から該当の問題セットを取得
      let problemSet = await DailyProblemSet.findOne({
        date: usedDate,
        difficulty: usedDifficulty
      });

      if (!problemSet || !problemSet.problems || problemSet.problems.length === 0) {
        console.log('❌ Problem set not found for scoring');
        return res.status(404).json({
          success: false,
          error: 'Problem set not found',
          message: '採点用の問題セットが見つかりません。'
        });
      }

      // problemIds の順序で問題を並び替え
      let orderedProblems = problemSet.problems;
      if (problemIds && Array.isArray(problemIds) && problemIds.length > 0) {
        const problemMap = new Map();
        problemSet.problems.forEach(p => {
          problemMap.set(p.id, p);
        });
        
        orderedProblems = [];
        for (const id of problemIds) {
          const problem = problemMap.get(id);
          if (problem) {
            orderedProblems.push(problem);
          } else {
            console.warn(`⚠️ Problem ID ${id} not found in database`);
          }
        }
        
        if (orderedProblems.length === 0) {
          console.log('❌ No matching problems found for provided IDs');
          return res.status(400).json({
            success: false,
            error: 'No matching problems found',
            message: '指定された問題IDに対応する問題が見つかりません。'
          });
        }
        
        console.log(`📝 Reordered problems based on problemIds: ${orderedProblems.length} problems`);
      } else {
        console.log('📝 Using original problem order (no problemIds provided)');
      }

      // 採点処理
      let correctCount = 0;
      const detailedResults = [];
      
      answers.forEach((userAnswer, index) => {
        if (index >= orderedProblems.length) return;
        
        const problem = orderedProblems[index];
        const userAnsRaw = userAnswer;
        const userAnsStr = userAnsRaw !== undefined && userAnsRaw !== null ? String(userAnsRaw).trim() : null;
        const userAnsNum = userAnsStr !== null && userAnsStr !== '' ? parseFloat(userAnsStr) : NaN;

        const correctAnsNum = typeof problem.answer === 'string' ? parseFloat(problem.answer) : problem.answer;
        const isCorrect = Number.isFinite(userAnsNum) && userAnsNum === correctAnsNum;

        if (isCorrect) correctCount++;
        
        detailedResults.push({
          id: problem.id,
          question: problem.question,
          correctAnswer: correctAnsNum,
          userAnswer: userAnsStr,
          isCorrect
        });
      });

      const score = orderedProblems.length > 0 ? Math.round((correctCount / orderedProblems.length) * 100) : 0;
      
      // 時間計算 (ms / s)
      const totalTimeMs = usedTimeToComplete || req.body.timeSpentMs || 0;
      const timeSpentSec = Math.round(totalTimeMs / 1000);
      
      console.log(`✅ Scoring complete: ${correctCount}/${orderedProblems.length} (${score}%)${userIsAdmin ? ' (ADMIN)' : ''}`);
      
      // JWT認証情報の取得
      const authHeader = req.headers.authorization;
      let userId = null;
      let username = 'anonymous';
      
      if (authHeader) {
        const user = verifyTokenAndGetUser(authHeader);
        if (user) {
          userId = user.id || user._id || user.userId;
          username = user.username || user.email || 'user';
        }
      }

      // results コレクションへの保存
      const resultDocument = {
        userId: userId,
        username: username,
        date: usedDate,
        difficulty: usedDifficulty,
        correctAnswers: correctCount,
        totalProblems: orderedProblems.length,
        score: score,
        totalTime: totalTimeMs,
        timeSpent: timeSpentSec,
        results: detailedResults,
        createdAt: new Date()
      };

      // MongoDB に結果を保存
      try {
        const ResultSchema = new mongoose.Schema({
          userId: String,
          username: String,
          date: String,
          difficulty: String,
          correctAnswers: Number,
          totalProblems: Number,
          score: Number,
          totalTime: Number,
          timeSpent: Number,
          results: Array
        }, { timestamps: true });
        
        const Result = mongoose.models.Result || mongoose.model('Result', ResultSchema);
        
        const savedResult = await Result.create(resultDocument);
        console.log(`✅ Result saved to database: ID=${savedResult._id}`);
      } catch (saveError) {
        console.error('⚠️ Failed to save result to database:', saveError.message);
        // 保存に失敗しても結果は返す
      }

      const responsePayload = {
        correctAnswers: correctCount,
        incorrectAnswers: orderedProblems.length - correctCount,
        totalProblems: orderedProblems.length,
        score: score,
        totalTime: totalTimeMs,
        timeSpent: timeSpentSec,
        difficulty: usedDifficulty,
        results: detailedResults,
        rank: null // 後続で集計する
      };

      return res.status(200).json({
        success: true,
        results: responsePayload,
        timestamp: new Date().toISOString()
      });
    }

    return res.status(405).json({ 
      success: false,
      error: 'Method not allowed' 
    });

  } catch (error) {
    console.error('💥 Problems API error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
};

// 他のAPIから使えるように問題セット生成関数をエクスポート
handler.generateProblemSet = generateProblemSet;

module.exports = handler;