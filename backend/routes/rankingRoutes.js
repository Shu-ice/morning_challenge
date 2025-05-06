const express = require('express');
const {
  getAllRankings: getRankings,
  getDailyRanking: getDailyRankings,
  getWeeklyRanking: getWeeklyRankings,
  getMonthlyRanking: getMonthlyRankings,
  getGradeRanking: getGradeRankings
} = require('../controllers/rankingController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

// 全てのルートに認証を適用
router.use(protect);

// 全期間ランキング取得 - 時間制限なし（いつでも閲覧可能）
router.get('/', getRankings);

// デイリーランキング取得 - 時間制限なし（いつでも閲覧可能）
router.get('/daily', getDailyRankings);

// ウィークリーランキング取得 - 時間制限なし（いつでも閲覧可能）
router.get('/weekly', getWeeklyRankings);

// マンスリーランキング取得 - 時間制限なし（いつでも閲覧可能）
router.get('/monthly', getMonthlyRankings);

// 学年別ランキング取得 - 時間制限なし（いつでも閲覧可能）
router.get('/grade/:grade', getGradeRankings);

module.exports = router;