import express from 'express';
import CounselingSession from '../models/CounselingSession.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

function requireMatsu(req, res, next) {
  if (req.user.membershipTier === 'MATSU') {
    return next();
  }
  return res.status(402).json({ 
    error: 'UPGRADE_REQUIRED', 
    need: 'MATSU' 
  });
}

router.post('/request', protect, requireMatsu, async (req, res) => {
  try {
    const { startsAt, endsAt } = req.body;
    
    const start = new Date(startsAt);
    const end = new Date(endsAt);
    
    if (start <= new Date() || end <= start) {
      return res.status(400).json({ error: 'INVALID_TIME_RANGE' });
    }
    
    const existingSessions = await CounselingSession.countDocuments({
      userId: req.user._id,
      startsAt: { 
        $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) 
      },
      status: { $ne: 'CANCELLED' }
    });
    
    if (existingSessions >= 1) {
      return res.status(400).json({ 
        error: 'MONTHLY_LIMIT_REACHED',
        message: '月1回の制限に達しています' 
      });
    }
    
    const session = await CounselingSession.create({
      userId: req.user._id,
      startsAt: start,
      endsAt: end,
      status: 'REQUESTED'
    });
    
    res.json({ 
      ok: true, 
      sessionId: session._id,
      session: {
        id: session._id,
        startsAt: session.startsAt,
        endsAt: session.endsAt,
        status: session.status
      }
    });
  } catch (error) {
    console.error('Counseling request error:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

router.get('/sessions', protect, requireMatsu, async (req, res) => {
  try {
    const sessions = await CounselingSession.find({ 
      userId: req.user._id 
    })
    .sort({ startsAt: -1 })
    .limit(12);
    
    res.json({ 
      sessions: sessions.map(s => ({
        id: s._id,
        startsAt: s.startsAt,
        endsAt: s.endsAt,
        status: s.status,
        notesForParent: s.notesForParent
      }))
    });
  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

router.post('/cancel/:sessionId', protect, requireMatsu, async (req, res) => {
  try {
    const session = await CounselingSession.findOne({
      _id: req.params.sessionId,
      userId: req.user._id,
      status: 'REQUESTED'
    });
    
    if (!session) {
      return res.status(404).json({ error: 'SESSION_NOT_FOUND' });
    }
    
    if (new Date(session.startsAt) - new Date() < 24 * 60 * 60 * 1000) {
      return res.status(400).json({ 
        error: 'TOO_LATE_TO_CANCEL',
        message: '24時間前までにキャンセルしてください' 
      });
    }
    
    session.status = 'CANCELLED';
    await session.save();
    
    res.json({ ok: true });
  } catch (error) {
    console.error('Cancel session error:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

export default router;