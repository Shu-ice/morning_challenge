const Problem = require('../models/Problem');
const problemGenerator = require('../utils/problemGenerator');

/**
 * @desc    指定された学年の問題セットを生成して取得
 * @route   GET /api/problems/generate/:grade
 * @access  Private (auth)
 */
exports.generateProblems = async (req, res) => {
  try {
    const { grade } = req.params;
    const gradeNumber = parseInt(grade);
    
    // 学年の範囲チェック
    if (isNaN(gradeNumber) || gradeNumber < 1 || gradeNumber > 6) {
      return res.status(400).json({
        success: false,
        error: '有効な学年（1-6）を指定してください'
      });
    }
    
    // 問題セットの生成
    const problemsData = problemGenerator.generateProblemsForGrade(gradeNumber, 10);
    
    // データベースに問題を保存
    const savedProblems = await Promise.all(
      problemsData.map(async (problem) => {
        const newProblem = await Problem.create({
          question: problem.question,
          answer: problem.answer,
          grade: gradeNumber,
          type: problem.type,
          difficulty: problem.difficulty
        });
        
        return {
          id: newProblem._id,
          question: newProblem.question,
          type: newProblem.type,
          grade: newProblem.grade,
          difficulty: newProblem.difficulty
        };
      })
    );
    
    res.status(200).json({
      success: true,
      count: savedProblems.length,
      data: savedProblems
    });
  } catch (error) {
    console.error('問題生成エラー:', error);
    res.status(500).json({
      success: false,
      error: '問題の生成中にエラーが発生しました'
    });
  }
};

/**
 * @desc    問題の詳細を取得
 * @route   GET /api/problems/:id
 * @access  Private (auth)
 */
exports.getProblem = async (req, res) => {
  try {
    const problem = await Problem.findById(req.params.id);
    
    if (!problem) {
      return res.status(404).json({
        success: false,
        error: '問題が見つかりません'
      });
    }
    
    res.status(200).json({
      success: true,
      data: {
        id: problem._id,
        question: problem.question,
        grade: problem.grade,
        type: problem.type,
        difficulty: problem.difficulty
      }
    });
  } catch (error) {
    console.error('問題取得エラー:', error);
    res.status(500).json({
      success: false,
      error: '問題の取得中にエラーが発生しました'
    });
  }
};

/**
 * @desc    問題の答えを検証する
 * @route   POST /api/problems/check/:id
 * @access  Private (auth)
 */
exports.checkAnswer = async (req, res) => {
  try {
    const { id } = req.params;
    const { answer } = req.body;
    
    if (answer === undefined || answer === null) {
      return res.status(400).json({
        success: false,
        error: '回答が提供されていません'
      });
    }
    
    const problem = await Problem.findById(id);
    
    if (!problem) {
      return res.status(404).json({
        success: false,
        error: '問題が見つかりません'
      });
    }
    
    const isCorrect = problem.answer === Number(answer);
    
    res.status(200).json({
      success: true,
      isCorrect,
      correctAnswer: problem.answer
    });
  } catch (error) {
    console.error('回答検証エラー:', error);
    res.status(500).json({
      success: false,
      error: '回答の検証中にエラーが発生しました'
    });
  }
};

/**
 * @desc    練習用の問題セットを取得（答えも含む）
 * @route   GET /api/problems/practice/:grade
 * @access  Private (auth)
 */
exports.getPracticeProblems = async (req, res) => {
  try {
    const { grade } = req.params;
    const gradeNumber = parseInt(grade);
    
    if (isNaN(gradeNumber) || gradeNumber < 1 || gradeNumber > 6) {
      return res.status(400).json({
        success: false,
        error: '有効な学年（1-6）を指定してください'
      });
    }
    
    // 練習用のため、データベースに保存せずに直接生成
    const problems = problemGenerator.generateProblemsForGrade(gradeNumber, 5);
    
    res.status(200).json({
      success: true,
      count: problems.length,
      data: problems
    });
  } catch (error) {
    console.error('練習問題生成エラー:', error);
    res.status(500).json({
      success: false,
      error: '練習問題の生成中にエラーが発生しました'
    });
  }
};