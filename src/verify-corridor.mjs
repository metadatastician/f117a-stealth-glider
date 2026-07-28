// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jonathan D.A. Jewell (hyperpolymath) <j.d.a.jewell@open.ac.uk>
//
// Ledger claim C4 — the shadow is load-bearing on the nominal corridor.
//
// C6 proves the LEVEL is phase-critical by flying it. This claim pins the
// GEOMETRY those flights depend on: walk the nominal corridor (the diagonal
// the aircraft flies with no input) and classify every cell's exposure over
// one full substrate period. Three structural facts must hold, and the
// measured counts are then pinned as declared values — the C11 discipline:
// a declaration that is not re-measured is how a level quietly stops meaning
// what its documentation says.
//
//   1. PHASE-DEPENDENT cells exist. A corridor whose exposure never varies
//      with phase is a wall or a hallway, not a puzzle.
//   2. At least one cell's longest CONSECUTIVE painted run reaches LOCK.
//      Exposure decays one per clean generation, so a cell that flickers can
//      never kill however often it is painted — without a run >= LOCK the
//      radar is decoration.
//   3. Cover exists: some cells are never painted at any phase.
//
// The computation is the same one design/measure.mjs (the instrument panel)
// performs; this file is the subset that gates, with the numbers frozen.
// After ANY geometry change: run `just measure`, update DECLARED, and let C6
// re-arbitrate whether the level still earns its premise.
//
// Run: node verify-corridor.mjs

import { buildLevel } from './level.mjs';
import { createMission, ambientStep } from './mission.mjs';
import { prepareSensors, paintedBy, shadowMap, LOCK } from './radar.mjs';

// Measured 2026-07-28 at the C6-green geometry (gate (79,73) range 23, twin
// shutters [68,68] + [66,79]) via design/measure.mjs.
const DECLARED = {
  cells: 81,          // corridor length
  always: 31,         // painted at every phase — a wall, no phase helps
  never: 42,          // painted at no phase — free cover
  dependent: 8,       // the cells that ARE the game
  lethal: 36,         // cells whose longest run >= LOCK
  survivable: 3,      // painted cells whose longest run < LOCK
};

const L = buildLevel();
const { W, H } = L;

const corridor = [];
{
  const [ax, ay] = L.corridor.from, [bx, by] = L.corridor.to;
  const n = Math.max(Math.abs(bx - ax), Math.abs(by - ay));
  for (let i = 0; i <= n; i++) corridor.push([ax + i, ay + i]);
}

const P = L.period;
const sensors = prepareSensors(L.sensors, W, L.radarRange);
const exposure = corridor.map(() => new Uint8Array(P));
{
  const m = createMission(buildLevel());
  for (let t = 0; t < P; t++) {
    for (let i = 0; i < corridor.length; i++) {
      exposure[i][t] = paintedBy(m.world, W, H, sensors, [corridor[i]]).length > 0 ? 1 : 0;
    }
    ambientStep(m);
  }
}

let always = 0, never = 0, dependent = 0;
for (const row of exposure) {
  let s = 0; for (let t = 0; t < P; t++) s += row[t];
  if (s === P) always++; else if (s === 0) never++; else dependent++;
}
const runs = corridor.map((_, i) => {
  const row = exposure[i];
  if (row.every((v) => v === 1)) return P;
  let best = 0, cur = 0;
  for (let k = 0; k < P * 2; k++) {
    if (row[k % P]) { cur++; if (cur > best) best = cur; } else cur = 0;
  }
  return Math.min(best, P);
});
const lethal = runs.filter((r) => r >= LOCK).length;
const survivable = runs.filter((r) => r > 0 && r < LOCK).length;

let failures = 0;
const ok = (cond, msg) => {
  if (cond) console.log(`  ok   ${msg}`);
  else { console.log(`  RED  ${msg}`); failures++; }
};

console.log('C4 — the shadow is load-bearing on the nominal corridor');
console.log(`  ${corridor.length} cells: always ${always} / never ${never} / phase-dependent ${dependent}`
  + `   runs>=LOCK ${lethal}, survivable ${survivable}`);

ok(dependent > 0,
  `phase-dependent cells exist (${dependent}) — the corridor is a puzzle, not scenery`);
ok(lethal > 0,
  `at least one cell can accumulate LOCK consecutively (${lethal}) — the radar has teeth`);
ok(never > 0,
  `cover exists: ${never} cells are painted at no phase`);

// The whole-map shadow is a function of SUBSTRATE PHASE ALONE.
//
// This is a corollary of C11 (periodic from generation 0) applied to the
// radar, and it is asserted here because the renderer BANKS on it: shadowMap
// costs 23.5 ms on this level — more than a 16.7 ms frame budget, and about
// 70% of a core at 30 generations per second — so src/ui.js memoises it by
// phase and turns the dominant per-tick cost into an array index. That cache
// is sound only while this holds. If a future level acquires a transient, or
// a pattern that never repeats, the cache would silently serve a stale map of
// where the radar can see; this check is what makes that failure loud.
//
// Scope is exact: the claim is about the PURE substrate. Once the aircraft is
// spliced into the world on contact, the world is no longer the substrate and
// the renderer bypasses the cache for the rest of the mission.
{
  const m = createMission(buildLevel());
  const byPhase = new Array(P).fill(null);
  let repeats = 0, drift = 0;
  for (let t = 0; t < P * 6; t++) {
    const ph = m.t % P;
    const fresh = shadowMap(m.world, W, H, m.radar);
    if (!byPhase[ph]) byPhase[ph] = fresh;
    else {
      repeats++;
      for (let i = 0; i < fresh.length; i++) if (fresh[i] !== byPhase[ph][i]) { drift++; break; }
    }
    ambientStep(m);
  }
  ok(drift === 0 && repeats > 0,
    `the radar shadow is a function of substrate phase alone `
    + `(${repeats} repeat(s) across ${P} phases, ${drift} mismatch(es)) — the renderer's phase cache is sound`);
}

const measured = { cells: corridor.length, always, never, dependent, lethal, survivable };
const drift = Object.keys(DECLARED).filter((k) => DECLARED[k] !== measured[k]);
ok(drift.length === 0,
  drift.length === 0
    ? `every declared count matches the measurement: ${JSON.stringify(measured)}`
    : `declared counts have drifted: ${drift.map((k) => `${k} declared ${DECLARED[k]} measured ${measured[k]}`).join(', ')}`
      + ' — geometry changed without re-measuring; run just measure, update DECLARED, re-run C6');

if (failures === 0) {
  console.log('\nC4: PASS — the corridor\'s danger is phase-shaped, and its shape is pinned.');
  process.exit(0);
}
console.log(`\nC4: RED (${failures})`);
process.exit(1);
