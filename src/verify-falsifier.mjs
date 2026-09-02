// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jonathan D.A. Jewell (hyperpolymath) <j.d.a.jewell@open.ac.uk>
//
// Ledger claim C6 — THE FALSIFIER.
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
// CURRENT STATUS: GREEN, AND THE HISTORY IS THE LESSON.
// -------------------------------------------------------------------------
// Measured at radarRange 40, LOCK 8: 14 of 14 off-phase launches are shot down
// as PAINTED; the on-phase flight lands with trace 0 (C5); and the exhaustive
// search finds no route in the whole state space that stays below exposure 7.
// The level is solvable only by reading phase, which is the premise this file
// exists to falsify.
//
// It took four measured geometry fixes to get here, each one closing a way
// the substrate could be scenery:
//
//   1. 0/30 -> the wall had to BE a wall. Flanking banks beside an open
//      corridor were routed around through permanent cover; a full-span
//      chokepoint made "WHEN is the gap masked?" the question at all.
//   2. 4/14 -> shutter TANGENCY. A pentadecathlon squarely on the gate-to-gap
//      ray masks it at every phase (15/15 land); grazing it occludes only in
//      its extended phases.
//   3. the SENSOR had to sit where the route is actually exposed. An exposure
//      diagnostic showed every flight peaking at 7 or 8 of LOCK=8 — the level
//      balances on one dwell generation — and a 507-point placement sweep
//      (design/place.mjs pipeline) moved the gate from (76,74) to (79,73):
//      14/14 off-phase PAINTED on the witness.
//   4. and the WITNESS was not the loophole. The same solver, asked for a
//      route that never reaches exposure 7, FOUND ONE: a zigzag hugging the
//      gate's range circle, draining the dwell counter between 3-4-generation
//      dips, landing at all 15 phases with peak 4. The three witness-scoped
//      assertions cannot see that route, so this file gained a fourth that
//      can. Sealing it took range 23 plus a second shutter at (66,79) across
//      the gate-to-egress rays — swept to a one-cell optimum where the escape
//      is gone AND the witness still lands on-phase.
//
// It is a level-geometry problem, not a code problem — and it was solved by
// sweeping geometry, never by weakening this file. The reverse happened: the
// majority assertion below was TIGHTENED (painted > n/2, where it previously
// accepted landed <= n/2), and the no-escape assertion ADDED, before the
// level was made to pass them.
//
// This check gates the build. While it was known-red it ran under CI's
// continue-on-error and was reported rather than hidden; now that it is green
// it sits in the gating ledger with the other claims, where a regression in
// level geometry will fail the build rather than quietly demote the substrate
// back to scenery.
//
// Run: node verify-falsifier.mjs

import { buildLevel } from './level.mjs';
import { createMission, missionStep, ambientStep } from './mission.mjs';
// The solver is imported for a NEGATIVE claim (see the fourth assertion). For
// positive claims it may only propose (C5 is the flight, not the search); a
// non-existence claim has no witness to re-fly, so that assertion is
// explicitly SOLVER-RELATIVE: exhaustive over the abstraction
// (anchor, heading, substrate phase, exposure), not over raw histories.
import { solve } from '../design/solver.mjs';

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
// The "identical peaks" diagnosis only means phase-invariance when launches
// SURVIVE with the same peak. When every launch is PAINTED, the peaks are all
// pinned at LOCK by construction — the counter stops at the kill — and say
// nothing about invariance.
console.log(`  peak exposure across phases: ${Math.min(...peaks)}..${Math.max(...peaks)}`
  + (Math.min(...peaks) === Math.max(...peaks) && painted === 0
    ? '   <- IDENTICAL at every phase: the route\'s exposure is phase-invariant'
    : ''));

let failures = 0;
const ok = (cond, msg) => {
  if (cond) console.log(`  ok   ${msg}`);
  else { console.log(`  RED  ${msg}`); failures++; }
};

// The claim is "a majority of off-phase launches fail AS PAINTED", so the
// assertion is painted > n/2. The previous form, landed <= n/2, was weaker
// than the sentence it printed: it permitted exactly half the launches to
// land, and combined with painted > other it forced only painted >= 4 of 14 —
// a "majority" that could be a minority. A gate must be at least as strong as
// its prose.
ok(painted > results.length / 2,
  `a majority of off-phase launches fail as PAINTED (${painted}/${results.length})`);
ok(painted > other,
  `failures are dominated by PAINTED (${painted}) not terrain/edge (${other})`);
ok(painted > 0, `at least one off-phase launch is locked by radar (${painted})`);

// NO ESCAPE ROUTE. The three assertions above quantify over the WITNESS: they
// cannot see a different route that lands at every phase. Such a route
// existed here and was found by measurement — a zigzag hugging the gate's
// range circle, dipping in for 3-4 generations and letting the dwell counter
// drain between dips, peak exposure 4, landing at all 15 phases. A level with
// that route in it is phase-critical only for players who fly the shipped
// witness, which is no level at all. So C6 also asserts, solver-relatively:
// the exhaustive search over (anchor, heading, phase, exposure) — the same
// search that PROPOSED the witness — finds no route that stays below
// exposure LOCK-1. Every flyable route in this level grazes one generation
// from death; the only freedom left is WHEN, and that is the game.
const escape = solve(L0, buildLevel, { lock: 7 });
ok(!escape.solved,
  'no route exists that never reaches exposure 7 — the level cannot be beaten without grazing LOCK'
  + (escape.solved ? ` (found one: ${escape.turns.length} turns)` : ` (searched ${escape.visited.toLocaleString()} states)`));

if (failures === 0) {
  console.log('\nC6: PASS — the substrate is load-bearing.');
  process.exit(0);
}
console.log(`\nC6: RED (${failures}) — the level is solvable but NOT phase-critical.`);
console.log('This is the known open design gate. See AUDIT.adoc and the header of this file.');
process.exit(1);
