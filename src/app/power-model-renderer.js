import { els } from "./dom.js";

export function renderModeToggle({ formState, powerModelData }) {
  const mode = formState.powerMode || "manual";
  const isManual = mode === "manual";

  for (const btn of els.powerModeToggle.querySelectorAll("[data-power-mode]")) {
    const active = btn.dataset.powerMode === mode;
    btn.setAttribute("aria-checked", String(active));
    btn.classList.toggle("active", active);
  }

  els.modeToggleSlider.dataset.active = mode;
  els.bestEffortBtn.disabled = !powerModelData;
  els.bestEffortBtn.title = powerModelData ? "" : "Connect to Intervals.icu first";
  els.manualPowerFields.classList.toggle("hidden", !isManual);
  els.bestEffortInfo.classList.toggle("hidden", isManual);
}

export function renderPowerModelPanel({ connectionState, powerModelData, connectionError }) {
  els.powerModelDisconnected.classList.toggle("hidden", connectionState !== "disconnected");
  els.powerModelLoading.classList.toggle("hidden", connectionState !== "loading");
  els.powerModelConnected.classList.toggle("hidden", connectionState !== "connected");
  els.powerModelError.classList.toggle("hidden", connectionState !== "error");

  if (connectionState === "connected" && powerModelData) {
    if (document.activeElement !== els.pmCp) els.pmCp.value = String(powerModelData.cp);
    if (document.activeElement !== els.pmWprime) els.pmWprime.value = String(powerModelData.wPrime);
    if (document.activeElement !== els.pmPmax) els.pmPmax.value = String(powerModelData.pMax);
    els.powerModelStatusPill.textContent = "Connected";
    els.powerModelStatusPill.classList.add("connected");
    els.powerModelStatusText.textContent = powerModelData.athleteId
      ? `Connected to ${powerModelData.athleteId}`
      : "Connected to Intervals.icu";
    if (powerModelData.fetchedAt) {
      const ago = Math.max(0, Math.round((Date.now() - powerModelData.fetchedAt) / 60000));
      els.pmUpdated.textContent = ago < 1 ? "Updated just now" : `Updated ${ago} min ago`;
    }
  } else if (connectionState === "error") {
    els.powerModelErrorMsg.textContent = connectionError;
    els.powerModelStatusPill.textContent = "Error";
    els.powerModelStatusPill.classList.remove("connected");
    els.powerModelStatusText.textContent = "Connection failed";
  } else if (connectionState === "loading") {
    els.powerModelStatusPill.textContent = "Loading";
    els.powerModelStatusPill.classList.remove("connected");
  } else {
    els.powerModelStatusPill.textContent = "Disconnected";
    els.powerModelStatusPill.classList.remove("connected");
    els.powerModelStatusText.textContent = "Connect to Intervals.icu to unlock Best Effort.";
  }
}

