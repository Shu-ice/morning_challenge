const notFound = (req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  res.status(404);
  next(error);
};

const errorHandler = (err, req, res, next) => {
  const { logger } = require('../utils/logger.js');
  
  logger.error('--- Error Handler Caught ---');
  logger.error('Error Name:', err.name);
  logger.error('Error Message:', err.message);
  if (process.env.NODE_ENV !== 'production' && err.stack) {
    logger.error('Error Stack:', err.stack);
  }
  logger.error('---------------------------');

  let statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  let message = err.message;

  // Mongoose の CastError (例: 不正な ObjectId) をハンドリング
  if (err.name === 'CastError' && err.kind === 'ObjectId') {
    statusCode = 404;
    message = 'リソースが見つかりません';
  }

  // Mongoose の ValidationError をハンドリング
  if (err.name === 'ValidationError') {
    statusCode = 400;
    // エラーメッセージを整形 (複数ある場合)
    const messages = Object.values(err.errors).map(val => val.message);
    message = messages.join(', ');
  }

  // Mongoose の Duplicate Key Error (ユニーク制約違反)
  if (err.code === 11000) {
    statusCode = 400;
    const field = Object.keys(err.keyValue)[0];
    message = `その${field === 'email' ? 'メールアドレス' : 'ユーザー名'}は既に使用されています。`;
  }

  res.status(statusCode).json({
    message: message,
    // 本番環境ではスタックトレースを非表示にする
    stack: process.env.NODE_ENV === 'production' ? '🥞' : err.stack,
  });
};

export { notFound, errorHandler }; 