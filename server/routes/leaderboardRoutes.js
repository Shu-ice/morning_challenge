import express from 'express';
import ChallengeAttempt from '../models/ChallengeAttempt.js';
import User from '../models/User.js';
import { getDateKeyJST } from '../utils/timeWindow.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/daily', protect, async (req, res) => {
  try {
    const dateKey = req.query.date || getDateKeyJST();
    const { grade } = req.query;
    
    const matchConditions = { 
      dateKey, 
      type: 'MORNING' 
    };
    
    const pipeline = [
      { $match: matchConditions },
      { 
        $lookup: { 
          from: 'users', 
          localField: 'userId', 
          foreignField: '_id', 
          as: 'user' 
        } 
      },
      { $unwind: '$user' }
    ];
    
    if (grade && grade !== 'ALL') {
      pipeline.push({ 
        $match: { 'user.grade': grade }
      });
    }
    
    pipeline.push(
      { 
        $project: {
          userId: 1, 
          correctCount: 1, 
          totalTimeSec: 1,
          displayName: '$user.displayName',
          username: '$user.username',
          grade: '$user.grade',
          avatar: '$user.avatar'
        }
      },
      { 
        $sort: { 
          correctCount: -1, 
          totalTimeSec: 1 
        } 
      },
      { $limit: 100 }
    );
    
    const attempts = await ChallengeAttempt.aggregate(pipeline);
    
    const leaderboard = attempts.map((attempt, index) => ({
      rank: index + 1,
      userId: attempt.userId,
      displayName: attempt.displayName || attempt.username,
      grade: attempt.grade,
      avatar: attempt.avatar,
      correctCount: attempt.correctCount,
      totalTimeSec: attempt.totalTimeSec
    }));
    
    res.json({ 
      dateKey, 
      leaderboard 
    });
  } catch (error) {
    console.error('Leaderboard error:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

export default router;