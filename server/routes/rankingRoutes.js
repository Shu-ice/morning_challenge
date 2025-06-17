import express from 'express';
const router = express.Router();
// rankingController.js から関数をインポート
import {
  getDailyRankings, // rankingController.js のエクスポート名に合わせる
  getWeeklyRankings,
  getMonthlyRankings,
  // getGradeRankings, // 今回の修正範囲では一旦コメントアウト
  // getRankings // getAllRankings のエイリアス、一旦コメントアウト
} from '../controllers/rankingController.js';
// const { getTopUsers } = require('../controllers/userController'); // 不要なので削除
// const { protect } = require('../middleware/authMiddleware'); // 認証用

// 公開ランキングAPI (認証不要)
router.get('/daily', getDailyRankings);
router.get('/weekly', getWeeklyRankings);
router.get('/monthly', getMonthlyRankings);

// router.get('/', getTopUsers); // 旧実装なので削除
// router.get('/daily', (req, res) => { // 旧実装なので削除
//   req.query.period = 'daily';
//   getTopUsers(req, res);
// });
// router.get('/weekly', (req, res) => { // 旧実装なので削除
//   req.query.period = 'weekly';
//   getTopUsers(req, res);
// });
// router.get('/monthly', (req, res) => { // 旧実装なので削除
//   req.query.period = 'monthly';
//   getTopUsers(req, res);
// });

// 学年別ランキングも rankingController を使う場合は以下のようにする (一旦コメントアウト)
// router.get('/grade/:grade', getGradeRankings);

// router.get('/grade/:grade', (req, res) => { // 旧実装なので削除
//   req.query.grade = req.params.grade;
//   getTopUsers(req, res);
// });

export default router;
