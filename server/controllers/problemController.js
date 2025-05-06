const Record = require('../models/recordModel');
const User = require('../models/userModel');
const Result = require('../models/resultModel');

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
    // クエリパラメータを取得
    const { difficulty, date, skipTimeCheck, userId } = req.query;
    
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
      // リクエストパラメータにuserIdがない場合、認証済みユーザーのIDを使用
      userId = req.user._id;
    }
    
    // 日付パラメータの処理
    const targetDate = date || new Date().toISOString().split('T')[0]; // YYYY-MM-DD形式
    
    // 難易度または学年に基づいて問題を生成
    let problems;
    
    if (difficulty) {
      // 難易度指定がある場合（'beginner', 'intermediate'など）
      if (!['beginner', 'intermediate', 'advanced', 'expert'].includes(difficulty)) {
        return res.status(400).json({
          success: false,
          message: '無効な難易度パラメータです。'
        });
      }
      
      // DBから問題を取得する処理を実装すべきですが、
      // 一時的にダミーデータを生成
      problems = Array(10).fill().map((_, i) => ({
        id: i + 1,
        question: `サンプル問題 ${i+1} (${difficulty})`,
        type: 'mixed'
      }));
    } else {
      // 従来のgradeパラメータを使用
      const grade = req.query.grade || (req.user && req.user.grade ? req.user.grade : 1);
    
    // 問題を生成
      problems = generateProblems(grade);
    
      // 回答を除外したデータを返す
      problems = problems.map(({ answer, ...rest }) => rest);
    }
    
    // セッションに問題と答えを保存
    req.session = req.session || {};
    req.session.problems = problems;
    
    res.json({
      success: true,
      difficulty: difficulty,
      date: targetDate,
      problems: problems
    });
  } catch (error) {
    console.error('問題取得エラー:', error);
    res.status(500).json({ 
      success: false, 
      message: 'サーバーエラーが発生しました。' 
    });
  }
};

// @desc    問題回答の提出
// @route   POST /api/problems/submit
// @access  Private
const submitAnswers = async (req, res) => {
  const { difficulty, date, answers, timeSpent, userId } = req.body;
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
    const problemSet = await getProblemSetForDate({ date, difficulty });
    
    if (!problemSet || !problemSet.problems || problemSet.problems.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: `指定された日付と難易度の問題が見つかりません: ${date} (${difficulty})` 
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
        timeSpent: timeSpent / problems.length // 各問題の平均時間（仮定）
      });
    }
    
    // スコア計算
    const score = calculateScore(correctCount, problems.length, timeSpent, difficulty);
    
    // 保存するための結果データを構築
    const resultsData = {
      totalProblems: problems.length,
        correctAnswers: correctCount,
      incorrectAnswers: incorrectCount,
      unanswered: unansweredCount,
      totalTime: timeSpent * 1000, // ミリ秒に変換
      timeSpent: timeSpent,
      problems: problemResults,
      score: score,
      difficulty: difficulty,
      date: date
    };
      
    // ユーザー情報の取得
    let user = null;
    if (userId) {
      user = await User.findById(userId).lean();
      console.log(`[Submit] ユーザー検索 (ID): ${user ? '見つかりました' : '見つかりません'}`);
    }
    
    // 結果の保存
    if (user) {
      // ユーザーIDを使用して結果を保存
      const savedResult = await Result.create({
        userId: user._id,
        username: user.username,
        difficulty,
        date,
        ...resultsData
      });
      console.log(`[Submit] 結果を保存しました: ID=${savedResult._id}`);
      
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
