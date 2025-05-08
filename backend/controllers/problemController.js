import Problem from '../models/Problem.js';
import { generateProblems, getProcessingStatus } from '../../server/utils/problemGenerator.js';

// 問題生成リクエストの状態を追跡するためのマップ
const generationRequests = new Map();

/**
 * @desc    指定された学年、難易度、日付の問題セットを生成してDBに保存
 * @route   POST /api/problems/generate (変更: POST にして Body でパラメータを受け取る方が安全かも)
 *          または GET /api/problems/generate?grade=1&difficulty=beginner&date=YYYY-MM-DD
 * @access  Private (Admin Only?)
 */
export const generateAndSaveProblems = async (req, res) => {
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
      const status = getProcessingStatus(requestId);
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
      const problems = generateProblems(difficulty, count, requestId);
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
export const getGenerationStatus = async (req, res) => {
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
    const generatorStatus = getProcessingStatus(requestId);
    
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
export const getProblem = async (req, res) => {
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
export const checkAnswer = async (req, res) => {
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
export const getPracticeProblems = async (req, res) => {
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
    const problems = generateProblems.generateProblems(difficulty, Math.min(count, 10));
    
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
 * @desc    指定された難易度と日付に基づいて問題を取得または生成
 * @route   GET /api/problems?difficulty=beginner&date=YYYY-MM-DD&count=10
 * @access  Private (auth)
 */
export const getProblemsByDifficulty = async (req, res) => {
  const { difficulty, date, count: countStr } = req.query;
  const count = parseInt(countStr, 10) || 10;
  const userId = req.user?._id?.toString() || req.user?.id;
  
  console.log(`[getProblemsByDifficulty] START: userId=${userId}, difficulty=${difficulty}, date=${date}, count=${count}`);

  if (!difficulty || !['beginner', 'intermediate', 'advanced', 'expert'].includes(difficulty)) {
    return res.status(400).json({ success: false, error: '有効な難易度を指定してください。' });
  }
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ success: false, error: '日付は YYYY-MM-DD 形式で指定してください。' });
  }

  try {
    console.log(`[getProblemsByDifficulty] Finding existing problems: date=${date}, difficulty=${difficulty}`);
    const problems = await Problem.find({ // ★ DB検索のみ実行
      date: date,
      difficulty: difficulty,
    })
    .limit(count)
    .lean();

    console.log(`[getProblemsByDifficulty] Found ${problems.length} existing problems.`);

    const responseProblems = problems.map(p => ({
      id: p._id,
      question: p.question,
      answer: p.answer,
      type: p.type,
      difficulty: p.difficulty,
    })).filter(Boolean); 
    
    console.log(`[getProblemsByDifficulty] END: Returning ${responseProblems.length} problems.`);

    // ★ 問題が見つからなかった場合 (空配列の場合) でも 200 OK で返す
    res.status(200).json({
      success: true,
      message: problems.length > 0 ? '問題を取得しました' : '指定された条件の問題は見つかりませんでした。',
      data: responseProblems, // 問題がない場合は空配列 [] が返る
    });

  } catch (error) {
    console.error('[getProblemsByDifficulty] Error:', error);
    res.status(500).json({
      success: false,
      error: '問題の取得中にエラーが発生しました。',
      details: error.message
    });
  }
};

/**
 * @desc    回答を提出・評価する
 * @route   POST /api/problems/submit
 * @access  Private
 */
export const submitUserAnswers = async (req, res) => {
  // import { saveResult } from './resultController.js'; // resultControllerに実装想定
  // return saveResult(req, res);
  console.warn('[problemController] submitUserAnswers called, but logic should be in resultController.');
  res.status(501).json({ success: false, error: 'Not Implemented: submit logic resides in resultController' });
};

/**
 * @desc    問題リストを一括更新する (問題編集画面からの保存用)
 * @route   POST /api/problems/edit
 * @access  Private (Admin Onlyを想定)
 */
export const updateMultipleProblems = async (req, res) => {
  const { date, difficulty, problems: updatedProblems } = req.body;

  if (!date || !difficulty || !updatedProblems || !Array.isArray(updatedProblems)) {
    return res.status(400).json({ success: false, error: '無効なリクエストデータです。date, difficulty, problems配列が必要です。' });
  }

  console.log(`[updateMultipleProblems] START: date=${date}, difficulty=${difficulty}, problems_count=${updatedProblems.length}`);

  try {
    let updatedCount = 0;
    const errors = [];

    for (const problemData of updatedProblems) {
      if (!problemData.id) {
        errors.push({ problemData, error: '問題IDが含まれていません。' });
        continue;
      }

      const { id, question, correctAnswer, options } = problemData;

      // correctAnswerが数値であることを確認 (フロントから文字列で来る可能性も考慮)
      const numericAnswer = Number(correctAnswer);
      if (isNaN(numericAnswer)) {
        errors.push({ problemData, error: '回答は有効な数値である必要があります。' });
        continue;
      }

      const updateFields = {
        question,
        answer: numericAnswer,
        // options も更新対象にする場合はここに追加
        // options: options,
      };

      // 不要なフィールドやundefinedなフィールドを取り除く
      Object.keys(updateFields).forEach(key => updateFields[key] === undefined && delete updateFields[key]);

      const result = await Problem.findByIdAndUpdate(id, { $set: updateFields }, { new: true });

      if (result) {
        updatedCount++;
      } else {
        errors.push({ problemData, error: `ID ${id} の問題が見つからないか、更新に失敗しました。` });
      }
    }

    if (errors.length > 0) {
      console.warn(`[updateMultipleProblems] 更新中にエラーが発生した問題があります:`, errors);
      return res.status(207).json({ // Multi-Status
        success: false, // 部分的な成功だが、全体としてはエラーがあるためfalseにするか、あるいは別のステータスを返す
        message: `一部の問題の更新に失敗しました。成功: ${updatedCount}件, 失敗: ${errors.length}件。詳細はエラーリストを確認してください。`,
        updatedCount,
        errors,
      });
    }

    res.status(200).json({
      success: true,
      message: `${updatedCount}件の問題を正常に更新しました。`,
      count: updatedCount,
    });

  } catch (error) {
    console.error('[updateMultipleProblems] Error:', error);
    res.status(500).json({
      success: false,
      error: '問題の一括更新中にサーバーエラーが発生しました。',
      details: error.message
    });
  }
};

// generateAndSaveProblems, getGenerationStatus, getProblem, checkAnswer, getPracticeProblems などは削除