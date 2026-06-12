import { cyclingPowerFastestVelocitySearch } from "./physics.js";

/**
 * Binary search for the power required to achieve a target time.
 *
 * @param {{ targetTimeSec, distanceM, slopeRatio, weightKg, crr, cda, elevationM, windMps, drivetrainLoss }} params
 * @returns {{ converged, powerW, timeSec, velocityMps, iterations, reason? }}
 */
export function solvePowerForTargetTime({
  targetTimeSec,
  distanceM,
  slopeRatio,
  weightKg,
  crr,
  cda,
  elevationM,
  windMps,
  drivetrainLoss,
  minPower = 50,
  maxPower = 800,
  toleranceSec = 0.5,
  maxIterations = 40,
}) {
  if (
    !Number.isFinite(targetTimeSec) || targetTimeSec <= 0 ||
    !Number.isFinite(distanceM) || distanceM <= 0
  ) {
    return { converged: false, reason: "invalid_input" };
  }

  let lo = minPower;
  let hi = maxPower;
  let best = null;

  for (let i = 0; i < maxIterations; i += 1) {
    const power = (lo + hi) / 2;

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
      lo = power;
      continue;
    }

    const timeSec = distanceM / estimate.velocity;

    best = {
      converged: Math.abs(timeSec - targetTimeSec) <= toleranceSec,
      powerW: power,
      timeSec,
      velocityMps: estimate.velocity,
      iterations: i + 1,
    };

    if (best.converged) {
      return best;
    }

    if (timeSec > targetTimeSec) {
      lo = power;
    } else {
      hi = power;
    }
  }

  return best
    ? { ...best, converged: false, reason: "max_iterations" }
    : { converged: false, reason: "no_solution" };
}

/**
 * Build a table of required powers for each achievement ring.
 *
 * @param {{ segment, rider, equipment, drafting }} input - validated form input
 * @param {Array} achievements - achievement thresholds
 * @param {number} currentPowerW - rider's current target power
 * @param {number} effectiveCda - effective CdA (drafting-aware)
 * @returns {Array} achievement rows with solution data
 */
export function buildTargetPowerTable(input, achievements, currentPowerW, effectiveCda) {
  const { segment, rider, equipment } = input;
  const common = {
    distanceM: segment.distanceM,
    slopeRatio: segment.slopeRatio,
    weightKg: rider.bodyWeightKg + rider.gearWeightKg,
    crr: equipment.crr,
    cda: effectiveCda,
    elevationM: segment.elevationM,
    windMps: segment.windMps,
    drivetrainLoss: rider.drivetrainLoss,
  };

  return achievements.map(target => {
    const solution = solvePowerForTargetTime({
      ...common,
      targetTimeSec: target.thresholdSec,
    });

    const requiredPowerW = Number.isFinite(solution.powerW) ? solution.powerW : null;
    const deltaPowerW = requiredPowerW != null ? requiredPowerW - currentPowerW : null;
    const requiredWkg = requiredPowerW != null ? requiredPowerW / rider.bodyWeightKg : null;
    const targetSpeedKph = (segment.distanceM / target.thresholdSec) * 3.6;
    const targetVamMph = segment.elevationGainM
      ? segment.elevationGainM / (target.thresholdSec / 3600)
      : null;

    return {
      ...target,
      solution,
      requiredPowerW,
      deltaPowerW,
      requiredWkg,
      targetSpeedKph,
      targetVamMph,
    };
  });
}
