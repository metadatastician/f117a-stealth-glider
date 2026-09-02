// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jonathan D.A. Jewell (hyperpolymath) <j.d.a.jewell@open.ac.uk>
//
// Ledger claim C13 — NO LAUNCH BEAT IS A DEAD END.
//
// C6 measures one thing and it is easy to misread. It flies the SAME committed
// route from all fifteen substrate phases and finds that fourteen of them die.
// That is the falsifier working: a canned route must not survive phase drift,
// or the automaton is scenery and the game is a memory test.
//
// It is NOT the statement "you may only launch on one beat". A player does not
// replay a recording; they steer. The question that decides whether the level
// is playable or merely provable is therefore a different one:
//
//   FROM HOW MANY LAUNCH BEATS DOES *SOME* ROUTE EXIST?
//
// The two answers are independent, and the pair is what you actually want:
//
//   canned route survives 1 of 15   -> phase is load-bearing (C6 green)
//   some route exists at 15 of 15   -> nobody is ever locked out
//
// If both hold, then reading the automaton is mandatory AND always sufficient,
// which is the design this project is aiming at. If the second is small, the
// level punishes the player for pressing ENTER at the wrong moment before they
// have done anything wrong, which is unfair rather than hard.
//
// The solver may only PROPOSE (it approximates mission.mjs for speed), so every
// route it returns here is FLOWN through the real missionStep with the
// substrate advanced to that launch beat before the flight begins.
//
// Run: node verify-beats.mjs   (or `just beats`; ~80s, so it is a separate CI
// job rather than part of the fast `just verify` loop)

import { buildLevel } from './level.mjs';
import { createMission, missionStep, ambientStep } from './mission.mjs';
import { solve } from '../design/solver.mjs';
import { LOCK } from './radar.mjs';

const L0 = buildLevel();
const P = L0.period;

console.log(`C13 — no launch beat is a dead end  (period ${P}, LOCK ${LOCK})\n`);
console.log('beat  solver      turns  flown        peak  verdict');
console.log('----  ----------  -----  -----------  ----  -------');

let playable = 0, unplayable = [];
const results = [];

for (let beat = 0; beat < P; beat++) {
  const mk = () => buildLevel();
  const r = solve(L0, mk, { startPhase: beat });
  if (!r.solved) {
    console.log(`${String(beat).padStart(4)}  UNSOLVABLE      -  -               -  no route from this beat`);
    unplayable.push(beat);
    results.push({ beat, solved: false });
    continue;
  }
  // The solver proposes; the real engine decides. Advance the substrate to this
  // launch beat, then fly the proposed route through missionStep.
  const M = createMission(mk());
  for (let k = 0; k < beat; k++) ambientStep(M);
  const turns = new Map(r.turns.map(([t, hx, hy]) => [t, [hx, hy]]));
  for (let t = 0; t < 4000 && !M.result; t++) missionStep(M, turns.get(t) ?? null);
  const ok = M.result === 'LANDED';
  if (ok) playable++; else unplayable.push(beat);
  results.push({ beat, solved: true, turns: r.turns.length, result: M.result, peak: M.peakExposure, trace: M.trace });
  console.log(
    `${String(beat).padStart(4)}  solved      ${String(r.turns.length).padStart(5)}  `
    + `${M.result.padEnd(11)}  ${String(M.peakExposure).padStart(4)}  `
    + (ok ? `playable (trace ${M.trace})` : 'solver proposed a losing route'),
  );
}

console.log(`\nplayable launch beats: ${playable} of ${P}`);
if (unplayable.length) console.log(`locked out: ${unplayable.join(', ')}`);

// Are the routes actually DIFFERENT? If one route served every beat, the level
// would be phase-invariant and C6 would be red — so distinctness is the other
// half of the story, not a curiosity.
const sigs = new Set(results.filter((r) => r.solved).map((r) => r.turns));
console.log(`distinct route lengths among solved beats: ${[...sigs].sort((a, b) => a - b).join(', ')}`);

let failures = 0;
const ok = (cond, msg) => {
  if (cond) console.log(`  ok   ${msg}`);
  else { console.log(`  RED  ${msg}`); failures++; }
};
console.log('');
ok(playable === P,
  `every launch beat admits a route flown to LANDED through the real engine (${playable}/${P})`);
ok(sigs.size > 1,
  `the routes are not one route in disguise — ${sigs.size} distinct lengths (${[...sigs].sort((a, b) => a - b).join(', ')})`);

console.log('\nRead this together with C6:');
console.log('  C6  = the SAME route flown from every beat must mostly die   (phase is load-bearing)');
console.log('  C13 = SOME route must exist from every beat                  (nobody is locked out)');
if (failures === 0) {
  console.log('\nC13: PASS — reading the automaton is mandatory AND always sufficient.');
  process.exit(0);
}
console.log(`\nC13: RED (${failures}) — a launch beat is a dead end, which punishes the`);
console.log('player before they have done anything wrong. That is unfair, not hard.');
process.exit(1);
