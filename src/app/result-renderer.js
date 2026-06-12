import { els } from "./dom.js";
import { renderEventMode, buildMobileSummaryFuji } from "./fuji-renderer.js";
import { setMobileSummary, showState } from "./ui-state.js";
import { evaluateAchievement } from "../lib/achievements.js";
import { formatCompactNumber, formatNumber, formatTime } from "../lib/format.js";

export function renderNoSolution() {
  showState("no-solution");
  setMobileSummary("No valid speed", "Check power, slope and wind.");
}

export function renderSuccess(input, result, warnings, event = null) {
  const time = formatTime(result.timeSec);
  const speed = `${formatNumber(result.speedKph, 1)} km/h`;
  const wkg = `${formatNumber(result.wattsPerKg, 2)} W/kg`;
  const mass = `${formatNumber(result.totalWeightKg, 1)} kg`;
  const wheelPower = `${formatCompactNumber(result.wheelPowerW, 0)} W`;

  els.resultHero.classList.remove("best-effort");
  els.bestEffortBadge.classList.add("hidden");
  els.metricWheelPowerLabel.textContent = "Wheel Power";
  els.effortProgress.classList.add("hidden");
  els.aboveCpWarning.classList.add("hidden");

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

  renderSharedResultSections(input, result, warnings, event);

  if (event?.id === "fuji-hc") {
    const evaluation = evaluateAchievement(result.timeSec, event.achievements);
    setMobileSummary(time, buildMobileSummaryFuji(result, evaluation));
  } else {
    setMobileSummary(time, `${speed} · ${wkg}`);
  }
}

export function renderSuccessBestEffort(input, result, warnings, event = null, powerModelData) {
  const be = result.bestEffort;
  const time = formatTime(result.timeSec);
  const speed = `${formatNumber(result.speedKph, 1)} km/h`;
  const wkg = `${formatNumber(result.wattsPerKg, 2)} W/kg`;
  const mass = `${formatNumber(result.totalWeightKg, 1)} kg`;

  els.resultHero.classList.add("best-effort");
  els.bestEffortBadge.classList.remove("hidden");
  els.predictedTime.textContent = time;
  els.scenarioSummary.textContent =
    `${formatNumber(input.segment.distanceM / 1000, 2)} km · ` +
    `${formatNumber(input.segment.gradePercent, 1)}% · ` +
    `${formatCompactNumber(be.modelPower, 0)} W` +
    `  ·  CP Model · ${formatNumber(be.effortPercent, 0)}% of CP`;
  els.metricSpeed.textContent = speed;
  els.metricWkg.textContent = wkg;
  els.metricMass.textContent = mass;

  els.metricWheelPowerLabel.textContent = "Effort";
  els.metricWheelPower.textContent = `${formatCompactNumber(be.modelPower, 0)} W`;
  els.effortProgress.classList.remove("hidden");
  const fillPct = Math.min(be.effortPercent, 100);
  els.effortProgressFill.style.width = `${fillPct}%`;
  els.effortProgressFill.className = `effort-progress-fill ${be.isAboveCp ? "above-cp" : be.effortPercent >= 99 ? "at-cp" : "below-cp"}`;

  els.riderPower.textContent = `Required Power ${formatCompactNumber(be.modelPower, 0)} W`;

  renderSharedResultSections(input, result, warnings, event);

  els.aboveCpWarning.classList.toggle("hidden", !be.isAboveCp);
  if (be.isAboveCp) {
    const overPct = formatNumber(be.effortPercent - 100, 0);
    els.aboveCpCopy.textContent = `This effort requires ${overPct}% above CP. W' drains at ${formatCompactNumber((be.modelPower - powerModelData.cp) * 60, 0)} J/min.`;
    const wpriPct = be.wPrimeTotal > 0 ? (be.wPrimeUsed / be.wPrimeTotal) * 100 : 0;
    els.wpriProgressFill.style.width = `${Math.min(wpriPct, 100)}%`;
    els.wpriProgressLabel.textContent = `${formatNumber(wpriPct, 0)}% W' used`;
  }

  if (event?.id === "fuji-hc") {
    const evaluation = evaluateAchievement(result.timeSec, event.achievements);
    setMobileSummary(time, `${buildMobileSummaryFuji(result, evaluation)} · Best Effort`);
  } else {
    setMobileSummary(time, `${speed} · ${wkg} · Best Effort`);
  }
}

function renderSharedResultSections(input, result, warnings, event) {
  showState("success");
  renderBreakdown(result);
  renderLimiter(result);
  renderDraftingResult(result);
  renderWarnings(warnings);
  renderPhysicsDetails(result);
  renderEventMode(input, result, event);
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
    barPct: Math.min(Math.max(Math.max(row.watts, 0) / riderPower, 0), 1),
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
      <span class="breakdown-label ${row.key}">${row.label}</span>
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

