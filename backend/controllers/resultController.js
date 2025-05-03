const Result = require('../models/Result');
const Problem = require('../models/Problem');
const User = require('../models/User');

/**
 * @desc    問題の解答結果を保存
 * @route   POST /api/results
 * @access  Private (auth + timeWindow)
 */
exports.saveResult = async (req, res) => {
  try {
    const {
      problems,
      totalTime,
      score,
      grade
    } = req.body;
    
    if (!problems || !Array.isArray(problems)) {
      return res.status(400).json({
        success: false,
        error: '問題の解答データが無効です'
      });
    }
    
    // 問題IDの配列を抽出
    const problemIds = problems.map(p => p.problemId);
    
    // 問題の存在チェック
    const dbProblems = await Problem.find({ _id: { $in: problemIds } });
    if (dbProblems.length !== problemIds.length) {
      return res.status(400).json({
        success: false,
        error: '一部の問題IDが無効です'
      });
    }
    
    // 正解数の計算
    const correctAnswers = problems.filter(p => p.isCorrect).length;
    const incorrectAnswers = problems.filter(p => p.userAnswer !== undefined && !p.isCorrect).length;
    const unanswered = problems.length - correctAnswers - incorrectAnswers;
    
    // 結果の保存
    const result = await Result.create({
      user: req.user.id,
      problems: problems.map(p => ({
        problem: p.problemId,
        userAnswer: p.userAnswer,
        isCorrect: p.isCorrect,
        timeSpent: p.timeSpent || 0
      })),
      totalProblems: problems.length,
      correctAnswers,
      totalTime,
      score,
      grade
    });
    
    // ユーザーのポイントを更新
    const pointsEarned = Math.floor(score / 10);
    const user = await User.findById(req.user.id);
    user.points += pointsEarned;
    await user.save();
    
    res.status(201).json({
      success: true,
      pointsEarned,
      data: {
        id: result._id,
        totalProblems: result.totalProblems,
        correctAnswers: result.correctAnswers,
        incorrectAnswers,
        unanswered,
        totalTime: result.totalTime,
        score: result.score,
        date: result.date
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
exports.getUserResults = async (req, res) => {
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
exports.getResultDetail = async (req, res) => {
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
exports.getTodayResult = async (req, res) => {
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