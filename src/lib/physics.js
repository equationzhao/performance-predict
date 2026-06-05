const G = 9.80655;
const P0 = 1.225;
const M0 = 0.0289644;
const R = 8.3144598;
const T0 = 288.15;

function min(values) {
  return Math.min(...values);
}

function max(values) {
  return Math.max(...values);
}

function stddev(values) {
  if (!values.length) {
    return 0;
  }
  const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + ((value - avg) ** 2), 0) / values.length;
  return Math.sqrt(variance);
}

function range(start, end, step) {
  const values = [];
  if (!Number.isFinite(start) || !Number.isFinite(end) || !Number.isFinite(step) || step <= 0) {
    return values;
  }
  for (let i = 0, value = start; value <= end && i < 100000; i += 1, value += step) {
    values.push(value);
  }
  return values;
}

export function gravityForce(slope, weight) {
  return G * Math.sin(Math.atan(slope)) * weight;
}

export function rollingResistanceForce(slope, weight, crr) {
  return G * Math.cos(Math.atan(slope)) * weight * crr;
}

export function aeroDragForce(cda, density, velocity, wind) {
  const netVelocity = velocity + wind;
  const invert = netVelocity < 0 ? -1 : 1;
  return (0.5 * cda * density * (netVelocity * netVelocity)) * invert;
}

export function airDensity(elevationM) {
  return P0 * Math.exp((-G * M0 * elevationM) / (R * T0));
}

export function cyclingPowerEstimate({
  velocity,
  slope,
  weight,
  crr,
  cda,
  el = 0,
  wind = 0,
  loss = 0.035,
}) {
  const invert = velocity < 0 ? -1 : 1;
  const gForce = gravityForce(slope, weight);
  const rForce = rollingResistanceForce(slope, weight, crr) * invert;
  const aForce = aeroDragForce(cda, airDensity(el), velocity, wind);
  const force = gForce + rForce + aForce;
  const vFactor = velocity / (1 - loss);
  return {
    gForce,
    rForce,
    aForce,
    force,
    gWatts: gForce * vFactor * invert,
    rWatts: rForce * vFactor * invert,
    aWatts: aForce * vFactor * invert,
    watts: force * vFactor * invert,
  };
}

export function cyclingDraftDragReduction(riders, position) {
  if (riders == null || position == null) {
    throw new TypeError("riders and position are required arguments");
  }
  if (riders < 2) {
    return 1;
  }
  if (position > riders) {
    throw new TypeError("position must be <= riders");
  }
  if (position < 1) {
    throw new TypeError("position must be >= 1");
  }
  const coefficients = {
    2: { y0: 6.228152, v0: 14.30192, k: 2.501857 },
    3: { y0: 3.862857, v0: 6.374476, k: 1.860752 },
    4: { y0: 3.167014, v0: 4.37368, k: 1.581374 },
    5: { y0: 2.83803, v0: 3.561276, k: 1.452583 },
    6: { y0: 2.598001, v0: 2.963105, k: 1.329827 },
    7: { y0: 2.556656, v0: 2.86052, k: 1.305172 },
    8: { y0: 2.506765, v0: 2.735303, k: 1.272144 },
  };
  if (riders > 8) {
    position = Math.max(1, (8 / riders) * position);
    riders = 8;
  }
  const c = coefficients[riders];
  return c.y0 - ((c.v0 / c.k) * (1 - Math.exp(-c.k * position)));
}

export function cyclingPowerVelocitySearchMultiPosition(riders, positions, args) {
  const reductions = positions.map(x => cyclingDraftDragReduction(riders, x.position));
  const avgCda =
    reductions.reduce((sum, reduction, i) => sum + (reduction * positions[i].pct), 0) * args.cda;
  const seedEstimate = cyclingPowerFastestVelocitySearch({ ...args, cda: avgCda });
  if (!seedEstimate) {
    return undefined;
  }
  const { velocity } = seedEstimate;
  const estimates = reductions.map((reduction, i) => cyclingPowerEstimate({
    ...args,
    weight: positions[i].weight || args.weight,
    cda: reduction * args.cda,
    velocity,
  }));
  const estimateAvg = field =>
    positions.reduce((sum, position, i) => sum + (position.pct * estimates[i][field]), 0);
  if (Math.abs(estimateAvg("watts") - args.power) > 0.01) {
    console.error("velocity from perf search seed is invalid");
  }
  return {
    gForce: estimateAvg("gForce"),
    rForce: estimateAvg("rForce"),
    aForce: estimateAvg("aForce"),
    force: estimateAvg("force"),
    gWatts: estimateAvg("gWatts"),
    rWatts: estimateAvg("rWatts"),
    aWatts: estimateAvg("aWatts"),
    watts: estimateAvg("watts"),
    estimates,
    velocity,
  };
}

export function cyclingPowerVelocitySearch({ power, ...args }) {
  const epsilon = 0.000001;
  const sampleSize = 300;
  const filterPct = 0.50;

  function refineRange(start, end) {
    let lastStart;
    let lastEnd;

    function byPowerClosenessOrVelocity(a, b) {
      const deltaA = Math.abs(a[1].watts - power);
      const deltaB = Math.abs(b[1].watts - power);
      if (deltaA < deltaB) {
        return -1;
      }
      if (deltaB < deltaA) {
        return 1;
      }
      return b[0] - a[0];
    }

    for (let fuse = 0; fuse < 100; fuse += 1) {
      const results = [];
      const step = Math.max((end - start) / sampleSize, epsilon / sampleSize);
      for (const velocity of range(start, end + step, step)) {
        const estimate = cyclingPowerEstimate({ velocity, ...args });
        results.push([velocity, estimate]);
      }
      results.sort(byPowerClosenessOrVelocity);
      results.length = Math.min(Math.floor(sampleSize * filterPct), results.length);
      const velocities = results.map(x => x[0]);
      if (velocities.length === 0) {
        throw new Error("Empty range");
      }
      start = min(velocities);
      end = max(velocities);
      if (
        velocities.length === 1 ||
        (Math.abs(start - lastStart) < epsilon && Math.abs(end - lastEnd) < epsilon)
      ) {
        if (step > epsilon) {
          for (const [initialVelocity, direction] of [[start, -1], [end, 1]]) {
            let bestEstimate = cyclingPowerEstimate({ velocity: initialVelocity, ...args });
            const smallStep = Math.max(step / 100, epsilon) * direction;
            for (let velocity = initialVelocity + smallStep; ; velocity += smallStep) {
              const estimate = cyclingPowerEstimate({ velocity, ...args });
              results.push([velocity, estimate]);
              if (Math.abs(estimate.watts - power) < Math.abs(bestEstimate.watts - power)) {
                bestEstimate = estimate;
              } else {
                break;
              }
            }
          }
          results.sort(byPowerClosenessOrVelocity);
          return results.map(x => x[0]);
        }
        return velocities;
      }
      lastStart = start;
      lastEnd = end;
    }
    throw new Error("No result found");
  }

  function findLocalRanges(velocities) {
    const deviation = stddev(velocities);
    const groups = new Map();
    for (const velocity of velocities) {
      let added = false;
      for (const [x, values] of groups.entries()) {
        if (Math.abs(velocity - x) < Math.max(deviation, epsilon * sampleSize * filterPct)) {
          values.push(velocity);
          added = true;
          break;
        }
      }
      if (!added) {
        groups.set(velocity, [velocity]);
      }
    }
    return Array.from(groups.values())
      .filter(x => x.length > 1)
      .map(x => [min(x), max(x)]);
  }

  const matches = [];
  function search(velocities) {
    const outerRanges = findLocalRanges(velocities);
    for (const [lower, upper] of outerRanges) {
      const rangeVelocities = refineRange(lower, upper);
      const innerRanges = rangeVelocities.length >= 4 && findLocalRanges(rangeVelocities);
      if (innerRanges && innerRanges.length > 1) {
        for (const [innerLower, innerUpper] of innerRanges) {
          search(refineRange(innerLower, innerUpper));
        }
      } else {
        const estimate = cyclingPowerEstimate({ velocity: rangeVelocities[0], ...args });
        if (
          Math.abs(estimate.watts - power) < epsilon ||
          Math.abs(1 - ((estimate.watts || epsilon) / (power || epsilon))) < epsilon
        ) {
          matches.push({ velocity: rangeVelocities[0], ...estimate });
        }
      }
    }
  }

  const c = 299792458;
  search(refineRange(-c, c));
  return matches;
}

export function cyclingPowerFastestVelocitySearch(options) {
  const velocities = cyclingPowerVelocitySearch(options).filter(x => x.velocity > 0);
  velocities.sort((a, b) => b.velocity - a.velocity);
  return velocities[0];
}

export function buildPredictionResult(input, estimate, drafting = null) {
  const { segment, rider } = input;
  const velocityMps = estimate.velocity;
  const distanceM = segment.distanceM;
  const timeSec = distanceM / velocityMps;
  const totalWeightKg = rider.bodyWeightKg + rider.gearWeightKg;
  const riderPowerW = rider.powerW;
  const wheelPowerW = riderPowerW * (1 - rider.drivetrainLoss);
  const lossWatts = riderPowerW - wheelPowerW;
  const gravityWheelWatts = estimate.gForce * velocityMps;
  const aeroWheelWatts = estimate.aForce * velocityMps;
  const rollingWheelWatts = estimate.rForce * velocityMps;

  return {
    velocityMps,
    timeSec,
    speedKph: velocityMps * 3.6,
    wattsPerKg: rider.powerW / rider.bodyWeightKg,
    totalWeightKg,
    riderPowerW,
    wheelPowerW,
    lossWatts,
    gravityWatts: gravityWheelWatts,
    aeroWatts: aeroWheelWatts,
    rollingWatts: rollingWheelWatts,
    gravityForceN: estimate.gForce,
    aeroForceN: estimate.aForce,
    rollingForceN: estimate.rForce,
    totalForceN: estimate.force,
    airDensity: airDensity(segment.elevationM),
    slopeRatio: segment.slopeRatio,
    drivetrainLoss: rider.drivetrainLoss,
    baseCda: input.equipment.cda,
    effectiveCda: drafting?.effectiveCda ?? input.equipment.cda,
    drafting,
  };
}
