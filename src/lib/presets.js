export const CDA_PRESETS = {
  elite_tt: {
    label: "Elite TT",
    value: 0.20,
    range: [0.17, 0.23],
    description: "Excellent time-trial position",
  },
  good_tt: {
    label: "Good TT",
    value: 0.26,
    range: [0.23, 0.30],
    description: "Good time-trial position",
  },
  road: {
    label: "Road",
    value: 0.32,
    range: [0.30, 0.35],
    description: "Typical road riding position",
  },
  climbing: {
    label: "Climbing",
    value: 0.40,
    range: [0.35, 0.50],
    description: "Open climbing position",
  },
  upright: {
    label: "Upright",
    value: 0.55,
    range: [0.50, 0.70],
    description: "Very upright position",
  },
};

export const CRR_PRESETS = {
  road: {
    asphalt: 0.0050,
    gravel: 0.0060,
    grass: 0.0070,
    offroad: 0.0200,
    sand: 0.0300,
  },
  mtb: {
    asphalt: 0.0065,
    gravel: 0.0075,
    grass: 0.0090,
    offroad: 0.0255,
    sand: 0.0380,
  },
};

export const BIKE_TYPES = {
  road: "Road Bike",
  mtb: "MTB",
};

export const TERRAIN_LABELS = {
  asphalt: "Asphalt",
  gravel: "Gravel",
  grass: "Grass",
  offroad: "Offroad",
  sand: "Sand",
};

export const DEFAULT_FORM_STATE = {
  distanceKm: "",
  gradePercent: "",
  elevationM: "",
  windMps: "0",
  bodyWeightKg: "",
  gearWeightKg: "",
  powerW: "",
  drivetrainLossPercent: "3.5",
  cda: "0.320",
  cdaPreset: "road",
  cdaModified: false,
  crr: "0.0050",
  bikeType: "road",
  terrain: "asphalt",
  crrModified: false,
  draftingEnabled: false,
  draftRiders: "2",
  draftPosition: "2",
  draftRotating: false,
  draftWorkPercent: "50",
  draftUseSameWeight: true,
  draftGroupBodyWeightKg: "",
  powerMode: "manual",
  intervalsConnected: false,
};

export const PERSISTED_FIELDS = [
  "bodyWeightKg",
  "gearWeightKg",
  "powerW",
  "drivetrainLossPercent",
  "cda",
  "cdaPreset",
  "cdaModified",
  "crr",
  "bikeType",
  "terrain",
  "crrModified",
  "draftingEnabled",
  "draftRiders",
  "draftPosition",
  "draftRotating",
  "draftWorkPercent",
  "draftUseSameWeight",
  "draftGroupBodyWeightKg",
  "powerMode",
];
