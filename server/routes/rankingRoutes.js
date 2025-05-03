const express = require('express');
const router = express.Router();
const { getTopUsers } = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');

// 各種ランキング取得ルート
router.get('/', getTopUsers);
router.get('/daily', (req, res) => {
  req.query.period = 'daily';
  getTopUsers(req, res);
});
router.get('/weekly', (req, res) => {
  req.query.period = 'weekly';
  getTopUsers(req, res);
});
router.get('/monthly', (req, res) => {
  req.query.period = 'monthly';
  getTopUsers(req, res);
});

// 学年別ランキング
router.get('/grade/:grade', (req, res) => {
  req.query.grade = req.params.grade;
  getTopUsers(req, res);
});

module.exports = router;
