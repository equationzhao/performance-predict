import {
  buildPredictionResult,
  cyclingPowerFastestVelocitySearch,
  cyclingPowerVelocitySearchMultiPosition,
} from "../src/lib/physics.js";
import { validateForm } from "../src/lib/validation.js";

const form = {
  distanceKm: "3.20",
  gradePercent: "7.5",
  elevationM: "500",
  windMps: "0",
  bodyWeightKg: "69",
  gearWeightKg: "13",
  powerW: "320",
  drivetrainLossPercent: "3.5",
  cda: "0.320",
  cdaPreset: "road",
  cdaModified: false,
  crr: "0.0050",
  bikeType: "road",
  terrain: "asphalt",
  crrModified: false,
};

const validation = validateForm(form);
if (validation.status !== "valid") {
  throw new Error(`Expected valid form, got ${validation.status}`);
}

const input = validation.input;
const estimate = cyclingPowerFastestVelocitySearch({
  power: input.rider.powerW,
  slope: input.segment.slopeRatio,
  weight: input.rider.bodyWeightKg + input.rider.gearWeightKg,
  crr: input.equipment.crr,
  cda: input.equipment.cda,
  el: input.segment.elevationM,
  wind: input.segment.windMps,
  loss: input.rider.drivetrainLoss,
});

if (!estimate || !Number.isFinite(estimate.velocity) || estimate.velocity <= 0) {
  throw new Error("Expected a positive velocity estimate");
}

const result = buildPredictionResult(input, estimate);
if (!Number.isFinite(result.timeSec) || result.timeSec <= 0) {
  throw new Error("Expected a positive predicted time");
}

console.log("Prediction check passed");
console.log(`velocity=${result.velocityMps.toFixed(3)}m/s time=${result.timeSec.toFixed(1)}s speed=${result.speedKph.toFixed(1)}km/h`);

const draftForm = {
  ...form,
  draftingEnabled: true,
  draftRiders: "4",
  draftPosition: "3",
  draftRotating: false,
  draftWorkPercent: "25",
  draftUseSameWeight: true,
  draftGroupBodyWeightKg: "",
};

const draftValidation = validateForm(draftForm);
if (draftValidation.status !== "valid") {
  throw new Error(`Expected valid draft form, got ${draftValidation.status}`);
}

const draftInput = draftValidation.input;
const draftEstimate = cyclingPowerFastestVelocitySearch({
  power: draftInput.rider.powerW,
  slope: draftInput.segment.slopeRatio,
  weight: draftInput.rider.bodyWeightKg + draftInput.rider.gearWeightKg,
  crr: draftInput.equipment.crr,
  cda: draftInput.equipment.cda * 0.5,
  el: draftInput.segment.elevationM,
  wind: draftInput.segment.windMps,
  loss: draftInput.rider.drivetrainLoss,
});

if (!draftEstimate?.velocity) {
  throw new Error("Expected static drafting velocity estimate");
}

const rotatingEstimate = cyclingPowerVelocitySearchMultiPosition(
  4,
  [
    { position: 1, pct: 0.25 },
    { position: 2, pct: 0.25 },
    { position: 3, pct: 0.25 },
    { position: 4, pct: 0.25 },
  ],
  {
    power: draftInput.rider.powerW,
    slope: draftInput.segment.slopeRatio,
    weight: draftInput.rider.bodyWeightKg + draftInput.rider.gearWeightKg,
    crr: draftInput.equipment.crr,
    cda: draftInput.equipment.cda,
    el: draftInput.segment.elevationM,
    wind: draftInput.segment.windMps,
    loss: draftInput.rider.drivetrainLoss,
  },
);

if (!rotatingEstimate?.velocity) {
  throw new Error("Expected rotating drafting velocity estimate");
}

console.log(`drafting check passed static=${draftEstimate.velocity.toFixed(3)}m/s rotating=${rotatingEstimate.velocity.toFixed(3)}m/s`);
