import { SEGMENT_PRESETS } from "../src/lib/segment-presets.js";
import { evaluateAchievement, sortAchievements } from "../src/lib/achievements.js";
import { solvePowerForTargetTime, buildTargetPowerTable } from "../src/lib/target-power.js";

function assert(condition, message) {
  if (!condition) {
    throw new Error(`FAIL: ${message}`);
  }
}

function assertRange(value, min, max, label) {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new Error(`FAIL: ${label} = ${value}, expected [${min}, ${max}]`);
  }
}

// --- Fuji preset data ---
console.log("Checking Fuji preset data...");
const fuji = SEGMENT_PRESETS.find(x => x.id === "fuji");

assert(fuji, "Fuji preset exists");
assert(fuji.distanceKm === 24.0, `Fuji distance should be 24.0km, got ${fuji.distanceKm}`);
assert(Math.abs(fuji.gradePercent - 5.229) < 0.02, `Fuji grade should be ~5.229%, got ${fuji.gradePercent}`);
assert(fuji.elevationM === 1680, `Fuji elevationM should be 1680, got ${fuji.elevationM}`);
assert(fuji.elevationGainM === 1255, `Fuji elevationGainM should be 1255, got ${fuji.elevationGainM}`);
assert(fuji.maxGradePercent === 7.8, `Fuji maxGradePercent should be 7.8, got ${fuji.maxGradePercent}`);
assert(fuji.event, "Fuji preset has event metadata");
assert(fuji.event.achievements, "Fuji event has achievements");
assert(fuji.event.checkpoints, "Fuji event has checkpoints");
assert(fuji.event.checkpoints.length === 5, `Fuji event should have 5 checkpoints, got ${fuji.event.checkpoints.length}`);
assert(fuji.event.checkpoints[0].kind === "start", "First checkpoint should be start");
assert(fuji.event.checkpoints.at(-1).id === "finish", "Last checkpoint should be finish");
assert(fuji.event.checkpoints.at(-1).cutoffSec === 10200, "Finish cutoff should be 170 minutes");
console.log("  Fuji preset data OK");

// --- Achievement evaluation ---
console.log("Checking achievement evaluation...");
const achievements = fuji.event.achievements;

function expect(timeSec, expectedId, label) {
  const result = evaluateAchievement(timeSec, achievements);
  assert(result.achieved?.id === expectedId, `${label}: expected ${expectedId}, got ${result.achieved?.id}`);
}

expect(54 * 60 + 59, "sub55", "54:59");
expect(55 * 60, "sub55", "55:00");
expect(55 * 60 + 1, "platinum", "55:01");
expect(59 * 60 + 59, "platinum", "59:59");
expect(60 * 60, "platinum", "60:00");
expect(60 * 60 + 1, "gold", "60:01");
expect(65 * 60, "gold", "65:00");
expect(65 * 60 + 1, "silver", "65:01");
expect(75 * 60, "silver", "75:00");
expect(75 * 60 + 1, "bronze", "75:01");
expect(90 * 60, "bronze", "90:00");
expect(90 * 60 + 1, "blue", "90:01");
expect(120 * 60, "blue", "120:00");
expect(120 * 60 + 1, "finish", "120:01");
expect(170 * 60, "finish", "170:00");

// Outside cutoff
const outside = evaluateAchievement(170 * 60 + 1, achievements);
assert(outside.outsideCutoff, "170:01 should be outside cutoff");
assert(!outside.achieved, "Outside cutoff should have no achieved ring");

// SUB55 achieved — no next target (top tier)
const sub55 = evaluateAchievement(54 * 60, achievements);
assert(sub55.achieved?.id === "sub55", "54:00 should be SUB55");
assert(!sub55.next, "SUB55 should have no next target");

// Platinum achieved — next is SUB55
const platinum = evaluateAchievement(59 * 60, achievements);
assert(platinum.achieved?.id === "platinum", "59:00 should be platinum");
assert(platinum.next?.id === "sub55", "Platinum next should be SUB55");

// Gap calculation
const silver = evaluateAchievement(78 * 60 + 30, achievements);
assert(silver.achieved?.id === "bronze", "78:30 should be bronze");
assert(silver.next?.id === "silver", "78:30 next should be silver");
assertRange(silver.gapToNextSec, 190, 210, "gap 78:30 to silver");

// Sort
const sorted = sortAchievements(achievements);
assert(sorted[0].thresholdSec <= sorted[1].thresholdSec, "sorted ascending");

console.log("  Achievement evaluation OK");

// --- Target power solver ---
console.log("Checking target power solver...");
const solverInput = {
  targetTimeSec: 4500, // Silver target: 75:00
  distanceM: 24000,
  slopeRatio: 0.05229,
  weightKg: 75,
  crr: 0.005,
  cda: 0.32,
  elevationM: 1680,
  windMps: 0,
  drivetrainLoss: 0.035,
};

const silverSolution = solvePowerForTargetTime(solverInput);
assert(silverSolution.converged, `Silver solver should converge, got reason: ${silverSolution.reason}`);
assertRange(silverSolution.powerW, 150, 500, "Silver required power");
assertRange(silverSolution.timeSec, 4499.5, 4500.5, "Silver solved time");
console.log(`  Silver: ${silverSolution.powerW.toFixed(1)}W in ${silverSolution.timeSec.toFixed(1)}s (${silverSolution.iterations} iterations)`);

// Gold requires more power than Silver
const goldSolution = solvePowerForTargetTime({ ...solverInput, targetTimeSec: 3900 });
assert(goldSolution.converged, `Gold solver should converge, got reason: ${goldSolution.reason}`);
assert(goldSolution.powerW > silverSolution.powerW, `Gold (${goldSolution.powerW}W) should require more power than Silver (${silverSolution.powerW}W)`);
console.log(`  Gold: ${goldSolution.powerW.toFixed(1)}W in ${goldSolution.timeSec.toFixed(1)}s`);

// Build full table
const fakeInput = {
  segment: {
    distanceM: 24000,
    slopeRatio: 0.05229,
    elevationM: 1680,
    windMps: 0,
    elevationGainM: 1255,
  },
  rider: {
    bodyWeightKg: 68,
    gearWeightKg: 8,
    drivetrainLoss: 0.035,
  },
  equipment: {
    crr: 0.005,
    cda: 0.32,
  },
  drafting: { enabled: false },
};

const table = buildTargetPowerTable(fakeInput, achievements, 316, 0.32);
assert(table.length === achievements.length, `Table should have ${achievements.length} rows, got ${table.length}`);

// Required power should decrease as threshold increases (slower = less power)
const powers = table.filter(r => r.requiredPowerW != null).map(r => r.requiredPowerW);
for (let i = 1; i < powers.length; i++) {
  assert(powers[i] < powers[i - 1], `Power at index ${i} (${powers[i]}W) should be less than index ${i - 1} (${powers[i - 1]}W)`);
}

console.log("  Target power solver OK");

console.log("\nAll Fuji achievement checks passed.");
