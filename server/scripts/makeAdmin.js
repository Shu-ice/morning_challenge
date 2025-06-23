import { getMockUsers, updateMockUser, connectDB } from '../config/database.js';
import User from '../models/User.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * 指定したメールアドレスのユーザーに管理者権限を付与
 */
async function makeAdmin(email) {
  console.log(`🔧 管理者権限付与スクリプト開始: ${email}`);
  
  const isMongoMock = process.env.MONGODB_MOCK === 'true';
  
  try {
    // データベース接続（モックデータ初期化を含む）
    await connectDB();
    
    if (isMongoMock) {
      // モック環境の処理
      console.log('📦 モック環境での処理...');
      const users = getMockUsers();
      console.log(`🔍 検索対象ユーザー数: ${users.length}`);
      
      const user = users.find(u => u.email === email);
      
      if (!user) {
        console.log(`❌ ユーザーが見つかりません: ${email}`);
        console.log('利用可能なユーザー:');
        users.forEach(u => console.log(`  - ${u.email} (${u.username}) - 管理者: ${u.isAdmin ? 'はい' : 'いいえ'}`));
        return;
      }

      if (user.isAdmin) {
        console.log(`✅ ${email} は既に管理者です`);
        return;
      }

      // 管理者権限を付与
      updateMockUser(user._id, { isAdmin: true });
      console.log(`✅ ${email} に管理者権限を付与しました`);
      
    } else {
      // 本番環境（MongoDB）の処理
      console.log('🗄️ MongoDB環境での処理...');
      
      // ユーザーを検索
      const user = await User.findOne({ email });
      
      if (!user) {
        console.log(`❌ ユーザーが見つかりません: ${email}`);
        console.log('📝 まず新規登録を行ってからこのスクリプトを実行してください');
        return;
      }

      if (user.isAdmin) {
        console.log(`✅ ${email} は既に管理者です`);
        return;
      }

      // 管理者権限を付与
      user.isAdmin = true;
      await user.save();
      
      console.log(`✅ ${email} に管理者権限を付与しました`);
      console.log(`👑 ${user.username} さんが管理者になりました`);
    }
    
  } catch (error) {
    console.error('❌ エラーが発生しました:', error);
  } finally {
    if (!isMongoMock) {
      // MongoDB接続を閉じる
      process.exit(0);
    }
  }
}

// コマンドライン引数からメールアドレスを取得
const email = process.argv[2];
if (!email) {
  console.log('使用方法: node makeAdmin.js <email>');
  console.log('例: node makeAdmin.js kanri@example.com');
  process.exit(1);
}

makeAdmin(email); 