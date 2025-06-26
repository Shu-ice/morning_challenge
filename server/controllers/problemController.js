import Result from '../models/Result.js';
import DailyProblemSet from '../models/DailyProblemSet.js';
import { logger } from '../utils/logger.js';
import User from '../models/User.js';
import dayjs from 'dayjs';
import { v4 as uuidv4 } from 'uuid';
import { getMockResults, getMockDailyProblemSets, addMockResult, findMockUser, getMockUsers } from '../config/database.js';
import { DifficultyRank } from '../constants/difficultyRank.js';
import { getRankForResult } from '../utils/ranking.js';
import { generateProblems } from '../utils/problemGenerator.js';

// モック環境判定
const isMongoMock = () => {
  // 環境変数から改行文字やスペースを除去して正確に比較
  const mongoMockValue = process.env.MONGODB_MOCK?.toString().trim();
  const isMock = mongoMockValue === 'true';
  logger.debug(`[ProblemController] MONGODB_MOCK check: raw="${process.env.MONGODB_MOCK}", trimmed="${mongoMockValue}", isMock=${isMock}`);
  return isMock;
};

// 日次チャレンジ制限チェック
const checkDailyChallengeLimit = async (userId, date, isAdmin) => {
  // 管理者は制限なし
  if (isAdmin) {
    logger.debug(`[DailyLimit] 管理者のため日次制限をスキップ: userId=${userId}`);
    return null;
  }
  
  // テスト環境では制限なし
  if (process.env.DISABLE_TIME_CHECK === 'true') {
    logger.debug(`[DailyLimit] DISABLE_TIME_CHECK=true のため日次制限をスキップ`);
    return null;
  }
  
  try {
    let existingResult = null;
    
    if (isMongoMock()) {
      // モック環境での既存結果チェック
      const mockResults = getMockResults();
      existingResult = mockResults.find(result => 
        result.userId === userId && result.date === date
      );
    } else {
      // MongoDB環境での既存結果チェック
      existingResult = await Result.findOne({ userId, date });
    }
    
    if (existingResult) {
      logger.warn(`[DailyLimit] 既に本日挑戦済み: userId=${userId}, date=${date}`);
      return {
        status: 409,
        success: false,
        message: '本日は既にチャレンジを完了しています。明日の挑戦をお待ちしています！',
        isAlreadyCompleted: true,
        completedAt: existingResult.createdAt || existingResult.updatedAt
      };
    }
    
    logger.debug(`[DailyLimit] 日次制限チェック通過: userId=${userId}, date=${date}`);
    return null; // 制限なし
  } catch (error) {
    logger.error(`[DailyLimit] チェック中にエラー:`, error);
    // エラー時は制限をかけない（安全側に倒す）
    return null;
  }
};

// @desc    問題の生成
// @route   GET /api/problems
// @access  Private
export const getProblems = async (req, res) => {
  try {
    // クエリパラメータを取得
    let { difficulty, date, skipTimeCheck, userId } = req.query; 

    // difficulty がない場合は 'beginner' をデフォルトとする
    if (!difficulty) {
      difficulty = DifficultyRank.BEGINNER;
    }
    
    // 時間制限チェックを実行 - 🚀 テストユーザーの場合は通常の時間制限を適用
    try {
      // 🔥 テストユーザーには必ず時間制限チェックを適用（メッセージ確認のため）
      const isTestUser = req.user && req.user.username === 'testuser';
      
      if (process.env.DISABLE_TIME_CHECK === 'true' && !isTestUser) {
        logger.debug('[TimeCheck] DISABLE_TIME_CHECK=true により時間制限チェックをスキップします（テストユーザー以外）');
        logger.info(`[TimeCheck] ✅ 時間制限チェックスキップ（環境変数により無効化）`);
      } else {
        // 時間制限チェックを実行（テストユーザーまたは通常環境）
        const shouldSkipTimeCheck = (skipTimeCheck === 'true' || 
                                   (req.user && req.user.isAdmin)) && !isTestUser;
        
        // 現在時刻をチェック（日本時間）
        const now = new Date();
        const hours = now.getHours();
        const minutes = now.getMinutes();
        const currentTime = hours + minutes/60;
        
        logger.debug(`[TimeCheck] 現在時刻チェック: ${hours}:${String(minutes).padStart(2, '0')} (${currentTime.toFixed(2)}時)`);
        
        if (!shouldSkipTimeCheck) {
          // 6:30-8:00の時間制限
          const startTime = 6.5; // 6:30
          const endTime = 8.0;   // 8:00
          
          if (currentTime < startTime || currentTime > endTime) {
            const timeMessage = isTestUser 
              ? '⏰ テストユーザーでも時間制限が適用されます。朝の計算チャレンジは朝6:30から8:00の間のみ挑戦できます。またの挑戦をお待ちしています！' 
              : '⏰ 朝の計算チャレンジは、朝6:30から8:00の間のみ挑戦できます。またの挑戦をお待ちしています！';
            
            logger.warn(`[TimeCheck] ⚠️ 時間制限エラー発生: 現在時刻=${currentTime.toFixed(2)}時, 許可時間=6:30-8:00`);
            logger.warn(`[TimeCheck] ユーザー: ${req.user.username}${isTestUser ? ' (テストユーザー)' : ''}`);
            
            return res.status(403).json({
              success: false,
              message: timeMessage,
              currentTime: `${hours}:${String(minutes).padStart(2, '0')}`,
              allowedTime: '6:30-8:00',
              isTimeRestricted: true
            });
          } else {
            logger.info(`[TimeCheck] ✅ 時間制限チェック通過: ${currentTime.toFixed(2)}時は許可時間内です`);
          }
        } else {
          logger.info(`[TimeCheck] ✅ 管理者権限により時間制限をスキップ`);
        }
      }
    } catch (timeCheckError) {
      logger.error(`[TimeCheck] 時間制限チェックでエラー発生:`, timeCheckError);
      // エラーが発生しても処理を続行
    }
    
    // userIdの検証
    if (!userId && req.user && req.user._id) {
      userId = req.user._id.toString(); // ObjectIdを文字列に変換
    }
    
    const targetDate = date || new Date().toISOString().split('T')[0];
    
    // 日次チャレンジ制限チェック
    if (userId) {
      const dailyLimitResult = await checkDailyChallengeLimit(
        userId, 
        targetDate, 
        req.user && req.user.isAdmin
      );
      
      if (dailyLimitResult) {
        logger.warn(`[getProblems] 日次制限によりアクセス拒否: userId=${userId}, date=${targetDate}`);
        return res.status(dailyLimitResult.status).json(dailyLimitResult);
      }
    }
    
      if (!['beginner', 'intermediate', 'advanced', 'expert'].includes(difficulty)) {
        return res.status(400).json({
          success: false,
          message: '無効な難易度パラメータです。'
        });
      }
      
    logger.debug(`[getProblems] 検索条件: date=${targetDate}, difficulty=${difficulty}`);
    const problemSet = await DailyProblemSet.findOne({ date: targetDate, difficulty: difficulty });

    if (!problemSet || !problemSet.problems || problemSet.problems.length === 0) {
      logger.warn(`[getProblems] No problem set found for ${targetDate} (${difficulty}). Returning 404.`);
      return res.status(404).json({
        success: false,
        message: `<ruby>選択<rt>せんたく</rt></ruby>された日付の問題が見つかりませんでした。`,
        problems: [],
        canGenerate: true
      });
    }

    // ★ デバッグログ追加
    logger.debug(`[getProblems] 取得した問題セット詳細:`);
    logger.debug(`  - 日付: ${problemSet.date}`);
    logger.debug(`  - 難易度: ${problemSet.difficulty}`);
    logger.debug(`  - 問題数: ${problemSet.problems.length}`);
    logger.debug(`  - 最初の3問:`);
    problemSet.problems.slice(0, 3).forEach((p, i) => {
      logger.debug(`    問題${i + 1}: ID=${p.id}, 質問="${p.question}", 正解=${p.correctAnswer}`);
    });

    const problemsForClient = problemSet.problems.map(p => ({
      id: p.id, 
      question: p.question,
      options: p.options,
    }));
    
    req.session = req.session || {};
    req.session.problems = problemsForClient; 
    
    res.json({
      success: true,
      difficulty: difficulty,
      date: targetDate,
      problems: problemsForClient
    });

  } catch (error) {
    logger.error('問題取得エラー:', error);
    res.status(500).json({ 
      success: false, 
      message: '<ruby>サーバー<rt>さーばー</rt></ruby>エラーが<ruby>発生<rt>はっせい</rt></ruby>しました。' 
    });
  }
};

// @desc    指定された日付と難易度の問題セットを編集用に取得 (管理者用)
// @route   GET /api/problems/edit
// @access  Private/Admin
export const getProblemSetForEdit = async (req, res) => {
  const { date, difficulty } = req.query;

  if (!date || !difficulty) {
    return res.status(400).json({
      success: false,
      message: '日付と難易度を指定してください。'
    });
  }

  try {
    logger.debug(`[getProblemSetForEdit] 検索条件: date=${date}, difficulty=${difficulty}`);
    const problemSet = await DailyProblemSet.findOne({ date, difficulty });

    if (!problemSet) {
      return res.status(404).json({
        success: false,
        message: '<ruby>指定<rt>してい</rt></ruby>された<ruby>問題<rt>もんだい</rt></ruby>セットが見つかりません。'
      });
    }

    // ★ デバッグログ追加
    logger.debug(`[getProblemSetForEdit] 取得した問題セット詳細:`);
    logger.debug(`  - 日付: ${problemSet.date}`);
    logger.debug(`  - 難易度: ${problemSet.difficulty}`);
    logger.debug(`  - 問題数: ${problemSet.problems.length}`);
    logger.debug(`  - 最初の3問:`);
    problemSet.problems.slice(0, 3).forEach((p, i) => {
      logger.debug(`    問題${i + 1}: ID=${p.id}, 質問="${p.question}", 正解=${p.correctAnswer}`);
    });

    // 問題セット全体を返す (編集に必要なすべての情報を含むことを想定)
    res.json({
      success: true,
      data: problemSet.problems // 問題配列を返す
    });

  } catch (error) {
    logger.error('問題セット編集用取得エラー:', error);
    res.status(500).json({ 
      success: false, 
      message: '<ruby>サーバー<rt>さーばー</rt></ruby>エラーが<ruby>発生<rt>はっせい</rt></ruby>しました。' 
    });
  }
};

// @desc    問題を生成してデータベースに保存 (管理者用)
// @route   POST /api/problems/generate
// @access  Private/Admin
export const generateProblemSet = async (req, res) => {
  const { date, difficulty, count = 10, force = false } = req.body;

  if (!date || !difficulty) {
    return res.status(400).json({
      success: false,
      message: '日付と難易度は必須パラメータです。'
    });
  }

  try {
    // 既存の問題セットをチェック
    const existingProblemSet = await DailyProblemSet.findOne({ date, difficulty });
    
    if (existingProblemSet && !force) {
      return res.status(200).json({
        success: true,
        alreadyExists: true,
        message: '<ruby>指定<rt>してい</rt></ruby>された<ruby>日付<rt>ひづけ</rt></ruby>・<ruby>難易度<rt>なんいど</rt></ruby>の<ruby>問題<rt>もんだい</rt></ruby>セットは<ruby>既<rt>すで</rt></ruby>に<ruby>存在<rt>そんざい</rt></ruby>します。',
        data: {
          _id: existingProblemSet._id,
          date: existingProblemSet.date,
          difficulty: existingProblemSet.difficulty,
          problemCount: existingProblemSet.problems.length
        }
      });
    }

    // 問題を生成
    const requestId = uuidv4();
    logger.info(`[generateProblemSet] 問題生成開始: ${date}, ${difficulty}, ${count}問`);
    
    const generatedProblems = await generateProblems(difficulty, count, null, requestId);
    
    if (!generatedProblems || generatedProblems.length === 0) {
      return res.status(500).json({
        success: false,
        message: '問題の生成に失敗しました。'
      });
    }

    // generateProblems の出力を DailyProblemSet の期待する形式に変換
    const problemsForDB = generatedProblems.map(p => ({
      id: p.id,
      question: p.question,
      correctAnswer: p.answer, // answer -> correctAnswer に変換
      options: p.options
    }));

    // データベースに保存
    if (existingProblemSet) {
      // 既存のものを更新 - findOneAndUpdateを使用
      const updatedSet = await DailyProblemSet.findOneAndUpdate(
        { date, difficulty },
        { 
          problems: problemsForDB,
          updatedAt: new Date(),
          isEdited: true
        },
        { new: true, upsert: false }
      );
      logger.info(`[generateProblemSet] 既存問題セットを更新: ${date} (${difficulty}), ID=${updatedSet._id}`);
    } else {
      // 新規作成（モック環境対応）
      const newProblemSet = await DailyProblemSet.create({
        date,
        difficulty,
        problems: problemsForDB,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      logger.info(`[generateProblemSet] 新規問題セット作成: ${date} (${difficulty}), ID=${newProblemSet._id}`);
    }

    res.status(201).json({
      success: true,
      message: `${problemsForDB.length}問の<ruby>問題<rt>もんだい</rt></ruby>を<ruby>生成<rt>せいせい</rt></ruby>し、データベースに<ruby>保存<rt>ほぞん</rt></ruby>しました。`,
      data: {
        date,
        difficulty,
        count: problemsForDB.length,
        requestId
      }
    });

  } catch (error) {
    logger.error('問題生成エラー:', error);
    res.status(500).json({ 
      success: false, 
      message: '<ruby>サーバー<rt>さーばー</rt></ruby>エラーが<ruby>発生<rt>はっせい</rt></ruby>しました。',
      error: error.message
    });
  }
};

// @desc    問題編集の保存 (管理者用)
// @route   POST /api/problems/edit
// @access  Private/Admin
export const saveEditedProblems = async (req, res) => {
  const { date, difficulty, problems } = req.body;

  if (!date || !difficulty || !problems || !Array.isArray(problems)) {
    return res.status(400).json({
      success: false,
      message: '日付、難易度、問題データを正しく指定してください。'
    });
  }

  try {
    const problemSet = await DailyProblemSet.findOne({ date, difficulty });

    if (!problemSet) {
      return res.status(404).json({
        success: false,
        message: '<ruby>指定<rt>してい</rt></ruby>された<ruby>問題<rt>もんだい</rt></ruby>セットが見つかりません。'
      });
    }

    // 問題を更新
    problemSet.problems = problems;
    problemSet.updatedAt = new Date();
    await problemSet.save();

    res.json({
      success: true,
      message: `${problems.length}問の問題を更新しました。`,
      data: {
        date,
        difficulty,
        count: problems.length
      }
    });

  } catch (error) {
    logger.error('問題編集保存エラー:', error);
    res.status(500).json({ 
      success: false, 
      message: '<ruby>サーバー<rt>さーばー</rt></ruby>エラーが<ruby>発生<rt>はっせい</rt></ruby>しました。',
      error: error.message
    });
  }
};

// @desc    問題生成の進捗状況を確認 (管理者用)
// @route   GET /api/problems/status/:requestId
// @access  Private/Admin
export const getGenerationStatus = async (req, res) => {
  const { requestId } = req.params;

  if (!requestId) {
    return res.status(400).json({
      success: false,
      message: 'リクエストIDを指定してください。'
    });
  }

  try {
    // 進捗状況を取得（problemGenerator.jsのprocessingStatusMapから）
    // 実際の実装では、problemGenerator.jsから進捗状況を取得する必要があります
    // ここでは簡単な実装例を示します
    
    res.json({
      success: true,
      data: {
        requestId,
        status: 'completed',
        message: '問題生成が完了しました。',
        progress: 100,
        total: 10,
        problemsGenerated: 10
      }
    });

  } catch (error) {
    logger.error('進捗状況確認エラー:', error);
    res.status(500).json({ 
      success: false, 
      message: '<ruby>サーバー<rt>さーばー</rt></ruby>エラーが<ruby>発生<rt>はっせい</rt></ruby>しました。',
      error: error.message
    });
  }
};

// @desc    問題回答の提出
// @route   POST /api/problems/submit
// @access  Private
export const submitAnswers = async (req, res) => {
  let { difficulty, date, answers, timeSpentMs, userId, problemIds } = req.body;
  
  // 日付が未指定の場合、今日の日付を設定
  if (!date) {
    date = dayjs().format('YYYY-MM-DD');
    logger.debug(`[Submit] 日付が未指定のため今日の日付を設定: ${date}`);
  }
  
  // ★ 重要修正: 認証済みユーザーのIDを必ず使用（優先順位を明確化）
  if (req.user && req.user._id) {
    userId = req.user._id.toString(); // ObjectIdを文字列に変換
    logger.debug(`[Submit] userId をreq.userから設定: ${userId}`);
  } else if (!userId && req.user && req.user._id) {
    userId = req.user._id.toString(); // バックアップ
    logger.debug(`[Submit] userId をreq.userから設定（バックアップ）: ${userId}`);
  } else if (!userId) {
    logger.error(`[Submit] userId が取得できません: req.user=${req.user ? 'exists' : 'null'}`);
    return res.status(400).json({ 
      success: false, 
      message: 'ユーザー認証情報が不正です。再ログインしてください。' 
    });
  }
  
  logger.info(`[Submit] 処理開始: userId=${userId}, difficulty=${difficulty}, date=${date}`);
  
  // 基本的なデータ検証
  if (!difficulty || !answers || !Array.isArray(answers)) {
      return res.status(400).json({ 
      success: false, 
      message: '有効な難易度と回答が必要です' 
    });
  }
  
  // 日次チャレンジ制限チェック
  const dailyLimitResult = await checkDailyChallengeLimit(
    userId, 
    date, 
    req.user && req.user.isAdmin
  );
  
  if (dailyLimitResult) {
    logger.warn(`[submitAnswers] 日次制限により提出拒否: userId=${userId}, date=${date}`);
    return res.status(dailyLimitResult.status).json(dailyLimitResult);
  }

  try {
    // データベースから問題セット取得
    logger.debug(`[Submit] 問題セット取得: date=${date}, difficulty=${difficulty}`);
    
    let problemSet = null;
    if (isMongoMock()) {
      // モック環境での問題セット取得
      const mockProblemSets = getMockDailyProblemSets();
      problemSet = mockProblemSets.find(ps => ps.date === date && ps.difficulty === difficulty);
      logger.debug(`[Submit] モック問題セット検索: ${problemSet ? '見つかりました' : '見つかりません'}`);
    } else {
      // 通常のMongoose処理
      problemSet = await DailyProblemSet.findOne({ date, difficulty });
      logger.debug(`[Submit] 問題セット検索: ${problemSet ? '見つかりました' : '見つかりません'}`);
    }
    
    if (!problemSet || !problemSet.problems || problemSet.problems.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: `指定された日付と難易度の問題が見つかりません: ${date} (${difficulty})` 
      });
    }
    
    // 問題IDリストが送信されている場合は、IDの順序で問題を並び替える
    let problems = problemSet.problems;
    if (problemIds && Array.isArray(problemIds) && problemIds.length > 0) {
      // problemIdsの順序に合わせて問題を並び替え
      const problemMap = new Map();
      problemSet.problems.forEach(p => {
        problemMap.set(p.id, p);
      });
      
      const orderedProblems = [];
      for (const id of problemIds) {
        const problem = problemMap.get(id);
        if (problem) {
          orderedProblems.push(problem);
        } else {
          logger.warn(`[Submit] 問題ID ${id} がデータベースに見つかりません`);
        }
      }
      
      if (orderedProblems.length > 0) {
        problems = orderedProblems;
        logger.debug(`[Submit] 問題IDの順序に合わせて問題を並び替えました: ${problems.length}問`);
      } else {
        logger.warn(`[Submit] 問題IDマッチングに失敗、元の順序を使用`);
      }
    }
    
    // ★ デバッグログ: 使用している問題ソースと回答数を確認
    logger.debug(`[Submit Controller] Date: ${date}, Difficulty: ${difficulty}`);
    logger.debug(`[Submit Controller] Problems count: ${problems.length}`);
    logger.debug(`[Submit Controller] Problem IDs used: ${problems.map(p => p.id).join(', ')}`);
    logger.debug(`[Submit Controller] Received answers count: ${answers ? answers.length : 'N/A'}`);
    // ★ デバッグログここまで
    
    // 問題数と解答数の検証
    if (!Array.isArray(answers) || problems.length !== answers.length) {
      logger.error(`[Submit Controller] Validation Error: Expected ${problems.length} problems, but received ${answers?.length} answers.`);
      return res.status(400).json({
        success: false,
        error: '問題数と解答数が一致しません。'
      });
    }
    
    // 回答を採点
    const problemResults = [];
    let correctCount = 0;
    let incorrectCount = 0;
    let unansweredCount = 0;
    
    // 各問題の採点
    for (let i = 0; i < problems.length; i++) {
      const correctAnswer = problems[i].correctAnswer;
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
        question: problems[i].question,
        userAnswer: userAnswerNum,
        correctAnswer: correctAnswer,
        isCorrect: isCorrect,
        timeSpent: timeSpentMs / problems.length // 各問題の平均時間（仮定）
      });
    }
    
    // 時間情報の取得と再構築
    const { timeSpentMs: reqTimeSpentMs } = req.body;
    const submissionTime = Date.now(); // 解答受付時刻 (サーバー)
    let calculatedStartTime;
    let calculatedEndTime = submissionTime;
    let finalTimeSpentMs;

    if (typeof reqTimeSpentMs === 'number' && reqTimeSpentMs >= 0) {
        finalTimeSpentMs = reqTimeSpentMs;
        calculatedStartTime = submissionTime - reqTimeSpentMs;
    } else if (typeof timeSpentMs === 'number' && timeSpentMs >= 0) {
        // 代替: timeSpentMsフィールドをチェック
        finalTimeSpentMs = timeSpentMs;
        calculatedStartTime = submissionTime - timeSpentMs;
    } else {
        // timeSpentMs が不正な場合は0とする
        finalTimeSpentMs = 0;
        calculatedStartTime = submissionTime;
    }
    
    logger.debug(`[Submit] 時間計算: reqTimeSpentMs=${reqTimeSpentMs}, timeSpentMs=${timeSpentMs}, finalTimeSpentMs=${finalTimeSpentMs}`);
    
    // 保存するための結果データを構築
    const resultsData = {
      totalProblems: problems.length,
      correctAnswers: correctCount,
      incorrectAnswers: incorrectCount,
      unanswered: unansweredCount,
      totalTime: finalTimeSpentMs, // ミリ秒
      timeSpent: Math.round((finalTimeSpentMs / 1000) * 100) / 100, // 秒に変換（小数点以下2桁まで保持）
      problems: problemResults,
      difficulty: difficulty,
      date: date,
      startTime: calculatedStartTime, // ★ サーバーで計算した開始時刻
      endTime: calculatedEndTime     // ★ サーバーで計算した終了時刻 (解答受付時刻)
    };
      
    // ユーザー情報の取得
    let user = null;
    if (userId) {
      if (isMongoMock()) {
        // モック環境でのユーザー検索
        user = findMockUser({ _id: userId });
        logger.debug(`[Submit] モックユーザー検索 (ID): ${user ? '見つかりました' : '見つかりません'}`);
      } else {
        // 通常のMongoose処理
        user = await User.findById(userId).lean();
        logger.debug(`[Submit] ユーザー検索 (ID): ${user ? '見つかりました' : '見つかりません'}`);
      }
    } else if (req.user && req.user._id) {
      if (isMongoMock()) {
        // モック環境でのユーザー検索
        user = findMockUser({ _id: req.user._id.toString() });
        logger.debug(`[Submit] モックユーザー検索 (req.user): ${user ? '見つかりました' : '見つかりません'}`);
      } else {
        // 通常のMongoose処理
        user = await User.findById(req.user._id).lean();
        logger.debug(`[Submit] ユーザー検索 (req.user): ${user ? '見つかりました' : '見つかりません'}`);
      }
    }
    
    // 結果の保存
    let savedResult = null;
    if (user) {
      if (isMongoMock()) {
        // モック環境での保存処理
        const mockResultData = {
          _id: `result_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          userId: user._id.toString(),
          username: user.username,
          grade: user.grade,
          difficulty: difficulty,
          date: date,
          correctAnswers: correctCount,
          incorrectAnswers: incorrectCount,
          unanswered: unansweredCount,
          totalProblems: problems.length,
          totalTime: finalTimeSpentMs,
          timeSpent: Math.round((finalTimeSpentMs / 1000) * 100) / 100, // 秒に変換（小数点以下2桁まで保持）
          problems: problemResults,
          startTime: calculatedStartTime,
          endTime: calculatedEndTime,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        
        // 既存の結果を更新または新規追加
        const mockResults = getMockResults();
        const existingIndex = mockResults.findIndex(r => 
          r.userId === user._id.toString() && r.date === date && r.difficulty === difficulty
        );
        
        if (existingIndex !== -1) {
          // 既存を更新 - 直接更新ではなく要素を置換
          Object.assign(mockResults[existingIndex], mockResultData);
          savedResult = mockResults[existingIndex];
          logger.info(`[Submit] モック結果を更新: userId=${user._id}, date=${date}`);
        } else {
          // 新規追加
          savedResult = addMockResult(mockResultData);
          logger.info(`[Submit] モック結果を新規追加: userId=${user._id}, date=${date}`);
        }
        
        logger.debug(`[Submit] モック保存完了:`, {
          id: savedResult._id,
          userId: savedResult.userId,
          difficulty: savedResult.difficulty,
          correctAnswers: savedResult.correctAnswers,
          totalProblems: savedResult.totalProblems
        });
      } else {
        // 通常のMongoose処理
        const query = {
          userId: user._id,
          date: date,
          difficulty: difficulty,
        };

        logger.debug(`[Submit] 結果保存開始: query=${JSON.stringify(query)}`);
        logger.debug(`[Submit] 保存データ概要: correct=${correctCount}/${problems.length}`);
        logger.debug(`[Submit] 保存するresultsData:`, resultsData);

        // ユーザーID、日付で検索し、該当があれば更新、なければ新規作成 (upsert)
        savedResult = await Result.findOneAndUpdate(
          query, 
          { 
            $set: { 
              username: user.username,
              grade: user.grade, // ユーザー学年も保存
              difficulty: difficulty, // ★ 最後に挑戦した難易度を保存
              ...resultsData
            }
          }, 
          { 
            upsert: true, 
            new: true,    
            setDefaultsOnInsert: true 
          }
        );
        
        logger.info(`[Submit] 結果を保存/更新しました: ID=${savedResult._id}, Date=${savedResult.date}`);
        logger.debug(`[Submit] 保存された結果詳細:`, {
          id: savedResult._id,
          userId: savedResult.userId,
          username: savedResult.username,
          date: savedResult.date,
          difficulty: savedResult.difficulty,
          correctAnswers: savedResult.correctAnswers,
          totalProblems: savedResult.totalProblems
        });
      }
      
      // ランキング情報の取得を試みる
      try {
        const rank = await getRankForResult(savedResult);
        resultsData.rank = rank;
        logger.debug(`[Submit] ランキング計算: ${rank}位`);
      } catch (rankErr) {
        logger.error('[Submit] ランキング計算エラー:', rankErr);
        // ランキング計算エラーは無視して処理を続行
      }
    } else {
      logger.error(`[Submit] ユーザー情報が見つかりません: userId=${userId}`);
    }
    
    logger.info(`[Submit] 処理完了: userId=${userId}, correct=${correctCount}/${problems.length}, time=${timeSpentMs}ms`);
    
    // 成功レスポンス - フロントエンドが期待する形式に合わせる
    return res.json({
      success: true,
      message: '回答を送信しました！',
      results: resultsData, // フロントエンドが期待するresultsフィールドを追加
      correctAnswers: correctCount,
      totalProblems: problems.length,
      timeSpent: timeSpentMs,
      resultId: savedResult?._id || null,
      rank: resultsData.rank || null
    });
    
  } catch (error) {
    logger.error('[Submit] Error:', error);
    res.status(500).json({ 
      success: false, 
      message: '回答の処理中にエラーが発生しました',
      error: error.message
    });
  }
};

// @desc    ユーザーの回答履歴を取得
// @route   GET /api/problems/history または GET /api/history
// @access  Private (ユーザー自身または管理者)
export const getHistory = async (req, res) => {
  // ユーザーIDの取得（クエリパラメータまたは認証済みユーザー）
  let targetUserId = req.query.userId;
  if (!targetUserId && req.user) {
    targetUserId = req.user._id.toString();
  }

  logger.debug(`[getHistory] リクエスト開始: targetUserId=${targetUserId}, req.user.isAdmin=${req.user?.isAdmin}`);

  // 管理者でない場合、自分の履歴のみ取得可能
  if (!req.user.isAdmin && targetUserId !== req.user._id.toString()) {
    logger.warn(`[getHistory] アクセス権限エラー: user=${req.user._id}, requested=${targetUserId}`);
    return res.status(403).json({ success: false, message: '他のユーザーの履歴へのアクセス権がありません。' });
  }

  if (!targetUserId) {
    logger.error('[getHistory] ユーザーIDが指定されていません');
    return res.status(400).json({ success: false, message: 'ユーザーIDが必要です。' });
  }

  try {
    logger.debug(`[getHistory] 履歴データ検索開始: userId=${targetUserId}`);
    
    // 履歴データの取得（日付順で新しいものから）
    let historyResults;
    if (isMongoMock()) {
      // モック環境での履歴取得
      const mockResults = getMockResults();
      historyResults = mockResults
        .filter(result => result.userId === targetUserId)
        .sort((a, b) => {
          // 日付順（新しいものから）
          if (a.date !== b.date) {
            return new Date(b.date) - new Date(a.date);
          }
          // 作成日時順（新しいものから）
          return new Date(b.createdAt) - new Date(a.createdAt);
        });
      logger.debug(`[getHistory] モック履歴検索完了: ${historyResults.length}件`);
    } else {
      // 通常のMongoose環境での取得を試行
      try {
        historyResults = await Result.find({ userId: targetUserId })
          .sort({ date: -1, createdAt: -1 })
          .populate('userId', 'username grade')
          .lean();
      } catch (populateError) {
        // populateが使えない場合の代替処理
        logger.warn('[getHistory] populateエラー、代替処理に切り替え:', populateError.message);
        
        historyResults = await Result.find({ userId: targetUserId })
          .sort({ date: -1, createdAt: -1 })
          .lean();
      }
    }

    logger.info(`[getHistory] 取得された履歴件数: ${historyResults.length}件`);
    
    if (historyResults.length > 0) {
      logger.debug(`[getHistory] 最初の履歴データ:`, {
        id: historyResults[0]._id,
        date: historyResults[0].date,
        difficulty: historyResults[0].difficulty,
        score: historyResults[0].score,
        hasUserData: !!historyResults[0].userId
      });
    }

    // フロントエンド用にデータを整形
    const formattedHistory = historyResults.map((result, index) => ({
      _id: result._id,
      date: result.date,
      difficulty: result.difficulty,
      username: result.userId?.username || result.username || req.user.username || '不明',
      grade: result.userId?.grade || result.grade || req.user.grade,
      totalProblems: result.totalProblems || 10,
      correctAnswers: result.correctAnswers || 0,
      incorrectAnswers: result.incorrectAnswers || 0,
      unanswered: result.unanswered || 0,
      timeSpent: result.timeSpent || 0,
      totalTime: result.totalTime || (result.timeSpent ? result.timeSpent * 1000 : 0),
      timestamp: result.createdAt || result.timestamp,
      rank: result.rank || null,
      problems: result.problems || []
    }));

    logger.debug(`[getHistory] 整形後の履歴データ例:`, formattedHistory[0] || 'なし');

    res.json({
      success: true,
      count: formattedHistory.length,
      data: formattedHistory
    });

  } catch (error) {
    logger.error('[getHistory] 履歴取得エラー:', error);
    res.status(500).json({ 
      success: false, 
      message: '履歴の取得に失敗しました。',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
