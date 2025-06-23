import { getMockUsers, updateMockUser, connectDB } from '../config/database.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * 指定したメールアドレスのユーザーに管理者権限を付与
 */
async function makeAdmin(email) {
  console.log(`🔧 管理者権限付与スクリプト開始: ${email}`);
  
  // モック環境または実本番環境で動作
  const isMongoMock = process.env.MONGODB_MOCK === 'true';
  if (!isMongoMock) {
    console.log('❌ このスクリプトは現在モック環境でのみ動作します');
    console.log('   本番環境対応が必要な場合は開発者にお問い合わせください');
    console.log('   MONGODB_MOCK=true を設定してモック環境でテストできます');
    return;
  }

  try {
    // データベース接続（モックデータ初期化を含む）
    await connectDB();
    
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
    
  } catch (error) {
    console.error('❌ エラーが発生しました:', error);
  }
}

// コマンドライン引数からメールアドレスを取得
const email = process.argv[2];
if (!email) {
  console.log('使用方法: node makeAdmin.js <email>');
  console.log('例: node makeAdmin.js admin@example.com');
  process.exit(1);
}

makeAdmin(email); 