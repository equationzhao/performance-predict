import { cpModel2Param, cpModel3Param, estimateTau, getPowerForDuration } from "../src/lib/power-model.js";
import { solveBestEffort } from "../src/lib/best-effort.js";
import { validateForm } from "../src/lib/validation.js";

function assert(condition, message) {
  if (!condition) {
    throw new Error(`FAIL: ${message}`);
  }
}

function assertRange(value, min, max, label) {
  assert(value >= min && value <= max, `${label}: ${value} not in [${min}, ${max}]`);
}

/* ── CP Model Tests ── */

console.log("Testing CP model functions...");

// 2-param model
const model2 = { cp: 300, wPrime: 20000, pMax: 800 };
const p2_60 = cpModel2Param(model2, 60);
assertRange(p2_60, 630, 640, "2P power at 60s");
const p2_300 = cpModel2Param(model2, 300);
assertRange(p2_300, 365, 370, "2P power at 300s");
const p2_3600 = cpModel2Param(model2, 3600);
assertRange(p2_3600, 305, 306, "2P power at 3600s");

// 3-param model
const tau = estimateTau(300, 20000, 800);
assert(tau != null && tau > 0, "tau should be positive");
const model3 = { cp: 300, wPrime: 20000, pMax: 800, tau };
const p3_60 = cpModel3Param(model3, 60);
assert(p3_60 > 300, "3P power at 60s should exceed CP");
const p3_3600 = cpModel3Param(model3, 3600);
assertRange(p3_3600, 300, 310, "3P power at 3600s");

// Dispatcher
const pDispatch = getPowerForDuration(model3, 300);
assert(pDispatch > 300, "dispatcher power should exceed CP");

// No tau → 2-param fallback
const modelNoTau = { cp: 300, wPrime: 20000, pMax: 800 };
const pFallback = getPowerForDuration(modelNoTau, 300);
assertRange(pFallback, 365, 370, "fallback to 2P");

console.log("  CP model tests passed");

/* ── Solver Tests ── */

console.log("Testing best effort solver...");

// Test 1: Classic climb
const result1 = solveBestEffort({
  cpModel: { cp: 300, wPrime: 20000, pMax: 800, tau: estimateTau(300, 20000, 800) },
  distanceM: 5000,
  slopeRatio: 0.08,
  weightKg: 82,
  crr: 0.005,
  cda: 0.32,
  elevationM: 0,
  windMps: 0,
  drivetrainLoss: 0.035,
});
assert(result1 != null, "solver should return a result");
assert(Number.isFinite(result1.timeSec), "time should be finite");
assertRange(result1.timeSec, 600, 1800, "climb time (10-30 min)");
assertRange(result1.powerW, 200, 500, "climb power");
assert(result1.iterations <= 50, "should converge within 50 iterations");
console.log(`  Classic climb: ${Math.round(result1.timeSec)}s, ${Math.round(result1.powerW)}W, ${result1.iterations} iters, converged=${result1.converged}`);

// Test 2: Short segment
const result2 = solveBestEffort({
  cpModel: { cp: 280, wPrime: 15000, pMax: 750, tau: estimateTau(280, 15000, 750) },
  distanceM: 1000,
  slopeRatio: 0.05,
  weightKg: 75,
  crr: 0.005,
  cda: 0.32,
  elevationM: 0,
  windMps: 0,
  drivetrainLoss: 0.035,
});
assert(result2 != null, "short result should exist");
assertRange(result2.timeSec, 60, 300, "short segment time (1-5 min)");
assert(result2.powerW > 280, "short effort should exceed CP");
console.log(`  Short segment: ${Math.round(result2.timeSec)}s, ${Math.round(result2.powerW)}W, ${result2.iterations} iters`);

// Test 3: Flat TT
const result3 = solveBestEffort({
  cpModel: { cp: 300, wPrime: 18000, pMax: 800, tau: estimateTau(300, 18000, 800) },
  distanceM: 10000,
  slopeRatio: 0,
  weightKg: 80,
  crr: 0.005,
  cda: 0.26,
  elevationM: 0,
  windMps: 0,
  drivetrainLoss: 0.035,
});
assert(result3 != null, "flat result should exist");
assertRange(result3.timeSec, 600, 2400, "flat TT time (10-40 min)");
assertRange(result3.powerW, 250, 400, "flat TT power near CP");
console.log(`  Flat TT: ${Math.round(result3.timeSec)}s, ${Math.round(result3.powerW)}W, ${result3.iterations} iters`);

/* ── Validation Tests ── */

console.log("Testing validation with powerMode...");

// Manual mode: powerW required
const manualResult = validateForm({
  distanceKm: "5", gradePercent: "5", bodyWeightKg: "75",
  gearWeightKg: "13", powerW: "", cda: "0.32", crr: "0.005",
  powerMode: "manual",
});
assert(manualResult.status === "empty", "manual mode should require powerW");

// Best Effort mode: powerW not required
const beResult = validateForm({
  distanceKm: "5", gradePercent: "5", bodyWeightKg: "75",
  gearWeightKg: "13", powerW: "", cda: "0.32", crr: "0.005",
  powerMode: "best_effort",
});
assert(beResult.status === "valid", "best effort mode should accept empty powerW");
assert(beResult.input.rider.powerMode === "best_effort", "powerMode should be in output");

// Default (no powerMode): powerW required (regression check)
const defaultResult = validateForm({
  distanceKm: "5", gradePercent: "5", bodyWeightKg: "75",
  gearWeightKg: "13", powerW: "", cda: "0.32", crr: "0.005",
});
assert(defaultResult.status === "empty", "default should require powerW (regression)");

console.log("  Validation tests passed");

console.log("\nAll best-effort tests passed.");
