const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

// 環境変数の設定
dotenv.config();

// Expressアプリケーションの作成
const app = express();

// ミドルウェアの設定
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ルートの設定
app.get('/', (req, res) => {
  res.json({ message: '朝の計算チャレンジAPIへようこそ！' });
});

// 問題生成APIのサンプル
app.get('/api/problems', (req, res) => {
  // 学年別の問題生成例
  const grade = req.query.grade || 1;
  
  // 問題生成ロジック（簡略化版）
  const generateProblem = (max) => {
    const a = Math.floor(Math.random() * max) + 1;
    const b = Math.floor(Math.random() * max) + 1;
    return {
      question: `${a} + ${b} = ?`,
      answer: a + b
    };
  };
  
  // 学年に応じた難易度設定
  const max = grade * 10;
  
  // 10問生成
  const problems = [];
  for (let i = 0; i < 10; i++) {
    problems.push({
      id: i + 1,
      ...generateProblem(max)
    });
  }
  
  // 答えを除外した問題のみ返す
  const clientProblems = problems.map(({answer, ...rest}) => rest);
  
  res.json({
    success: true,
    grade: Number(grade),
    problems: clientProblems
  });
});

// 回答提出APIのサンプル
app.post('/api/problems/submit', (req, res) => {
  const { answers, timeSpent, grade } = req.body;
  
  // ダミーレスポンス
  res.json({
    success: true,
    score: 100,
    correctAnswers: 10,
    totalProblems: 10,
    timeSpent
  });
});

// ランキングAPIのサンプル
app.get('/api/rankings', (req, res) => {
  // ダミーデータ
  const users = [];
  const avatars = ['😊', '🐱', '🐶', '🐼', '🦊', '🐰', '🐻', '🐨', '🦁', '🐯'];
  
  for (let i = 0; i < 10; i++) {
    users.push({
      _id: `user-${i}`,
      username: `ユーザー${i + 1}`,
      avatar: avatars[i % avatars.length],
      grade: Math.floor(Math.random() * 6) + 1,
      points: Math.floor(Math.random() * 1000),
      streak: Math.floor(Math.random() * 10)
    });
  }
  
  res.json({
    success: true,
    users: users.sort((a, b) => b.points - a.points)
  });
});

// サーバーの起動
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`サーバーが${PORT}番ポートで起動しました`);
});
