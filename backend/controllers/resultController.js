import Result from '../models/Result.js';
import Problem from '../models/Problem.js';
import User from '../models/User.js';
import History from '../models/History.js';

/**
 * @desc    問題の解答結果を保存
 * @route   POST /api/results
 * @access  Private (auth + timeWindow)
 */
export const saveResult = async (req, res) => {
  // ★★★ req.user の内容を詳細にログ出力 ★★★
  // console.log('[saveResult] req.user details:', JSON.stringify(req.user, null, 2));
  // console.log('[saveResult] req.user?.id:', req.user?.id);
  // console.log('[saveResult] req.user?._id:', req.user?._id);
  // console.log('[saveResult] req.user?.username:', req.user?.username);

  try {
    const {
      problemIds,
      answers,
      timeSpentMs,
      difficulty,
      date
    } = req.body;
    
    const userId = req.user?._id || req.user?.id;
    const username = req.user?.username;

    if (!userId || !username) {
      console.error('[saveResult] Failed to get userId or username from req.user:', req.user);
      return res.status(500).json({
        success: false,
        error: 'ユーザー情報の取得に失敗しました。結果を保存できません。'
      });
    }
    
    if (!problemIds || !Array.isArray(problemIds) || !answers || !Array.isArray(answers) || problemIds.length !== answers.length) {
      return res.status(400).json({
        success: false,
        error: '問題IDリストと解答リストの形式が無効か、数が一致しません。'
      });
    }

    // ★★★ 既存の結果チェックを変更: difficulty も条件に含める ★★★
    const specificDifficulty = difficulty.toLowerCase(); // 保存する難易度
    const existingResultForDate = await Result.findOne({ userId, date }); // まずその日の結果があるか確認
    const existingResultForSpecificDifficulty = await Result.findOne({ userId, date, difficulty: specificDifficulty }); // ★ 特定の難易度の結果を探す

    if (existingResultForDate) { // その日に何らかの結果が既にある場合
      if (req.user.isAdmin === true) {
        console.log(`[saveResult] Admin override check: User ${userId}, Date ${date}, Attempting Difficulty ${specificDifficulty}`);
        // ★ 特定の難易度の既存結果があれば削除する
        if (existingResultForSpecificDifficulty) {
          console.log(`[saveResult] Admin override: Deleting existing result for difficulty ${specificDifficulty}`);
          await Result.findByIdAndDelete(existingResultForSpecificDifficulty._id);
          // ★ 履歴も difficulty を含めて削除
          console.log(`[saveResult] Admin override: Attempting to delete history for difficulty ${specificDifficulty}`);
          const deletedHistory = await History.findOneAndDelete({ user: userId, date, difficulty: specificDifficulty });
          if (deletedHistory) {
             console.log(`[saveResult] Admin override: Successfully deleted history ID: ${deletedHistory._id}`);
          } else {
             console.log(`[saveResult] Admin override: No specific history found to delete for difficulty ${specificDifficulty}`);
          }
        } else {
           console.log(`[saveResult] Admin override: No existing result found for specific difficulty ${specificDifficulty}, proceeding to create.`);
        }
        // ★★★ 管理者の場合は、ここで return せずに下の Result.create に進む ★★★
      } else {
        // 一般ユーザーで既に何らかの結果がある場合 (難易度問わず)
        console.log(`[saveResult] Result already exists for user ${userId}, date ${date}. Skipping creation.`);
        return res.status(200).json({
          success: true, 
          alreadyExists: true,
          message: '本日は既に参加済みです。', // 修正済み
          data: { // 既存の結果データ (最初に見つかったもの) を返す
            id: existingResultForDate._id, 
            totalProblems: existingResultForDate.totalProblems,
            correctAnswers: existingResultForDate.correctAnswers,
            incorrectAnswers: existingResultForDate.incorrectAnswers,
            unanswered: existingResultForDate.unanswered,
            totalTime: existingResultForDate.totalTime,
            score: existingResultForDate.score,
            date: existingResultForDate.date,
            difficulty: existingResultForDate.difficulty
          }
        });
      }
    } // ★★★ 既存チェックの if ブロック終了 ★★★
    
    const dbProblems = await Problem.find({ _id: { $in: problemIds } }).lean();
    if (dbProblems.length !== problemIds.length) {
      return res.status(400).json({
        success: false,
        error: '一部の問題IDが無効です。データベースに存在しません。'
      });
    }

    const problemMap = new Map(dbProblems.map(p => [p._id.toString(), p]));

    let correctAnswersCount = 0;
    let unansweredCount = 0;
    const problemResults = [];

    for (let i = 0; i < problemIds.length; i++) {
      const problemId = problemIds[i];
      const userAnswerString = answers[i];
      const dbProblem = problemMap.get(problemId);

      if (!dbProblem) {
        problemResults.push({
          problem: problemId,
          userAnswer: userAnswerString,
          isCorrect: false,
          error: 'Problem not found in DB after initial check'
        });
        if (userAnswerString === '' || userAnswerString === null || userAnswerString === undefined) {
            unansweredCount++;
        }
        continue;
      }

      let isCorrect = false;
      if (userAnswerString === '' || userAnswerString === null || userAnswerString === undefined) {
        unansweredCount++;
      } else {
        isCorrect = dbProblem.answer === Number(userAnswerString);
        if (isCorrect) {
          correctAnswersCount++;
        }
      }
      
      problemResults.push({
        problem: dbProblem._id,
        userAnswer: userAnswerString === '' || userAnswerString === null || userAnswerString === undefined ? null : Number(userAnswerString),
        isCorrect,
      });
    }
    
    const totalProblems = problemIds.length;
    const incorrectAnswersCount = totalProblems - correctAnswersCount - unansweredCount;
    const calculatedScore = correctAnswersCount * 10;
    const timeSpentSeconds = Math.round(timeSpentMs / 1000);

    const result = await Result.create({
      userId: userId,
      username: username,
      problems: problemResults,
      totalProblems,
      correctAnswers: correctAnswersCount,
      incorrectAnswers: incorrectAnswersCount,
      unanswered: unansweredCount,
      totalTime: timeSpentMs,
      timeSpent: timeSpentSeconds,
      score: calculatedScore,
      difficulty: difficulty.toLowerCase(),
      date: date,
    });
    
    try {
      await History.create({
        user: userId,
        username: username,
        difficulty: difficulty.toLowerCase(),
        totalProblems,
        correctAnswers: correctAnswersCount,
        incorrectAnswers: incorrectAnswersCount,
        unanswered: unansweredCount,
        score: calculatedScore,
        timeSpent: timeSpentSeconds,
        date,
        problems: problemResults.map((pr, index) => {
          const dbProblem = problemMap.get(problemIds[index]);
          return {
            problem: dbProblem?.question || '問題不明',
            userAnswer: pr.userAnswer,
            correctAnswer: dbProblem?.answer?.toString() || '正解不明',
            isCorrect: pr.isCorrect
          };
        })
      });
      console.log('解答履歴が保存されました。');
    } catch (historyError) {
      console.error('履歴保存エラー:', historyError);
    }
    
    const pointsEarned = Math.floor(calculatedScore / 10);
    const userDoc = await User.findById(userId);
    if (userDoc) {
        userDoc.points = (userDoc.points || 0) + pointsEarned;
        await userDoc.save();
    } else {
        console.error(`User not found for point update: ${userId}`);
    }
    
    res.status(201).json({
      success: true,
      pointsEarned,
      data: {
        id: result._id,
        totalProblems: result.totalProblems,
        correctAnswers: result.correctAnswers,
        incorrectAnswers: result.incorrectAnswers,
        unanswered: result.unanswered,
        totalTime: result.totalTime,
        score: result.score,
        date: result.date,
        difficulty: result.difficulty,
        problems: problemResults.map((pr, index) => {
          const dbProblem = problemMap.get(problemIds[index]);
          return {
            problemId: dbProblem?._id || problemIds[index],
            question: dbProblem?.question || '問題不明',
            userAnswer: pr.userAnswer,
            correctAnswer: dbProblem?.answer,
            isCorrect: pr.isCorrect
          };
        })
      }
    });
  } catch (error) {
    console.error('結果保存エラー:', error);
    res.status(500).json({
      success: false,
      error: '結果の保存中にエラーが発生しました'
    });
  }
};

/**
 * @desc    ユーザーの結果履歴を取得
 * @route   GET /api/results
 * @access  Private (auth)
 */
export const getUserResults = async (req, res) => {
  try {
    // 最新の結果から順に取得
    const results = await Result.find({ user: req.user.id })
      .sort({ date: -1 })
      .limit(10);
    
    res.status(200).json({
      success: true,
      count: results.length,
      data: results.map(result => ({
        id: result._id,
        totalProblems: result.totalProblems,
        correctAnswers: result.correctAnswers,
        score: result.score,
        totalTime: result.totalTime,
        grade: result.grade,
        date: result.date
      }))
    });
  } catch (error) {
    console.error('結果取得エラー:', error);
    res.status(500).json({
      success: false,
      error: '結果の取得中にエラーが発生しました'
    });
  }
};

/**
 * @desc    結果の詳細を取得
 * @route   GET /api/results/:id
 * @access  Private (auth)
 */
export const getResultDetail = async (req, res) => {
  try {
    const result = await Result.findById(req.params.id)
      .populate('problems.problem', 'question answer type difficulty');
    
    if (!result) {
      return res.status(404).json({
        success: false,
        error: '結果が見つかりません'
      });
    }
    
    // 自分の結果かどうかを確認
    if (result.user.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'この結果にアクセスする権限がありません'
      });
    }
    
    // 問題と解答の詳細を含めて返す
    const problems = result.problems.map(p => ({
      id: p.problem._id,
      question: p.problem.question,
      correctAnswer: p.problem.answer,
      userAnswer: p.userAnswer,
      isCorrect: p.isCorrect,
      timeSpent: p.timeSpent,
      type: p.problem.type,
      difficulty: p.problem.difficulty
    }));
    
    res.status(200).json({
      success: true,
      data: {
        id: result._id,
        totalProblems: result.totalProblems,
        correctAnswers: result.correctAnswers,
        score: result.score,
        totalTime: result.totalTime,
        grade: result.grade,
        date: result.date,
        problems
      }
    });
  } catch (error) {
    console.error('結果詳細取得エラー:', error);
    res.status(500).json({
      success: false,
      error: '結果詳細の取得中にエラーが発生しました'
    });
  }
};

/**
 * @desc    今日の結果を確認
 * @route   GET /api/results/today
 * @access  Private (auth)
 */
export const getTodayResult = async (req, res) => {
  try {
    // 今日の日付範囲を設定
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // 今日の結果を検索
    const result = await Result.findOne({
      user: req.user.id,
      date: { $gte: today, $lt: tomorrow }
    });
    
    if (!result) {
      return res.status(200).json({
        success: true,
        exists: false
      });
    }
    
    res.status(200).json({
      success: true,
      exists: true,
      data: {
        id: result._id,
        totalProblems: result.totalProblems,
        correctAnswers: result.correctAnswers,
        score: result.score,
        totalTime: result.totalTime,
        grade: result.grade,
        date: result.date
      }
    });
  } catch (error) {
    console.error('今日の結果確認エラー:', error);
    res.status(500).json({
      success: false,
      error: '今日の結果確認中にエラーが発生しました'
    });
  }
};