import { cyclingPowerFastestVelocitySearch } from "./physics.js";
import { getPowerForDuration } from "./power-model.js";

const MAX_ITERATIONS = 50;
const CONVERGENCE_EPSILON = 0.01; // seconds
const MIN_POWER = 1;
const FALLBACK_VELOCITY = 5; // m/s if initial guess fails

function clampPower(power, pMax) {
  return Math.max(MIN_POWER, Math.min(power, pMax * 1.2));
}

function velocityFromPower(power, { slopeRatio, weightKg, crr, cda, elevationM, windMps, drivetrainLoss }) {
  const estimate = cyclingPowerFastestVelocitySearch({
    power,
    slope: slopeRatio,
    weight: weightKg,
    crr,
    cda,
    el: elevationM,
    wind: windMps,
    loss: drivetrainLoss,
  });
  if (!estimate || !Number.isFinite(estimate.velocity) || estimate.velocity <= 0) {
    return null;
  }
  return estimate.velocity;
}

/**
 * Solve for best effort time using fixed-point iteration.
 *
 * The key insight: the time t to ride a segment is also the duration
 * parameter in the CP power model. We find the fixed point where
 * the model's sustainable power at time t produces a speed that
 * results in exactly time t.
 *
 * @param {{ cpModel, distanceM, slopeRatio, weightKg, crr, cda, elevationM, windMps, drivetrainLoss }} params
 * @returns {{ timeSec, powerW, velocityMps, converged, iterations }}
 */
export function solveBestEffort({ cpModel, distanceM, slopeRatio, weightKg, crr, cda, elevationM, windMps, drivetrainLoss }) {
  const segmentArgs = { slopeRatio, weightKg, crr, cda, elevationM, windMps, drivetrainLoss };

  // Initial guess: use CP power to estimate time
  const v0 = velocityFromPower(cpModel.cp, segmentArgs);
  let t = v0 ? distanceM / v0 : distanceM / FALLBACK_VELOCITY;

  let lastPower = cpModel.cp;
  let lastVelocity = v0 || FALLBACK_VELOCITY;

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const power = clampPower(getPowerForDuration(cpModel, t), cpModel.pMax);
    const velocity = velocityFromPower(power, segmentArgs);

    if (!velocity) {
      return {
        timeSec: distanceM / lastVelocity,
        powerW: lastPower,
        velocityMps: lastVelocity,
        converged: false,
        iterations: i + 1,
      };
    }

    const newTime = distanceM / velocity;

    if (Math.abs(newTime - t) < CONVERGENCE_EPSILON) {
      return {
        timeSec: newTime,
        powerW: power,
        velocityMps: velocity,
        converged: true,
        iterations: i + 1,
      };
    }

    t = newTime;
    lastPower = power;
    lastVelocity = velocity;
  }

  return {
    timeSec: distanceM / lastVelocity,
    powerW: lastPower,
    velocityMps: lastVelocity,
    converged: false,
    iterations: MAX_ITERATIONS,
  };
}
