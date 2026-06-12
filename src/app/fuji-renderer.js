import { els } from "./dom.js";
import { computeEffectiveCda } from "./drafting.js";
import { evaluateAchievement } from "../lib/achievements.js";
import { formatCompactNumber, formatNumber, formatTime } from "../lib/format.js";
import { buildTargetPowerTable } from "../lib/target-power.js";

function getMotionLevel(tier) {
  return { outside: 0, finish: 1, blue: 2, bronze: 3, silver: 4, gold: 5, platinum: 6, sub55: 7 }[tier] ?? 1;
}

let lastFujiTier = null;

function applyFujiTier(tier) {
  const card = els.fujiAchievementCard;
  card.dataset.tier = tier;
  card.dataset.motionLevel = String(getMotionLevel(tier));

  if (lastFujiTier && lastFujiTier !== tier) {
    card.classList.remove("rank-reveal");
    void card.offsetWidth;
    card.classList.add("rank-reveal");
  }

  lastFujiTier = tier;
}

export function hideFujiMode() {
  els.fujiEventCard.classList.add("hidden");
  els.fujiAchievementCard.classList.add("hidden");
  els.fujiRingLadder.classList.add("hidden");
  els.fujiCheckpoints.classList.add("hidden");
}

function formatSignedPower(deltaW) {
  if (!Number.isFinite(deltaW)) return "--";
  const rounded = Math.round(deltaW);
  if (rounded === 0) return "same as current";
  return `${rounded > 0 ? "+" : ""}${rounded} W`;
}

export function renderEventMode(input, result, event) {
  try {
    if (!event || event.id !== "fuji-hc") {
      hideFujiMode();
      return;
    }

    renderFujiEventHeader(event);
    renderFujiAchievement(input, result, event);
    renderFujiRingLadder(input, result, event);
    renderFujiCheckpoints(result, event);
  } catch (error) {
    console.error("Fuji render error:", error);
    hideFujiMode();
  }
}

function renderFujiEventHeader(event) {
  els.fujiEventCard.classList.remove("hidden");
  els.fujiCourseSummary.textContent =
    `${event.routeName} · ${event.measuredDistanceKm} km measured · +${event.elevationGainM} m`;
  els.fujiCourseDetail.textContent =
    `avg ${event.averageGradePercent}% · max ${event.maxGradePercent}% · ${event.startLabel} → ${event.finishLabel}`;
  els.fujiSourceConfidence.textContent =
    event.sourceNotes.map(n => n.text).join(" · ");
}

function renderFujiAchievement(input, result, event) {
  const evaluation = evaluateAchievement(result.timeSec, event.achievements);
  const effectiveCda = computeEffectiveCda(input);
  const table = buildTargetPowerTable(input, event.achievements, input.rider.powerW, effectiveCda);
  const nextRow = evaluation.next
    ? table.find(row => row.id === evaluation.next.id)
    : null;

  els.fujiAchievementCard.classList.remove("hidden");
  const tier = evaluation.achieved?.id ?? "outside";
  applyFujiTier(tier);

  els.fujiBigTime.textContent = formatTime(result.timeSec);

  if (evaluation.outsideCutoff) {
    const finishThreshold = event.achievements.find(a => a.id === "finish")?.thresholdSec;
    els.fujiAchievementKicker.textContent = "Achievement";
    els.fujiAchievementTitle.textContent = "Outside official finish cutoff";
    els.fujiAchievementGap.textContent = finishThreshold
      ? `Finish cutoff is ${formatTime(finishThreshold)}. Current prediction is ${formatTime(result.timeSec)}.`
      : "Prediction exceeds finish cutoff.";
    els.fujiAchievementTarget.classList.add("hidden");
  } else if (!evaluation.next) {
    const rewardText = evaluation.achieved?.reward ? ` — ${evaluation.achieved.reward}` : "";
    els.fujiAchievementKicker.textContent = tier === "sub55" ? "Record Challenge" : "Achievement";
    els.fujiAchievementTitle.textContent = `${evaluation.achieved.label} achieved${rewardText}`;
    els.fujiAchievementGap.textContent = "Top target — no higher goal.";
    els.fujiAchievementTarget.classList.add("hidden");
  } else {
    els.fujiAchievementKicker.textContent = tier === "sub55" ? "Record Challenge" : "Achievement";
    els.fujiAchievementTitle.textContent =
      `${evaluation.achieved?.label ?? "No ring"} predicted`;
    els.fujiAchievementGap.textContent =
      `${evaluation.next.label} is ${formatTime(evaluation.gapToNextSec)} away`;

    els.fujiAchievementTarget.classList.remove("hidden");
    if (nextRow?.requiredPowerW != null) {
      els.fujiTargetPower.textContent =
        `${evaluation.next.shortLabel} needs ${formatCompactNumber(nextRow.requiredPowerW, 0)} W / ${formatNumber(nextRow.requiredWkg, 2)} W/kg`;
      els.fujiTargetCopy.textContent =
        `${formatSignedPower(nextRow.deltaPowerW)} from current target`;
    } else {
      els.fujiTargetPower.textContent = "--";
      els.fujiTargetCopy.textContent = "No stable power solution under current inputs.";
    }
  }
}

function renderFujiRingLadder(input, result, event) {
  const effectiveCda = computeEffectiveCda(input);
  const table = buildTargetPowerTable(input, event.achievements, input.rider.powerW, effectiveCda);
  const evaluation = evaluateAchievement(result.timeSec, event.achievements);

  els.fujiRingLadder.classList.remove("hidden");
  els.fujiRingLadderList.innerHTML = "";

  const achievedCount = evaluation.achieved
    ? table.filter(r => r.thresholdSec >= evaluation.achieved.thresholdSec).length
    : 0;
  els.fujiLadderSummary.textContent = `${achievedCount}/${table.length} achieved`;

  for (const row of table) {
    const step = document.createElement("div");
    step.className = "ring-step";

    const isAchieved = evaluation.achieved && row.thresholdSec >= evaluation.achieved.thresholdSec;
    const isNext = evaluation.next?.id === row.id;
    const isCurrent = evaluation.achieved?.id === row.id;

    if (isAchieved) step.classList.add("achieved");
    if (isNext) step.classList.add("next");
    if (isCurrent) step.classList.add("current");
    if (row.id === "sub55") step.classList.add("ring-sub55");
    if (evaluation.outsideCutoff && row.id === "finish") step.classList.add("outside");

    step.style.setProperty("--ring-color", `var(${row.colorToken})`);

    const powerText = row.requiredPowerW != null
      ? `${formatCompactNumber(row.requiredPowerW, 0)} W`
      : "--";
    const deltaText = row.deltaPowerW != null
      ? formatSignedPower(row.deltaPowerW)
      : "";
    const statusText = isAchieved ? "achieved" : isNext ? "target" : deltaText;

    step.innerHTML = `
      <span class="ring-label" style="color: var(${row.colorToken})">${row.shortLabel}</span>
      <span class="ring-time">${formatTime(row.thresholdSec)}</span>
      <span class="ring-power">${powerText}</span>
      <span class="ring-status">${statusText}</span>
    `;

    els.fujiRingLadderList.appendChild(step);
  }
}

function renderFujiCheckpoints(result, event) {
  els.fujiCheckpoints.classList.remove("hidden");
  els.fujiCheckpointStrip.innerHTML = "";

  const velocityMps = result.velocityMps;
  if (!Number.isFinite(velocityMps) || velocityMps <= 0) return;

  for (const cp of event.checkpoints) {
    const etaSec = (cp.distanceKm * 1000) / velocityMps;
    const isOverCutoff = cp.cutoffSec != null && etaSec > cp.cutoffSec;

    let dotClass = "";
    if (cp.kind === "start") dotClass = "safe";
    else if (cp.kind === "split") dotClass = "split";
    else if (isOverCutoff) dotClass = "danger";
    else if (cp.cutoffSec != null && etaSec > cp.cutoffSec * 0.9) dotClass = "risk";
    else dotClass = "safe";

    const checkpoint = document.createElement("div");
    checkpoint.className = "checkpoint";
    checkpoint.innerHTML = `
      <div class="checkpoint-dot ${dotClass}"></div>
      <span class="checkpoint-label">${cp.label}</span>
      <span class="checkpoint-eta">${cp.kind === "start" ? "--" : formatTime(etaSec)}</span>
      ${cp.cutoffSec != null
        ? `<span class="checkpoint-status ${isOverCutoff ? "over-cutoff" : ""}">${isOverCutoff ? "over cutoff" : "safe"}</span>`
        : ""}
    `;

    els.fujiCheckpointStrip.appendChild(checkpoint);
  }
}

export function buildMobileSummaryFuji(result, evaluation) {
  const ring = evaluation.achieved?.shortLabel ?? "Outside";
  if (evaluation.next) {
    return `${ring} · ${evaluation.next.shortLabel} +${formatTime(evaluation.gapToNextSec)}`;
  }
  if (evaluation.outsideCutoff) {
    return "Outside cutoff";
  }
  return `${ring} · Top ring`;
}

