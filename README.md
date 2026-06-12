# Segment Performance Predictor

Pure frontend cycling segment performance predictor.

This app predicts cycling segment completion time from distance, average grade, elevation,
wind, rider weight, gear weight, target power, CdA and Crr. It is intended as a lightweight
static web app that can be hosted on GitHub Pages or opened through any local static server.

The physics model is extracted and adapted from the Performance Predictor in
[sauce4strava](https://github.com/SauceLLC/sauce4strava). It keeps the same core idea:
estimate gravity, rolling resistance and aerodynamic drag, then search for the fastest
positive velocity that matches the rider's target power. Drafting support also follows
the sauce4strava model, including static group position and rotating paceline modes.

The app is fully client-side. It can optionally call Intervals.icu from the browser
when the user provides credentials. No app server stores data.

## Run

```bash
npm run serve
```

Open:

```text
http://localhost:5173/
```

## Check

```bash
npm run check
```

## Scope

- Manual segment inputs: distance, average grade, average elevation and wind.
- Rider inputs: body weight, gear weight and target power.
- CdA presets plus manual CdA tuning.
- Crr bike/surface presets plus manual Crr tuning.
- Drivetrain loss in Advanced.
- Drafting in Advanced, including static position and rotating paceline modes.
- Result output: predicted time, average speed, W/kg, total mass, wheel power, power breakdown and model details.

## Fuji HC Mode

The Mt. Fuji HC preset uses official measured course distance and elevation gain:
24.0 km measured distance and 1,255 m measured elevation gain. Achievement ring
thresholds are configurable community defaults unless official thresholds are verified.

Features:
- Achievement ring evaluation (Platinum / Gold / Silver / Bronze / Blue / Finish)
- Target power solver — required W to reach each ring
- Ring ladder with per-ring required power and delta
- Course checkpoints (10.5km / 17.2km / 19.5km / 24km) with average-speed ETA
- Source notes distinguishing official data, community thresholds, and model estimates
- Best Effort mode integration with Intervals.icu CP / W' / Pmax data. Current
  Best Effort uses a 2-parameter CP model, `P(t) = CP + W' / t`, capped by Pmax
  for very short efforts.
- Mobile sticky summary with ring and gap info
