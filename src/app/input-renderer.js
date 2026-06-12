import { els } from "./dom.js";
import { BIKE_TYPES, CDA_PRESETS, CRR_PRESETS, TERRAIN_LABELS } from "../lib/presets.js";
import { SEGMENT_PRESETS } from "../lib/segment-presets.js";
import { clamp, formatNumber, formatSignedMeters } from "../lib/format.js";

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

export function renderPresetControls() {
  const spContainer = document.querySelector("#segment-presets");
  if (spContainer) {
    const options = SEGMENT_PRESETS.map(
      preset => `
        <button type="button" class="segment-preset-option" data-preset-id="${preset.id}" role="option" aria-selected="false">
          <span class="segment-preset-option-title">${preset.name}</span>
          <span class="segment-preset-option-meta">${formatNumber(preset.distanceKm, 1)} km · ${formatNumber(preset.gradePercent, 1)}%</span>
        </button>
      `
    ).join("");
    spContainer.innerHTML = `
      <button type="button" class="segment-preset-trigger" id="segment-preset-trigger" aria-haspopup="listbox" aria-expanded="false" aria-controls="segment-preset-list">
        <span class="segment-preset-trigger-copy">
          <span class="segment-preset-selected-label" id="segment-preset-selected-label">Choose a segment preset</span>
          <span class="segment-preset-selected-meta" id="segment-preset-selected-meta">Select to fill distance and grade</span>
        </span>
        <span class="segment-preset-caret" aria-hidden="true"></span>
      </button>
      <div class="segment-preset-list" id="segment-preset-list" role="listbox" aria-label="Segment preset">
        <button type="button" class="segment-preset-option" data-preset-id="" role="option" aria-selected="false">
          <span class="segment-preset-option-title">No preset</span>
          <span class="segment-preset-option-meta">Keep manual distance and grade</span>
        </button>
        ${options}
      </div>
    `;
  }

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

export function syncInputsFromState(formState) {
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

export function renderDerivedValues(formState) {
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

export function renderPresetStates(formState) {
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

export function normalizeDraftingControls(formState) {
  const riders = clampInt(Number(formState.draftRiders) || 2, 2, 8);
  const position = clampInt(Number(formState.draftPosition) || riders, 1, riders);
  const workPercent = clampInt(Number(formState.draftWorkPercent) || 0, 0, 100);
  return {
    ...formState,
    draftRiders: String(riders),
    draftPosition: String(position),
    draftWorkPercent: String(workPercent),
  };
}

export function renderDraftingControls(formState) {
  const enabled = Boolean(formState.draftingEnabled);
  const rotating = Boolean(formState.draftRotating);
  const riders = Number(formState.draftRiders) || 2;
  const position = Number(formState.draftPosition) || riders;
  const workPercent = Number(formState.draftWorkPercent) || 0;

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

export function renderSegmentPresetStates(activeSegmentPreset) {
  const container = document.querySelector("#segment-presets");
  const selectedLabel = document.querySelector("#segment-preset-selected-label");
  const selectedMeta = document.querySelector("#segment-preset-selected-meta");
  if (!container || !selectedLabel || !selectedMeta) return;

  const active = SEGMENT_PRESETS.find(item => item.id === activeSegmentPreset) ?? null;

  if (active) {
    selectedLabel.textContent = active.name;
    selectedMeta.textContent = `${formatNumber(active.distanceKm, 1)} km · ${formatNumber(active.gradePercent, 1)}%`;
  } else {
    selectedLabel.textContent = "Choose a segment preset";
    selectedMeta.textContent = "Select to fill distance and grade";
  }

  for (const option of container.querySelectorAll(".segment-preset-option")) {
    const isSelected = option.dataset.presetId === activeSegmentPreset;
    option.setAttribute("aria-selected", String(isSelected));
    option.classList.toggle("is-selected", isSelected);
  }
}
