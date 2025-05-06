const Problem = require('../models/Problem');
const problemGenerator = require('../utils/problemGenerator');

// 問題生成リクエストの状態を追跡するためのマップ
const generationRequests = new Map();

/**
 * @desc    指定された学年、難易度、日付の問題セットを生成してDBに保存
 * @route   POST /api/problems/generate (変更: POST にして Body でパラメータを受け取る方が安全かも)
 *          または GET /api/problems/generate?grade=1&difficulty=beginner&date=YYYY-MM-DD
 * @access  Private (Admin Only?)
 */
exports.generateAndSaveProblems = async (req, res) => {
  // パラメータ取得 (クエリ or ボディ から)
  const grade = parseInt(req.query.grade || req.body.grade, 10);
  const difficulty = req.query.difficulty || req.body.difficulty;
  const date = req.query.date || req.body.date;
  const count = parseInt(req.query.count || req.body.count, 10) || 10; // 生成する問題数
  const forceUpdate = req.body.force === true; // 既存の問題を強制的に更新するフラグ

  // パラメータ検証
  if (!grade || grade < 1 || grade > 6) {
    return res.status(400).json({ success: false, error: '有効な学年(1-6)を指定してください。' });
  }
  if (!difficulty || !['beginner', 'intermediate', 'advanced', 'expert'].includes(difficulty)) {
    return res.status(400).json({ success: false, error: '有効な難易度(beginner, intermediate, advanced, expert)を指定してください。' });
  }
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ success: false, error: '日付は YYYY-MM-DD 形式で指定してください。' });
  }

  // Expert難易度の場合は問題数を制限（タイムアウト防止）
  let actualCount = count;
  if (difficulty === 'expert' && count > 10) {
    actualCount = 10;
    console.warn(`Expert難易度では最大10問に制限されています (${count}要求 -> ${actualCount}生成)`);
  }

  try {
    // 指定された日付、難易度、学年の問題が既に存在するかチェック
    const existingProblems = await Problem.countDocuments({ date, difficulty, grade });
    
    if (existingProblems > 0 && !forceUpdate) {
      return res.status(409).json({ // 409 Conflict
        success: false,
        message: `指定された日付(${date})、難易度(${difficulty})、学年(${grade})の問題は既に存在します。`,
        count: existingProblems
      });
    }
    
    // 既存の問題があり、強制更新フラグがある場合は削除する
    if (existingProblems > 0 && forceUpdate) {
      await Problem.deleteMany({ date, difficulty, grade });
      console.log(`既存の問題を削除しました: ${date}, ${difficulty}, 学年${grade}`);
    }
    
    // 各リクエストに一意のIDを割り当てて進捗を追跡できるようにする
    const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // リクエスト情報を記録
    generationRequests.set(requestId, {
      startTime: Date.now(),
      status: 'processing',
      params: { date, difficulty, grade, count: actualCount },
      progress: 0
    });
    
    // 問題セットの生成
    // サーバー側の問題生成関数を使用し、リクエストIDも渡す
    const problemsData = await generateProblemsWithTimeout(difficulty, actualCount, grade, requestId);
    
    // 生成された問題に日付と難易度を付与してDB保存用に整形
    const problemsToSave = problemsData.map(problem => ({
      question: problem.question,
      answer: problem.answer,
      grade: grade,
      type: problem.type || 'mixed', // 明示的に設定されていない場合は 'mixed'
      difficulty: difficulty, 
      date: date
    }));

    // データベースに問題を一括保存
    const savedProblems = await Problem.insertMany(problemsToSave);
    
    // 処理状態を更新
    generationRequests.set(requestId, {
      ...generationRequests.get(requestId),
      status: 'completed',
      endTime: Date.now(),
      count: savedProblems.length
    });
    
    res.status(201).json({
      success: true,
      message: `日付(${date})、難易度(${difficulty})、学年(${grade})の問題を${savedProblems.length}件生成し、保存しました。`,
      count: savedProblems.length,
      requestId
    });

  } catch (error) {
    console.error('問題生成・保存エラー:', error);
    res.status(500).json({
      success: false,
      error: '問題の生成・保存中にエラーが発生しました',
      details: error.message
    });
  }
};

/**
 * タイムアウト付き問題生成関数
 * @param {string} difficulty 難易度
 * @param {number} count 問題数
 * @param {number} grade 学年
 * @param {string} requestId リクエストID
 * @returns {Promise<Array>} 生成された問題のリスト
 */
const generateProblemsWithTimeout = (difficulty, count, grade, requestId) => {
  return new Promise((resolve, reject) => {
    // タイムアウト処理
    const timeoutId = setTimeout(() => {
      // タイムアウト時には部分的な結果があればそれを返す
      const status = problemGenerator.getProcessingStatus(requestId);
      if (status && status.status === 'timeout') {
        console.warn(`問題生成がタイムアウトしました。部分的な結果を返します。(${difficulty}, ${count}問)`);
        
        // 部分的な結果があれば返す
        if (status.problems && status.problems.length > 0) {
          resolve(status.problems);
        } else {
          // フォールバック問題を生成
          const fallbackProblems = generateFallbackProblems(difficulty, Math.min(5, count), grade);
          resolve(fallbackProblems);
        }
      }
    }, 25000); // 25秒タイムアウト
    
    try {
      // 問題生成を実行
      const problems = problemGenerator.generateProblems(difficulty, count, requestId);
      
      clearTimeout(timeoutId); // タイマーをクリア
      
      if (!problems || problems.length === 0) {
        throw new Error('問題生成に失敗しました');
      }
      
      if (problems.length < count) {
        console.warn(`要求された${count}問のうち、${problems.length}問のみ生成されました`);
      }
      
      resolve(problems);
    } catch (error) {
      clearTimeout(timeoutId);
      console.error('問題生成中のエラー:', error);
      reject(error);
    }
  });
};

/**
 * フォールバック問題生成（生成失敗時の代替）
 */
const generateFallbackProblems = (difficulty, count, grade) => {
  const problems = [];
  
  // 簡単な加算問題を作成（必ず成功するように）
  for (let i = 0; i < count; i++) {
    const a = 1 + (i * 2);
    const b = 2 + i;
    
    problems.push({
      question: `${a} + ${b} = ?`,
      answer: a + b,
      type: 'addition'
    });
  }
  
  return problems;
};

/**
 * @desc    問題生成の進捗状況を取得
 * @route   GET /api/problems/status/:requestId
 * @access  Private (auth)
 */
exports.getGenerationStatus = async (req, res) => {
  try {
    const { requestId } = req.params;
    
    if (!requestId || !generationRequests.has(requestId)) {
      return res.status(404).json({
        success: false,
        error: '指定されたリクエストIDが見つかりません'
      });
    }
    
    const requestStatus = generationRequests.get(requestId);
    
    // 処理完了から30分以上経過している古いステータスはクリーンアップ
    const now = Date.now();
    if (requestStatus.endTime && (now - requestStatus.endTime > 30 * 60 * 1000)) {
      generationRequests.delete(requestId);
      return res.status(404).json({
        success: false,
        error: '指定されたリクエストのステータスは期限切れです'
      });
    }
    
    // サーバー側の問題生成モジュールからも状態を取得
    const generatorStatus = problemGenerator.getProcessingStatus(requestId);
    
    // 両方の情報をマージ
    const status = {
      ...requestStatus,
      ...(generatorStatus || {}),
      elapsedTime: now - requestStatus.startTime
    };
    
    res.status(200).json({
      success: true,
      data: status
    });
    
  } catch (error) {
    console.error('状態取得エラー:', error);
    res.status(500).json({
      success: false,
      error: '状態の取得中にエラーが発生しました'
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
    const difficulty = req.query.difficulty || 'beginner';
    const gradeNumber = parseInt(grade);
    const count = parseInt(req.query.count) || 5;
    
    if (isNaN(gradeNumber) || gradeNumber < 1 || gradeNumber > 6) {
      return res.status(400).json({
        success: false,
        error: '有効な学年（1-6）を指定してください'
      });
    }
    
    if (!['beginner', 'intermediate', 'advanced', 'expert'].includes(difficulty)) {
      return res.status(400).json({
        success: false,
        error: '有効な難易度(beginner, intermediate, advanced, expert)を指定してください'
      });
    }
    
    // 練習用のため、データベースに保存せずに直接生成
    // 新しい問題生成関数を使用
    const problems = problemGenerator.generateProblems(difficulty, Math.min(count, 10));
    
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

/**
 * @desc    指定された日付と難易度の問題を取得
 * @route   GET /api/problems?difficulty=beginner&date=YYYY-MM-DD
 * @access  Private
 */
exports.getProblemsByDifficulty = async (req, res) => {
  const { difficulty, date } = req.query;
  const count = parseInt(req.query.count, 10) || 10; // 問題数も考慮する場合

  // パラメータ検証
  if (!difficulty || !date) {
    return res.status(400).json({ 
      success: false, 
      error: '難易度(difficulty)と日付(date)をクエリパラメータで指定してください。'
    });
  }
  // 簡単な日付形式チェック (例: YYYY-MM-DD)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ 
        success: false, 
        error: '日付は YYYY-MM-DD 形式で指定してください。'
      });
  }

  // 認証済みユーザーからIDを取得
  const userId = req.user?._id?.toString() || req.user?.id;
  
  // userIdのログ出力（開発・デバッグ用）
  console.log(`[getProblemsByDifficulty] 問題取得リクエスト: userId=${userId}, difficulty=${difficulty}, date=${date}`);

  try {
    // DBから指定された日付と難易度の問題を取得
    let problems = await Problem.find({
      date: date,
      difficulty: difficulty,
    })
    .limit(count)
    .select('-answer -createdAt') // クライアントには答えと作成日時を返さない
    .lean();

    // 問題が見つからない場合は自動生成して保存
    if (!problems || problems.length === 0) {
      console.log(`[getProblemsByDifficulty] ${date}の${difficulty}難易度の問題が見つからないため自動生成します`);
      
      try {
        // 1. 問題を生成
        const generatedProblems = problemGenerator.generateProblems(difficulty, count);
        console.log(`[getProblemsByDifficulty] ${generatedProblems.length}個の問題を生成しました`);
        
        // 2. メタデータを追加してDB保存用に整形
        const problemsToSave = generatedProblems.map(p => ({
          question: p.question,
          answer: p.answer,
          options: p.options,
          difficulty,
          grade: 1, // デフォルト値
          date
        }));
        
        // 3. 問題をDBに保存
        const savedProblems = await Problem.insertMany(problemsToSave);
        console.log(`[getProblemsByDifficulty] ${savedProblems.length}個の問題をDBに保存しました`);
        
        // 4. クライアント用に整形
        problems = savedProblems.map(p => ({
          _id: p._id,
          question: p.question,
          grade: p.grade,
          type: p.type || 'mixed',
          difficulty: p.difficulty,
          date: p.date
        }));
      } catch (generationError) {
        console.error('[getProblemsByDifficulty] 問題生成エラー:', generationError);
        return res.status(500).json({
          success: false,
          error: '問題の自動生成に失敗しました。'
        });
      }
    }

    res.status(200).json({
      success: true,
      count: problems.length,
      data: problems
    });

  } catch (error) {
    console.error('[getProblemsByDifficulty] エラー:', error);
    res.status(500).json({
      success: false,
      error: '問題の取得中にエラーが発生しました'
    });
  }
};

/**
 * @desc    回答を提出・評価する
 * @route   POST /api/problems/submit
 * @access  Private
 */
exports.submitAnswers = async (req, res) => {
  const { difficulty, date, answers, timeSpent, userId } = req.body;
  
  // 基本的なパラメータのバリデーション
  if (!difficulty || !answers || !Array.isArray(answers)) {
    return res.status(400).json({
      success: false,
      error: '難易度と回答は必須です'
    });
  }
  
  try {
    // ここから実際の回答処理に進む
    // ...
  } catch (error) {
    console.error('回答提出エラー:', error);
    res.status(500).json({
      success: false,
      error: '回答の提出中にエラーが発生しました'
    });
  }
};