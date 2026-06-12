export const FUJI_HC_ACHIEVEMENTS = [
  { id: "sub55", label: "SUB55 Challenge", shortLabel: "SUB55", thresholdSec: 3300, colorToken: "--ring-sub55", source: "official", confidence: "verified", reward: "¥100,000 prize" },
  { id: "platinum", label: "Platinum Ring", shortLabel: "Platinum", thresholdSec: 3600, colorToken: "--ring-platinum", source: "community", confidence: "needs_verification" },
  { id: "gold", label: "Gold Ring", shortLabel: "Gold", thresholdSec: 3900, colorToken: "--ring-gold", source: "community", confidence: "needs_verification" },
  { id: "silver", label: "Silver Ring", shortLabel: "Silver", thresholdSec: 4500, colorToken: "--ring-silver", source: "community", confidence: "needs_verification" },
  { id: "bronze", label: "Bronze Ring", shortLabel: "Bronze", thresholdSec: 5400, colorToken: "--ring-bronze", source: "community", confidence: "needs_verification" },
  { id: "blue", label: "Blue Ring", shortLabel: "Blue", thresholdSec: 7200, colorToken: "--ring-blue", source: "community", confidence: "needs_verification" },
  { id: "finish", label: "Official Finish Cutoff", shortLabel: "Finish", thresholdSec: 10200, colorToken: "--ring-finish", source: "official", confidence: "verified" },
];

export const FUJI_HC_CHECKPOINTS = [
  { id: "start", label: "Start", distanceKm: 0, kind: "start" },
  { id: "gate-1", label: "Gate 1", distanceKm: 10.5, cutoffSec: 6600, kind: "gate", note: "Final start +1:50" },
  { id: "gate-2", label: "Gate 2", distanceKm: 17.2, cutoffSec: 7800, kind: "gate", note: "Final start +2:10" },
  { id: "split", label: "Mountain Split", distanceKm: 19.5, kind: "split", note: "19–20km mountain sprint" },
  { id: "finish", label: "Finish", distanceKm: 24.0, cutoffSec: 10200, kind: "finish", note: "Final start +2:50" },
];

export const FUJI_HC_SOURCE_NOTES = [
  { level: "official", text: "Course distance, elevation gain, grade, cutoffs from fujihc.jp" },
  { level: "community", text: "Ring thresholds are community defaults — verify against official guide" },
  { level: "model", text: "Average elevation (~1680m) is estimated for air-density modeling" },
];

export const FUJI_HC_EVENT = {
  id: "fuji-hc",
  name: "Mt. Fuji Hill Climb",
  shortName: "Fuji HC",
  routeName: "Fuji Subaru Line",
  year: 2026,
  officialCourseUrl: "https://www.fujihc.jp/course/",
  officialOutlineUrl: "https://www.fujihc.jp/outline/",
  measuredDistanceKm: 24.0,
  totalCourseDistanceKm: 25.0,
  elevationGainM: 1255,
  totalElevationGainM: 1270,
  averageGradePercent: 5.2,
  maxGradePercent: 7.8,
  startLabel: "Tainai Cave Entrance",
  finishLabel: "Mt. Fuji 5th Station",
  achievements: FUJI_HC_ACHIEVEMENTS,
  checkpoints: FUJI_HC_CHECKPOINTS,
  sourceNotes: FUJI_HC_SOURCE_NOTES,
};
