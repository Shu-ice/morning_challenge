const mongoose = require('mongoose');
const User = require('../models/User');

const setAdmin = async (email) => {
  try {
    // データベースに接続
    await mongoose.connect('mongodb://localhost:27017/morning-math', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('MongoDBに接続しました');

    // ユーザーを検索
    const user = await User.findOne({ email });
    if (!user) {
      console.error(`ユーザーが見つかりません: ${email}`);
      return;
    }

    // 管理者権限を設定
    user.isAdmin = true;
    await user.save();

    console.log(`管理者権限を設定しました: ${email}`);
    console.log('ユーザー情報:', {
      id: user._id,
      email: user.email,
      isAdmin: user.isAdmin
    });

  } catch (error) {
    console.error('エラーが発生しました:', error);
  } finally {
    // データベース接続を閉じる
    await mongoose.connection.close();
    console.log('\nMongoDB接続を閉じました');
  }
};

// コマンドライン引数からメールアドレスを取得
const email = process.argv[2];
if (!email) {
  console.error('メールアドレスを指定してください');
  console.log('使用例: node set-admin.js user@example.com');
  process.exit(1);
}

// スクリプトを実行
setAdmin(email); 