/**
 * Sort achievements by threshold ascending (fastest ring first).
 */
export function sortAchievements(achievements) {
  return [...achievements].sort((a, b) => a.thresholdSec - b.thresholdSec);
}

/**
 * Evaluate which achievement ring a given time achieves.
 *
 * @param {number} timeSec - predicted time in seconds
 * @param {Array} achievements - array of { id, label, thresholdSec, ... }
 * @returns {{ achieved, next, gapToNextSec, outsideCutoff }}
 */
export function evaluateAchievement(timeSec, achievements) {
  const sorted = sortAchievements(achievements);

  if (!Number.isFinite(timeSec) || timeSec <= 0 || sorted.length === 0) {
    return { achieved: null, next: null, gapToNextSec: null, outsideCutoff: false };
  }

  const achieved = sorted.find(item => timeSec <= item.thresholdSec) ?? null;

  const next = achieved
    ? sorted.filter(item => item.thresholdSec < achieved.thresholdSec).pop() ?? null
    : null;

  const finish = sorted.find(item => item.id === "finish") ?? sorted[sorted.length - 1];
  const outsideCutoff = finish ? timeSec > finish.thresholdSec : false;

  const gapToNextSec = next ? timeSec - next.thresholdSec : null;

  return { achieved, next, gapToNextSec, outsideCutoff };
}
