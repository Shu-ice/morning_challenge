import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

let mongoServer;

beforeAll(async () => {
  // MongoDB Memory Serverを起動
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  
  // テスト用の環境変数を設定
  process.env.MONGODB_URI = mongoUri;
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-secret-key';
  
  // Mongooseの接続
  await mongoose.connect(mongoUri);
});

afterAll(async () => {
  // すべてのコレクションをクリア
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    const collection = collections[key];
    await collection.deleteMany({});
  }
  
  // 接続を閉じる
  await mongoose.connection.close();
  
  // MongoDB Memory Serverを停止
  if (mongoServer) {
    await mongoServer.stop();
  }
});

afterEach(async () => {
  // 各テスト後にデータをクリア
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    const collection = collections[key];
    await collection.deleteMany({});
  }
});