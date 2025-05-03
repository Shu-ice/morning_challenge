const Record = require('../models/recordModel');
const User = require('../models/userModel');

// 問題生成の関数（フロントエンドの実装と同様のロジック）
const generateProblems = (grade) => {
  const problems = [];
  const problemCount = 10;
  
  for (let i = 0; i < problemCount; i++) {
    let problem;
    
    switch(parseInt(grade)) {
      case 1:
        // 1年生: 10以下の加算
        problem = generateAdditionProblem(10);
        break;
      case 2:
        // 2年生: 20以下の加減算
        problem = Math.random() > 0.5 
          ? generateAdditionProblem(20) 
          : generateSubtractionProblem(20);
        break;
      case 3:
        // 3年生: 100以下の加減算、かんたんな掛け算
        if (Math.random() > 0.7) {
          problem = generateMultiplicationProblem(10);
        } else {
          problem = Math.random() > 0.5 
            ? generateAdditionProblem(100) 
            : generateSubtractionProblem(100);
        }
        break;
      case 4:
        // 4年生: 3桁の加減算、掛け算、簡単な割り算
        const randOp4 = Math.random();
        if (randOp4 > 0.7) {
          problem = generateMultiplicationProblem(12);
        } else if (randOp4 > 0.4) {
          problem = generateDivisionProblem();
        } else {
          problem = Math.random() > 0.5 
            ? generateAdditionProblem(1000) 
            : generateSubtractionProblem(1000);
        }
        break;
      case 5:
      case 6:
        // 5-6年生: 4桁の加減算、2桁同士の掛け算、割り算
        const randOp56 = Math.random();
        if (randOp56 > 0.7) {
          problem = generateMultiplicationProblem(grade === 5 ? 20 : 100);
        } else if (randOp56 > 0.4) {
          problem = generateDivisionProblem(grade === 5 ? 20 : 100);
        } else {
          problem = Math.random() > 0.5 
            ? generateAdditionProblem(10000) 
            : generateSubtractionProblem(10000);
        }
        break;
      default:
        problem = generateAdditionProblem(10);
    }
    
    problems.push({
      id: i + 1,
      ...problem
    });
  }
  
  return problems;
};

const generateAdditionProblem = (max) => {
  const a = Math.floor(Math.random() * max) + 1;
  const b = Math.floor(Math.random() * max) + 1;
  return {
    question: `${a} + ${b} = ?`,
    answer: a + b,
    type: 'addition'
  };
};

const generateSubtractionProblem = (max) => {
  const a = Math.floor(Math.random() * max) + 1;
  const b = Math.floor(Math.random() * a) + 1; // 負の数を避ける
  return {
    question: `${a} - ${b} = ?`,
    answer: a - b,
    type: 'subtraction'
  };
};

const generateMultiplicationProblem = (max) => {
  const a = Math.floor(Math.random() * max) + 1;
  const b = Math.floor(Math.random() * 10) + 1;
  return {
    question: `${a} × ${b} = ?`,
    answer: a * b,
    type: 'multiplication'
  };
};

const generateDivisionProblem = (max = 10) => {
  const b = Math.floor(Math.random() * 9) + 2; // 2-10の除数
  const a = b * (Math.floor(Math.random() * max) + 1); // 割り切れる数値を確保
  return {
    question: `${a} ÷ ${b} = ?`,
    answer: a / b,
    type: 'division'
  };
};

// @desc    問題の生成
// @route   GET /api/problems
// @access  Private
const getProblems = (req, res) => {
  try {
    // 時間制限チェックをスキップするオプション（開発モード用）
    const skipTimeCheck = req.query.skipTimeCheck === 'true';
    
    // 現在時刻をチェック（日本時間）
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const currentTime = hours + minutes/60;
    
    // 時間制限チェック: 朝6:30-8:00のみ利用可能
    if (!skipTimeCheck && (currentTime < 6.5 || currentTime > 8.0)) {
      return res.status(403).json({ 
        success: false, 
        message: '問題は朝6:30から8:00の間のみ利用可能です。' 
      });
    }
    
    // クエリパラメータからgradeを取得、またはユーザーのgradeを使用
    const grade = req.query.grade || req.user.grade;
    
    // 問題を生成
    const problems = generateProblems(grade);
    
    // 回答を除外したデータを返す（クライアント側で答えが見えないように）
    const clientProblems = problems.map(({ answer, ...rest }) => rest);
    
    // セッションに問題と答えを保存
    req.session = req.session || {};
    req.session.problems = problems;
    
    res.json({
      success: true,
      grade: parseInt(grade),
      problems: clientProblems
    });
  } catch (error) {
    console.error('問題取得エラー:', error);
    res.status(500).json({ 
      success: false, 
      message: 'サーバーエラーが発生しました。' 
    });
  }
};

// @desc    問題の解答提出と結果保存
// @route   POST /api/problems/submit
// @access  Private
const submitAnswers = async (req, res) => {
  try {
    const { answers, timeSpent, grade } = req.body;
    
    if (!answers || !Array.isArray(answers)) {
      return res.status(400).json({ 
        success: false, 
        message: '有効な回答が提供されていません。' 
      });
    }
    
    // セッションから正解を取得
    const storedProblems = req.session?.problems;
    
    let correctCount = 0;
    let totalScore = 0;
    
    if (storedProblems && storedProblems.length > 0) {
      // セッションの問題と照合
      answers.forEach((answer, index) => {
        if (index < storedProblems.length && 
            parseInt(answer) === storedProblems[index].answer) {
          correctCount++;
        }
      });
    } else {
      // セッションが存在しない場合、クライアント側で答え合わせ
      correctCount = req.body.correctCount || 0;
    }
    
    // スコア計算 (正解数 * 10ポイント - 時間による減点)
    const timeDeduction = Math.floor(timeSpent / 10);
    totalScore = Math.max(0, (correctCount * 10) - timeDeduction);
    
    // ユーザーレコードを保存
    if (req.user && req.user._id) {
      // ユーザーのレコードを作成
      const newRecord = new Record({
        user: req.user._id,
        grade: parseInt(grade),
        score: totalScore,
        correctAnswers: correctCount,
        totalProblems: answers.length,
        timeSpent: timeSpent
      });
      
      await newRecord.save();
      
      // ユーザーのポイントを更新
      await User.findByIdAndUpdate(
        req.user._id,
        { 
          $inc: { points: totalScore },
          $push: { 
            records: {
              date: new Date(),
              score: totalScore,
              correctAnswers: correctCount,
              timeSpent: timeSpent,
              grade: parseInt(grade)
            } 
          }
        }
      );
      
      // 連続ログイン更新
      const user = await User.findById(req.user._id);
      await user.updateStreak();
    }
    
    res.json({
      success: true,
      score: totalScore,
      correctAnswers: correctCount,
      totalProblems: answers.length,
      timeSpent
    });
  } catch (error) {
    console.error('回答提出エラー:', error);
    res.status(500).json({ 
      success: false, 
      message: 'サーバーエラーが発生しました。' 
    });
  }
};

// @desc    ユーザーの記録履歴取得
// @route   GET /api/problems/history
// @access  Private
const getHistory = async (req, res) => {
  try {
    const userId = req.user._id;
    
    // ユーザーの履歴を取得
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'ユーザーが見つかりません。'
      });
    }
    
    // 詳細な履歴を取得
    const records = await Record.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(30); // 直近30件
    
    res.json({
      success: true,
      history: records,
      streak: user.streak,
      points: user.points
    });
  } catch (error) {
    console.error('履歴取得エラー:', error);
    res.status(500).json({ 
      success: false, 
      message: 'サーバーエラーが発生しました。' 
    });
  }
};

module.exports = {
  getProblems,
  submitAnswers,
  getHistory
};
