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

The app is fully local. It does not call remote APIs, does not require OAuth, and does not
import remote segment data automatically.

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
