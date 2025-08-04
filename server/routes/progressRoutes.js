import express from 'express';
import ChallengeAttempt from '../models/ChallengeAttempt.js';
import { protect } from '../middleware/authMiddleware.js';
import { DateTime } from 'luxon';

const router = express.Router();

function requireTier(tier) {
  return (req, res, next) => {
    const order = { UME: 0, TAKE: 1, MATSU: 2 };
    if (order[req.user.membershipTier] >= order[tier]) {
      return next();
    }
    return res.status(402).json({ 
      error: 'UPGRADE_REQUIRED', 
      need: tier 
    });
  };
}

router.get('/summary', protect, requireTier('TAKE'), async (req, res) => {
  try {
    const userId = req.user._id;
    const { period = 'month' } = req.query;
    
    let startDate;
    const now = DateTime.now().setZone('Asia/Tokyo');
    
    switch (period) {
      case 'week':
        startDate = now.minus({ weeks: 1 }).toFormat('yyyy-LL-dd');
        break;
      case 'month':
        startDate = now.minus({ months: 1 }).toFormat('yyyy-LL-dd');
        break;
      case 'all':
        startDate = '2000-01-01';
        break;
      default:
        startDate = now.minus({ days: 7 }).toFormat('yyyy-LL-dd');
    }
    
    const timeline = await ChallengeAttempt.aggregate([
      { 
        $match: { 
          userId: userId,
          dateKey: { $gte: startDate }
        } 
      },
      { 
        $group: {
          _id: '$dateKey',
          avgCorrect: { $avg: '$correctCount' },
          avgTimeSec: { $avg: '$totalTimeSec' },
          attempts: { $sum: 1 },
          morningAttempts: {
            $sum: { $cond: [{ $eq: ['$type', 'MORNING'] }, 1, 0] }
          },
          bonusAttempts: {
            $sum: { $cond: [{ $eq: ['$type', 'BONUS'] }, 1, 0] }
          }
        }
      },
      { $sort: { _id: 1 } }
    ]);
    
    const stats = await ChallengeAttempt.aggregate([
      { $match: { userId: userId } },
      { 
        $group: {
          _id: null,
          totalAttempts: { $sum: 1 },
          avgCorrect: { $avg: '$correctCount' },
          avgTimeSec: { $avg: '$totalTimeSec' },
          bestCorrect: { $max: '$correctCount' },
          bestTimeSec: { $min: '$totalTimeSec' },
          perfectScores: {
            $sum: { $cond: [{ $eq: ['$correctCount', 10] }, 1, 0] }
          }
        }
      }
    ]);
    
    res.json({ 
      timeline,
      stats: stats[0] || {},
      period 
    });
  } catch (error) {
    console.error('Progress summary error:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

router.get('/weakness', protect, requireTier('TAKE'), async (req, res) => {
  try {
    const userId = req.user._id;
    
    const recentAttempts = await ChallengeAttempt.find({ 
      userId,
      correctCount: { $lt: 8 }
    })
    .sort({ dateKey: -1 })
    .limit(10);
    
    const weakAreas = [];
    if (recentAttempts.some(a => a.correctCount < 7)) {
      weakAreas.push('accuracy');
    }
    if (recentAttempts.some(a => a.totalTimeSec > 300)) {
      weakAreas.push('speed');
    }
    
    res.json({ 
      weakAreas,
      recentPerformance: recentAttempts.map(a => ({
        date: a.dateKey,
        correct: a.correctCount,
        time: a.totalTimeSec
      }))
    });
  } catch (error) {
    console.error('Weakness analysis error:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

export default router;