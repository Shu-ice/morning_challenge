// ここに管理者機能のコントローラー関数を実装していきます。
// 例:
// const Problem = require('../models/Problem');
// const { generateMathProblems } = require('../utils/problemGenerator');

// /**
//  * @desc    管理者向けに問題リストを取得
//  * @route   GET /api/admin/problems
//  * @access  Private/Admin
//  */
// exports.getProblemsForAdmin = async (req, res) => {
//   // 実装...
// };

import Problem from '../models/Problem.js';
import User from '../models/User.js';
import { generateProblems } from '../utils/problemGenerator.js';

/**
 * @desc    管理者ページのダッシュボードデータを取得
 * @route   GET /api/admin/dashboard
 * @access  Private (Admin Only)
 */
export const getDashboardData = async (req, res) => {
  try {
    // ユーザー数
    const userCount = await User.countDocuments();
    
    // 問題数（難易度別）
    const problemCounts = {
      beginner: await Problem.countDocuments({ difficulty: 'beginner' }),
      intermediate: await Problem.countDocuments({ difficulty: 'intermediate' }),
      advanced: await Problem.countDocuments({ difficulty: 'advanced' }),
      expert: await Problem.countDocuments({ difficulty: 'expert' })
    };
    
    res.status(200).json({
      success: true,
      data: {
        userCount,
        problemCounts
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: 'サーバーエラー' });
  }
};

/**
 * @desc    管理者が問題を生成
 * @route   POST /api/admin/generate-problems
 * @access  Private (Admin Only)
 */
export const generateProblemsByAdmin = async (req, res) => {
  try {
    const { grade, difficulty, date } = req.body;
    
    if (!grade || !difficulty || !date) {
      return res.status(400).json({ success: false, error: '学年、難易度、日付は必須です' });
    }
    
    // 難易度の検証
    if (!['beginner', 'intermediate', 'advanced', 'expert'].includes(difficulty)) {
      return res.status(400).json({ success: false, error: '無効な難易度です' });
    }
    
    // 問題生成
    const problems = generateProblems(difficulty, 10);
    
    // 日付と学年を追加
    const problemsWithMeta = problems.map(p => ({
      question: p.question,
      answer: p.answer,
      options: p.options,
      difficulty,
      grade: parseInt(grade),
      date
    }));
    
    // 既存の問題を確認
    const existing = await Problem.countDocuments({ date, difficulty, grade: parseInt(grade) });
    
    if (existing > 0) {
      // 既存の問題を削除してから新しい問題を保存
      await Problem.deleteMany({ date, difficulty, grade: parseInt(grade) });
    }
    
    // 問題を保存
    await Problem.insertMany(problemsWithMeta);
    
    res.status(201).json({
      success: true,
      message: `${problemsWithMeta.length}個の問題が生成されました`,
      count: problemsWithMeta.length
    });
  } catch (error) {
    console.error('問題生成エラー:', error);
    res.status(500).json({ success: false, error: 'サーバーエラー' });
  }
};

/**
 * @desc    管理者向けに指定された条件の問題リストを取得
 * @route   GET /api/admin/problems?date=YYYY-MM-DD&difficulty=beginner
 * @access  Private/Admin
 */
export const getProblemsForAdmin = async (req, res) => {
  const { date, difficulty, grade } = req.query;

  // クエリパラメータに基づいて検索条件を作成
  const query = {};
  if (date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ success: false, error: '日付は YYYY-MM-DD 形式で指定してください。' });
    }
    query.date = date;
  }
  if (difficulty) {
      if (!['beginner', 'intermediate', 'advanced', 'expert'].includes(difficulty)) {
        return res.status(400).json({ success: false, error: '有効な難易度(beginner, intermediate, advanced, expert)を指定してください。' });
      }
    query.difficulty = difficulty;
  }
   if (grade) {
    const gradeNum = parseInt(grade, 10);
    if (isNaN(gradeNum) || gradeNum < 1 || gradeNum > 6) {
         return res.status(400).json({ success: false, error: '有効な学年(1-6)を指定してください。' });
    }
    query.grade = gradeNum;
  }

  try {
    // 条件に一致する問題を検索 (日付順、難易度順などでソート)
    const problems = await Problem.find(query).sort({ date: 1, difficulty: 1, grade: 1 });

    res.status(200).json({
      success: true,
      count: problems.length,
      data: problems,
    });

  } catch (error) {
    console.error('Error fetching problems for admin:', error);
    res.status(500).json({ success: false, error: '問題の取得中にエラーが発生しました。' });
  }
};

/**
 * @desc    管理者による問題の更新
 * @route   PUT /api/admin/problems/:id
 * @access  Private/Admin
 */
export const updateProblemByAdmin = async (req, res) => {
  const problemId = req.params.id;
  const { question, answer, type } = req.body; // 更新可能なフィールドを限定

  // 簡単な入力検証
  if (!question || answer === undefined) { // answer は 0 の可能性があるので undefined でチェック
    return res.status(400).json({ success: false, error: '問題文 (question) と答え (answer) は必須です。' });
  }

  // answer が数値であることを確認 (Number()で変換を試みる)
  const numericAnswer = Number(answer);
  if (isNaN(numericAnswer)) {
      return res.status(400).json({ success: false, error: '答え (answer) は数値である必要があります。' });
  }

  try {
    const problem = await Problem.findById(problemId);

    if (!problem) {
      return res.status(404).json({ success: false, error: '指定された ID の問題が見つかりません。' });
    }

    // 更新するフィールドを設定
    problem.question = question;
    problem.answer = numericAnswer;
    if (type) { // type が指定されていれば更新
      // TODO: type の enum 検証を追加した方が良い
      problem.type = type;
    }

    const updatedProblem = await problem.save();

    res.status(200).json({
      success: true,
      message: '問題が更新されました。',
      data: updatedProblem,
    });

  } catch (error) {
    console.error('Error updating problem by admin:', error);
    // IDの形式が不正な場合などのエラーハンドリング
    if (error.name === 'CastError') {
        return res.status(400).json({ success: false, error: '無効な問題ID形式です。' });
    }
    res.status(500).json({ success: false, error: '問題の更新中にエラーが発生しました。' });
  }
};

// 他のコントローラー関数 ... 