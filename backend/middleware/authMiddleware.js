import jwt from 'jsonwebtoken';
import User from '../models/User.js';

/**
 * ユーザー認証を確認するミドルウェア
 */
export const protect = async (req, res, next) => {
  // ★ デバッグログ追加
  console.log('[authMiddleware.js] protect middleware is executing...');
  let token;
  
  // デバッグログ: Authorizationヘッダーの内容を出力
  console.log('Authorization Header:', req.headers.authorization);
  
  // Authorization ヘッダーからトークンを取得
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
    // デバッグログ: 抽出されたトークンを出力
    console.log('Extracted Token:', token);
  } 
  // クッキーからトークンを取得（将来的な拡張用）
  else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }
  
  // トークンがない場合はエラー
  if (!token) {
    console.error('No token found in request headers or cookies.'); // デバッグログ追加
    return res.status(401).json({
      success: false,
      error: '認証されていません。ログインしてください。'
    });
  }
  
  try {
    // デバッグログ: 検証に使用する Secret Key (環境変数から取得) を出力
    // 注意: 本番環境ではシークレットそのものをログに出力しないこと
    console.log('Verifying token with secret from env var:', process.env.JWT_SECRET ? 'Loaded' : 'NOT LOADED!');
    
    // トークンを検証
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // デバッグログ: デコードされたペイロード
    console.log('Decoded Payload:', decoded);
    
    // デコードされたIDからユーザーを取得
    req.user = await User.findById(decoded.id);
    
    // ユーザーが存在しない場合
    if (!req.user) {
      console.error('User not found for decoded ID:', decoded.id); // デバッグログ追加
      return res.status(401).json({
        success: false,
        error: 'このトークンに関連するユーザーが見つかりません'
      });
    }
    
    console.log('Authentication successful for user:', req.user.username, 'isAdmin:', req.user.isAdmin); // デバッグログ追加
    next();
  } catch (error) {
    // デバッグログ: JWT検証エラーの詳細を出力
    console.error('JWT Verification Error:', error);
    return res.status(401).json({
      success: false,
      // エラーメッセージを少し具体的にする (オプション)
      // error: `認証に失敗しました (${error.name}): ${error.message}`
      error: '認証に失敗しました。もう一度ログインしてください。'
    });
  }
};

/**
 * 時間制限を確認するミドルウェア（6:30-8:00の間のみアクセス可能）
 * 問題挑戦機能にのみ適用し、ログインや履歴閲覧などには適用しない
 */
export const checkTimeWindow = (req, res, next) => {
  // 開発環境ではスキップ可能
  if (process.env.DISABLE_TIME_CHECK === 'true') {
    console.log('[TimeCheck] スキップ: DISABLE_TIME_CHECK=true');
    return next();
  }
  
  // 管理者アカウントの場合は時間制限をスキップ
  if (req.user && req.user.isAdmin) {
    console.log('[TimeCheck] 管理者権限のため時間制限をスキップします:', req.user.username);
    return next();
  }
  
  const now = new Date();
  const hour = now.getHours();
  const minutes = now.getMinutes();
  const currentTime = hour + minutes/60;
  
  // 現在のJST時間をログ出力
  console.log(`[TimeCheck] 現在時刻: ${hour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}. 許可時間: 06:30 - 08:00`);
  
  // 6:30-8:00の間かチェック
  if (currentTime >= 6.5 && currentTime <= 8.0) {
    return next();
  }
  
  console.log('[TimeCheck] アクセス拒否. 現在時刻:', `${hour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}. 許可時間: 06:30 - 08:00`);
  return res.status(403).json({
    success: false,
    error: '問題挑戦は朝6:30〜8:00の間のみ可能です。また明日挑戦してください！'
  });
};

/**
 * 特定のロールを持つユーザーのみアクセスを許可する
 */
export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user.role || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: `${roles.join(', ')}のロールを持つユーザーのみアクセスできます`
      });
    }
    next();
  };
};