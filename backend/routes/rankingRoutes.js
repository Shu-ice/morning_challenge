const express = require('express');
const { getDailyRanking, getWeeklyRanking, getMonthlyRanking } = require('../controllers/rankingController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

// オプションで認証情報を使用（自分の順位を取得するため）
router.use((req, res, next) => {
  // 認証トークンがある場合のみユーザー情報を取得
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    return protect(req, res, next);
  }
  next();
});

// 日間ランキングを取得
router.get('/daily', getDailyRanking);

// 週間ランキングを取得
router.get('/weekly', getWeeklyRanking);

// 月間ランキングを取得
router.get('/monthly', getMonthlyRanking);

module.exports = router;