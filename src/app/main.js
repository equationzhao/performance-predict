import {
  BIKE_TYPES,
  CDA_PRESETS,
  CRR_PRESETS,
  DEFAULT_FORM_STATE,
  PERSISTED_FIELDS,
  TERRAIN_LABELS,
} from "../lib/presets.js";
import {
  buildPredictionResult,
  cyclingDraftDragReduction,
  cyclingPowerEstimate,
  cyclingPowerFastestVelocitySearch,
  cyclingPowerVelocitySearchMultiPosition,
} from "../lib/physics.js";
import { buildWarnings, validateForm } from "../lib/validation.js";
import { clamp, formatCompactNumber, formatNumber, formatSignedMeters, formatTime } from "../lib/format.js";

const STORAGE_KEY = "segment-performance-predictor-defaults-v1";

const els = {
  form: document.querySelector("#predictor-form"),
  mobileSummary: document.querySelector("#mobile-summary"),
  elevationGain: document.querySelector("#elevation-gain"),
  totalWeight: document.querySelector("#total-weight"),
  powerToWeight: document.querySelector("#power-to-weight"),
  cdaPresets: document.querySelector("#cda-presets"),
  cdaRange: document.querySelector("#cdaRange"),
  cdaStatus: document.querySelector("#cda-status"),
  crrStatus: document.querySelector("#crr-status"),
  draftingOptions: document.querySelector("#drafting-options"),
  draftRiders: document.querySelector("#draftRiders"),
  draftRidersValue: document.querySelector("#draft-riders-value"),
  draftPosition: document.querySelector("#draftPosition"),
  draftPositionValue: document.querySelector("#draft-position-value"),
  draftStaticOptions: document.querySelector("#draft-static-options"),
  draftRotatingOptions: document.querySelector("#draft-rotating-options"),
  draftWorkPercent: document.querySelector("#draftWorkPercent"),
  draftWorkValue: document.querySelector("#draft-work-value"),
  draftGroupBodyWeightKg: document.querySelector("#draftGroupBodyWeightKg"),
  draftGroupWeightField: document.querySelector("#draft-group-weight-field"),
  bikeType: document.querySelector("#bike-type"),
  terrain: document.querySelector("#terrain"),
  resultEmpty: document.querySelector("#result-empty"),
  resultInvalid: document.querySelector("#result-invalid"),
  resultNoSolution: document.querySelector("#result-no-solution"),
  resultSuccess: document.querySelector("#result-success"),
  missingList: document.querySelector("#missing-list"),
  predictedTime: document.querySelector("#predicted-time"),
  scenarioSummary: document.querySelector("#scenario-summary"),
  metricSpeed: document.querySelector("#metric-speed"),
  metricWkg: document.querySelector("#metric-wkg"),
  metricMass: document.querySelector("#metric-mass"),
  metricWheelPower: document.querySelector("#metric-wheel-power"),
  riderPower: document.querySelector("#rider-power"),
  barGravity: document.querySelector("#bar-gravity"),
  barAero: document.querySelector("#bar-aero"),
  barRolling: document.querySelector("#bar-rolling"),
  barLoss: document.querySelector("#bar-loss"),
  breakdownList: document.querySelector("#breakdown-list"),
  limiterTitle: document.querySelector("#limiter-title"),
  limiterCopy: document.querySelector("#limiter-copy"),
  draftingOutput: document.querySelector("#drafting-output"),
  draftingSummary: document.querySelector("#drafting-summary"),
  draftingEffectiveCda: document.querySelector("#drafting-effective-cda"),
  draftingReduction: document.querySelector("#drafting-reduction"),
  draftingGroupPower: document.querySelector("#drafting-group-power"),
  draftingVariance: document.querySelector("#drafting-variance"),
  assumptionDrafting: document.querySelector("#assumption-drafting"),
  warningList: document.querySelector("#warning-list"),
  detailGForce: document.querySelector("#detail-g-force"),
  detailAForce: document.querySelector("#detail-a-force"),
  detailRForce: document.querySelector("#detail-r-force"),
  detailForce: document.querySelector("#detail-force"),
  detailAirDensity: document.querySelector("#detail-air-density"),
  detailEffectiveCda: document.querySelector("#detail-effective-cda"),
  detailVelocity: document.querySelector("#detail-velocity"),
  detailSlope: document.querySelector("#detail-slope"),
  detailLoss: document.querySelector("#detail-loss"),
};

let formState = loadInitialState();
let recalcTimer;

init();

function init() {
  renderPresetControls();
  syncInputsFromState();
  bindEvents();
  render();
}

function loadInitialState() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    const allowed = Object.fromEntries(PERSISTED_FIELDS.map(field => [field, stored[field]]));
    for (const key of Object.keys(allowed)) {
      if (allowed[key] === undefined) {
        delete allowed[key];
      }
    }
    return { ...DEFAULT_FORM_STATE, ...allowed };
  } catch {
    return { ...DEFAULT_FORM_STATE };
  }
}

function persistDefaults() {
  const persisted = {};
  for (const field of PERSISTED_FIELDS) {
    persisted[field] = formState[field];
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
}

function renderPresetControls() {
  els.cdaPresets.innerHTML = "";
  for (const [key, preset] of Object.entries(CDA_PRESETS)) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "preset-button";
    button.dataset.cdaPreset = key;
    button.innerHTML = `<strong>${preset.label}</strong><span>${preset.value.toFixed(2)}</span>`;
    button.title = preset.description;
    els.cdaPresets.append(button);
  }
  const customButton = document.createElement("button");
  customButton.type = "button";
  customButton.className = "preset-button";
  customButton.dataset.cdaPreset = "custom";
  customButton.innerHTML = "<strong>Custom</strong><span>manual</span>";
  els.cdaPresets.append(customButton);

  els.bikeType.innerHTML = "";
  for (const [key, label] of Object.entries(BIKE_TYPES)) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "segment-button";
    button.dataset.bikeType = key;
    button.textContent = label;
    els.bikeType.append(button);
  }

  els.terrain.innerHTML = "";
  for (const [key, label] of Object.entries(TERRAIN_LABELS)) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "segment-button";
    button.dataset.terrain = key;
    button.textContent = label;
    els.terrain.append(button);
  }
}

function bindEvents() {
  els.form.addEventListener("input", event => {
    const field = event.target.dataset.field;
    if (!field) {
      return;
    }
    const value = event.target.type === "checkbox" ? event.target.checked : event.target.value;
    formState = { ...formState, [field]: value };
    if (field === "cda") {
      formState.cdaModified = true;
    }
    if (field === "crr") {
      formState.crrModified = true;
    }
    persistDefaultsIfNeeded(field);
    scheduleRender();
  });

  els.cdaRange.addEventListener("input", event => {
    formState = {
      ...formState,
      cda: Number(event.target.value).toFixed(3),
      cdaModified: true,
    };
    persistDefaults();
    syncInputsFromState();
    scheduleRender();
  });

  els.cdaPresets.addEventListener("click", event => {
    const button = event.target.closest("[data-cda-preset]");
    if (!button) {
      return;
    }
    const presetKey = button.dataset.cdaPreset;
    if (presetKey === "custom") {
      formState = { ...formState, cdaPreset: "custom", cdaModified: true };
    } else {
      formState = {
        ...formState,
        cdaPreset: presetKey,
        cda: CDA_PRESETS[presetKey].value.toFixed(3),
        cdaModified: false,
      };
    }
    persistDefaults();
    syncInputsFromState();
    render();
  });

  els.bikeType.addEventListener("click", event => {
    const button = event.target.closest("[data-bike-type]");
    if (!button) {
      return;
    }
    formState = {
      ...formState,
      bikeType: button.dataset.bikeType,
      crr: CRR_PRESETS[button.dataset.bikeType][formState.terrain].toFixed(4),
      crrModified: false,
    };
    persistDefaults();
    syncInputsFromState();
    render();
  });

  els.terrain.addEventListener("click", event => {
    const button = event.target.closest("[data-terrain]");
    if (!button) {
      return;
    }
    formState = {
      ...formState,
      terrain: button.dataset.terrain,
      crr: CRR_PRESETS[formState.bikeType][button.dataset.terrain].toFixed(4),
      crrModified: false,
    };
    persistDefaults();
    syncInputsFromState();
    render();
  });
}

function persistDefaultsIfNeeded(field) {
  if (PERSISTED_FIELDS.includes(field) || field === "cda" || field === "crr") {
    persistDefaults();
  }
}

function scheduleRender() {
  clearTimeout(recalcTimer);
  recalcTimer = setTimeout(render, 80);
}

function syncInputsFromState() {
  for (const input of document.querySelectorAll("[data-field]")) {
    const field = input.dataset.field;
    if (field in formState) {
      if (input.type === "checkbox") {
        input.checked = Boolean(formState[field]);
      } else {
        input.value = formState[field] ?? "";
      }
    }
  }
  const cdaNumber = Number(formState.cda);
  els.cdaRange.value = Number.isFinite(cdaNumber) ? String(clamp(cdaNumber, 0.15, 0.7)) : "0.32";
}

function render() {
  syncInputsFromState();
  clearFieldErrors();
  renderDerivedValues();
  renderPresetStates();
  renderDraftingControls();

  const validation = validateForm(formState);
  if (validation.status === "empty") {
    renderEmpty(validation.missingFields);
    return;
  }
  if (validation.status === "invalid") {
    renderInvalid(validation.errors);
    return;
  }
  renderPrediction(validation.input);
}

function renderDerivedValues() {
  const distanceKm = parseLooseNumber(formState.distanceKm);
  const gradePercent = parseLooseNumber(formState.gradePercent);
  const bodyWeightKg = parseLooseNumber(formState.bodyWeightKg);
  const gearWeightKg = parseLooseNumber(formState.gearWeightKg);
  const powerW = parseLooseNumber(formState.powerW);

  if (Number.isFinite(distanceKm) && Number.isFinite(gradePercent)) {
    els.elevationGain.textContent = formatSignedMeters(distanceKm * 1000 * (gradePercent / 100));
  } else {
    els.elevationGain.textContent = "--";
  }

  if (Number.isFinite(bodyWeightKg) && Number.isFinite(gearWeightKg)) {
    els.totalWeight.textContent = `${formatNumber(bodyWeightKg + gearWeightKg, 1)} kg`;
  } else {
    els.totalWeight.textContent = "--";
  }

  if (Number.isFinite(bodyWeightKg) && bodyWeightKg > 0 && Number.isFinite(powerW)) {
    els.powerToWeight.textContent = `${formatNumber(powerW / bodyWeightKg, 2)} W/kg`;
  } else {
    els.powerToWeight.textContent = "--";
  }
}

function renderPresetStates() {
  for (const button of els.cdaPresets.querySelectorAll("[data-cda-preset]")) {
    const pressed =
      button.dataset.cdaPreset === formState.cdaPreset ||
      (formState.cdaModified && button.dataset.cdaPreset === "custom");
    button.setAttribute("aria-pressed", String(pressed));
  }
  const cdaPresetLabel = CDA_PRESETS[formState.cdaPreset]?.label || "Custom";
  els.cdaStatus.textContent = formState.cdaModified
    ? `${cdaPresetLabel} modified`
    : `${cdaPresetLabel} preset`;

  for (const button of els.bikeType.querySelectorAll("[data-bike-type]")) {
    button.setAttribute("aria-pressed", String(button.dataset.bikeType === formState.bikeType));
  }
  for (const button of els.terrain.querySelectorAll("[data-terrain]")) {
    button.setAttribute("aria-pressed", String(button.dataset.terrain === formState.terrain));
  }
  const bike = BIKE_TYPES[formState.bikeType] || "Custom bike";
  const terrain = TERRAIN_LABELS[formState.terrain] || "Custom surface";
  els.crrStatus.textContent = formState.crrModified
    ? `${bike} on ${terrain} modified`
    : `${bike} on ${terrain}`;
}

function renderDraftingControls() {
  const enabled = Boolean(formState.draftingEnabled);
  const rotating = Boolean(formState.draftRotating);
  const riders = clampInt(Number(formState.draftRiders) || 2, 2, 8);
  const position = clampInt(Number(formState.draftPosition) || riders, 1, riders);
  const workPercent = clampInt(Number(formState.draftWorkPercent) || 0, 0, 100);

  formState.draftRiders = String(riders);
  formState.draftPosition = String(position);
  formState.draftWorkPercent = String(workPercent);

  els.draftingOptions.classList.toggle("hidden", !enabled);
  els.draftRiders.value = String(riders);
  els.draftRidersValue.textContent = String(riders);
  els.draftPosition.max = String(riders);
  els.draftPosition.value = String(position);
  els.draftPositionValue.textContent = String(position);
  els.draftWorkPercent.value = String(workPercent);
  els.draftWorkValue.textContent = `${workPercent}%`;
  els.draftStaticOptions.classList.toggle("hidden", rotating);
  els.draftRotatingOptions.classList.toggle("hidden", !rotating);

  const groupDisabled = Boolean(formState.draftUseSameWeight);
  els.draftGroupBodyWeightKg.disabled = groupDisabled;
  els.draftGroupWeightField.classList.toggle("disabled", groupDisabled);
}

function renderEmpty(missingFields) {
  showState("empty");
  els.missingList.innerHTML = "";
  for (const field of missingFields) {
    const chip = document.createElement("span");
    chip.className = "missing-chip";
    chip.textContent = field;
    els.missingList.append(chip);
  }
  setMobileSummary("Ready to predict", `Missing: ${missingFields.join(", ")}`);
}

function renderInvalid(errors) {
  showState("invalid");
  for (const [field, message] of Object.entries(errors)) {
    setFieldError(field, message);
  }
  setMobileSummary("Cannot calculate", "Fix highlighted fields.");
}

function renderPrediction(input) {
  try {
    const { estimate, drafting } = estimateWithDrafting(input);

    if (!estimate || !Number.isFinite(estimate.velocity) || estimate.velocity <= 0) {
      renderNoSolution();
      return;
    }

    const result = buildPredictionResult(input, estimate, drafting);
    showState("success");
    renderSuccess(input, result, buildWarnings(input));
  } catch (error) {
    console.error(error);
    renderNoSolution();
  }
}

function renderNoSolution() {
  showState("no-solution");
  setMobileSummary("No valid speed", "Check power, slope and wind.");
}

function renderSuccess(input, result, warnings) {
  const time = formatTime(result.timeSec);
  const speed = `${formatNumber(result.speedKph, 1)} km/h`;
  const wkg = `${formatNumber(result.wattsPerKg, 2)} W/kg`;
  const mass = `${formatNumber(result.totalWeightKg, 1)} kg`;
  const wheelPower = `${formatCompactNumber(result.wheelPowerW, 0)} W`;

  els.predictedTime.textContent = time;
  els.scenarioSummary.textContent =
    `${formatNumber(input.segment.distanceM / 1000, 2)} km · ` +
    `${formatNumber(input.segment.gradePercent, 1)}% · ` +
    `${formatCompactNumber(input.rider.powerW, 0)} W`;
  els.metricSpeed.textContent = speed;
  els.metricWkg.textContent = wkg;
  els.metricMass.textContent = mass;
  els.metricWheelPower.textContent = wheelPower;
  els.riderPower.textContent = `Rider Power ${formatCompactNumber(result.riderPowerW, 0)} W`;

  renderBreakdown(result);
  renderLimiter(result);
  renderDraftingResult(result);
  renderWarnings(warnings);
  renderPhysicsDetails(result);
  setMobileSummary(time, `${speed} · ${wkg}`);
}

function estimateWithDrafting(input) {
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

function buildRotatingPositions(riders, workPct) {
  const positions = [];
  for (let i = workPct ? 0 : 1; i < riders; i += 1) {
    const pct = i === 0 ? workPct : ((1 / (riders - 1)) * (1 - workPct));
    if (pct) {
      positions.push({ position: i + 1, pct });
    }
  }
  return positions;
}

function buildDraftingAnalysis(input, baseArgs, estimate, positions, staticEffectiveCda) {
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

function renderBreakdown(result) {
  const riderPower = Math.max(result.riderPowerW, 1);
  const rows = [
    { key: "gravity", label: "Gravity", watts: result.gravityWatts },
    { key: "aero", label: "Aero", watts: result.aeroWatts },
    { key: "rolling", label: "Rolling", watts: result.rollingWatts },
    { key: "loss", label: "Loss", watts: result.lossWatts },
  ].map(row => ({
    ...row,
    pct: row.watts / riderPower,
    barPct: clamp(Math.max(row.watts, 0) / riderPower, 0, 1),
  }));

  els.barGravity.style.width = `${rows[0].barPct * 100}%`;
  els.barAero.style.width = `${rows[1].barPct * 100}%`;
  els.barRolling.style.width = `${rows[2].barPct * 100}%`;
  els.barLoss.style.width = `${rows[3].barPct * 100}%`;

  els.breakdownList.innerHTML = "";
  for (const row of rows) {
    const item = document.createElement("div");
    item.className = "breakdown-row";
    item.innerHTML = `
      <span class="breakdown-label"><span class="dot ${row.key}"></span>${row.label}</span>
      <strong>${formatCompactNumber(row.watts, 0)} W</strong>
      <span>${formatNumber(row.pct * 100, 0)}%</span>
    `;
    els.breakdownList.append(item);
  }
}

function renderLimiter(result) {
  const magnitudes = [
    { key: "gravity", watts: Math.abs(result.gravityWatts) },
    { key: "aero", watts: Math.abs(result.aeroWatts) },
    { key: "rolling", watts: Math.abs(result.rollingWatts) },
  ];
  magnitudes.sort((a, b) => b.watts - a.watts);
  const rollingShare = Math.abs(result.rollingWatts) / Math.max(result.wheelPowerW, 1);

  if (rollingShare > 0.22) {
    els.limiterTitle.textContent = "Rolling resistance is high";
    els.limiterCopy.textContent = "Tire, pressure and surface assumptions strongly affect the result.";
    return;
  }

  if (magnitudes[0].key === "aero") {
    els.limiterTitle.textContent = "Aero drag dominates";
    els.limiterCopy.textContent = "Position and CdA changes may have a large impact.";
  } else if (magnitudes[0].key === "rolling") {
    els.limiterTitle.textContent = "Rolling resistance dominates";
    els.limiterCopy.textContent = "Tire, pressure and surface assumptions strongly affect the result.";
  } else {
    els.limiterTitle.textContent = "Gravity dominates";
    els.limiterCopy.textContent = "Reducing total weight or increasing power will matter more than small aero gains.";
  }
}

function renderWarnings(warnings) {
  els.warningList.innerHTML = "";
  for (const warning of warnings) {
    const callout = document.createElement("div");
    callout.className = "warning-callout";
    callout.textContent = warning;
    els.warningList.append(callout);
  }
}

function renderDraftingResult(result) {
  const drafting = result.drafting;
  els.draftingOutput.classList.toggle("hidden", !drafting?.enabled);
  if (!drafting?.enabled) {
    els.assumptionDrafting.textContent = "Does not account for drafting.";
    return;
  }
  els.draftingSummary.textContent = drafting.summary;
  els.draftingEffectiveCda.textContent = `${formatNumber(drafting.effectiveCda, 3)} m²`;
  els.draftingReduction.textContent = `${formatNumber(drafting.dragReductionPct, 1)}%`;
  els.draftingGroupPower.textContent = `${formatCompactNumber(drafting.groupPowerW, 0)} W`;
  els.draftingVariance.textContent = `${formatNumber(drafting.powerVariancePct, 0)}%`;
  els.assumptionDrafting.textContent = drafting.mode === "rotating"
    ? "Drafting enabled with rotating paceline positions."
    : "Drafting enabled for a static group position.";
}

function renderPhysicsDetails(result) {
  els.detailGForce.textContent = `${formatNumber(result.gravityForceN, 2)} N`;
  els.detailAForce.textContent = `${formatNumber(result.aeroForceN, 2)} N`;
  els.detailRForce.textContent = `${formatNumber(result.rollingForceN, 2)} N`;
  els.detailForce.textContent = `${formatNumber(result.totalForceN, 2)} N`;
  els.detailAirDensity.textContent = `${formatNumber(result.airDensity, 3)} kg/m³`;
  els.detailEffectiveCda.textContent = `${formatNumber(result.effectiveCda, 3)} m²`;
  els.detailVelocity.textContent = `${formatNumber(result.velocityMps, 3)} m/s`;
  els.detailSlope.textContent = formatNumber(result.slopeRatio, 4);
  els.detailLoss.textContent = formatNumber(result.drivetrainLoss, 3);
}

function clearFieldErrors() {
  for (const field of document.querySelectorAll(".field.error")) {
    field.classList.remove("error");
  }
  for (const message of document.querySelectorAll("[data-error-for]")) {
    message.textContent = "";
  }
}

function setFieldError(field, message) {
  const input = document.querySelector(`[data-field="${field}"]`);
  const container = input?.closest(".field");
  const messageEl = document.querySelector(`[data-error-for="${field}"]`);
  container?.classList.add("error");
  if (messageEl) {
    messageEl.textContent = message;
  }
}

function showState(state) {
  els.resultEmpty.classList.toggle("hidden", state !== "empty");
  els.resultInvalid.classList.toggle("hidden", state !== "invalid");
  els.resultNoSolution.classList.toggle("hidden", state !== "no-solution");
  els.resultSuccess.classList.toggle("hidden", state !== "success");
}

function setMobileSummary(title, metrics) {
  els.mobileSummary.querySelector(".mobile-summary-title").textContent = title;
  els.mobileSummary.querySelector(".mobile-summary-metrics").textContent = metrics;
}

function parseLooseNumber(value) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) {
    return NaN;
  }
  return Number(trimmed);
}

function clampInt(value, min, max) {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.round(clamp(value, min, max));
}
