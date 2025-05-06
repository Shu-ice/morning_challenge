const mongoose = require('mongoose');
const User = require('../models/User');

const checkAdminStatus = async () => {
  try {
    // データベースに接続
    await mongoose.connect('mongodb://localhost:27017/morning-math', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('MongoDBに接続しました');

    // すべてのユーザーを取得
    const users = await User.find({}, 'email isAdmin');
    console.log('\nユーザー一覧:');
    users.forEach(user => {
      console.log(`Email: ${user.email}, isAdmin: ${user.isAdmin}`);
    });

  } catch (error) {
    console.error('エラーが発生しました:', error);
  } finally {
    // データベース接続を閉じる
    await mongoose.connection.close();
    console.log('\nMongoDB接続を閉じました');
  }
};

// スクリプトを実行
checkAdminStatus(); 