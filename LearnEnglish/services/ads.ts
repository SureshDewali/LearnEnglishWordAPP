
import { getStats, saveStats } from './storage';

type AdType = 'video' | 'popUnder' | 'interstitial';

const AD_LIMITS = {
  video: 2,
  popUnder: 2,
  interstitial: 5 // Default limit
};

export const triggerAd = (type: AdType): boolean => {
  const stats = getStats();
  const today = new Date().toDateString();

  // Reset if date mismatch
  if (stats.adTriggers.lastDate !== today) {
    stats.adTriggers = { video: 0, popUnder: 0, lastDate: today };
  }

  // Check limits
  if (type === 'video' && stats.adTriggers.video >= AD_LIMITS.video) return false;
  if (type === 'popUnder' && stats.adTriggers.popUnder >= AD_LIMITS.popUnder) return false;

  console.log(`[AdService] Triggering ${type} ad...`);
  
  // Placeholder for real Monetag logic
  // if (window.monetag) window.monetag.show(...)

  // Increment counts
  if (type === 'video') stats.adTriggers.video += 1;
  if (type === 'popUnder') stats.adTriggers.popUnder += 1;

  saveStats(stats);
  return true;
};

export const openPopUnder = () => {
  if (triggerAd('popUnder')) {
    console.log("Mock Pop-Under Triggered");
    // window.open("https://monetag.com/...", "_blank");
  }
};
