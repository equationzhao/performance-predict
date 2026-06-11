const CREDENTIALS_KEY = "segment-performance-predictor-intervals-credentials-v1";
const POWER_MODEL_KEY = "segment-performance-predictor-intervals-power-model-v1";

const BASE_URL = "https://intervals.icu/api/v1";

/* ── Credential ops ── */

export function loadCredentials() {
  try {
    const raw = localStorage.getItem(CREDENTIALS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.athleteId && parsed?.apiKey) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveCredentials(athleteId, apiKey) {
  localStorage.setItem(CREDENTIALS_KEY, JSON.stringify({ athleteId, apiKey }));
}

export function clearCredentials() {
  localStorage.removeItem(CREDENTIALS_KEY);
}

/**
 * Mask API key for display: first 4 chars + "***"
 * Never logs the full key.
 */
export function maskApiKey(apiKey) {
  if (!apiKey || apiKey.length < 4) {
    return "***";
  }
  return `${apiKey.slice(0, 4)}***`;
}

/* ── Power model cache ── */

export function savePowerModel(model) {
  localStorage.setItem(POWER_MODEL_KEY, JSON.stringify(model));
}

export function loadPowerModel() {
  try {
    const raw = localStorage.getItem(POWER_MODEL_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.cp === "number" && typeof parsed.wPrime === "number" && typeof parsed.pMax === "number") {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function clearPowerModel() {
  localStorage.removeItem(POWER_MODEL_KEY);
}

/* ── API call ── */

/**
 * Fetch the athlete's power model parameters from Intervals.icu.
 * Uses the MMP model endpoint which gives the fitted CP/W'/Pmax.
 *
 * @param {{ athleteId: string, apiKey: string }} credentials
 * @returns {Promise<{ cp: number, wPrime: number, pMax: number }>}
 */
export async function fetchPowerModel({ athleteId, apiKey }) {
  const url = `${BASE_URL}/athlete/${encodeURIComponent(athleteId)}/mmp-model?type=Ride`;

  const auth = btoa(`API_KEY:${apiKey}`);

  let response;
  try {
    response = await fetch(url, {
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: "application/json",
      },
    });
  } catch (err) {
    throw new Error(`Network error: ${err.message}`);
  }

  if (response.status === 401 || response.status === 403) {
    throw new Error("Invalid credentials. Check your API key.");
  }

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  const data = await response.json();

  const cp = data?.criticalPower;
  const wPrime = data?.wPrime;
  const pMax = data?.pMax;

  if (!Number.isFinite(cp) || !Number.isFinite(wPrime) || !Number.isFinite(pMax)) {
    throw new Error("Power model data incomplete. Ensure you have enough ride data with a power meter.");
  }

  return { cp, wPrime, pMax };
}
