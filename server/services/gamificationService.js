import Achievement from '../models/Achievement.js';
import User from '../models/User.js';
import ChallengeAttempt from '../models/ChallengeAttempt.js';
import { getDateKeyJST, isoWeekKey } from '../utils/timeWindow.js';
import { DateTime } from 'luxon';

export function calcPoints({ correctCount, totalTimeSec, previousBest }) {
  let pts = 10 + (correctCount * 2);
  if (previousBest && correctCount > previousBest) pts += 5;
  if (totalTimeSec <= 60) pts += 5;
  return pts;
}

export function levelFromPoints(points) {
  if (points >= 1000) return 5;
  if (points >= 500) return 4;
  if (points >= 250) return 3;
  if (points >= 100) return 2;
  return 1;
}

export async function updateStreak(user, { completedMorningToday }) {
  const today = getDateKeyJST();
  if (!completedMorningToday) {
    user.lastChallengeDate = today;
    await user.save();
    return user;
  }
  
  const last = user.lastChallengeDate;
  const yesterday = DateTime.now().setZone('Asia/Tokyo').minus({ days: 1 }).toFormat('yyyy-LL-dd');
  
  if (last === yesterday || last === today) {
    user.currentStreak = (last === today) ? user.currentStreak : user.currentStreak + 1;
  } else {
    user.currentStreak = 1;
  }
  
  if (user.currentStreak > user.bestStreak) {
    user.bestStreak = user.currentStreak;
  }
  
  user.lastChallengeDate = today;
  await user.save();
  return user;
}

export function canUseFreeze(user) {
  const wk = isoWeekKey();
  return user.weeklyFreezeUsedAt !== wk;
}

export async function useFreeze(user) {
  user.weeklyFreezeUsedAt = isoWeekKey();
  await user.save();
  return user;
}

export async function checkAndAwardAchievements(user, { correctCount, finishedMorning, totalSolved }) {
  const grants = [];
  const hasAchievement = (code) => {
    return user.achievements.some(a => {
      const achievement = a.achievementId;
      return achievement && achievement.code === code;
    });
  };
  
  const need = (code) => !hasAchievement(code);

  if (finishedMorning && need('EARLY_BIRD')) grants.push('EARLY_BIRD');
  if (correctCount === 10 && need('PERFECT_10')) grants.push('PERFECT_10');
  if (user.currentStreak >= 7 && need('STREAK_7')) grants.push('STREAK_7');
  if (user.currentStreak >= 30 && need('STREAK_30')) grants.push('STREAK_30');
  if (totalSolved >= 100 && need('SOLVED_100')) grants.push('SOLVED_100');

  if (grants.length) {
    const docs = await Achievement.find({ code: { $in: grants } }).lean();
    user.achievements.push(...docs.map(d => ({ 
      achievementId: d._id, 
      earnedAt: new Date() 
    })));
    await user.save();
  }
  
  return grants;
}