import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';
import { protect, admin } from './middleware/authMiddleware.js';
import bcrypt from 'bcryptjs';

import User from './models/User.js';
import DailyProblemSet from './models/DailyProblemSet.js';
import Result from './models/Result.js';
import { generateProblems, DifficultyRank } from './utils/problemGenerator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

// 明示的なJWT設定 - 環境変数から取得
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('エラー: JWT_SECRET 環境変数が設定されていません。');
  process.exit(1); // シークレットがない場合は起動失敗
}
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '30d';

// ポート設定 - 環境変数から取得、デフォルトは5001番
const PORT = process.env.BACKEND_PORT || 5001; // 5000 から 5001 に変更
// フロントエンドのオリジン - 環境変数から取得、デフォルトは http://localhost:3000
const FRONTEND_ORIGIN = `http://localhost:${process.env.FRONTEND_PORT || 3000}`;

// MongoDBサーバーに接続
const startServer = async () => {
  try {
    // MongoDB接続文字列
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/morningmathdb';
    
    // モックモード確認
    const useMockDB = process.env.MONGODB_MOCK === 'true';
    
    if (useMockDB) {
      console.log('⚠️ モックモードで実行中 - インメモリデータベースを使用します');
      // インメモリDBを使用する場合の処理
      try {
        // 動的インポート
        const { MongoMemoryServer } = await import('mongodb-memory-server');
    const mongoServer = await MongoMemoryServer.create();
        const mockMongoUri = mongoServer.getUri();
        
        mongoose.connect(mockMongoUri, {
          useNewUrlParser: true,
          useUnifiedTopology: true,
          serverSelectionTimeoutMS: 5000,
        })
        .then(() => console.log('MongoDB インメモリサーバーに接続しました'))
        .catch(err => {
          console.error('MongoDB インメモリ接続エラー:', err);
          console.error('MongoDB インメモリ接続に失敗しました。');
        });
      } catch (error) {
        console.error('インメモリDBの初期化に失敗しました:', error);
        console.log('通常のMongoDBに接続を試みます...');
        
        // 通常のMongoDBに接続を試みる
        mongoose.connect(mongoUri, {
          useNewUrlParser: true,
          useUnifiedTopology: true,
          serverSelectionTimeoutMS: 5000,
        });
      }
    } else {
      // 通常のMongoDBに接続
    mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000, // タイムアウト設定（5秒）
    })
      .then(() => console.log(`MongoDB サーバーに接続しました: ${mongoUri}`))
    .catch(err => {
      console.error('MongoDB 接続エラー:', err);
        console.error('MongoDB 接続に失敗しました。サーバー起動を中止します。');
        process.exit(1); // 接続失敗で終了
    });
    }
    
    // MongoDB接続監視
    mongoose.connection.on('error', err => {
      console.error('MongoDB 接続エラー:', err);
    });
    
    mongoose.connection.on('disconnected', () => {
      console.warn('MongoDB 接続が切断されました。再接続します...');
    });
    
    const app = express();
    
    app.use(cors({
        origin: function (origin, callback) {
            console.log('CORS request from origin:', origin);
            // 許可するオリジンのリスト (環境変数 + リクエストオリジン)
            const allowedOrigins = [FRONTEND_ORIGIN]; // .env の FRONTEND_PORT をベースにする
            // 開発環境では localhost:* からのリクエストを追加で許可 (Viteのポート自動変更に対応)
            // Linterエラー修正: 正規表現リテラル内のバックスラッシュを修正
            if (process.env.NODE_ENV !== 'production' && origin && /^https?:\/\/localhost(:[0-9]+)?$/.test(origin)) {
                allowedOrigins.push(origin);
            }

            if (!origin || allowedOrigins.includes(origin)) {
                console.log(`Origin ${origin || 'N/A'} is allowed by CORS policy`);
                callback(null, true); // オリジンがないか、許可リストに含まれていれば許可
            } else {
                console.log(`Origin ${origin} is not allowed by CORS policy. Allowed: ${allowedOrigins.join(', ')}`);
                callback(new Error(`Origin ${origin} not allowed by CORS policy`)); // それ以外は拒否
            }
        },
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
        optionsSuccessStatus: 204,
        maxAge: 86400 // 24時間
    }));
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use(cookieParser());
    
    dayjs.extend(utc);
    dayjs.extend(timezone);
    dayjs.tz.setDefault("Asia/Tokyo");

    const JST_OFFSET = 9 * 60;
    
    // 問題生成プロセスのロック管理用マップ
    const problemGenerationLocks = new Map();

    const isChallengeTimeAllowed = () => {
        if (process.env.DISABLE_TIME_CHECK === 'true') {
            console.log('[Time Check] Skipped due to DISABLE_TIME_CHECK=true');
            return true;
        }

        const nowJST = dayjs().tz();
        const currentHour = nowJST.hour();
        const currentMinute = nowJST.minute();

        const currentTimeInMinutes = currentHour * 60 + currentMinute;
        const startTimeInMinutes = 6 * 60 + 30;
        const endTimeInMinutes = 8 * 60 + 0;

        const isAllowed = currentTimeInMinutes >= startTimeInMinutes && currentTimeInMinutes < endTimeInMinutes;
        if (!isAllowed) {
            console.log(`[Time Check] Access denied. Current JST: ${nowJST.format('HH:mm')}. Allowed: 06:30 - 08:00`);
        }
        return isAllowed;
    };

    const getTodayDateStringJST = () => {
        return dayjs().tz().format('YYYY-MM-DD');
    };

    app.get('/', (req, res) => {
      res.json({ message: '朝の計算チャレンジAPIへようこそ！' });
    });

    // 翌日の問題を生成する関数
    const generateProblemsForNextDay = async () => {
      try {
        // 翌日の日付を取得
        const tomorrow = dayjs().tz().add(1, 'day').format('YYYY-MM-DD');
        console.log(`[自動生成] ${tomorrow}の問題セットを生成します...`);
        
        // 全難易度の問題を生成
        for (const difficulty of Object.values(DifficultyRank)) {
          // 既に存在するかチェック
          const existingSet = await DailyProblemSet.findOne({ date: tomorrow, difficulty });
          
          if (existingSet) {
            console.log(`[自動生成] ${tomorrow}の${difficulty}難易度の問題セットは既に存在します。スキップします。`);
            continue;
          }
          
          console.log(`[自動生成] ${tomorrow}の${difficulty}難易度の問題を生成します...`);
          
          try {
            // 決定論的に問題を生成（日付と難易度から一貫したシード値を生成）
            const seed = `${tomorrow}_${difficulty}`.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
            const problems = generateProblems(difficulty, 10, seed);
            
            if (!problems || problems.length === 0) {
              console.error(`[自動生成] ${tomorrow}の${difficulty}難易度の問題生成に失敗しました。`);
              continue;
            }
            
            // 問題セットを保存
            const newProblemSet = new DailyProblemSet({
              date: tomorrow,
              difficulty,
              problems: problems.map(p => ({
                question: p.question,
                correctAnswer: p.answer,
                options: p.options
              }))
            });
            
            await newProblemSet.save();
            console.log(`[自動生成] ${tomorrow}の${difficulty}難易度の問題生成完了 (${problems.length}問)`);
          } catch (error) {
            console.error(`[自動生成] ${tomorrow}の${difficulty}難易度の問題生成中にエラー:`, error);
          }
        }
        
        console.log(`[自動生成] ${tomorrow}の全難易度の問題生成が完了しました。`);
      } catch (error) {
        console.error('[自動生成] 翌日問題の生成中にエラー:', error);
      }
    };
    
    // 次の実行時間をスケジュールする関数
    const scheduleNextGeneration = () => {
      const now = dayjs().tz();
      const targetHour = 12; // 正午12時に設定
      
      // 次の実行時間を計算（本日の12時または翌日の12時）
      let nextRun = now.hour(targetHour).minute(0).second(0);
      if (now.hour() >= targetHour) {
        // 既に今日の12時を過ぎている場合は翌日の12時に設定
        nextRun = nextRun.add(1, 'day');
      }
      
      // 次の実行までのミリ秒を計算
      const timeToNextRun = nextRun.diff(now);
      console.log(`[スケジューラ] 次回の問題自動生成は ${nextRun.format('YYYY-MM-DD HH:mm:ss')} に実行されます (${Math.round(timeToNextRun / (1000 * 60))}分後)`);
      
      // タイマーをセット
      setTimeout(() => {
        console.log('[スケジューラ] 定期実行: 翌日問題の自動生成を開始します');
        generateProblemsForNextDay().finally(() => {
          // 完了後、次の実行をスケジュール
          scheduleNextGeneration();
        });
      }, timeToNextRun);
    };
    
    // MongoDB接続後に初期化処理を実行
    mongoose.connection.once('open', async () => {
      console.log('MongoDB接続確立 - 管理者ユーザーを確認/作成');
      await createDefaultAdminUser();
      
      // サーバー起動時に翌日の問題が存在するかチェック
      const tomorrow = dayjs().tz().add(1, 'day').format('YYYY-MM-DD');
      const missingDifficulties = [];
      
      for (const difficulty of Object.values(DifficultyRank)) {
        const existingSet = await DailyProblemSet.findOne({ date: tomorrow, difficulty });
        if (!existingSet) {
          missingDifficulties.push(difficulty);
        }
      }
      
      // 不足している難易度の問題がある場合は生成
      if (missingDifficulties.length > 0) {
        console.log(`[初期化] ${tomorrow}の問題で不足している難易度があります: ${missingDifficulties.join(', ')}`);
        await generateProblemsForNextDay();
      } else {
        console.log(`[初期化] ${tomorrow}の全難易度の問題は既に存在します。`);
      }
      
      // 定期実行をスケジュール
      scheduleNextGeneration();
    });

    app.get('/api/problems', protect, async (req, res) => {
      const { difficulty, date } = req.query;
      const userId = req.user._id; // 認証ミドルウェアから直接ユーザーIDを取得
      const isAdmin = req.user.isAdmin; // 管理者フラグを取得

      if (!difficulty || !Object.values(DifficultyRank).includes(difficulty)) {
        return res.status(400).json({
          success: false,
          message: '有効な難易度(beginner, intermediate, advanced, expert)を指定してください。'
        });
      }

      // usernameのチェックを削除 - 認証済みユーザーのIDを使用するため不要

      let searchDate = date;
      const todayJST = getTodayDateStringJST();

      // --- 1日1回挑戦チェック (管理者以外) ---
      if (!isAdmin) {
        try {
          // userIdとdateで既存の結果を検索
          const existingResult = await Result.findOne({
            userId: userId,
            date: todayJST // チェックは常に「今日」に対して行う
          });

          if (existingResult) {
            console.log(`[Attempt Check] User ID ${userId} already attempted today (${todayJST}). Access denied.`);
            return res.status(403).json({
              success: false,
              message: '今日は既に挑戦済みです。明日また挑戦してください。'
            });
          }
        } catch (error) {
          console.error('Error checking existing result for /api/problems:', error);
          return res.status(500).json({ success: false, message: '挑戦履歴の確認中にエラーが発生しました。' });
        }
      } else {
        console.log(`[Attempt Check] Skipped for admin user ID ${userId}.`);
      }
      // --- チェックここまで ---

      if (!searchDate) {
        searchDate = todayJST;
      }

      if (!/^\d{4}-\d{2}-\d{2}$/.test(searchDate)) {
        return res.status(400).json({ success: false, message: '日付の形式が無効です (YYYY-MM-DD)。' });
      }

      try {
        // ログメッセージにもusernameの代わりにuserIdを使用
        console.log(`[API] 問題取得リクエスト: 日付=${searchDate}, 難易度=${difficulty}, ユーザーID=${userId}`);
        const problemSet = await DailyProblemSet.findOne({ date: searchDate, difficulty });

        if (!problemSet || !problemSet.problems || problemSet.problems.length === 0) {
          console.warn(`Problem set not found for ${searchDate} - ${difficulty}`);
          
          // 問題が見つからない場合、自動生成して保存（排他的に実行）
          const lockKey = `${searchDate}_${difficulty}`;
          
          // 別のリクエストが既に生成中かチェック
          if (problemGenerationLocks.has(lockKey)) {
            console.log(`[自動生成] ${searchDate}の${difficulty}難易度は別のプロセスが生成中です。待機します...`);
            
            // 2秒待機して再チェック
            await new Promise(resolve => setTimeout(resolve, 2000));
            const retryProblemSet = await DailyProblemSet.findOne({ date: searchDate, difficulty });
            
            if (retryProblemSet && retryProblemSet.problems && retryProblemSet.problems.length > 0) {
              console.log(`[自動生成] ${searchDate}の${difficulty}難易度の問題が別プロセスにより生成されました。`);
              
              // 生成された問題をクライアントに返す
              const clientProblems = retryProblemSet.problems.map((p, index) => ({
                id: index,
                question: p.question,
              }));
              
              return res.json({
                success: true,
                difficulty: difficulty,
                date: searchDate,
                problems: clientProblems,
              });
            } else {
              return res.status(404).json({
                success: false,
                message: `${searchDate}の${difficulty}難易度の問題の生成に失敗しました。サポートにお問い合わせください。`
              });
            }
          }
          
          // ロックを取得
          problemGenerationLocks.set(lockKey, true);
          console.log(`[自動生成] ${searchDate}の${difficulty}難易度の問題生成を開始します（排他的実行）`);
          
          try {
            // 決定論的に問題を生成（日付と難易度から一貫したシード値を生成）
            const seed = `${searchDate}_${difficulty}`.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
            const problems = generateProblems(difficulty, 10, seed);
            
            if (!problems || problems.length === 0) {
              throw new Error('問題生成に失敗しました');
            }
            
            // 生成した問題を保存
            const newProblemSet = new DailyProblemSet({
              date: searchDate,
              difficulty: difficulty,
              problems: problems.map(p => ({
                question: p.question,
                correctAnswer: p.answer,
                options: p.options
              }))
            });
            
            await newProblemSet.save();
            console.log(`[自動生成] ${searchDate}の${difficulty}難易度の問題生成完了（${problems.length}問）`);
            
            // 生成した問題をクライアントに返す
            const clientProblems = problems.map((p, index) => ({
              id: index,
              question: p.question,
            }));
            
            return res.json({
              success: true,
              difficulty: difficulty,
              date: searchDate,
              problems: clientProblems,
              autoGenerated: true
            });
          } catch (genError) {
            console.error(`[自動生成] ${searchDate}の${difficulty}難易度の問題生成中にエラー:`, genError);
            console.error(genError.stack);  // スタックトレースも出力
            
            const message = searchDate === new Date().toISOString().split('T')[0]
                ? '本日の問題セットが見つかりません。管理者にお問い合わせください。'
                : `${searchDate}の問題セットが見つかりません。`;
            return res.status(404).json({ success: false, message: message });
          } finally {
            // 必ずロックを解放
            problemGenerationLocks.delete(lockKey);
            console.log(`[自動生成] ${searchDate}の${difficulty}難易度の問題生成ロックを解放しました`);
          }
        }

        // 問題が見つかった場合の処理
        console.log(`[API] 問題セットが見つかりました: ${searchDate} - ${difficulty}. 問題数: ${problemSet.problems.length}`);
        const clientProblems = problemSet.problems.map((p, index) => ({
          id: index,
          question: p.question,
        }));

        res.json({
          success: true,
          difficulty: difficulty,
          date: searchDate,
          problems: clientProblems,
        });

      } catch (error) {
        console.error(`Error fetching problems for ${searchDate} - ${difficulty}:`, error);
        console.error(error.stack);  // スタックトレースも出力
        res.status(500).json({ 
          success: false, 
          message: '問題の取得中にエラーが発生しました。もう一度お試しいただくか、サポートにお問い合わせください。' 
        });
      }
    });

    app.post('/api/problems/submit', protect, async (req, res) => {
      const { difficulty, date, answers, timeSpent } = req.body;
      const userId = req.user._id; // 認証ミドルウェアから userId を取得
      const isAdmin = req.user.isAdmin; // 管理者フラグを取得

      console.log(`[Submit] Request received from user ID: ${userId}, isAdmin: ${isAdmin}`);
      
      // ===================================================
      // ユーザー識別の最適化（2023-04更新）
      // - userIdを優先的に使用するように変更
      // - usernameはバックアップとして維持
      // - 認証トークンからのuserIdも利用
      // - 優先順位: リクエストのuserId > トークンのuserId > username
      // ===================================================
      
      // 認証トークンからユーザーIDを取得
      const authHeader = req.headers.authorization;
      let tokenUserId = null;
      
      if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
          const token = authHeader.split(' ')[1];
          const decoded = jwt.verify(token, JWT_SECRET);
          tokenUserId = decoded.userId;
          console.log(`[Submit] Token decoded, userId: ${tokenUserId}`);
        } catch (error) {
          console.error('[Submit] Token verification error:', error);
          // トークンエラーの場合でも処理を続行
        }
      }
      
      // ユーザーIDの優先順位: リクエストのuserId > トークンのuserId > username検索
      const effectiveUserId = userId || tokenUserId;
      console.log(`[Submit] Effective userId: ${effectiveUserId || 'None, will use username'}`);
      
      // 時間制限チェック（DISABLE_TIME_CHECK=trueの場合はスキップ）
      if (process.env.DISABLE_TIME_CHECK !== 'true' && !isChallengeTimeAllowed()) {
        return res.status(403).json({ 
          success: false, 
          message: '挑戦可能な時間外です (毎日 6:30 - 8:00 JST)。',
          results: null
        });
      }

      if (!difficulty || !date || !answers || !Array.isArray(answers) || timeSpent === undefined) {
        return res.status(400).json({ 
          success: false, 
          message: '無効なリクエストデータです。difficulty, date, answers, timeSpent は必須です。',
          results: null 
        });
      }
      
      // username は不要になったので削除
      if (!Object.values(DifficultyRank).includes(difficulty)) {
        return res.status(400).json({ 
          success: false, 
          message: '無効な難易度です。',
          results: null 
        });
      }

      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ 
          success: false, 
          message: '日付の形式が無効です (YYYY-MM-DD)。',
          results: null
        });
      }

      const todayJST = getTodayDateStringJST();

      // --- 1日1回提出チェック (管理者以外) ---
      if (!isAdmin) {
        try {
          // userId と date で既存の結果を検索
          const existingResultQuery = { userId: userId, date: date }; // 提出された日付でチェック

          const existingResult = await Result.findOne(existingResultQuery);

          if (existingResult) {
            console.log(`[Submit Check] User ${userId} already submitted for date ${date}. Preventing duplicate submission.`);
            return res.status(409).json({ // 409 Conflict
              success: false,
              message: 'この日付の結果は既に提出済みです。',
              results: null
            });
          }
        } catch (error) {
          console.error('Error checking existing result before submit:', error);
          return res.status(500).json({ 
            success: false, 
            message: '提出済み履歴の確認中にエラーが発生しました。',
            results: null
          });
        }
      } else {
        console.log(`[Submit Check] Skipped for admin user ID ${userId}.`);
      }
      // --- チェックここまで ---

      // 開発環境または当日の提出はOK (重複チェックは上記で行う)
      console.log(`[Submit] Processing submission for user ${userId} on ${date}`);

      // 改善されたスコア計算 - 難易度に応じた配点とボーナスポイント
      const calculateScore = (correctCount, totalProblems, timeSpentInSeconds, difficulty) => {
        // 基本点: 正解1問あたりの点数（難易度によって変動）
        const difficultyMultiplier = {
          'beginner': 10,
          'intermediate': 15,
          'advanced': 20,
          'expert': 25
        };
        
        const basePointsPerCorrect = difficultyMultiplier[difficulty] || 10;
        const baseScore = correctCount * basePointsPerCorrect;
        
        // 時間ボーナス: 早く解くほど高得点
        // 標準時間: 問題数 × 30秒
        const standardTime = totalProblems * 30;
        let timeBonus = 0;
        
        if (timeSpentInSeconds < standardTime) {
          // 標準時間より早く解いた場合、ボーナスポイント
          const timeSaved = standardTime - timeSpentInSeconds;
          timeBonus = Math.min(50, Math.floor(timeSaved / 5)); // 5秒ごとに1ポイント、最大50ポイント
        }
        
        // 全問正解ボーナス
        const perfectBonus = (correctCount === totalProblems) ? 20 : 0;
        
        return baseScore + timeBonus + perfectBonus;
      };

      try {
        const problemSet = await DailyProblemSet.findOne({ date: date, difficulty: difficulty });

        if (!problemSet || !problemSet.problems || problemSet.problems.length === 0) {
          console.warn(`Submit request for non-existent problem set: ${date} - ${difficulty}`);
          return res.status(404).json({ 
            success: false, 
            message: `${date} の ${difficulty} 問題セットが見つかりません。`,
            results: null
          });
        }

        const correctProblemAnswers = problemSet.problems;

        if (answers.length !== correctProblemAnswers.length) {
            console.warn(`Answer count mismatch: expected ${correctProblemAnswers.length}, got ${answers.length}`);
            return res.status(400).json({ success: false, message: '回答数と問題数が一致しません。' });
        }

        let correctCount = 0;
        let incorrectCount = 0;
        let unansweredCount = 0;
        const problemResults = [];

        for (let i = 0; i < correctProblemAnswers.length; i++) {
          const correctAnswer = correctProblemAnswers[i].correctAnswer;
          const userAnswerStr = answers[i];
          let userAnswerNum = null;
          let isCorrect = false;

          if (userAnswerStr === '' || userAnswerStr === null || userAnswerStr === undefined) {
            unansweredCount++;
          } else {
            userAnswerNum = parseFloat(userAnswerStr);
            if (isNaN(userAnswerNum)) {
                incorrectCount++;
            } else {
                const tolerance = 1e-9;
                if (Math.abs(userAnswerNum - correctAnswer) < tolerance) {
                    correctCount++;
                    isCorrect = true;
                } else {
                    incorrectCount++;
                }
            }
          }

          problemResults.push({
              id: i,
              question: correctProblemAnswers[i].question,
              userAnswer: userAnswerNum,
              correctAnswer: correctAnswer,
              isCorrect: isCorrect,
          });
        }

        // 改善したスコア計算を使用
        const score = calculateScore(correctCount, correctProblemAnswers.length, timeSpent, difficulty);

        const resultsData = {
            totalProblems: correctProblemAnswers.length,
            correctAnswers: correctCount,
            incorrectAnswers: incorrectCount,
            unanswered: unansweredCount,
            totalTime: timeSpent * 1000,
            timeSpent: timeSpent,
            problems: problemResults,
            score: score,
        };

        // ユーザーIDを取得
        let user = null;
        if (userId) {
          user = await User.findById(userId).lean(); // protect ミドルウェアで取得した userId を使用
          console.log(`[Submit] Found user by ID: ${user ? user.username : 'Not found'}`);
        }
        
        // ユーザーが見つからない場合はエラー（通常は発生しないはず）
        if (!user) {
          console.error(`[Submit] User not found for ID: ${userId}. Submission aborted.`);
          return res.status(404).json({
            success: false,
            message: 'ユーザー情報が見つかりません。再ログインしてください。',
            results: null
          });
        }
        
        // 結果保存用のデータ
        const resultToSave = {
            username: user.username, // 認証済みユーザーの username を使用
            userId: user._id,
            difficulty: difficulty,
            date: date,
            timestamp: new Date(), // ★ 現在時刻をtimestampとして保存
            ...resultsData,
        };

        // 結果の保存
        const savedResult = await Result.create(resultToSave);
        console.log(`Result saved for user ${user.username} (ID: ${user._id}) on ${date} - ${difficulty}, Result ID: ${savedResult._id}`);

        // レスポンス形式を統一
        res.json({
          success: true,
          message: '回答を正常に処理し、結果を保存しました。',
          results: resultsData
        });

      } catch (error) {
        console.error(`Error submitting answers for ${date} - ${difficulty}:`, error);
        res.status(500).json({ 
          success: false, 
          message: '回答の処理または保存中にエラーが発生しました。',
          results: null
        });
      }
    });

    app.get('/api/rankings', (req, res) => {
      const users = [];
      const avatars = ['😊', '🐱', '🐶', '🐼', '🦊', '🐰', '🐻', '🐨', '🦁', '🐯'];
      
      for (let i = 0; i < 10; i++) {
        users.push({
          _id: `user-${i}`,
          username: `ユーザー${i + 1}`,
          avatar: avatars[i % avatars.length],
          grade: Math.floor(Math.random() * 6) + 1,
          points: Math.floor(Math.random() * 1000),
          streak: Math.floor(Math.random() * 10)
        });
      }
      
      res.json({
        success: true,
        users: users.sort((a, b) => b.points - a.points)
      });
    });

    // 日間ランキングAPI
    app.get('/api/rankings/daily', async (req, res) => {
      try {
        const { difficulty, grade } = req.query;
        const limit = parseInt(req.query.limit) || 10;
        
        console.log(`[DEBUG-RANKING] リクエストパラメータ:`, { difficulty, grade, limit });
        
        // 日付フィルターを一時的に無効化（すべてのデータを取得）
        const filter = {};
        if (difficulty) filter.difficulty = difficulty;
        if (grade) filter.grade = parseInt(grade);
        
        console.log(`[DEBUG-RANKING] 使用フィルター:`, filter);
        
        // 全データ確認用ログ
        const allResults = await Result.find({}).limit(20).lean();
        console.log(`[DEBUG-RANKING] データベース内のデータ (最大20件):`, 
          allResults.map(r => ({
            id: r._id.toString().substring(0, 8) + '...',
            username: r.username,
            userId: r.userId ? r.userId.toString().substring(0, 8) + '...' : 'none',
            date: r.date, 
            difficulty: r.difficulty,
            score: r.score
          }))
        );
        
        // Resultコレクションから取得
        const results = await Result.find(filter)
          .sort({ score: -1, timeSpent: 1 })
          .limit(limit)
          .lean();
        
        console.log(`[DEBUG-RANKING] Filter results:`, results.length);
        if (results.length > 0) {
          console.log(`[DEBUG-RANKING] First result:`, {
            username: results[0].username,
            userId: results[0].userId ? results[0].userId.toString().substring(0, 8) + '...' : 'none',
            score: results[0].score,
            date: results[0].date
          });
        }
        
        if (!results.length) {
          return res.json({
            success: true,
            message: 'まだランキングデータがありません',
            rankings: []
          });
        }
        
        // ユーザー情報を取得
        // 1. まずuserIdでユーザーを検索
        const userIds = [...new Set(results
          .filter(r => r.userId) // userIdがあるものだけ抽出
          .map(r => r.userId.toString())
        )];
        console.log(`[Ranking] Unique userIds to lookup:`, userIds.length);
        
        const usersByIdMap = new Map();
        if (userIds.length > 0) {
          const usersById = await User.find({ _id: { $in: userIds } }).lean();
          console.log(`[Ranking] Found ${usersById.length} users by ID`);
          
          // IDをキーとするマップに変換
          usersById.forEach(user => {
            usersByIdMap.set(user._id.toString(), user);
          });
        }
        
        // 2. userIdで見つからなかったユーザーをusernameで検索
        const usernamesToLookup = results
          .filter(r => !r.userId || !usersByIdMap.has(r.userId.toString()))
          .map(r => r.username);
        
        const uniqueUsernames = [...new Set(usernamesToLookup)];
        console.log(`[Ranking] Additional usernames to lookup:`, uniqueUsernames.length);
        
        const usersByNameMap = new Map();
        if (uniqueUsernames.length > 0) {
          const usersByName = await User.find({ username: { $in: uniqueUsernames } }).lean();
          console.log(`[Ranking] Found ${usersByName.length} users by username`);
          
          // ユーザー名をキーとするマップに変換
          usersByName.forEach(user => {
            usersByNameMap.set(user.username, user);
          });
        }
        
        // ランキング情報をユーザー情報と組み合わせる
        const rankings = results.map((result, index) => {
          // 1. まずuserIdでユーザーを検索
          let user = null;
          if (result.userId) {
            user = usersByIdMap.get(result.userId.toString());
          }
          
          // 2. userIdで見つからない場合はusernameで検索
          if (!user) {
            user = usersByNameMap.get(result.username);
          }
          
          // 3. それでも見つからない場合は最低限の情報を使用
          const avatar = user?.avatar || '👤';
          const grade = result.grade || user?.grade || 1;
          
          return {
            rank: index + 1,
            username: result.username,
            avatar: avatar,
            grade: grade,
            score: result.score,
            timeSpent: result.timeSpent,
            correctAnswers: result.correctAnswers,
            totalProblems: result.totalProblems || 10,
            incorrectAnswers: result.incorrectAnswers || 0,
            unanswered: result.unanswered || 0,
            totalTime: result.totalTime || result.timeSpent * 1000,
            difficulty: result.difficulty,
            date: result.date
          };
        });
        
        // レスポンス形式の改善 - フロントエンドが期待する形式に合わせる
        res.json({
          success: true,
          date: new Date().toISOString().split('T')[0],
          message: rankings.length ? null : 'まだランキングデータがありません',
          rankings: rankings
        });
        
      } catch (error) {
        console.error('[API] Error getting daily rankings:', error);
        res.status(500).json({ 
          success: false, 
          message: 'ランキングの取得中にエラーが発生しました' 
        });
      }
    });
    
    // 週間ランキングAPI
    app.get('/api/rankings/weekly', async (req, res) => {
      try {
        const { difficulty, grade } = req.query;
        const limit = parseInt(req.query.limit) || 10;
        
        // 週の始まり（日曜日）を計算
        const today = new Date();
        const day = today.getDay();
        const diff = today.getDate() - day;
        const startOfWeek = new Date(today.setDate(diff));
        startOfWeek.setHours(0, 0, 0, 0);
        
        // 今週の日付範囲を文字列配列で作成
        const dateRange = [];
        for (let i = 0; i < 7; i++) {
          const date = new Date(startOfWeek);
          date.setDate(startOfWeek.getDate() + i);
          dateRange.push(date.toISOString().split('T')[0]);
        }
        
        console.log(`[Ranking] Weekly date range:`, dateRange);
        
        // フィルター設定
        const filter = { date: { $in: dateRange } };
        if (difficulty) filter.difficulty = difficulty;
        if (grade) filter.grade = parseInt(grade);
        
        console.log(`[Ranking] Retrieving weekly rankings with filter:`, filter);
        
        // 実際にDBに入っている最新のデータを確認
        const allResults = await Result.find({}).sort({ createdAt: -1 }).limit(5).lean();
        console.log(`[Ranking] Latest results in DB (sample):`, 
          allResults.map(r => ({
            id: r._id.toString().substring(0, 8),
            username: r.username,
            userId: r.userId ? r.userId.toString().substring(0, 8) : 'none',
            date: r.date,
            difficulty: r.difficulty,
            score: r.score
          }))
        );
        
        // データベースからランキングを取得 - まず標準的なクエリを試す
        const simpleResults = await Result.find(filter)
          .sort({ score: -1, timeSpent: 1 })
          .limit(limit)
          .lean();
          
        console.log(`[Ranking] Found ${simpleResults.length} results for weekly rankings with simple query`);
        
        // アグリゲーションでも試してみる
        // 各ユーザーの最高スコアのみを取得するため、ユーザー名でグループ化
        const results = await Result.aggregate([
          { $match: filter },
          { $sort: { score: -1 } },
          // グループ化条件を修正: userIdが存在する場合はuserIdでグループ化、そうでなければusername
          { $group: {
              _id: { $cond: { if: { $eq: ["$userId", null] }, then: "$username", else: "$userId" } },
              username: { $first: "$username" },
              userId: { $first: "$userId" },
              score: { $max: "$score" },
              timeSpent: { $first: "$timeSpent" },
              correctAnswers: { $first: "$correctAnswers" },
              date: { $first: "$date" },
              grade: { $first: "$grade" },
              difficulty: { $first: "$difficulty" },
              totalProblems: { $first: "$totalProblems" },
              incorrectAnswers: { $first: "$incorrectAnswers" },
              unanswered: { $first: "$unanswered" },
              totalTime: { $first: "$totalTime" }
            }
          },
          { $sort: { score: -1, timeSpent: 1 } },
          { $limit: limit }
        ]);
        
        console.log(`[Ranking] Found ${results.length} results for weekly rankings after aggregation`);
        
        if (!results.length) {
          return res.json({
            success: true,
            message: 'まだランキングデータがありません',
            rankings: []
          });
        }
        
        // ユーザー情報を取得
        // 1. まずuserIdでユーザーを検索
        const userIds = [...new Set(results
          .filter(r => r.userId) // userIdがあるものだけ抽出
          .map(r => r.userId.toString())
        )];
        console.log(`[Ranking] Unique userIds to lookup:`, userIds.length);
        
        const usersByIdMap = new Map();
        if (userIds.length > 0) {
          const usersById = await User.find({ _id: { $in: userIds } }).lean();
          console.log(`[Ranking] Found ${usersById.length} users by ID`);
          
          // IDをキーとするマップに変換
          usersById.forEach(user => {
            usersByIdMap.set(user._id.toString(), user);
          });
        }
        
        // 2. userIdで見つからなかったユーザーをusernameで検索
        const usernamesToLookup = results
          .filter(r => !r.userId || !usersByIdMap.has(r.userId.toString()))
          .map(r => r.username);
        
        const uniqueUsernames = [...new Set(usernamesToLookup)];
        console.log(`[Ranking] Additional usernames to lookup:`, uniqueUsernames.length);
        
        const usersByNameMap = new Map();
        if (uniqueUsernames.length > 0) {
          const usersByName = await User.find({ username: { $in: uniqueUsernames } }).lean();
          console.log(`[Ranking] Found ${usersByName.length} users by username`);
          
          // ユーザー名をキーとするマップに変換
          usersByName.forEach(user => {
            usersByNameMap.set(user.username, user);
          });
        }
        
        // ランキング情報をユーザー情報と組み合わせる
        const rankings = results.map((result, index) => {
          // 1. まずuserIdでユーザーを検索
          let user = null;
          if (result.userId) {
            user = usersByIdMap.get(result.userId.toString());
          }
          
          // 2. userIdで見つからない場合はusernameで検索
          if (!user) {
            user = usersByNameMap.get(result.username);
          }
          
          // 3. それでも見つからない場合は最低限の情報を使用
          const avatar = user?.avatar || '👤';
          const grade = result.grade || user?.grade || 1;
          
          return {
            rank: index + 1,
            username: result.username,
            avatar: avatar,
            grade: grade,
            score: result.score,
            timeSpent: result.timeSpent,
            correctAnswers: result.correctAnswers,
            totalProblems: result.totalProblems || 10,
            incorrectAnswers: result.incorrectAnswers || 0,
            unanswered: result.unanswered || 0,
            totalTime: result.totalTime || result.timeSpent * 1000,
            difficulty: result.difficulty,
            date: result.date
          };
        });
        
        res.json({
          success: true,
          startDate: startOfWeek.toISOString().split('T')[0],
          endDate: new Date(startOfWeek.getTime() + 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          rankings
        });
        
      } catch (error) {
        console.error('[API] Error getting weekly rankings:', error);
        res.status(500).json({ 
          success: false, 
          message: 'ランキングの取得中にエラーが発生しました',
          error: error.message
        });
      }
    });
    
    // 月間ランキングAPI
    app.get('/api/rankings/monthly', async (req, res) => {
      try {
        const { difficulty, grade } = req.query;
        const limit = parseInt(req.query.limit) || 10;
        
        // 月の始まりと終わりを計算
        const today = new Date();
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        startOfMonth.setHours(0, 0, 0, 0);
        const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        endOfMonth.setHours(23, 59, 59, 999);
        
        // 今月の日付範囲を文字列配列で作成
        const dateRange = [];
        const startDate = startOfMonth.getDate();
        const endDate = endOfMonth.getDate();
        
        for (let i = startDate; i <= endDate; i++) {
          const date = new Date(today.getFullYear(), today.getMonth(), i);
          dateRange.push(date.toISOString().split('T')[0]);
        }
        
        console.log(`[Ranking] Monthly date range (samples): ${dateRange[0]}, ${dateRange[dateRange.length-1]}, length: ${dateRange.length}`);
        
        // フィルター設定
        const filter = { date: { $in: dateRange } };
        if (difficulty) filter.difficulty = difficulty;
        if (grade) filter.grade = parseInt(grade);
        
        console.log(`[Ranking] Retrieving monthly rankings with filter:`, filter);
        
        // データベースから直接いくつかのサンプルを取得してデバッグ
        const samples = await Result.find({}).limit(5).lean();
        console.log(`[Ranking] DB sample dates:`, samples.map(s => ({ 
          date: s.date, 
          username: s.username, 
          userId: s.userId ? s.userId.toString().substring(0, 8) : 'none'
        })));
        
        // データベースからランキングを取得 - まず標準的なクエリを試す
        const simpleResults = await Result.find(filter)
          .sort({ score: -1, timeSpent: 1 })
          .limit(limit)
          .lean();
          
        console.log(`[Ranking] Found ${simpleResults.length} results for monthly rankings with simple query`);
        
        // 各ユーザーの最高スコアのみを取得するため、ユーザー名でグループ化
        const results = await Result.aggregate([
          { $match: filter },
          { $sort: { score: -1 } },
          // グループ化条件を修正: userIdが存在する場合はuserIdでグループ化、そうでなければusername
          { $group: {
              _id: { $cond: { if: { $eq: ["$userId", null] }, then: "$username", else: "$userId" } },
              username: { $first: "$username" },
              userId: { $first: "$userId" },
              score: { $max: "$score" },
              timeSpent: { $first: "$timeSpent" },
              correctAnswers: { $first: "$correctAnswers" },
              date: { $first: "$date" },
              grade: { $first: "$grade" },
              difficulty: { $first: "$difficulty" },
              totalProblems: { $first: "$totalProblems" },
              incorrectAnswers: { $first: "$incorrectAnswers" },
              unanswered: { $first: "$unanswered" },
              totalTime: { $first: "$totalTime" }
            }
          },
          { $sort: { score: -1, timeSpent: 1 } },
          { $limit: limit }
        ]);
        
        console.log(`[Ranking] Found ${results.length} results for monthly rankings after aggregation`);
        
        if (!results.length) {
          return res.json({
            success: true,
            message: 'まだランキングデータがありません',
            rankings: []
          });
        }
        
        // ユーザー情報を取得
        // 1. まずuserIdでユーザーを検索
        const userIds = [...new Set(results
          .filter(r => r.userId) // userIdがあるものだけ抽出
          .map(r => r.userId.toString())
        )];
        console.log(`[Ranking] Unique userIds to lookup:`, userIds.length);
        
        const usersByIdMap = new Map();
        if (userIds.length > 0) {
          const usersById = await User.find({ _id: { $in: userIds } }).lean();
          console.log(`[Ranking] Found ${usersById.length} users by ID`);
          
          // IDをキーとするマップに変換
          usersById.forEach(user => {
            usersByIdMap.set(user._id.toString(), user);
          });
        }
        
        // 2. userIdで見つからなかったユーザーをusernameで検索
        const usernamesToLookup = results
          .filter(r => !r.userId || !usersByIdMap.has(r.userId.toString()))
          .map(r => r.username);
        
        const uniqueUsernames = [...new Set(usernamesToLookup)];
        console.log(`[Ranking] Additional usernames to lookup:`, uniqueUsernames.length);
        
        const usersByNameMap = new Map();
        if (uniqueUsernames.length > 0) {
          const usersByName = await User.find({ username: { $in: uniqueUsernames } }).lean();
          console.log(`[Ranking] Found ${usersByName.length} users by username`);
          
          // ユーザー名をキーとするマップに変換
          usersByName.forEach(user => {
            usersByNameMap.set(user.username, user);
          });
        }
        
        // ランキング情報をユーザー情報と組み合わせる
        const rankings = results.map((result, index) => {
          // 1. まずuserIdでユーザーを検索
          let user = null;
          if (result.userId) {
            user = usersByIdMap.get(result.userId.toString());
          }
          
          // 2. userIdで見つからない場合はusernameで検索
          if (!user) {
            user = usersByNameMap.get(result.username);
          }
          
          // 3. それでも見つからない場合は最低限の情報を使用
          const avatar = user?.avatar || '👤';
          const grade = result.grade || user?.grade || 1;
          
          return {
            rank: index + 1,
            username: result.username,
            avatar: avatar,
            grade: grade,
            score: result.score,
            timeSpent: result.timeSpent,
            correctAnswers: result.correctAnswers,
            totalProblems: result.totalProblems || 10,
            incorrectAnswers: result.incorrectAnswers || 0,
            unanswered: result.unanswered || 0,
            totalTime: result.totalTime || result.timeSpent * 1000,
            difficulty: result.difficulty,
            date: result.date
          };
        });
        
        res.json({
          success: true,
          startDate: startOfMonth.toISOString().split('T')[0],
          endDate: endOfMonth.toISOString().split('T')[0],
          rankings
        });
        
      } catch (error) {
        console.error('[API] Error getting monthly rankings:', error);
        res.status(500).json({ 
          success: false, 
          message: 'ランキングの取得中にエラーが発生しました',
          error: error.message
        });
      }
    });

    // 問題履歴取得API
    app.get('/api/problems/history', protect, async (req, res) => {
      try {
        const userId = req.user._id;

        if (!userId) {
          return res.status(401).json({ success: false, message: '認証されていません。' });
        }

        console.log(`[API] 履歴取得: userId=${userId}`);

        // 1. ユーザーの全履歴を取得 (日付降順)
        const userHistory = await Result.find({ userId })
          .sort({ date: -1 })
          .lean(); // .lean() で軽量なJSオブジェクトとして取得

        console.log(`[API] ユーザー履歴取得結果: ${userHistory.length}件`);

        // 履歴がない場合はここで早期リターン
        if (userHistory.length === 0) {
          // 連続記録計算 (履歴がないので 0)
           const currentStreak = 0;
           const maxStreak = 0;
           return res.json({
             success: true,
             history: [],
             currentStreak,
             maxStreak
           });
        }

        // 2. 順位計算が必要な (日付, 難易度) の組み合わせを抽出
        const uniqueDateDifficultyPairs = [...new Set(userHistory.map(h => `${h.date}|${h.difficulty}`))]
                                          .map(pair => {
                                            const [date, difficulty] = pair.split('|');
                                            return { date, difficulty };
                                          });

        console.log(`[API] 順位計算が必要な組み合わせ: ${uniqueDateDifficultyPairs.length}件`);
        // console.log('[API] Pairs:', uniqueDateDifficultyPairs); // デバッグ用

        // 3. 各組み合わせについて順位を計算 (アグリゲーション)
        const ranksMap = new Map(); // 型注釈を削除

        for (const pair of uniqueDateDifficultyPairs) {
          const { date, difficulty } = pair;
          const key = `${date}|${difficulty}`;

          try {
            // アグリゲーションパイプラインの構築
            const pipeline = [
              // Step 1: 対象の日付と難易度で絞り込み
              { $match: { date: date, difficulty: difficulty } },
              // Step 2: スコア(降順)、時間(昇順)でソート
              { $sort: { score: -1, timeSpent: 1 } },
              // Step 3: グループ化して各ドキュメントに一時的な配列を作成 (元のドキュメント + ID)
              { $group: {
                  _id: null, // 単一グループ
                  items: { $push: { _id: "$_id", userId: "$userId" } } // IDとユーザーIDのみ保持
              }},
              // Step 4: 配列を展開し、各要素にインデックス(順位)を付与
              { $unwind: { path: "$items", includeArrayIndex: "rank" } },
              // Step 5: 対象ユーザーの結果のみに絞り込み
              { $match: { "items.userId": userId } },
              // Step 6: 必要なフィールド(rank)のみを選択
              { $project: {
                  _id: 0, // 元の _id は不要
                  rank: { $add: ["$rank", 1] } // rank は 0-indexed なので +1
              }}
            ];

            // console.log(`[API] Aggregation Pipeline for ${key}:`, JSON.stringify(pipeline, null, 2)); // デバッグ用
            const result = await Result.aggregate(pipeline);
            // console.log(`[API] Aggregation Result for ${key}:`, result); // デバッグ用

            if (result && result.length > 0) {
              ranksMap.set(key, result[0].rank);
              console.log(`[API] Rank calculated for ${key}: ${result[0].rank}`);
            } else {
              // アグリゲーションで結果が見つからない場合 (通常はありえないはず)
              ranksMap.set(key, -1); // または null や '-' など
              console.warn(`[API] Rank not found for user ${userId} in aggregation result for ${key}`);
            }
          } catch (aggError) {
            console.error(`[API] Aggregation error for ${key}:`, aggError);
            ranksMap.set(key, -1); // エラー時は -1 または null
          }
        }
        console.log('[API] 全ての順位計算が完了');


        // 4. 連続記録の計算 (既存ロジックを流用)
        let currentStreak = 0;
        let maxStreak = 0;
        let tempStreak = 0;
        const today = dayjs().tz().startOf('day');

        // streak計算のために日付昇順にソート (userHistoryは既に取得済み)
        const sortedHistoryAsc = [...userHistory].sort((a, b) => dayjs(a.date).diff(dayjs(b.date)));

        for (let i = 0; i < sortedHistoryAsc.length; i++) {
           const submissionDate = dayjs(sortedHistoryAsc[i].date).tz().startOf('day');
           if (i === 0) {
             tempStreak = 1;
           } else {
             const prevDate = dayjs(sortedHistoryAsc[i - 1].date).tz().startOf('day');
             const dayDiff = submissionDate.diff(prevDate, 'day');
             if (dayDiff === 1) {
               tempStreak++;
             } else if (dayDiff > 1) {
               tempStreak = 1;
             }
           }
           maxStreak = Math.max(maxStreak, tempStreak);
        }
        const lastSubmissionDate = dayjs(sortedHistoryAsc[sortedHistoryAsc.length - 1].date).tz().startOf('day');
        if (today.diff(lastSubmissionDate, 'day') <= 1) {
          currentStreak = tempStreak;
        }


        // 5. 履歴データの整形 (順位情報をマージ)
        const formattedHistory = userHistory.map(submission => {
          const key = `${submission.date}|${submission.difficulty}`;
          const rank = ranksMap.get(key) ?? null; // Mapから順位を取得、なければ null

          // ランクが見つからなかった場合のログ
          if (rank === null) {
             console.warn(`[API] Rank lookup failed for key: ${key}`);
          }

          return {
            date: submission.date,
            difficulty: submission.difficulty,
            timeSpent: submission.timeSpent,
            score: submission.score,
            correctAnswers: submission.correctAnswers,
            totalProblems: submission.totalProblems,
            rank: rank // 計算した順位を追加
          };
        });

        res.json({
          success: true,
          history: formattedHistory, // 順位ありの履歴
          currentStreak,
          maxStreak
        });
      } catch (error) {
        console.error('履歴取得または順位計算エラー:', error); // エラーメッセージを具体的に
        res.status(500).json({
          success: false,
          message: '履歴の取得または順位計算中にエラーが発生しました',
        });
      }
    });

    // 問題生成処理のためのレート制限とキューを実装
    const pendingGenerations = new Map();
    const MAX_CONCURRENT_GENERATIONS = 2; // 同時に処理する生成リクエスト数の制限
    let currentGenerations = 0;

    app.post('/api/problems/generate', protect, admin, async (req, res) => {
      const { date, difficulty, count = 10, force = false } = req.body;
      
      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ success: false, message: '日付の形式が無効です (YYYY-MM-DD)。' });
      }

      if (!difficulty || !Object.values(DifficultyRank).includes(difficulty)) {
        return res.status(400).json({ success: false, message: '無効な難易度です。' });
      }
      
      // リクエスト識別用のID生成
      const requestId = `${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
      const requestKey = `${date}_${difficulty}_${requestId}`;

      try {
        console.log(`[API] 問題生成リクエスト: ${date}, 難易度: ${difficulty}, 問題数: ${count}, ID: ${requestId}`);
        
        // 既に同じ日付と難易度で実行中のリクエストがあるかチェック
        const existingRequest = Array.from(pendingGenerations.values()).find(
          p => p.date === date && p.difficulty === difficulty
        );
        
        if (existingRequest) {
          console.log(`[API] 同じ日付・難易度のリクエストが処理中です: ${date}, ${difficulty}`);
          return res.status(409).json({
            success: false,
            message: `同じ日付・難易度の問題生成が既に処理中です。しばらく待ってからもう一度お試しください。`,
            pendingRequestId: existingRequest.requestId
          });
        }
        
        // 問題数の上限を設定（50問を超えないように）
        const validCount = Math.min(50, Math.max(1, parseInt(count) || 10));
        
        // 既存の問題セットをチェック
        const existingSet = await DailyProblemSet.findOne({ date, difficulty });
        
        // 既存のセットがあり、強制更新フラグがfalseの場合は409エラー
        if (existingSet && !force) {
          console.log(`[API] 既存の問題セットが見つかりました (${date}, ${difficulty}), 強制更新なし`);
          return res.status(409).json({ 
            success: false, 
            message: `${date}の${difficulty}問題セットは既に存在します。上書きするには強制更新フラグを使用してください。`
          });
        }
        
        // 同時実行数の制限
        if (currentGenerations >= MAX_CONCURRENT_GENERATIONS) {
          console.log(`[API] 同時生成制限に達しました (${currentGenerations}/${MAX_CONCURRENT_GENERATIONS}). リクエストをキューに入れます`);
          
          // リクエストを保留キューに追加
          pendingGenerations.set(requestKey, {
            date,
            difficulty,
            count: validCount,
            force,
            requestId,
            timestamp: Date.now()
          });
          
          return res.status(202).json({
            success: true,
            message: `リクエストを受け付けました。現在処理中のリクエストが完了次第、問題生成を開始します。`,
            requestId,
            status: 'queued'
          });
        }
        
        // 生成処理を実行
        currentGenerations++;
        console.log(`[API] 問題生成開始: ${date}, 難易度: ${difficulty}, 問題数: ${validCount} (同時実行: ${currentGenerations}/${MAX_CONCURRENT_GENERATIONS})`);
        
        const startTime = Date.now();
        
        // 問題生成
        const problems = generateProblems(difficulty, validCount);
        
        if (!problems || problems.length === 0) {
          currentGenerations--;
          console.error(`[API] 問題生成失敗: 有効な問題を生成できませんでした`);
          return res.status(500).json({ 
            success: false, 
            message: '問題の生成に失敗しました。もう一度試すか、問題数を減らしてください。'
          });
        }
        
        const processingTime = Date.now() - startTime;
        console.log(`[API] 問題生成完了: ${problems.length}問, 処理時間: ${processingTime}ms`);

        // 一部の問題が生成できなかった場合の処理
        if (problems.length < validCount) {
          console.warn(`[API] 要求された${validCount}問のうち、${problems.length}問のみ生成されました`);
        }

        // 問題セットを更新または作成（$setOnInsertで既定値設定）
        const problemSet = await DailyProblemSet.findOneAndUpdate(
          { date, difficulty },
          {
            $set: {
              problems: problems.map(p => ({
                question: p.question,
                correctAnswer: p.answer,
                options: p.options,
              })),
              isEdited: false,
              lastUpdatedAt: new Date()
            },
            $setOnInsert: {
              createdAt: new Date()
            }
          },
          { upsert: true, new: true }
        );
        
        console.log(`[API] データベース保存完了: ${problemSet.problems.length}問 (${date}, ${difficulty})`);
        
        // 同時実行数を減らす
        currentGenerations--;
        
        // 保留中のリクエストが他にあれば処理を開始
        processPendingGenerations();
        
        res.json({ 
          success: true, 
          message: `${date}の${difficulty}問題セットを${existingSet && force ? '上書き' : '新規'}作成しました。`, 
          count: problemSet.problems.length,
          processingTime: `${processingTime}ms`
        });
      } catch (error) {
        // エラー発生時も同時実行数を減らす
        currentGenerations = Math.max(0, currentGenerations - 1);
        
        // 保留中のリクエストの処理を試みる
        processPendingGenerations();
        
        console.error(`[API] 問題生成/保存エラー (${date}, ${difficulty}):`, error);
        console.error(error.stack); // スタックトレースも記録
        
        // クライアントに適切なエラーメッセージを返す
        let errorMessage = '問題セットの生成または保存中にエラーが発生しました。';
        if (error.message) {
          if (error.message.includes('timeout')) {
            errorMessage = '問題生成がタイムアウトしました。問題数を減らすか、難易度を下げてください。';
          } else {
            errorMessage += ' ' + error.message;
          }
        }
        
        res.status(500).json({ 
          success: false, 
          message: errorMessage
        });
      }
    });
    
    // 保留中の問題生成リクエストを処理する関数
    const processPendingGenerations = async () => {
      if (pendingGenerations.size === 0 || currentGenerations >= MAX_CONCURRENT_GENERATIONS) {
        return;
      }
      
      // 最も古いリクエストを取得
      const entries = Array.from(pendingGenerations.entries());
      const oldestEntry = entries.reduce((oldest, current) => {
        const [, oldestData] = oldest;
        const [, currentData] = current;
        return oldestData.timestamp < currentData.timestamp ? oldest : current;
      });
      
      if (!oldestEntry) return;
      
      const [key, data] = oldestEntry;
      pendingGenerations.delete(key);
      
      // リクエストを処理
      try {
        currentGenerations++;
        console.log(`[API] キューから問題生成開始: ${data.date}, 難易度: ${data.difficulty}, 問題数: ${data.count}, ID: ${data.requestId}`);
        
        const startTime = Date.now();
        
        // 問題生成
        const problems = generateProblems(data.difficulty, data.count);
        
        if (!problems || problems.length === 0) {
          throw new Error('問題の生成に失敗しました');
        }
        
        const processingTime = Date.now() - startTime;
        console.log(`[API] 問題生成完了: ${problems.length}問, 処理時間: ${processingTime}ms, ID: ${data.requestId}`);
        
        // 問題セットを更新または作成
        const problemSet = await DailyProblemSet.findOneAndUpdate(
          { date: data.date, difficulty: data.difficulty },
          {
            $set: {
              problems: problems.map(p => ({
                question: p.question,
                correctAnswer: p.answer,
                options: p.options,
              })),
              isEdited: false,
              lastUpdatedAt: new Date()
            },
            $setOnInsert: {
              createdAt: new Date()
            }
          },
          { upsert: true, new: true }
        );
        
        console.log(`[API] キューからの生成処理完了: ${problemSet.problems.length}問, ID: ${data.requestId}`);
      } catch (error) {
        console.error(`[API] キューからの問題生成失敗 (${data.date}, ${data.difficulty}):`, error);
      } finally {
        // 同時実行数を減らす
        currentGenerations = Math.max(0, currentGenerations - 1);
        
        // 他の保留中のリクエストを処理
        if (pendingGenerations.size > 0) {
          processPendingGenerations();
        }
      }
    };
    
    // キューからの古いリクエストをクリーンアップする（5分以上経過したもの）
    setInterval(() => {
      const now = Date.now();
      const expiredTimeout = 5 * 60 * 1000; // 5分
      
      let expiredCount = 0;
      for (const [key, data] of pendingGenerations.entries()) {
        if (now - data.timestamp > expiredTimeout) {
          pendingGenerations.delete(key);
          expiredCount++;
        }
      }
      
      if (expiredCount > 0) {
        console.log(`[API] ${expiredCount}件の期限切れリクエストをキューからクリア`);
      }
    }, 60 * 1000); // 1分ごとにチェック

    // POST /api/auth/register - 新規ユーザー登録
    app.post('/api/auth/register', async (req, res) => {
        const { username, email, password, grade } = req.body;
        
        // 必須項目の検証
        if (!username || !email || !password || !grade) {
            return res.status(400).json({ success: false, message: 'ユーザー名、メールアドレス、パスワード、学年は必須です。' });
        }
        if (password.length < 6) {
            return res.status(400).json({ success: false, message: 'パスワードは6文字以上である必要があります。' });
        }

        try {
            // ユーザー名またはメールアドレスの重複チェック
            const existingUser = await User.findOne({ 
                $or: [
                    { username: username.toLowerCase() },
                    { email: email.toLowerCase() }
                ] 
            });
            
            if (existingUser) {
                if (existingUser.username === username.toLowerCase()) {
                    return res.status(400).json({ success: false, message: 'このユーザー名は既に使用されています。' });
                } else {
                    return res.status(400).json({ success: false, message: 'このメールアドレスは既に使用されています。' });
                }
            }

            // 新しいユーザーを作成 (パスワードは pre-save フックでハッシュ化される)
            const newUser = await User.create({
                username: username.toLowerCase(), // ユーザー名として保存
                email: email.toLowerCase(),       // メールアドレスとして保存 
                password: password,
                grade: grade,
            });

            console.log(`User registered: ${newUser.username}, Email: ${newUser.email}`);

            // トークンを生成
            const token = generateToken(res, newUser._id);
            console.log(`Generated token for new user: ${token}`);

            // 登録成功レスポンス (パスワードは含めない)
            res.status(201).json({
                success: true,
                message: 'ユーザー登録が成功しました。ログインしてください。',
                token: token, // トークンを追加
                user: {
                    id: newUser._id,
                    username: newUser.username,
                    email: newUser.email,
                    grade: newUser.grade,
                    avatar: newUser.avatar
                }
            });

        } catch (error) {
            // エラーログを強化
            console.error('User registration error:', error); 
            console.error('Request body (masked password):', { ...req.body, password: '***' }); 
            // Mongoose のバリデーションエラーなどもここでキャッチ
            if (error.name === 'ValidationError') {
                const messages = Object.values(error.errors).map(val => val.message);
                return res.status(400).json({ success: false, message: messages.join(' ') });
            }
            res.status(500).json({ success: false, message: 'ユーザー登録中にエラーが発生しました。' });
        }
    });

    // デフォルト管理者ユーザーの作成関数
    const createDefaultAdminUser = async () => {
      try {
        // 既存の管理者ユーザーを確認
        const existingAdmin = await User.findOne({ 
          $or: [
            { email: 'admin@example.com' },
            { username: '管理者' }
          ]
        });
        
        if (existingAdmin) {
          console.log('管理者ユーザーは既に存在します。パスワード: admin123');
          
          // 既存のユーザーに管理者権限がない場合は付与
          if (!existingAdmin.isAdmin) {
            console.log('既存ユーザーに管理者権限を付与します');
            existingAdmin.isAdmin = true;
            await existingAdmin.save();
          }
          
          // パスワードをリセット
          const salt = await bcrypt.genSalt(10);
          const hashedPassword = await bcrypt.hash('admin123', salt);
          existingAdmin.password = hashedPassword;
          await existingAdmin.save();
          
          return;
        }
        
        // パスワードのハッシュ化
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash('admin123', salt);
        
        // 管理者ユーザーを作成
        const adminUser = await User.create({
          username: '管理者',           // 表示用ユーザー名
          email: 'admin@example.com',   // ログイン用メールアドレス
          password: hashedPassword,
          grade: 6,
          isAdmin: true,
          avatar: '👨‍💼'
        });
        
        console.log('デフォルト管理者ユーザーを作成しました:');
        console.log('メールアドレス: admin@example.com');
        console.log('パスワード: admin123');
      } catch (error) {
        console.error('管理者ユーザー作成エラー:', error);
      }
    };
    
    // ★ トークン生成関数
    const generateToken = (res, userId) => {
        const token = jwt.sign({ userId }, JWT_SECRET, {
            expiresIn: JWT_EXPIRES_IN
        });
        
        // CookieにJWTを設定
        res.cookie('jwt', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV !== 'development',
            sameSite: 'lax', 
            maxAge: 30 * 24 * 60 * 60 * 1000 // 30日間
        });
        
        // デバッグ用にトークンを返す
        return token;
    };

    // ★ POST /api/auth/login - ログイン処理
    app.post('/api/auth/login', async (req, res) => {
        const { email, password } = req.body;
        
        console.log('ログインリクエスト受信:');
        console.log('email:', email);
        console.log('password provided:', password ? '********' : 'なし');

        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'メールアドレスとパスワードを入力してください。' });
        }

        try {
            // 管理者アカウントのログイン試行の場合
            if (email.toLowerCase() === 'admin@example.com') {
                console.log('[Login] 管理者アカウントログイン試行');
                // 管理者アカウントを再作成/更新して確実に存在するようにする
                await createDefaultAdminUser();
            }
            
            // emailフィールドでユーザーを検索
            console.log(`[Login] emailで検索: ${email.toLowerCase()}`);
            let user = await User.findOne({ email: email.toLowerCase() }).select('+password');
            
            // ユーザーが見つからない場合は、usernameフィールドでも検索（旧バージョン互換性）
            if (!user) {
                console.log(`[Login] emailで見つからないため、usernameで検索: ${email.toLowerCase()}`);
                user = await User.findOne({ username: email.toLowerCase() }).select('+password');
            }
            
            console.log(`[Login] ユーザー検索結果:`, user ? `ユーザー見つかりました (ID: ${user._id})` : 'ユーザーが見つかりません');

            if (user) {
                console.log(`[Login] パスワード比較を実行します`);
                const isMatch = await user.matchPassword(password);
                console.log(`[Login] パスワード一致: ${isMatch}`);
                
                if (isMatch) {
                    // パスワード一致 -> JWTを生成してCookieにセット
                    const token = generateToken(res, user._id);

                    console.log(`User logged in: ${user.username} (${user.email})`);
                    console.log(`Generated token: ${token}`);
                    console.log(`User details: isAdmin=${user.isAdmin}, grade=${user.grade}`);

                    // ログイン成功レスポンス (パスワードは含めない)
                    res.status(200).json({
                        success: true,
                        message: 'ログインしました。',
                        token: token,
                        user: {
                            id: user._id,
                            username: user.username,
                            email: user.email,
                            grade: user.grade,
                            avatar: user.avatar,
                            isAdmin: user.isAdmin
                        }
                    });
                } else {
                    // 管理者特殊ケース
                    if (email.toLowerCase() === 'admin@example.com' && password === 'admin123') {
                        console.log('[Login] 管理者特殊ケース: パスワードを再設定します');
                        // パスワードを再設定
                        const salt = await bcrypt.genSalt(10);
                        user.password = await bcrypt.hash('admin123', salt);
                        await user.save();
                        
                        // JWTを生成
                        const token = generateToken(res, user._id);
                        
                        console.log(`Admin user logged in with password reset`);
                        
                        return res.status(200).json({
                            success: true,
                            message: 'ログインしました（管理者パスワード再設定）。',
                            token: token,
                            user: {
                                id: user._id,
                                username: user.username,
                                email: user.email,
                                grade: user.grade,
                                avatar: user.avatar,
                                isAdmin: true
                            }
                        });
                    }
                    
                    // 通常のパスワード不一致
                    console.log(`[Login] パスワードが一致しません: ${email}`);
                    res.status(401).json({ success: false, message: 'メールアドレスまたはパスワードが無効です。' });
                }
            } else {
                // ユーザーが見つからない
                console.log(`[Login] ユーザーが見つかりません: ${email}`);
                res.status(401).json({ success: false, message: 'メールアドレスまたはパスワードが無効です。' });
            }
        } catch (error) {
            console.error('Login error:', error);
            res.status(500).json({ success: false, message: 'ログイン処理中にエラーが発生しました。' });
        }
    });

    // 認証確認エンドポイント - デバッグ用
    app.get('/api/auth/check', protect, (req, res) => {
      res.json({
        success: true,
        message: '認証成功',
        user: {
          id: req.user._id,
          username: req.user.username,
          isAdmin: req.user.isAdmin
        }
      });
    });

    // ★ PUT /api/auth/update-password - パスワード変更 (要認証)
    app.put('/api/auth/update-password', protect, async (req, res) => {
        const { currentPassword, newPassword } = req.body;
        const userId = req.user._id; // protect ミドルウェアからユーザーIDを取得

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ success: false, message: '現在のパスワードと新しいパスワードを入力してください。' });
        }
        if (newPassword.length < 6) {
            return res.status(400).json({ success: false, message: '新しいパスワードは6文字以上である必要があります。' });
        }
        if (currentPassword === newPassword) {
            return res.status(400).json({ success: false, message: '新しいパスワードが現在のパスワードと同じです。' });
        }

        try {
            // ユーザーを再取得 (パスワードを含む)
            const user = await User.findById(userId).select('+password');

            if (!user) {
                return res.status(404).json({ success: false, message: 'ユーザーが見つかりません。' });
            }

            // 現在のパスワードを確認
            if (await user.matchPassword(currentPassword)) {
                // パスワードが一致したら新しいパスワードを設定
                user.password = newPassword;
                await user.save(); // pre-save フックでハッシュ化される

                console.log(`Password updated for user: ${user.username}`);
                res.status(200).json({ success: true, message: 'パスワードが正常に変更されました。' });
            } else {
                // 現在のパスワードが不一致
                res.status(401).json({ success: false, message: '現在のパスワードが正しくありません。' });
            }
        } catch (error) {
            // エラーログを強化
            console.error(`Password update error for user ${userId}:`, error);
            console.error('Request body (masked passwords):', { 
                currentPassword: currentPassword ? '***' : 'undefined',
                newPassword: newPassword ? '***' : 'undefined'
            });
            res.status(500).json({ success: false, message: 'パスワードの変更中にエラーが発生しました。' });
        }
    });

    // ★ TODO: ログアウト API (POST /api/auth/logout)
    //       - Cookie の jwt をクリアする

    // ★ TODO: ログイン状態確認 API (GET /api/auth/me)
    //       - リクエストの Cookie から jwt を検証
    //       - 有効ならユーザー情報を返す

    // 問題編集用の取得エンドポイント
    app.get('/api/problems/edit', protect, admin, async (req, res) => {
      const { date, difficulty } = req.query;
      
      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ success: false, message: '日付の形式が無効です (YYYY-MM-DD)。' });
      }

      if (!difficulty || !Object.values(DifficultyRank).includes(difficulty)) {
        return res.status(400).json({ success: false, message: '無効な難易度です。' });
      }

      try {
        // リクエストパラメータをログ出力
        console.log(`[GET /api/problems/edit] Request params: date=${date}, difficulty=${difficulty}`);
        
        // 指定された日付・難易度の問題セットを検索
        const problemSet = await DailyProblemSet.findOne({ date, difficulty });
        console.log(`[GET /api/problems/edit] Problem set found: ${problemSet ? 'Yes' : 'No'}`);
        
        if (!problemSet || !problemSet.problems || problemSet.problems.length === 0) {
          return res.status(404).json({ 
            success: false, 
            message: `${date}の${difficulty}問題セットは存在しません。` 
          });
        }

        // 編集用に問題データを返す
        res.json({
          success: true,
          problems: problemSet.problems.map((p, index) => ({
            id: index,
            question: p.question,
            correctAnswer: p.correctAnswer,
            options: p.options
          }))
        });
      } catch (error) {
        console.error(`Error fetching problems for editing (${date}, ${difficulty}):`, error);
        // スタックトレースもログ出力
        console.error(error.stack);
        res.status(500).json({ success: false, message: '問題の取得中にエラーが発生しました。' });
      }
    });

    // 問題編集用の更新エンドポイント
    app.post('/api/problems/edit', protect, admin, async (req, res) => {
      const { date, difficulty, problems } = req.body;
      
      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ success: false, message: '日付の形式が無効です (YYYY-MM-DD)。' });
      }

      if (!difficulty || !Object.values(DifficultyRank).includes(difficulty)) {
        return res.status(400).json({ success: false, message: '無効な難易度です。' });
      }

      if (!problems || !Array.isArray(problems) || problems.length === 0) {
        return res.status(400).json({ success: false, message: '有効な問題データが提供されていません。' });
      }

      try {
        // リクエストデータをログ出力
        console.log(`[POST /api/problems/edit] Request data: date=${date}, difficulty=${difficulty}, problems count=${problems.length}`);
        
        // 問題データを検証
        const validatedProblems = problems.map(p => ({
          question: String(p.question || ''),
          correctAnswer: Number(p.correctAnswer) || 0,
          options: Array.isArray(p.options) ? p.options.map(opt => Number(opt) || 0) : []
        }));

        // 問題セットを更新
        const updatedSet = await DailyProblemSet.findOneAndUpdate(
          { date, difficulty },
          {
            $set: {
              problems: validatedProblems,
              isEdited: true,
              lastEditedAt: new Date()
            }
          },
          { new: true }
        );
        
        if (!updatedSet) {
          console.log(`[POST /api/problems/edit] No problem set found for date=${date}, difficulty=${difficulty}`);
          return res.status(404).json({ 
            success: false, 
            message: `${date}の${difficulty}問題セットが見つかりません。先に問題を生成してください。` 
          });
        }

        console.log(`[Admin] Problems updated for ${date} - ${difficulty}. Count: ${updatedSet.problems.length}`);
        
        res.json({
          success: true,
          message: `${date}の${difficulty}問題セットを更新しました。`,
          count: updatedSet.problems.length
        });
      } catch (error) {
        console.error(`Error updating problems (${date}, ${difficulty}):`, error);
        // スタックトレースもログ出力
        console.error(error.stack);
        res.status(500).json({ success: false, message: '問題の更新中にエラーが発生しました。' });
      }
    });

    // サーバーの起動
    const serverProcess = app.listen(PORT, () => {
      console.log(`🚀 サーバーが起動しました！ポート ${PORT} で待機中...`);
      console.log(`🔗 フロントエンドオリジン許可: ${FRONTEND_ORIGIN}`);
      console.log(`⏰ チャレンジ時間制限 ${process.env.DISABLE_TIME_CHECK === 'true' ? '無効' : '有効 (06:30 - 08:00 JST)'}`);
      console.log(`💾 DBモード: ${process.env.MONGODB_MOCK === 'true' ? 'モック (InMemory)' : '通常 (MongoDB)'}`);

      // 翌日の問題生成をスケジュール（開発/本番問わず一度だけ実行）
      // scheduleNextGeneration(); // ★ タイミングを見直す必要あり（起動時ではなく定時に実行すべき）
      // generateProblemsForNextDay(); // 起動時に翌日分を生成（初回起動やテスト用）

      // プロセス終了時の処理 (SIGINT)
      process.on('SIGINT', async () => {
        console.log('\n🔌 サーバーをシャットダウンします...');
        // 必要であればDB接続を切断などのクリーンアップ処理
        await mongoose.disconnect();
        console.log('MongoDB 接続を切断しました。');
        serverProcess.close(() => {
          console.log('サーバープロセスを終了しました。');
          process.exit(0);
        });
      });
    });

    // サーバー起動エラーハンドリング (EADDRINUSE など)
    serverProcess.on('error', (error) => {
      if (error.syscall !== 'listen') {
        throw error;
      }

      const bind = typeof PORT === 'string'
        ? 'Pipe ' + PORT
        : 'Port ' + PORT;

      // handle specific listen errors with friendly messages
      switch (error.code) {
        case 'EACCES':
          console.error(`❌ ${bind} には管理者権限が必要です`);
          process.exit(1);
          break;
        case 'EADDRINUSE':
          console.error(`❌ ${bind} は既に使用されています`);
          console.error('他のプロセスがそのポートを使用していないか確認してください。');
          process.exit(1); // ポート使用中エラーで終了
          break;
        default:
          throw error;
      }
    });

    // startServer(); // ★ startServer() 関数の最後で app.listen を呼んでいるので、ここでは不要
    // export default app; // server.js がエントリーポイントなら不要

  } catch (error) {
    console.error('サーバー起動中に予期せぬエラーが発生しました:', error);
    process.exit(1); // エラーで終了
  }
}; // startServer 関数の終わり

startServer(); // サーバー起動処理を実行
