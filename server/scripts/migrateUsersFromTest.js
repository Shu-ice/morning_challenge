// スクリプト: migrateUsersFromTest.js
// 'test' DB の users コレクションを main DB (morning_challenge) に移行し、email を小文字化して upsert します。
// 実行方法: npm run migrate-users

import dotenv from 'dotenv';
import { MongoClient } from 'mongodb';

dotenv.config();

const URI = process.env.MONGODB_URI;
const SOURCE_DB = process.env.SOURCE_DB || 'test';
const TARGET_DB = process.env.DB_NAME || 'morning_challenge';

if (!URI) {
  console.error('❌ MONGODB_URI が未設定です');
  process.exit(1);
}

(async () => {
  console.log(`🚚 ユーザーデータ移行開始: ${SOURCE_DB}.users → ${TARGET_DB}.users`);

  const client = new MongoClient(URI, {
    maxPoolSize: 5,
    serverSelectionTimeoutMS: 5000,
  });

  try {
    await client.connect();
    const srcDb = client.db(SOURCE_DB);
    const tgtDb = client.db(TARGET_DB);

    const srcCol = srcDb.collection('users');
    const tgtCol = tgtDb.collection('users');

    const total = await srcCol.countDocuments();
    console.log(`🔎 移行対象ドキュメント数: ${total}`);

    let inserted = 0;
    let updated = 0;
    const cursor = srcCol.find();

    while (await cursor.hasNext()) {
      const doc = await cursor.next();
      if (!doc) break;
      const lowerEmail = (doc.email || '').toLowerCase();
      doc.email = lowerEmail;

      // upsert by email
      const res = await tgtCol.updateOne(
        { email: lowerEmail },
        { $setOnInsert: doc },
        { upsert: true, collation: { locale: 'en', strength: 2 } }
      );

      if (res.upsertedCount === 1) {
        inserted += 1;
        console.log(`➕ インサート: ${lowerEmail}`);
      } else if (res.matchedCount === 1) {
        updated += 1;
        // 詳細更新は不要（既存を保持）
      }
    }

    console.log(`✅ 移行完了: inserted=${inserted}, skipped/updated=${updated}`);

    // 一意インデックスを確認/作成
    const indexes = await tgtCol.indexes();
    const hasEmailIndex = indexes.some(i => i.name === 'email_unique_ci');
    if (!hasEmailIndex) {
      console.log('🔧 email_unique_ci インデックスを作成');
      await tgtCol.createIndex({ email: 1 }, { unique: true, collation: { locale: 'en', strength: 2 }, name: 'email_unique_ci' });
    }

  } catch (err) {
    console.error('❌ 移行エラー:', err);
  } finally {
    await client.close();
    console.log('🔚 移行スクリプト終了');
  }
})(); 