import mongoose from 'mongoose';
import { generateProblems } from '../utils/problemGenerator.js';
import DailyProblemSet from '../models/DailyProblemSet.js';
import dotenv from 'dotenv';

// 環境変数を読み込み
dotenv.config({ path: '../.env' });

const difficulties = ['beginner', 'intermediate', 'advanced', 'expert'];

// コマンドライン引数から force オプションを取得
const forceUpdate = process.argv.includes('--force');

async function generateTodayProblems() {
  try {
    // MongoDB接続
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/morning-math-challenge');
    console.log('MongoDB接続成功');

    const today = new Date().toISOString().split('T')[0];
    console.log(`今日の日付: ${today}`);
    
    if (forceUpdate) {
      console.log('--force オプションが指定されました。既存の問題セットを更新します。');
    }

    for (const difficulty of difficulties) {
      console.log(`\n${difficulty}難易度の問題を生成中...`);
      
      // 既存の問題セットをチェック
      const existingSet = await DailyProblemSet.findOne({ date: today, difficulty });
      if (existingSet && !forceUpdate) {
        console.log(`${difficulty}難易度の問題は既に存在します。スキップします。`);
        continue;
      }

      // 問題を生成（より良いランダム性を確保）
      const seed = Date.now() + Math.random() * 1000000 + difficulty.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      const problems = await generateProblems(difficulty, 10, seed);
      
      if (!problems || problems.length === 0) {
        console.error(`${difficulty}難易度の問題生成に失敗しました。`);
        continue;
      }

      // generateProblems の出力を DailyProblemSet の期待する形式に変換
      const problemsForDB = problems.map(p => ({
        id: p.id,
        question: p.question,
        correctAnswer: p.answer, // answer -> correctAnswer に変換
        options: p.options
      }));

      if (existingSet) {
        // 既存のセットを更新
        existingSet.problems = problemsForDB;
        existingSet.updatedAt = new Date();
        await existingSet.save();
        console.log(`${difficulty}難易度の問題を更新しました (${problemsForDB.length}問)`);
      } else {
        // 新規作成
        const newProblemSet = new DailyProblemSet({
          date: today,
          difficulty,
          problems: problemsForDB
        });
        await newProblemSet.save();
        console.log(`${difficulty}難易度の問題を新規作成しました (${problemsForDB.length}問)`);
      }
    }

    console.log('\n全ての問題生成が完了しました！');
  } catch (error) {
    console.error('エラーが発生しました:', error);
  } finally {
    await mongoose.disconnect();
    console.log('MongoDB接続を切断しました');
  }
}

generateTodayProblems(); 