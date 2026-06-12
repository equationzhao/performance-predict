import {
  cyclingDraftDragReduction,
  cyclingPowerEstimate,
  cyclingPowerFastestVelocitySearch,
  cyclingPowerVelocitySearchMultiPosition,
} from "../lib/physics.js";

export function buildRotatingPositions(riders, workPct) {
  const positions = [];
  for (let i = workPct ? 0 : 1; i < riders; i += 1) {
    const pct = i === 0 ? workPct : ((1 / (riders - 1)) * (1 - workPct));
    if (pct) {
      positions.push({ position: i + 1, pct });
    }
  }
  return positions;
}

export function computeEffectiveCda(input) {
  if (!input.drafting.enabled) {
    return input.equipment.cda;
  }
  if (input.drafting.rotating) {
    const positions = buildRotatingPositions(input.drafting.riders, input.drafting.workPct);
    return positions.reduce(
      (sum, pos) => sum + cyclingDraftDragReduction(input.drafting.riders, pos.position) * pos.pct * input.equipment.cda,
      0,
    );
  }
  const reduction = cyclingDraftDragReduction(input.drafting.riders, input.drafting.position);
  return input.equipment.cda * reduction;
}

export function estimateWithDrafting(input) {
  const baseArgs = {
    power: input.rider.powerW,
    slope: input.segment.slopeRatio,
    weight: input.rider.bodyWeightKg + input.rider.gearWeightKg,
    crr: input.equipment.crr,
    cda: input.equipment.cda,
    el: input.segment.elevationM,
    wind: input.segment.windMps,
    loss: input.rider.drivetrainLoss,
  };

  if (!input.drafting.enabled) {
    return {
      estimate: cyclingPowerFastestVelocitySearch(baseArgs),
      drafting: null,
    };
  }

  if (input.drafting.rotating) {
    const positions = buildRotatingPositions(input.drafting.riders, input.drafting.workPct);
    const estimate = cyclingPowerVelocitySearchMultiPosition(input.drafting.riders, positions, baseArgs);
    return {
      estimate,
      drafting: estimate && buildDraftingAnalysis(input, baseArgs, estimate, positions),
    };
  }

  const reduction = cyclingDraftDragReduction(input.drafting.riders, input.drafting.position);
  const effectiveCda = input.equipment.cda * reduction;
  const estimate = cyclingPowerFastestVelocitySearch({ ...baseArgs, cda: effectiveCda });
  const positions = [{ position: input.drafting.position, pct: 1 }];
  return {
    estimate,
    drafting: estimate && buildDraftingAnalysis(input, baseArgs, estimate, positions, effectiveCda),
  };
}

export function buildDraftingAnalysis(input, baseArgs, estimate, positions, staticEffectiveCda) {
  const { drafting, rider, equipment, segment } = input;
  const positionPct = new Map(positions.map(x => [x.position, x.pct]));
  const effectiveCda = staticEffectiveCda ?? positions.reduce(
    (sum, position) =>
      sum + (cyclingDraftDragReduction(drafting.riders, position.position) * position.pct * equipment.cda),
    0,
  );
  const totalWeight = rider.bodyWeightKg + rider.gearWeightKg;
  const groupBodyWeight = drafting.useSameWeight ? rider.bodyWeightKg : drafting.groupBodyWeightKg;
  const groupWeight = groupBodyWeight + rider.gearWeightKg;
  const time = segment.distanceM / estimate.velocity;
  let minPower = Infinity;
  let maxPower = -Infinity;
  let joules = 0;

  for (let i = 0; i < drafting.riders; i += 1) {
    const position = i + 1;
    const positionCda = equipment.cda * cyclingDraftDragReduction(drafting.riders, position);
    if (drafting.rotating) {
      const pct = positionPct.get(position) || 0;
      const youEstimate = cyclingPowerEstimate({
        ...baseArgs,
        velocity: estimate.velocity,
        weight: totalWeight,
        cda: positionCda,
      });
      const groupEstimate = cyclingPowerEstimate({
        ...baseArgs,
        velocity: estimate.velocity,
        weight: groupWeight,
        cda: positionCda,
      });
      minPower = Math.min(youEstimate.watts, groupEstimate.watts, minPower);
      maxPower = Math.max(youEstimate.watts, groupEstimate.watts, maxPower);
      joules += (youEstimate.watts * time * pct) + (groupEstimate.watts * time * (1 - pct));
    } else {
      const weight = position === drafting.position ? totalWeight : groupWeight;
      const positionEstimate = cyclingPowerEstimate({
        ...baseArgs,
        velocity: estimate.velocity,
        weight,
        cda: positionCda,
      });
      minPower = Math.min(positionEstimate.watts, minPower);
      maxPower = Math.max(positionEstimate.watts, maxPower);
      joules += positionEstimate.watts * time;
    }
  }

  const groupPowerW = joules / drafting.riders / time;
  return {
    enabled: true,
    mode: drafting.rotating ? "rotating" : "static",
    riders: drafting.riders,
    position: drafting.position,
    workPct: drafting.workPct,
    effectiveCda,
    dragReductionPct: (1 - (effectiveCda / equipment.cda)) * 100,
    groupPowerW,
    powerVariancePct: ((maxPower - minPower) / groupPowerW) * 100,
    minPowerW: minPower,
    maxPowerW: maxPower,
    summary: drafting.rotating
      ? `${drafting.riders} riders · rotating · ${Math.round(drafting.workPct * 100)}% front`
      : `${drafting.riders} riders · position ${drafting.position}`,
  };
}

