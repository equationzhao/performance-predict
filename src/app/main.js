import { els } from "./dom.js";
import { initAchievementTilt } from "./achievement-tilt.js";
import { initFujiDetail } from "./fuji-detail.js?v=13";
import { computeEffectiveCda, estimateWithDrafting } from "./drafting.js";
import {
  normalizeDraftingControls,
  renderDerivedValues,
  renderDraftingControls,
  renderPresetControls,
  renderPresetStates,
  renderSegmentPresetStates,
  syncInputsFromState,
} from "./input-renderer.js";
import { renderModeToggle, renderPowerModelPanel } from "./power-model-renderer.js";
import { renderNoSolution, renderSuccess, renderSuccessBestEffort } from "./result-renderer.js";
import { clearFieldErrors, renderEmpty, renderInvalid } from "./ui-state.js";
import { createInitialAppState, persistDefaults, syncUrl } from "./url-state.js";
import { CDA_PRESETS, CRR_PRESETS, PERSISTED_FIELDS } from "../lib/presets.js";
import { SEGMENT_PRESETS } from "../lib/segment-presets.js";
import { buildPredictionResult } from "../lib/physics.js";
import { buildWarnings, validateForm } from "../lib/validation.js";
import { solveBestEffort } from "../lib/best-effort.js";
import { isValidPowerModel } from "../lib/power-model.js";
import {
  clearCredentials,
  clearPowerModel,
  fetchPowerModel,
  loadCredentials,
  loadPowerModel,
  saveCredentials,
  savePowerModel,
} from "../lib/intervals-api.js";

const initialState = createInitialAppState({ cachedPowerModel: loadPowerModel() });

let formState = initialState.formState;
let powerModelData = initialState.powerModelData;
let activeSegmentPreset = initialState.activeSegmentPreset;
let connectionState = powerModelData ? "connected" : "disconnected";
let connectionError = "";
let savedPowerW = formState.powerW || "";
let recalcTimer;

if (initialState.powerModelFromUrl && powerModelData) {
  savePowerModel(powerModelData);
}

function getActiveSegmentPreset() {
  return SEGMENT_PRESETS.find(preset => preset.id === activeSegmentPreset) ?? null;
}

function getActiveEvent() {
  return getActiveSegmentPreset()?.event ?? null;
}

function init() {
  renderPresetControls();
  syncInputsFromState(formState);
  bindEvents();

  if (powerModelData) {
    const creds = loadCredentials();
    if (creds) {
      powerModelData = { ...powerModelData, athleteId: creds.athleteId };
      handleRefresh();
    }
  } else if (formState.powerMode === "best_effort") {
    formState = { ...formState, powerMode: "manual" };
  }

  render();
  initAchievementTilt();
  initFujiDetail();
}

function bindEvents() {
  els.form.addEventListener("input", event => {
    const field = event.target.dataset.field;
    if (!field) {
      return;
    }

    const value = event.target.type === "checkbox" ? event.target.checked : event.target.value;
    formState = { ...formState, [field]: value };

    if (field === "distanceKm" || field === "gradePercent") {
      activeSegmentPreset = null;
    }
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
    persistDefaults(formState);
    syncInputsFromState(formState);
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
    persistDefaults(formState);
    syncInputsFromState(formState);
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
    persistDefaults(formState);
    syncInputsFromState(formState);
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
    persistDefaults(formState);
    syncInputsFromState(formState);
    render();
  });

  const segmentPresetWrap = document.querySelector("#segment-presets");
  if (segmentPresetWrap) {
    const closeSegmentPreset = () => {
      segmentPresetWrap.classList.remove("open");
      const trigger = segmentPresetWrap.querySelector("#segment-preset-trigger");
      if (trigger) {
        trigger.setAttribute("aria-expanded", "false");
      }
    };

    segmentPresetWrap.addEventListener("click", event => {
      const option = event.target.closest(".segment-preset-option");
      if (option) {
        const presetId = option.dataset.presetId;
        const preset = SEGMENT_PRESETS.find(item => item.id === presetId);

        closeSegmentPreset();

        if (!preset) {
          activeSegmentPreset = null;
          persistDefaults(formState);
          render();
          return;
        }

        formState = {
          ...formState,
          distanceKm: String(preset.distanceKm),
          gradePercent: String(preset.gradePercent),
          elevationM: String(preset.elevationM),
        };
        activeSegmentPreset = preset.id;
        persistDefaults(formState);
        syncInputsFromState(formState);
        render();
        return;
      }

      const trigger = event.target.closest("#segment-preset-trigger");
      if (trigger) {
        const shouldOpen = trigger.getAttribute("aria-expanded") !== "true";
        trigger.setAttribute("aria-expanded", String(shouldOpen));
        segmentPresetWrap.classList.toggle("open", shouldOpen);
        event.stopPropagation();
      }
    });

    document.addEventListener("click", event => {
      if (!segmentPresetWrap.contains(event.target)) {
        closeSegmentPreset();
      }
    });

    document.addEventListener("keydown", event => {
      if (event.key === "Escape") {
        closeSegmentPreset();
      }
    });
  }

  els.powerModeToggle.addEventListener("click", event => {
    const option = event.target.closest("[data-power-mode]");
    if (!option) return;

    const mode = option.dataset.powerMode;
    if (mode === "best_effort" && !powerModelData) return;
    if (formState.powerMode === mode) return;

    if (mode === "best_effort") {
      savedPowerW = formState.powerW;
      formState = { ...formState, powerMode: "best_effort" };
    } else {
      formState = { ...formState, powerMode: "manual", powerW: savedPowerW };
    }

    persistDefaults(formState);
    scheduleRender();
  });

  els.intervalsConnectBtn.addEventListener("click", () => handleConnect());
  els.intervalsDisconnectBtn.addEventListener("click", () => handleDisconnect());
  els.intervalsRetryBtn.addEventListener("click", () => handleConnect());
  els.intervalsRefreshBtn.addEventListener("click", () => handleRefresh());

  els.pmCp.addEventListener("input", () => handlePowerModelEdit());
  els.pmWprime.addEventListener("input", () => handlePowerModelEdit());
  els.pmPmax.addEventListener("input", () => handlePowerModelEdit());
}

function persistDefaultsIfNeeded(field) {
  if (PERSISTED_FIELDS.includes(field) || field === "cda" || field === "crr") {
    persistDefaults(formState);
  }
}

function scheduleRender() {
  clearTimeout(recalcTimer);
  recalcTimer = setTimeout(render, 80);
}

function render() {
  syncInputsFromState(formState);
  clearFieldErrors();
  renderDerivedValues(formState);
  renderPresetStates(formState);
  formState = normalizeDraftingControls(formState);
  renderDraftingControls(formState);
  renderModeToggle({ formState, powerModelData });
  renderPowerModelPanel({ connectionState, powerModelData, connectionError });
  renderSegmentPresetStates(activeSegmentPreset);

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
  syncUrl({ formState, powerModelData, activeSegmentPreset });
}

function renderPrediction(input) {
  try {
    if (input.rider.powerMode === "best_effort") {
      if (!isValidPowerModel(powerModelData)) {
        renderNoSolution();
        return;
      }
      renderBestEffortPrediction(input);
      return;
    }

    const { estimate, drafting } = estimateWithDrafting(input);
    if (!estimate || !Number.isFinite(estimate.velocity) || estimate.velocity <= 0) {
      renderNoSolution();
      return;
    }

    const result = buildPredictionResult(input, estimate, drafting);
    renderSuccess(input, result, buildWarnings(input), getActiveEvent());
  } catch (error) {
    console.error(error);
    renderNoSolution();
  }
}

function renderBestEffortPrediction(input) {
  const effectiveCda = computeEffectiveCda(input);
  const solution = solveBestEffort({
    cpModel: powerModelData,
    distanceM: input.segment.distanceM,
    slopeRatio: input.segment.slopeRatio,
    weightKg: input.rider.bodyWeightKg + input.rider.gearWeightKg,
    crr: input.equipment.crr,
    cda: effectiveCda,
    elevationM: input.segment.elevationM,
    windMps: input.segment.windMps,
    drivetrainLoss: input.rider.drivetrainLoss,
  });

  if (!solution || !Number.isFinite(solution.velocityMps) || solution.velocityMps <= 0) {
    renderNoSolution();
    return;
  }

  const syntheticInput = {
    ...input,
    rider: { ...input.rider, powerW: solution.powerW },
  };

  const { estimate, drafting } = estimateWithDrafting(syntheticInput);
  if (!estimate || !Number.isFinite(estimate.velocity) || estimate.velocity <= 0) {
    renderNoSolution();
    return;
  }

  const result = buildPredictionResult(syntheticInput, estimate, drafting);
  result.bestEffort = {
    modelPower: solution.powerW,
    timeSec: solution.timeSec,
    converged: solution.converged,
    iterations: solution.iterations,
    effortPercent: (solution.powerW / powerModelData.cp) * 100,
    isAboveCp: solution.powerW > powerModelData.cp,
    wPrimeUsed: solution.powerW > powerModelData.cp
      ? (solution.powerW - powerModelData.cp) * solution.timeSec
      : 0,
    wPrimeTotal: powerModelData.wPrime,
  };

  renderSuccessBestEffort(syntheticInput, result, buildWarnings(syntheticInput), getActiveEvent(), powerModelData);
}

async function handleConnect() {
  const athleteId = els.intervalsAthleteId.value.trim();
  const apiKey = els.intervalsApiKey.value.trim();
  if (!athleteId || !apiKey) return;

  connectionState = "loading";
  renderPowerModelPanel({ connectionState, powerModelData, connectionError });

  try {
    const model = await fetchPowerModel({ athleteId, apiKey });
    powerModelData = { ...model, athleteId, fetchedAt: Date.now() };
    saveCredentials(athleteId, apiKey);
    savePowerModel(powerModelData);
    connectionState = "connected";
  } catch (err) {
    connectionError = err.message || "Connection failed.";
    connectionState = "error";
  }

  renderPowerModelPanel({ connectionState, powerModelData, connectionError });
  scheduleRender();
}

function handleDisconnect() {
  clearCredentials();
  clearPowerModel();
  powerModelData = null;
  connectionState = "disconnected";
  connectionError = "";
  if (formState.powerMode === "best_effort") {
    formState = { ...formState, powerMode: "manual", powerW: savedPowerW };
  }
  els.intervalsAthleteId.value = "";
  els.intervalsApiKey.value = "";
  renderPowerModelPanel({ connectionState, powerModelData, connectionError });
  renderModeToggle({ formState, powerModelData });
  scheduleRender();
}

async function handleRefresh() {
  const creds = loadCredentials();
  if (!creds) return;

  connectionState = "loading";
  renderPowerModelPanel({ connectionState, powerModelData, connectionError });

  try {
    const model = await fetchPowerModel(creds);
    powerModelData = { ...model, athleteId: creds.athleteId, fetchedAt: Date.now() };
    savePowerModel(powerModelData);
    connectionState = "connected";
  } catch (err) {
    connectionError = err.message || "Refresh failed.";
    connectionState = "error";
  }

  renderPowerModelPanel({ connectionState, powerModelData, connectionError });
  scheduleRender();
}

function handlePowerModelEdit() {
  const candidate = {
    cp: Number(els.pmCp.value),
    wPrime: Number(els.pmWprime.value),
    pMax: Number(els.pmPmax.value),
  };

  if (!isValidPowerModel(candidate)) return;

  powerModelData = { ...powerModelData, ...candidate, fetchedAt: Date.now() };
  savePowerModel(powerModelData);
  scheduleRender();
}

init();
