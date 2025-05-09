import express from 'express';
import {
  getAllRankings as getRankings,
  getDailyRanking as getDailyRankings,
  getWeeklyRanking as getWeeklyRankings,
  getMonthlyRanking as getMonthlyRankings,
  getGradeRanking as getGradeRankings
} from '../controllers/rankingController.js';
// import { protect } from '../middleware/authMiddleware.js'; // protect のインポートは不要ならコメントアウト

const router = express.Router();

// 全てのルートに認証を適用する記述を削除またはコメントアウト
// router.use(protect);

// 全期間ランキング取得 - 時間制限なし（いつでも閲覧可能）
router.get('/', getRankings); // もし認証が必要なら router.get('/', protect, getRankings); のように個別に設定

// デイリーランキング取得 - 時間制限なし（いつでも閲覧可能）
router.get('/daily', getDailyRankings);

// ウィークリーランキング取得 - 時間制限なし（いつでも閲覧可能）
router.get('/weekly', getWeeklyRankings);

// マンスリーランキング取得 - 時間制限なし（いつでも閲覧可能）
router.get('/monthly', getMonthlyRankings);

// 学年別ランキング取得 - 時間制限なし（いつでも閲覧可能）
router.get('/grade/:grade', getGradeRankings);

export default router;