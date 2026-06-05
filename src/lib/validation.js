import { CRR_PRESETS } from "./presets.js";

const DECIMAL_RE = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/;

const REQUIRED_LABELS = {
  distanceKm: "Distance",
  gradePercent: "Average Grade",
  bodyWeightKg: "Body Weight",
  powerW: "Target Power",
};

function parseDecimal(raw) {
  const value = String(raw ?? "").trim();
  if (!value) {
    return { ok: false, empty: true };
  }
  if (!DECIMAL_RE.test(value)) {
    return { ok: false, empty: false };
  }
  const number = Number(value);
  return Number.isFinite(number) ? { ok: true, value: number } : { ok: false, empty: false };
}

function validateNumber(form, field, label, { required = false, min = -Infinity, max = Infinity }) {
  const parsed = parseDecimal(form[field]);
  if (parsed.empty) {
    if (required) {
      return { missing: label };
    }
    return { value: undefined };
  }
  if (!parsed.ok) {
    return { error: `${label} must be a number.` };
  }
  if (parsed.value < min || parsed.value > max) {
    return { error: `${label} must be between ${min} and ${max}.` };
  }
  return { value: parsed.value };
}

function validateDraftNumber(form, errors, field, label, { min, max }) {
  const parsed = parseDecimal(form[field]);
  if (parsed.empty) {
    errors[field] = `${label} is required.`;
    return undefined;
  }
  if (!parsed.ok) {
    errors[field] = `${label} must be a number.`;
    return undefined;
  }
  if (parsed.value < min || parsed.value > max) {
    errors[field] = `${label} must be between ${min} and ${max}.`;
    return undefined;
  }
  return parsed.value;
}

export function validateForm(form) {
  const errors = {};
  const missingFields = [];
  const values = {};

  const specs = {
    distanceKm: { required: true, min: 0.001, max: 500 },
    gradePercent: { required: true, min: -30, max: 30 },
    elevationM: { required: false, min: -500, max: 9000 },
    windMps: { required: false, min: -20, max: 20 },
    bodyWeightKg: { required: true, min: 20, max: 200 },
    gearWeightKg: { required: false, min: 0, max: 40 },
    powerW: { required: true, min: 1, max: 2000 },
    drivetrainLossPercent: { required: false, min: 0, max: 20 },
    cda: { required: true, min: 0.15, max: 0.70 },
    crr: { required: true, min: 0.0001, max: 0.10 },
  };

  const labels = {
    distanceKm: "Distance",
    gradePercent: "Average grade",
    elevationM: "Average elevation",
    windMps: "Wind",
    bodyWeightKg: "Body weight",
    gearWeightKg: "Gear weight",
    powerW: "Target power",
    drivetrainLossPercent: "Drivetrain loss",
    cda: "CdA",
    crr: "Crr",
  };

  for (const [field, spec] of Object.entries(specs)) {
    const result = validateNumber(form, field, labels[field], spec);
    if (result.missing) {
      missingFields.push(REQUIRED_LABELS[field] || result.missing);
    } else if (result.error) {
      errors[field] = result.error;
    } else if (result.value !== undefined) {
      values[field] = result.value;
    }
  }

  if (missingFields.length) {
    return { status: "empty", missingFields, errors: {} };
  }

  const draftingEnabled = Boolean(form.draftingEnabled);
  const draftValues = {};
  if (draftingEnabled) {
    draftValues.riders = validateDraftNumber(form, errors, "draftRiders", "Draft riders", {
      min: 2,
      max: 8,
    });
    draftValues.position = validateDraftNumber(form, errors, "draftPosition", "Draft position", {
      min: 1,
      max: 8,
    });
    draftValues.workPercent = validateDraftNumber(form, errors, "draftWorkPercent", "Time at front", {
      min: 0,
      max: 100,
    });
    if (draftValues.riders !== undefined) {
      draftValues.riders = Math.round(draftValues.riders);
      if (draftValues.riders < 2 || draftValues.riders > 8) {
        errors.draftRiders = "Draft riders must be between 2 and 8.";
      }
    }
    if (draftValues.position !== undefined) {
      draftValues.position = Math.round(draftValues.position);
      if (draftValues.riders !== undefined && draftValues.position > draftValues.riders) {
        errors.draftPosition = "Draft position must be less than or equal to riders.";
      }
    }
    if (!form.draftUseSameWeight) {
      draftValues.groupBodyWeightKg = validateDraftNumber(
        form,
        errors,
        "draftGroupBodyWeightKg",
        "Group body weight",
        { min: 20, max: 200 },
      );
    }
  }

  if (Object.keys(errors).length) {
    return { status: "invalid", errors };
  }

  const gearWeightKg = values.gearWeightKg ?? 13;
  const elevationM = values.elevationM ?? 0;
  const windMps = values.windMps ?? 0;
  const drivetrainLossPercent = values.drivetrainLossPercent ?? 3.5;
  const crr =
    values.crr ??
    CRR_PRESETS[form.bikeType || "road"]?.[form.terrain || "asphalt"] ??
    0.0050;

  return {
    status: "valid",
    input: {
      segment: {
        distanceM: values.distanceKm * 1000,
        slopeRatio: values.gradePercent / 100,
        gradePercent: values.gradePercent,
        elevationM,
        windMps,
      },
      rider: {
        bodyWeightKg: values.bodyWeightKg,
        gearWeightKg,
        powerW: values.powerW,
        drivetrainLoss: drivetrainLossPercent / 100,
      },
      equipment: {
        cda: values.cda,
        cdaPreset: form.cdaPreset,
        cdaModified: Boolean(form.cdaModified),
        crr,
        bikeType: form.bikeType,
        terrain: form.terrain,
        crrModified: Boolean(form.crrModified),
      },
      drafting: {
        enabled: draftingEnabled,
        riders: draftValues.riders ?? 2,
        position: draftValues.position ?? 2,
        rotating: Boolean(form.draftRotating),
        workPct: (draftValues.workPercent ?? 50) / 100,
        useSameWeight: Boolean(form.draftUseSameWeight),
        groupBodyWeightKg: draftValues.groupBodyWeightKg,
      },
    },
  };
}

export function buildWarnings(input) {
  const warnings = [];
  if (input.segment.windMps < -10) {
    warnings.push("Strong tailwind detected. Aero drag may become very small or counterintuitive.");
  }
  if (input.segment.gradePercent < -10) {
    warnings.push("Steep descent detected. This average-grade model may be less reliable.");
  }
  if (input.segment.gradePercent > 15) {
    warnings.push("Very steep grade detected. Small input errors may strongly affect prediction.");
  }
  if (input.drafting.enabled && input.drafting.rotating && input.drafting.workPct === 0) {
    warnings.push("Rotating draft has 0% time at the front. You are modeled as never pulling.");
  }
  return warnings;
}
