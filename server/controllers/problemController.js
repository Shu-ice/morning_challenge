import User from '../models/User.js';
import Result from '../models/Result.js';
import DailyProblemSet from '../models/DailyProblemSet.js';
import { DifficultyRank } from '../constants/difficultyRank.js';
import { calculateScore } from '../utils/problemScoring.js';
import { getRankForResult } from '../utils/ranking.js';
import { generateProblems } from '../utils/problemGenerator.js';
import dayjs from 'dayjs';
import { v4 as uuidv4 } from 'uuid';

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
    
    // 時間制限チェックをスキップするオプション（開発モード用）
    const shouldSkipTimeCheck = skipTimeCheck === 'true' || (req.user && req.user.isAdmin);
    
    // 現在時刻をチェック（日本時間）
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const currentTime = hours + minutes/60;
    
    // 時間制限チェック: 朝6:30-8:00のみ利用可能
    if (!shouldSkipTimeCheck && (currentTime < 6.5 || currentTime > 8.0)) {
      return res.status(403).json({ 
        success: false, 
        message: '問題は朝6:30から8:00の間のみ利用可能です。' 
      });
    }
    
    // userIdの検証
    if (!userId && req.user && req.user._id) {
      userId = req.user._id.toString(); // ObjectIdを文字列に変換
    }
    
    const targetDate = date || new Date().toISOString().split('T')[0];
    
      if (!['beginner', 'intermediate', 'advanced', 'expert'].includes(difficulty)) {
        return res.status(400).json({
          success: false,
          message: '無効な難易度パラメータです。'
        });
      }
      
    const problemSet = await DailyProblemSet.findOne({ date: targetDate, difficulty: difficulty });

    if (!problemSet || !problemSet.problems || problemSet.problems.length === 0) {
      console.warn(`[getProblems] No problem set found for ${targetDate} (${difficulty}). Returning 404.`);
      return res.status(404).json({
        success: false,
        message: `指定された日付・難易度の問題が見つかりません: ${targetDate} (${difficulty})`,
        problems: []
      });
    }

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
    console.error('問題取得エラー:', error);
    res.status(500).json({ 
      success: false, 
      message: 'サーバーエラーが発生しました。' 
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
    const problemSet = await DailyProblemSet.findOne({ date, difficulty });

    if (!problemSet) {
      return res.status(404).json({
        success: false,
        message: '指定された問題セットが見つかりません。'
      });
    }

    // 問題セット全体を返す (編集に必要なすべての情報を含むことを想定)
    res.json({
      success: true,
      data: problemSet.problems // 問題配列を返す
    });

  } catch (error) {
    console.error('問題セット編集用取得エラー:', error);
    res.status(500).json({ 
      success: false, 
      message: 'サーバーエラーが発生しました。' 
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
      message: '日付と難易度を指定してください。'
    });
  }

  try {
    // 既存の問題セットをチェック
    const existingProblemSet = await DailyProblemSet.findOne({ date, difficulty });
    
    if (existingProblemSet && !force) {
      return res.status(409).json({
        success: false,
        message: '指定された日付・難易度の問題セットは既に存在します。上書きする場合は force オプションを使用してください。'
      });
    }

    // 問題を生成
    const requestId = uuidv4();
    console.log(`[generateProblemSet] 問題生成開始: ${date}, ${difficulty}, ${count}問`);
    
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
      // 既存のものを更新
      existingProblemSet.problems = problemsForDB;
      existingProblemSet.updatedAt = new Date();
      await existingProblemSet.save();
    } else {
      // 新規作成
      const newProblemSet = new DailyProblemSet({
        date,
        difficulty,
        problems: problemsForDB,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      await newProblemSet.save();
    }

    res.json({
      success: true,
      message: `${problemsForDB.length}問の問題を生成し、データベースに保存しました。`,
      data: {
        date,
        difficulty,
        count: problemsForDB.length,
        requestId
      }
    });

  } catch (error) {
    console.error('問題生成エラー:', error);
    res.status(500).json({ 
      success: false, 
      message: 'サーバーエラーが発生しました。',
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
        message: '指定された問題セットが見つかりません。'
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
    console.error('問題編集保存エラー:', error);
    res.status(500).json({ 
      success: false, 
      message: 'サーバーエラーが発生しました。',
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
    console.error('進捗状況確認エラー:', error);
    res.status(500).json({ 
      success: false, 
      message: 'サーバーエラーが発生しました。',
      error: error.message
    });
  }
};

// @desc    問題回答の提出
// @route   POST /api/problems/submit
// @access  Private
export const submitAnswers = async (req, res) => {
  const { difficulty, date, answers, timeSpentMs, userId } = req.body;
  // 基本的なデータ検証
  if (!difficulty || !answers || !Array.isArray(answers)) {
      return res.status(400).json({ 
      success: false, 
      message: '有効な難易度と回答が必要です' 
    });
  }

  try {
    // 該当日の問題セット取得
    console.log(`[Submit] 問題セット取得: date=${date}, difficulty=${difficulty}`);
    
    // 問題セットを取得（DB連携またはモック）
    const problemSet = await DailyProblemSet.findOne({ date, difficulty });
    
    // ★ デバッグログ: 取得した問題セットとanswersの長さを確認
    console.log(`[Submit Controller] Date: ${date}, Difficulty: ${difficulty}`);
    if (problemSet && problemSet.problems) {
      console.log(`[Submit Controller] Expected problems count from DB: ${problemSet.problems.length}`);
    } else {
      console.log(`[Submit Controller] Problem set not found in DB for date: ${date}, difficulty: ${difficulty}`);
    }
    console.log(`[Submit Controller] Received answers count: ${answers ? answers.length : 'N/A'}`);
    // ★ デバッグログここまで

    if (!problemSet || !problemSet.problems || problemSet.problems.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: `指定された日付と難易度の問題が見つかりません: ${date} (${difficulty})` 
      });
    }
    
    // 問題IDリストと解答リストの形式と数を検証
    // DailyProblemSet の problems は correctAnswer を持つので、 problem.id は不要
    if (!Array.isArray(answers) || (problemSet && problemSet.problems && problemSet.problems.length !== answers.length)) {
      console.error(`[Submit Controller] Validation Error: Expected ${problemSet?.problems?.length} problems, but received ${answers?.length} answers.`); // ★ エラー詳細ログ
      return res.status(400).json({
        success: false,
        error: '問題IDリストと解答リストの形式が無効か、数が一致しません。'
      });
    }
    
    // 回答を採点
    const problems = problemSet.problems;
    const problemResults = [];
    let correctCount = 0;
    let incorrectCount = 0;
    let unansweredCount = 0;
    
    // 回答数と問題数が一致しない場合の調整
    const answersArray = answers.slice(0, problems.length);
    while (answersArray.length < problems.length) {
      answersArray.push(null); // 未回答として null を追加
    }
    
    // 各問題の採点
    for (let i = 0; i < problems.length; i++) {
      const correctAnswer = problems[i].correctAnswer;
      const userAnswerStr = answersArray[i];
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
    
    // スコア計算
    const score = calculateScore(correctCount, problems.length, timeSpentMs, difficulty);
    
    // 時間情報の取得と再構築
    const { timeSpentMs: reqTimeSpentMs } = req.body;
    const submissionTime = Date.now(); // 解答受付時刻 (サーバー)
    let calculatedStartTime;
    let calculatedEndTime = submissionTime;
    let finalTimeSpentMs;

    if (typeof reqTimeSpentMs === 'number' && reqTimeSpentMs >= 0) {
        finalTimeSpentMs = reqTimeSpentMs;
        calculatedStartTime = submissionTime - reqTimeSpentMs;
    } else {
        // timeSpentMs が不正な場合は0とする (またはエラー処理)
        finalTimeSpentMs = 0;
        calculatedStartTime = submissionTime;
    }
    
    // 保存するための結果データを構築
    const resultsData = {
      totalProblems: problems.length,
        correctAnswers: correctCount,
      incorrectAnswers: incorrectCount,
      unanswered: unansweredCount,
      totalTime: finalTimeSpentMs, // ミリ秒
      timeSpent: finalTimeSpentMs / 1000, // 秒
      problems: problemResults,
      score: score,
      difficulty: difficulty,
      date: date,
      startTime: calculatedStartTime, // ★ サーバーで計算した開始時刻
      endTime: calculatedEndTime     // ★ サーバーで計算した終了時刻 (解答受付時刻)
    };
      
    // ユーザー情報の取得
    let user = null;
    if (userId) {
      user = await User.findById(userId).lean();
      console.log(`[Submit] ユーザー検索 (ID): ${user ? '見つかりました' : '見つかりません'}`);
    } else if (req.user && req.user._id) {
      user = await User.findById(req.user._id).lean();
      console.log(`[Submit] ユーザー検索 (req.user): ${user ? '見つかりました' : '見つかりません'}`);
    }
    
    // 結果の保存
    if (user) {
      const query = {
        userId: user._id,
        date: date, // resultsData.date と同じはず
      };

      // ユーザーID、日付で検索し、該当があれば更新、なければ新規作成 (upsert)
      const savedResult = await Result.findOneAndUpdate(
        query, 
        { 
          $set: { 
        username: user.username,
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
      console.log(`[Submit] 結果を保存/更新しました (1日1レコード): ID=${savedResult._id}, UpsertedId=${savedResult.upsertedId || 'N/A'}`);
      
      // ランキング情報の取得を試みる
      try {
        const rank = await getRankForResult(savedResult);
        resultsData.rank = rank;
        console.log(`[Submit] ランキング計算: ${rank}位`);
      } catch (rankErr) {
        console.error('[Submit] ランキング計算エラー:', rankErr);
        // ランキング計算エラーは無視して処理を続行
      }
    } else {
      console.log('[Submit] 有効なユーザーが見つからないため、結果を保存しません');
    }
    
    // クライアントに結果を返す
    res.status(200).json({
      success: true,
      message: '回答を正常に送信し、結果を計算しました',
      results: resultsData
    });
    
  } catch (error) {
    console.error('[Submit] Error:', error);
    res.status(500).json({ 
      success: false, 
      message: '回答の処理中にエラーが発生しました',
      error: error.message
    });
  }
};

// @desc    ユーザーの回答履歴を取得
// @route   GET /api/problems/history
// @access  Private (ユーザー自身または管理者)
export const getHistory = async (req, res) => {
  // ユーザーIDの取得（クエリパラメータまたは認証済みユーザー）
  let targetUserId = req.query.userId;
  if (!targetUserId && req.user) {
    targetUserId = req.user._id.toString();
  }

  // 管理者でない場合、自分の履歴のみ取得可能
  if (!req.user.isAdmin && targetUserId !== req.user._id.toString()) {
    return res.status(403).json({ success: false, message: '他のユーザーの履歴へのアクセス権がありません。' });
  }

  if (!targetUserId) {
    return res.status(400).json({ success: false, message: 'ユーザーIDが指定されていません。' });
  }

  try {
    const history = await Result.find({ userId: targetUserId })
                              .sort({ date: -1, createdAt: -1 })
                              .limit(parseInt(req.query.limit) || 50); // .select('-problems') を削除

    if (!history || history.length === 0) {
      res.set('Cache-Control', 'no-store');
      return res.json({ success: true, message: '回答履歴がありません。', data: [] });
    }

    res.set('Cache-Control', 'no-store');
    res.json({ success: true, count: history.length, data: history });
  } catch (error) {
    console.error('履歴取得エラー:', error);
    res.status(500).json({ success: false, message: 'サーバーエラーが発生しました。' });
  }
};
