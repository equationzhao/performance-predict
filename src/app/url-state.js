import { DEFAULT_FORM_STATE, PERSISTED_FIELDS } from "../lib/presets.js";
import { SEGMENT_PRESETS } from "../lib/segment-presets.js";
import { isValidPowerModel } from "../lib/power-model.js";

export const STORAGE_KEY = "segment-performance-predictor-defaults-v1";

export const URL_PARAM_MAP = {
  d: "distanceKm",
  g: "gradePercent",
  e: "elevationM",
  w: "windMps",
  bw: "bodyWeightKg",
  gw: "gearWeightKg",
  p: "powerW",
  cda: "cda",
  crr: "crr",
  m: "powerMode",
};

function getStorage(storage) {
  return storage ?? globalThis.localStorage;
}

export function loadPersistedDefaults(storage) {
  try {
    const raw = getStorage(storage).getItem(STORAGE_KEY);
    const stored = JSON.parse(raw || "{}");
    const allowed = Object.fromEntries(PERSISTED_FIELDS.map(field => [field, stored[field]]));
    for (const key of Object.keys(allowed)) {
      if (allowed[key] === undefined) {
        delete allowed[key];
      }
    }
    return allowed;
  } catch {
    return {};
  }
}

export function persistDefaults(formState, storage) {
  const persisted = {};
  for (const field of PERSISTED_FIELDS) {
    persisted[field] = formState[field];
  }
  getStorage(storage).setItem(STORAGE_KEY, JSON.stringify(persisted));
}

export function parseUrlState(search, segmentPresets = SEGMENT_PRESETS) {
  const params = new URLSearchParams(search);
  const fields = {};

  for (const [short, full] of Object.entries(URL_PARAM_MAP)) {
    const value = params.get(short);
    if (value != null && value !== "") {
      fields[full] = value;
    }
  }

  const cp = Number(params.get("cp"));
  const wPrime = Number(params.get("w2"));
  const pMax = Number(params.get("pm"));
  const powerModelData = isValidPowerModel({ cp, wPrime, pMax })
    ? { cp, wPrime, pMax, fetchedAt: Date.now() }
    : null;

  const presetId = params.get("sp");
  const activeSegmentPreset = presetId && segmentPresets.some(preset => preset.id === presetId)
    ? presetId
    : null;

  return {
    fields,
    powerModelData,
    powerModelFromUrl: Boolean(powerModelData),
    activeSegmentPreset,
    hasUrlState: Object.keys(fields).length > 0 || Boolean(powerModelData) || Boolean(activeSegmentPreset),
  };
}

export function createInitialAppState({
  search = globalThis.location?.search ?? "",
  storage,
  cachedPowerModel = null,
  segmentPresets = SEGMENT_PRESETS,
} = {}) {
  const persisted = loadPersistedDefaults(storage);
  const urlState = parseUrlState(search, segmentPresets);
  return {
    formState: {
      ...DEFAULT_FORM_STATE,
      ...persisted,
      ...urlState.fields,
    },
    powerModelData: urlState.powerModelData ?? cachedPowerModel,
    powerModelFromUrl: urlState.powerModelFromUrl,
    activeSegmentPreset: urlState.activeSegmentPreset,
    hasUrlState: urlState.hasUrlState,
  };
}

export function buildUrl({
  formState,
  powerModelData,
  activeSegmentPreset,
  pathname = globalThis.location?.pathname ?? "/",
}) {
  const params = new URLSearchParams();
  for (const [short, full] of Object.entries(URL_PARAM_MAP)) {
    const value = formState[full];
    if (value != null && value !== "" && value !== DEFAULT_FORM_STATE[full]) {
      params.set(short, String(value));
    }
  }

  if (formState.powerMode === "best_effort" && isValidPowerModel(powerModelData)) {
    params.set("cp", String(powerModelData.cp));
    params.set("w2", String(powerModelData.wPrime));
    params.set("pm", String(powerModelData.pMax));
  }

  if (activeSegmentPreset) {
    params.set("sp", activeSegmentPreset);
  }

  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function syncUrl(state, history = globalThis.history) {
  const url = buildUrl(state);
  history.replaceState(null, "", url);
  return url;
}

