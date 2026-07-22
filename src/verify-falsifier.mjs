// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jonathan D.A. Jewell (hyperpolymath) <j.d.a.jewell@open.ac.uk>
//
// Ledger claim C6 — THE FALSIFIER. Currently RED, deliberately and visibly.
//
// f19-stealth-glider stated its premise with a knife attached: "if the crossing
// becomes learnable without tracking phase, the substrate is scenery and v0
// fails." This repository inherits the premise and therefore the knife.
//
// C6: fly the SAME witness route from every launch phase. If the level is a
// phase puzzle, most off-phase launches must die — and die specifically by
// being PAINTED, because that is what shows phase-reading defeats the RADAR
// rather than the terrain. Asserting merely that off-phase runs "fail" would
// pass on a route that flies into a still life at every phase alike, which is
// exactly how a decorative mechanic ships behind a green check.
//
// -------------------------------------------------------------------------
// CURRENT STATUS: RED. THIS IS A REAL RESULT, NOT A TODO.
// -------------------------------------------------------------------------
// Measured at radarRange 40, LOCK 8: all 30 launch phases LAND, and peak
// exposure is 7 of 8 at EVERY phase — the same number, phase after phase. The
// route's exposure is therefore entirely phase-invariant: it comes from cells
// that are permanently painted, and the oscillator shutters contribute nothing
// to it. The radar is currently a static obstacle wearing a dynamic costume.
//
// design/sweep.mjs shows how narrow the level's window is: of 21 (range, LOCK)
// combinations tried, exactly ONE is solvable at all, and that one is this.
//
// The mechanic itself is sound and proven — C2 and C3 establish the LOS
// geometry, and design/measure.mjs finds genuinely phase-dependent cells on the
// map. What is wrong is the LEVEL: the shutter banks do not lie across the
// sight lines that the viable route actually uses, and there is too much
// permanent cover (45 of 85 corridor cells are never painted) for temporal
// cover to matter. Fixing it means moving sensors and banks so that the only
// survivable corridor is one whose cover is the oscillators, then re-running
// design/sweep.mjs. It is a level-geometry problem, not a code problem.
//
// This check is run by CI and reported, and it is NOT allowed to gate the build
// while it is known-red — a red gate that everyone learns to ignore is worse
// than an honest one that says exactly what is unfinished.
//
// Run: node verify-falsifier.mjs

import { buildLevel } from './level.mjs';
import { createMission, missionStep, ambientStep } from './mission.mjs';

function fly(offset) {
  const L = buildLevel();
  const M = createMission(L);
  const turns = new Map(L.witness.map(([t, hx, hy]) => [t, [hx, hy]]));
  for (let k = 0; k < offset; k++) ambientStep(M);
  for (let t = 0; t < 4000 && !M.result; t++) missionStep(M, turns.get(t) ?? null);
  return M;
}

const L0 = buildLevel();
const results = [];
for (let off = 1; off < L0.period; off++) {
  const M = fly(off);
  results.push({ off, result: M.result, peak: M.peakExposure });
}

const landed = results.filter((r) => r.result === 'LANDED').length;
const painted = results.filter((r) => r.result === 'PAINTED').length;
const other = results.length - landed - painted;
const peaks = results.map((r) => r.peak);

const tally = {};
for (const r of results) tally[r.result] = (tally[r.result] ?? 0) + 1;

console.log('C6 — falsifier: the same route flown at every other launch phase');
console.log(`  outcomes over ${results.length} off-phase launches: `
  + Object.entries(tally).map(([k, v]) => `${k}=${v}`).join('  '));
console.log(`  peak exposure across phases: ${Math.min(...peaks)}..${Math.max(...peaks)}`
  + (Math.min(...peaks) === Math.max(...peaks)
    ? '   <- IDENTICAL at every phase: the route\'s exposure is phase-invariant'
    : ''));

let failures = 0;
const ok = (cond, msg) => {
  if (cond) console.log(`  ok   ${msg}`);
  else { console.log(`  RED  ${msg}`); failures++; }
};

ok(landed <= results.length / 2,
  `a majority of off-phase launches fail (${results.length - landed}/${results.length})`);
ok(painted > other,
  `failures are dominated by PAINTED (${painted}) not terrain/edge (${other})`);
ok(painted > 0, `at least one off-phase launch is locked by radar (${painted})`);

if (failures === 0) {
  console.log('\nC6: PASS — the substrate is load-bearing.');
  process.exit(0);
}
console.log(`\nC6: RED (${failures}) — the level is solvable but NOT phase-critical.`);
console.log('This is the known open design gate. See AUDIT.adoc and the header of this file.');
process.exit(1);
