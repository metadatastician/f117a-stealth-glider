// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jonathan D.A. Jewell (hyperpolymath) <j.d.a.jewell@open.ac.uk>
//
// Ledger claim C5 — the witness route lands.
//
//   C5  The witness route LANDS, with trace 0, never locked by radar.
//
// The FALSIFIER that decides whether this is a game rather than a diorama is
// C6, and it lives in verify-falsifier.mjs. It is currently RED. See AUDIT.adoc.
//
// C6 is the claim that decides whether this game exists. f19's falsifier was
// "if the crossing becomes learnable without tracking phase, the substrate is
// scenery and v0 fails". The same knife applies here, but it must be held
// correctly: asserting merely that off-phase runs FAIL is not enough, because a
// route can fail by flying into a still life at any phase whatsoever. That
// would let a decorative radar layer ship behind terrain doing the real work —
// the fake-gate shape this estate keeps rediscovering. So C6 counts PAINTED
// specifically. Only PAINTED failures show that phase-reading beats the RADAR.
//
// The route itself comes from design/solve.mjs, which is an APPROXIMATION of
// this engine. Flying it here through the real missionStep() is what makes C5 a
// claim rather than a hope; if the two ever disagree, the solver is wrong.
//
// Run: node verify-witness.mjs

import { buildLevel } from './level.mjs';
import { createMission, missionStep, ambientStep } from './mission.mjs';
import { LOCK } from './radar.mjs';

let failures = 0;
const ok = (cond, msg) => {
  if (cond) console.log(`  ok   ${msg}`);
  else { console.log(`  FAIL ${msg}`); failures++; }
};

/**
 * Fly the witness, optionally delaying launch by `offset` generations so the
 * substrate is at a different phase when the aircraft sets off. The route is
 * IDENTICAL in every case — only the phase it meets differs. That is exactly
 * what "learnable by feel" would defeat.
 */
function fly(offset = 0, maxGens = 4000) {
  const L = buildLevel();
  const M = createMission(L);
  const turns = new Map(L.witness.map(([t, hx, hy]) => [t, [hx, hy]]));

  // Hold on the pad for `offset` generations. ambientStep advances the substrate
  // (and the shadow world, and trace) without moving the aircraft, which is
  // precisely "same route, different phase" — the aircraft's own sequence of
  // headings is untouched, so any difference in outcome is attributable to the
  // substrate's phase and to nothing else.
  for (let k = 0; k < offset; k++) ambientStep(M);

  // Turns stay keyed to time SINCE LAUNCH, so the flown route is identical.
  for (let t = 0; t < maxGens && !M.result; t++) {
    missionStep(M, turns.get(t) ?? null);
  }
  return M;
}

console.log(`C5 — the witness route (LOCK = ${LOCK})`);

const base = fly(0);
ok(base.result === 'LANDED', `result is LANDED (got ${base.result} at t=${base.endT})`);
ok(base.trace === 0, `trace is 0 (got ${base.trace})`);
ok(base.peakExposure < LOCK, `never locked: peak exposure ${base.peakExposure} of ${LOCK}`);
ok(base.peakExposure > 0, `the route is NOT trivially safe — it was painted at some point (peak ${base.peakExposure})`);


console.log(failures === 0 ? '\nC5: PASS' : `\nC5: ${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
