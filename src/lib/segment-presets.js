import { FUJI_HC_EVENT } from "./events.js";

export const SEGMENT_PRESETS = [
  { id: "alpe", name: "Alpe d'Huez", distanceKm: 13.8, gradePercent: 8.1, elevationM: 1300 },
  { id: "ventoux", name: "Mont Ventoux", distanceKm: 21.5, gradePercent: 7.5, elevationM: 1100 },
  { id: "stelvio", name: "Stelvio", distanceKm: 24.3, gradePercent: 7.4, elevationM: 2100 },
  { id: "galibier", name: "Galibier", distanceKm: 17.1, gradePercent: 6.9, elevationM: 2000 },
  { id: "tourmalet", name: "Tourmalet", distanceKm: 17.1, gradePercent: 7.3, elevationM: 1400 },
  { id: "angliru", name: "Angliru", distanceKm: 12.5, gradePercent: 10.1, elevationM: 900 },
  { id: "madeleine", name: "Madeleine", distanceKm: 19.0, gradePercent: 7.9, elevationM: 1100 },
  { id: "arrate", name: "Arrate", distanceKm: 7.2, gradePercent: 6.2, elevationM: 400 },
  {
    id: "fuji",
    name: "Mt. Fuji HC",
    distanceKm: 24.0,
    gradePercent: 5.229,
    elevationM: 1680,
    elevationGainM: FUJI_HC_EVENT.elevationGainM,
    maxGradePercent: FUJI_HC_EVENT.maxGradePercent,
    event: FUJI_HC_EVENT,
  },
];
