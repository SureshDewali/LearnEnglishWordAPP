import { UserStats, Level, Language } from '../types';

const STORAGE_KEY = 'chandrama_elite_v2';

const DEFAULT_STATS: UserStats = {
  streak: 0,
  lastDate: '',
  unlockedDays: 1,
  lastCompletionDate: '',
  completionsToday: 0,
  lastUnlockTimestamp: 0,
  completedHistory: {},
  adTriggers: {
    video: 0,
    popUnder: 0,
    lastDate: ''
  }
};

export const getStats = (): UserStats => {
  const data = localStorage.getItem(STORAGE_KEY);
  if (!data) return DEFAULT_STATS;
  try {
    const parsed = JSON.parse(data);
    return { ...DEFAULT_STATS, ...parsed };
  } catch {
    return DEFAULT_STATS;
  }
};

export const saveStats = (stats: UserStats) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
};

/**
 * 📅 SYSTEM LOCK PROTOCOL (Day 4+)
 * Strict evaluation of calendar date to prevent over-progression.
 */
export const checkDayLock = (nextDay: number): { locked: boolean; remaining: string; nextUnlockDate: string } => {
  const stats = getStats();
  const today = new Date().toDateString();
  
  // Logic: Day 1, 2, 3 are free. Day 4 and above require a new calendar day if a day was already finished today.
  if (nextDay >= 4 && stats.lastCompletionDate === today) {
    const now = Date.now();
    const tomorrow = new Date();
    tomorrow.setHours(24, 0, 0, 0); 
    const diff = tomorrow.getTime() - now;
    
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    
    return { 
      locked: true, 
      remaining: `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`,
      nextUnlockDate: new Date(Date.now() + 86400000).toDateString()
    };
  }
  return { locked: false, remaining: "", nextUnlockDate: "" };
};

/**
 * 💾 ATOMIC PROGRESS SAVE
 * Forces immediate update of the sequential day pointer for the specific level.
 */
export const completeDay = (lang: Language, level: Level, day: number) => {
  const stats = getStats();
  const today = new Date().toDateString();
  const progressKey = `chandrama_${level}_${lang}_pointer`;
  const historyKey = `${lang}_${level}`;

  if (!stats.completedHistory[historyKey]) stats.completedHistory[historyKey] = [];
  
  if (!stats.completedHistory[historyKey].includes(day)) {
    stats.completedHistory[historyKey].push(day);
    
    // Calculate the new pointer
    const maxDayFinished = Math.max(...stats.completedHistory[historyKey]);
    const nextDayPointer = maxDayFinished + 1;
    
    // 1. Force save the pointer to its dedicated level key
    localStorage.setItem(progressKey, nextDayPointer.toString());
    
    // 2. Update global stats for streak and calendar lock
    stats.lastCompletionDate = today;
    saveStats(stats);
  }
};

export const updateStreak = () => {
  const stats = getStats();
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();

  if (stats.lastDate === yesterday) {
    stats.streak += 1;
  } else if (stats.lastDate !== today) {
    stats.streak = 1;
  }
  stats.lastDate = today;
  saveStats(stats);
};
