<!--
SPDX-License-Identifier: CC-BY-SA-4.0
Copyright (c) 2026 Jonathan D.A. Jewell (hyperpolymath)
-->

# Changelog

Including what is *not* finished, and what was retracted.

## [Unreleased] — Operation Nightglass

### Added
- `src/radar.mjs` — supercover line of sight, sensor footprint exemption, exposure dwell.
- `src/level.mjs` — Operation Nightglass. Oscillator shutter banks, three sensors,
  measured landing lanes, zero transient.
- Ledger: C1 kernel parity, C2/C3 LOS, C5 witness, C8 determinism, C11 periodicity,
  C12 level sanity. Each canary-tested where it could otherwise be vacuous.
- `design/` — `measure.mjs`, `solve.mjs`, `solver.mjs`, `sweep.mjs`. The level is tuned
  against measurements, not inspection.
- `spike/` — the v0 3D prototype verbatim, with seven measured defects recorded.

### Known red
- **C6, the falsifier.** All 30 launch phases land the witness route, with peak
  exposure 7 of 8 at every phase. The route's exposure is phase-invariant, so by this
  project's own standard the substrate is currently scenery. Reported by CI under
  `continue-on-error`, not hidden. See `AUDIT.adoc`.

### Not present
- No renderer, camera, input handling or playable bundle. C7 and C10 are reserved.
- `pages.yml` was removed: a workflow deploying a bundle that does not exist is a
  permanent red, and a permanently red check teaches people to ignore checks.

### Design decisions overturned by measurement
- **3D dropped.** 0 spaceships from 180 soups per rule in Bays 5766 and 4555. The world
  stays 2D and literally Conway; the three dimensions move to the camera.
- **f19's level dropped.** 521 of its 528 painted cells are painted at every generation.
- **The Gosper gun dropped.** It gives f19's field a 347-generation transient, during
  which `phase = t mod 30` does not exist.
