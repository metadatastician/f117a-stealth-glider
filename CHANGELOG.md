<!--
SPDX-License-Identifier: CC-BY-SA-4.0
Copyright (c) 2026 Jonathan D.A. Jewell (hyperpolymath)
-->

# Changelog

Including what is *not* finished, and what was retracted.

## [Unreleased] — C6 green: the level earns its premise (2026-07-28)

### Changed
- **C6, the falsifier, is GREEN and gates the build.** Measured: 14 of 14
  off-phase launches of the witness are PAINTED, the on-phase flight lands with
  trace 0, and the exhaustive search finds no route in the state space that
  stays below exposure 7. Geometry: gate sensor (76,74)→(79,73), range 20→23,
  and a second pentadecathlon shutter at (66,79) across the gate-to-egress
  rays. Witness regenerated (21 turns, lands t=469).
- **The C6 assertions were tightened first, then the level made to pass them.**
  The majority clause now asserts `painted > n/2` (the old `landed <= n/2` was
  satisfiable with 4/14 painted); a fourth, solver-relative assertion requires
  that no route exists that never reaches exposure LOCK-1 — added after
  measurement found a peak-4 zigzag landing at all 15 phases by hugging the
  gate's range circle and draining the dwell counter between dips.
- `design/place.mjs` and `design/sweep.mjs` falsifiers now tally off-phase
  launches only (the on-phase flight is reported separately) and use the same
  painted-majority verdict as the ledger.
- CI: the standalone known-red `falsifier` job (`continue-on-error`) is gone;
  `verify-falsifier` runs inside the gating `ledger` job, per that job's own
  exit note. `just verify` includes it; `just falsifier` remains as the
  tuning loop.
- Ledger docs rewritten for the green state; AUDIT's stale C11 row corrected
  (period 15, population 210..294 — it still said period 30).

### Measured, not shipped
- A second gate *sensor* (the "untried lever" in the red-era notes): swept
  2,016 configurations — zero viable. The second *shutter* is what worked.

## [Earlier unreleased state] — Operation Nightglass

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
