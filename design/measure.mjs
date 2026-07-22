// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jonathan D.A. Jewell (hyperpolymath) <j.d.a.jewell@open.ac.uk>
//
// design/measure.mjs — the level's instrument panel. Not a ledger claim: this is
// the tool the level is TUNED against, and the numbers it reports are the ones
// claims C4 and C11 later pin.
//
// It answers four questions a level designer cannot answer by looking:
//
//   1. Is the substrate periodic, from when, and with what period?
//      (If the transient is not ~0, "substrate phase" is undefined at launch
//      and the solver's state space is a fiction.)
//   2. How exposed is the corridor, and how much of that exposure is
//      PHASE-DEPENDENT? Phase-independent exposure is not a puzzle, it is a
//      wall; phase-independent cover is not a puzzle either, it is a corridor.
//   3. What is the longest run of CONSECUTIVE exposed generations at each
//      corridor cell? Exposure decays by one per clean generation, so a cell
//      that flickers can never kill you however often it is painted. Only runs
//      approaching LOCK matter. This is the number that decides whether the
//      radar has teeth.
//   4. Is there anywhere to hide at all?
//
// Run: node design/measure.mjs

import { createHash } from 'node:crypto';
import { buildLevel } from '../src/level.mjs';
import { createMission, ambientStep } from '../src/mission.mjs';
import { paintedBy, prepareSensors, LOCK } from '../src/radar.mjs';

const L = buildLevel();
const M = createMission(L);
const { W, H } = M;

// ---------------------------------------------------------------- periodicity
function measurePeriod(maxGens = 600) {
  const m = createMission(buildLevel());
  const seen = new Map();
  let popMin = Infinity, popMax = 0;
  for (let t = 0; t < maxGens; t++) {
    const h = createHash('sha1').update(Buffer.from(m.world)).digest('hex');
    let p = 0; for (let i = 0; i < m.world.length; i++) p += m.world[i];
    popMin = Math.min(popMin, p); popMax = Math.max(popMax, p);
    if (seen.has(h)) return { transient: seen.get(h), period: t - seen.get(h), popMin, popMax };
    seen.set(h, t);
    ambientStep(m);
  }
  return { transient: null, period: null, popMin, popMax };
}

const per = measurePeriod();
console.log('=== 1. periodicity ===');
if (per.period === null) {
  console.log('  NO CYCLE within 600 generations — the substrate is not periodic.');
  console.log('  The solver cannot index states by phase. Fix the level before continuing.');
} else {
  console.log(`  transient : ${per.transient} generations   (declared ${L.transient})`);
  console.log(`  period    : ${per.period} generations   (declared ${L.period})`);
  console.log(`  population: ${per.popMin}..${per.popMax}  (bounded)`);
}

// ------------------------------------------------------- corridor exposure map
// Walk the nominal corridor: the diagonal the aircraft flies with no input.
const corridor = [];
{
  const [ax, ay] = L.corridor.from, [bx, by] = L.corridor.to;
  const n = Math.max(Math.abs(bx - ax), Math.abs(by - ay));
  for (let i = 0; i <= n; i++) corridor.push([ax + i, ay + i]);
}

const P = per.period ?? 30;
const sensors = prepareSensors(L.sensors, W, L.radarRange);

// exposure[i][t] — is corridor cell i painted at substrate phase t?
const exposure = corridor.map(() => new Uint8Array(P));
{
  const m = createMission(buildLevel());
  for (let t = 0; t < P; t++) {
    for (let i = 0; i < corridor.length; i++) {
      // The aircraft occupies 5 cells; a single cell is a fair proxy for the map.
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

console.log('\n=== 2. corridor exposure ===');
console.log(`  corridor cells      : ${corridor.length}`);
console.log(`  ALWAYS painted      : ${always}   (a wall — no phase helps)`);
console.log(`  NEVER painted       : ${never}   (free cover — no phase needed)`);
console.log(`  PHASE-DEPENDENT     : ${dependent}   <- the only cells that are a puzzle`);
console.log(`  phase-dependent pct : ${(100 * dependent / corridor.length).toFixed(1)}%`);

// ------------------------------------------------- longest consecutive run
// Exposure decays one per clean generation, so only CONSECUTIVE painted
// generations accumulate. Wrap around the cycle: the run may straddle t=0.
console.log('\n=== 3. longest consecutive exposed run (LOCK = ' + LOCK + ') ===');
const runs = corridor.map((_, i) => {
  const row = exposure[i];
  if (row.every((v) => v === 1)) return P;      // permanently exposed
  let best = 0, cur = 0;
  for (let k = 0; k < P * 2; k++) {
    if (row[k % P]) { cur++; if (cur > best) best = cur; } else cur = 0;
  }
  return Math.min(best, P);
});
const lethal = runs.filter((r) => r >= LOCK).length;
const hist = {};
for (const r of runs) hist[r] = (hist[r] ?? 0) + 1;
console.log(`  cells whose run >= LOCK: ${lethal} / ${corridor.length}  <- these can actually kill`);
console.log('  run-length histogram   : '
  + Object.keys(hist).sort((a, b) => a - b).map((k) => `${k}:${hist[k]}`).join('  '));

console.log('\n=== 4. is there cover? ===');
const safe = runs.filter((r) => r === 0).length;
console.log(`  cells never painted    : ${safe}`);
console.log(`  cells survivable (<LOCK): ${runs.filter((r) => r > 0 && r < LOCK).length}`);

// ------------------------------------------------------------------- verdict
console.log('\n=== verdict ===');
const problems = [];
if (per.period === null) problems.push('substrate never becomes periodic');
if (per.transient !== 0) problems.push(`transient is ${per.transient}, not 0`);
if (per.period !== L.period) problems.push(`measured period ${per.period} != declared ${L.period}`);
if (dependent === 0) problems.push('NO phase-dependent corridor cells — the radar is scenery');
if (lethal === 0) problems.push('NO cell can reach LOCK — the radar cannot kill, so it is decoration');
if (safe === 0 && runs.every((r) => r >= LOCK)) problems.push('every corridor cell is lethal — likely unsolvable');
if (problems.length === 0) console.log('  level is in a tunable state.');
else for (const p of problems) console.log(`  PROBLEM: ${p}`);
