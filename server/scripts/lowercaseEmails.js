// スクリプト: lowercaseEmails.js
// すべてのユーザー email を小文字化し、一意インデックスを作成する
// 実行方法: npm run lowercase-emails

import dotenv from 'dotenv';
import { MongoClient } from 'mongodb';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/morning_challenge';
const DB_NAME = process.env.DB_NAME || 'morning_challenge';

(async () => {
  console.log('🔄 Email 小文字化スクリプト開始');
  const client = new MongoClient(MONGODB_URI, {
    maxPoolSize: 5,
    serverSelectionTimeoutMS: 5000,
  });

  try {
    await client.connect();
    const db = client.db(DB_NAME);
    const usersCol = db.collection('users');

    // 1. email が小文字でないドキュメントを取得
    const cursor = usersCol.find({ $expr: { $ne: [ '$email', { $toLower: '$email' } ] } });
    let updatedCount = 0;

    while (await cursor.hasNext()) {
      const user = await cursor.next();
      const lowerEmail = user.email.toLowerCase();

      // 同一メールが既に存在する場合は重複を避ける
      const conflict = await usersCol.findOne({ email: lowerEmail });
      if (conflict && conflict._id.toString() !== user._id.toString()) {
        console.warn(`⚠️  重複メール検出: ${user.email} -> ${lowerEmail} は既存ユーザーと衝突するためスキップ`);
        continue;
      }

      await usersCol.updateOne(
        { _id: user._id },
        { $set: { email: lowerEmail } }
      );
      updatedCount += 1;
      console.log(`✅ Updated ${user.email} -> ${lowerEmail}`);
    }

    console.log(`📝 更新完了: ${updatedCount} 件のユーザーメールを小文字化しました`);

    // 2. 大文字小文字を無視したユニークインデックスを作成
    console.log('🔧 email フィールドに一意インデックスを作成（case-insensitive）');
    await usersCol.createIndex(
      { email: 1 },
      {
        unique: true,
        collation: { locale: 'en', strength: 2 },
        name: 'email_unique_ci'
      }
    );
    console.log('✅ インデックス作成完了');
  } catch (err) {
    console.error('❌ スクリプト実行エラー:', err);
  } finally {
    await client.close();
    console.log('🔚 スクリプト終了');
  }
})(); 