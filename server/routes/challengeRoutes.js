import express from 'express';
import User from '../models/User.js';
import ChallengeAttempt from '../models/ChallengeAttempt.js';
import { inMorningWindow, inBonusWindow, getDateKeyJST } from '../utils/timeWindow.js';
import { calcPoints, levelFromPoints, updateStreak, checkAndAwardAchievements } from '../services/gamificationService.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/start', protect, async (req, res) => {
  try {
    const { type } = req.body;
    const isMorning = type === 'MORNING';
    const allowed = isMorning ? inMorningWindow() : inBonusWindow();
    
    if (!allowed) {
      return res.status(403).json({ error: 'OUT_OF_WINDOW' });
    }

    const dateKey = getDateKeyJST();
    const exists = await ChallengeAttempt.findOne({ 
      userId: req.user._id, 
      dateKey, 
      type 
    });
    
    if (exists) {
      return res.status(409).json({ error: 'ALREADY_STARTED' });
    }

    return res.json({ 
      ok: true, 
      type, 
      dateKey,
      startedAt: new Date()
    });
  } catch (error) {
    console.error('Challenge start error:', error);
    return res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

router.post('/submit', protect, async (req, res) => {
  try {
    const { type, correctCount, totalTimeSec, startedAt } = req.body;
    const isMorning = type === 'MORNING';
    const allowed = isMorning ? inMorningWindow() : inBonusWindow();
    
    if (!allowed) {
      return res.status(403).json({ error: 'OUT_OF_WINDOW' });
    }

    const dateKey = getDateKeyJST();
    const dup = await ChallengeAttempt.findOne({ 
      userId: req.user._id, 
      dateKey, 
      type 
    });
    
    if (dup) {
      return res.status(409).json({ error: 'ALREADY_SUBMITTED' });
    }

    const attempt = await ChallengeAttempt.create({
      userId: req.user._id,
      dateKey,
      type,
      startedAt: new Date(startedAt),
      finishedAt: new Date(),
      correctCount,
      totalTimeSec
    });

    const user = await User.findById(req.user._id);

    const previousBest = await ChallengeAttempt.findOne({
      userId: req.user._id,
      type: 'MORNING',
      _id: { $ne: attempt._id }
    }).sort({ correctCount: -1 }).limit(1);

    const pts = calcPoints({ 
      correctCount, 
      totalTimeSec,
      previousBest: previousBest?.correctCount
    });
    
    user.points += pts;
    user.level = levelFromPoints(user.points);

    let granted = [];
    if (isMorning) {
      await updateStreak(user, { completedMorningToday: true });
      
      const totalSolved = await ChallengeAttempt.countDocuments({ 
        userId: user._id 
      });
      
      granted = await checkAndAwardAchievements(user, {
        correctCount,
        finishedMorning: true,
        totalSolved: totalSolved * 10
      });
    } else {
      await user.save();
    }

    return res.json({ 
      ok: true, 
      pointsGained: pts, 
      level: user.level, 
      currentStreak: user.currentStreak,
      achievementsGranted: granted 
    });
  } catch (error) {
    console.error('Challenge submit error:', error);
    return res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

export default router;