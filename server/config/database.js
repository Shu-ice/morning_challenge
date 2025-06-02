const mongoose = require('mongoose');

/**
 * データベース接続設定
 */
class DatabaseConfig {
  constructor() {
    this.connectionString = process.env.MONGODB_URI || 'mongodb://localhost:27017/morning_challenge';
    this.options = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: 10, // 接続プールの最大サイズ
      serverSelectionTimeoutMS: 5000, // サーバー選択のタイムアウト
      socketTimeoutMS: 45000, // ソケットのタイムアウト
      bufferMaxEntries: 0 // バッファリングを無効化
    };
  }

  /**
   * データベースに接続
   */
  async connect() {
    try {
      await mongoose.connect(this.connectionString, this.options);
      console.log('✅ MongoDB接続成功');
      
      // 接続イベントリスナー
      mongoose.connection.on('error', (err) => {
        console.error('❌ MongoDB接続エラー:', err);
      });

      mongoose.connection.on('disconnected', () => {
        console.log('⚠️ MongoDB接続が切断されました');
      });

      process.on('SIGINT', async () => {
        await mongoose.connection.close();
        console.log('📞 MongoDBコネクションを正常に終了しました');
        process.exit(0);
      });

    } catch (error) {
      console.error('❌ MongoDB接続失敗:', error);
      process.exit(1);
    }
  }

  /**
   * データベース接続を切断
   */
  async disconnect() {
    try {
      await mongoose.connection.close();
      console.log('✅ MongoDB接続を正常に切断しました');
    } catch (error) {
      console.error('❌ MongoDB切断エラー:', error);
    }
  }

  /**
   * 接続状態を取得
   */
  getConnectionState() {
    const states = {
      0: 'disconnected',
      1: 'connected', 
      2: 'connecting',
      3: 'disconnecting'
    };
    return states[mongoose.connection.readyState] || 'unknown';
  }
}

module.exports = new DatabaseConfig(); 