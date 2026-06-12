import { createInitialAppState, parseUrlState, buildUrl } from "../src/app/url-state.js";
import { DEFAULT_FORM_STATE } from "../src/lib/presets.js";

function assert(condition, message) {
  if (!condition) {
    throw new Error(`FAIL: ${message}`);
  }
}

function createStorage(seed = {}) {
  const data = new Map(Object.entries(seed));
  return {
    getItem(key) {
      return data.has(key) ? data.get(key) : null;
    },
    setItem(key, value) {
      data.set(key, String(value));
    },
    removeItem(key) {
      data.delete(key);
    },
  };
}

console.log("Checking URL state parsing...");

const search = "?d=24&g=5.229&e=1680&bw=68&gw=8&p=316&cda=0.32&crr=0.005&sp=fuji";
const parsed = parseUrlState(search);
assert(parsed.fields.distanceKm === "24", "distance should parse");
assert(parsed.fields.gradePercent === "5.229", "grade should parse");
assert(parsed.fields.elevationM === "1680", "elevation should parse");
assert(parsed.fields.bodyWeightKg === "68", "body weight should parse");
assert(parsed.fields.gearWeightKg === "8", "gear weight should parse");
assert(parsed.fields.powerW === "316", "power should parse");
assert(parsed.fields.cda === "0.32", "cda should parse");
assert(parsed.fields.crr === "0.005", "crr should parse");
assert(parsed.activeSegmentPreset === "fuji", "Fuji preset should parse");

const storage = createStorage({
  "segment-performance-predictor-defaults-v1": JSON.stringify({
    bodyWeightKg: "72",
    gearWeightKg: "10",
    powerW: "280",
  }),
});

const noUrlInitial = createInitialAppState({ search: "", storage, cachedPowerModel: null });
assert(noUrlInitial.formState.bodyWeightKg === "72", "no URL should restore persisted body weight");
assert(noUrlInitial.formState.gearWeightKg === "10", "no URL should restore persisted gear weight");
assert(noUrlInitial.formState.powerW === "280", "no URL should restore persisted power");
assert(noUrlInitial.activeSegmentPreset === null, "no URL should not invent an active preset");

const initial = createInitialAppState({ search, storage, cachedPowerModel: null });
assert(initial.formState.bodyWeightKg === "68", "URL should override persisted body weight");
assert(initial.formState.gearWeightKg === "8", "URL should override persisted gear weight");
assert(initial.formState.powerW === "316", "URL should override persisted power");
assert(initial.formState.windMps === DEFAULT_FORM_STATE.windMps, "missing URL fields should use defaults when no cache exists");
assert(initial.activeSegmentPreset === "fuji", "initial preset should restore");

const invalid = parseUrlState("?sp=unknown&cp=300&w2=20000&pm=250");
assert(invalid.activeSegmentPreset === null, "unknown preset should be ignored");
assert(invalid.powerModelData === null, "invalid power model should be ignored");

const built = buildUrl({
  formState: initial.formState,
  powerModelData: null,
  activeSegmentPreset: initial.activeSegmentPreset,
  pathname: "/",
});
assert(built.includes("d=24"), "built URL should include distance");
assert(built.includes("sp=fuji"), "built URL should include preset");
assert(!built.includes("w=0"), "built URL should omit default wind");

console.log("URL state checks passed.");
