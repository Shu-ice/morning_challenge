import User from '../server/models/User.js';
import { connectDB } from '../server/config/database.js';

export default async function handler(req, res) {
  // セキュリティ: POSTメソッドのみ許可
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const { email, adminKey } = req.body;

  // セキュリティ: 管理者キーの確認
  const expectedAdminKey = process.env.ADMIN_SECRET_KEY || 'morning-challenge-admin-2025';
  if (adminKey !== expectedAdminKey) {
    return res.status(403).json({ success: false, message: 'Invalid admin key' });
  }

  if (!email) {
    return res.status(400).json({ success: false, message: 'Email is required' });
  }

  try {
    // データベース接続
    await connectDB();
    console.log(`🔧 管理者権限付与開始: ${email}`);
    
    // ユーザーを検索
    const user = await User.findOne({ email });
    
    if (!user) {
      console.log(`❌ ユーザーが見つかりません: ${email}`);
      return res.status(404).json({ 
        success: false, 
        message: `ユーザーが見つかりません: ${email}` 
      });
    }

    if (user.isAdmin) {
      console.log(`✅ ${email} は既に管理者です`);
      return res.status(200).json({ 
        success: true, 
        message: `${email} は既に管理者です`,
        user: {
          username: user.username,
          email: user.email,
          isAdmin: user.isAdmin
        }
      });
    }

    // 管理者権限を付与
    user.isAdmin = true;
    await user.save();
    
    console.log(`✅ ${email} に管理者権限を付与しました`);
    console.log(`👑 ${user.username} さんが管理者になりました`);

    return res.status(200).json({ 
      success: true, 
      message: `${email} に管理者権限を付与しました`,
      user: {
        username: user.username,
        email: user.email,
        isAdmin: user.isAdmin
      }
    });
    
  } catch (error) {
    console.error('❌ エラーが発生しました:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'サーバーエラーが発生しました',
      error: error.message 
    });
  }
} 