const MIN_DURATION_SEC = 1;

/**
 * Two-parameter CP model (Monod-Scherrer), capped by Pmax.
 *
 * Definitions:
 * - cp: critical power in watts.
 * - wPrime: finite work capacity above CP in joules.
 * - pMax: short-duration power ceiling in watts.
 *
 * Sustainable power uses P(t) = CP + W' / t. Pmax is not a third
 * CP-model parameter here; it is a safety ceiling for very short efforts.
 */
export function cpModel2Param({ cp, wPrime, pMax = Infinity }, durationSec) {
  const t = Math.max(durationSec, MIN_DURATION_SEC);
  return Math.min(cp + wPrime / t, pMax);
}

export function isValidPowerModel(model) {
  return Boolean(
    model &&
    Number.isFinite(model.cp) &&
    Number.isFinite(model.wPrime) &&
    Number.isFinite(model.pMax) &&
    model.cp > 0 &&
    model.wPrime > 0 &&
    model.pMax > model.cp
  );
}

export function normalizePowerModel(model) {
  if (!isValidPowerModel(model)) {
    return null;
  }
  return {
    cp: Number(model.cp),
    wPrime: Number(model.wPrime),
    pMax: Number(model.pMax),
  };
}

export function getPowerForDuration(model, durationSec) {
  if (!isValidPowerModel(model)) {
    return NaN;
  }
  return cpModel2Param(model, durationSec);
}

