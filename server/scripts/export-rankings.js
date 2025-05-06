// ランキング関連データダンプ用スクリプト
import mongoose from 'mongoose';
import Result from '../models/Result.js';
import User from '../models/User.js';

async function exportRankings() {
  try {
    await mongoose.connect('mongodb://localhost:27017/morningmathdb');
    console.log('MongoDB接続成功');
    const results = await Result.find().populate('user', 'username');
    console.log(`${results.length}件の結果データを取得しました`);
    console.log(results);
  } catch (err) {
    console.error('エラー:', err);
  } finally {
    await mongoose.connection.close();
    console.log('MongoDB接続を閉じました');
  }
}

exportRankings();
