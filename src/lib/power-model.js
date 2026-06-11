const MIN_DURATION_SEC = 1;

/**
 * Two-parameter CP model (Monod-Scherrer).
 * P(t) = cp + wPrime / t
 */
export function cpModel2Param({ cp, wPrime }, durationSec) {
  const t = Math.max(durationSec, MIN_DURATION_SEC);
  return cp + wPrime / t;
}

/**
 * Three-parameter CP model (Morton Exponential).
 * P(t) = cp + wPrime * exp(-t / tau)
 */
export function cpModel3Param({ cp, wPrime, tau }, durationSec) {
  const t = Math.max(durationSec, MIN_DURATION_SEC);
  return cp + wPrime * Math.exp(-t / tau);
}

/**
 * Compute tau for the 3-param model from boundary conditions.
 * tau = wPrime / (pMax - cp)
 * Returns null if pMax <= cp (invalid).
 */
export function estimateTau(cp, wPrime, pMax) {
  if (pMax <= cp) {
    return null;
  }
  return wPrime / (pMax - cp);
}

/**
 * Get sustainable power for a given duration using the available model.
 * Uses 3-param if tau is present, otherwise falls back to 2-param.
 */
export function getPowerForDuration(model, durationSec) {
  if (model.tau != null) {
    return cpModel3Param(model, durationSec);
  }
  return cpModel2Param(model, durationSec);
}
