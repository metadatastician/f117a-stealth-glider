// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jonathan D.A. Jewell (hyperpolymath) <j.d.a.jewell@open.ac.uk>
//
// design/period.mjs — measure every oscillator's period IN ISOLATION, and check
// that the level's declared PERIOD really is the lcm of the ones it places.
//
// This file exists because src/level.mjs cited it and it did not exist. The
// comment above OSC reads "Periods verified empirically; see C11 and
// design/period.mjs" — a citation to nothing is exactly the kind of claim this
// repository is built to refuse, so either the citation or the tool had to go.
// The tool is the honest choice, because C11 cannot cover what it asserts:
//
//   C11 measures the period of the WHOLE SUBSTRATE and compares it to the
//   declared PERIOD. That catches an aggregate mismatch — it is what caught
//   "period is the declared 30 (measured 15)" when the p2 banks were removed.
//   It says nothing about any INDIVIDUAL oscillator, and it is structurally
//   blind to the three oscillators OSC defines but the level does not place
//   (blinker, toad, beacon). Those are the dangerous ones: they are sitting
//   there labelled p2, ready for the next level edit to build a bank from on
//   the strength of a label nothing has ever checked.
//
// So: stamp each oscillator alone on an empty grid with margin, evolve it, and
// report the transient and period actually observed. Then take the lcm of the
// periods of the oscillators the level ACTUALLY places and compare that to the
// declared PERIOD — the arithmetic in level.mjs's comment, performed rather
// than asserted.
//
// Run: node design/period.mjs

import { mkGrid, step, stamp } from '../src/kernel/engine.mjs';
import { OSC, PERIOD, buildLevel } from '../src/level.mjs';
import { createHash } from 'node:crypto';

const MARGIN = 12;          // clear of the border: a p15 pentadecathlon breathes
const MAXGEN = 400;

// Measure one pattern alone. Returns { transient, period, popMin, popMax } or
// { period: null } if it has not repeated within MAXGEN.
function periodOf(cells) {
  let w = 0, h = 0;
  for (const [x, y] of cells) { if (x + 1 > w) w = x + 1; if (y + 1 > h) h = y + 1; }
  const W = w + 2 * MARGIN, H = h + 2 * MARGIN;
  let world = mkGrid(W, H), scratch = mkGrid(W, H);
  stamp(world, W, cells, MARGIN, MARGIN);

  const seen = new Map();
  let popMin = Infinity, popMax = 0;
  for (let t = 0; t < MAXGEN; t++) {
    let pop = 0;
    for (let i = 0; i < world.length; i++) pop += world[i];
    if (pop < popMin) popMin = pop;
    if (pop > popMax) popMax = pop;
    const key = createHash('sha1').update(Buffer.from(world)).digest('hex');
    if (seen.has(key)) return { transient: seen.get(key), period: t - seen.get(key), popMin, popMax };
    seen.set(key, t);
    step(world, scratch, W, H);
    [world, scratch] = [scratch, world];
  }
  return { transient: null, period: null, popMin, popMax };
}

const gcd = (a, b) => (b === 0 ? a : gcd(b, a % b));
const lcm = (a, b) => (a / gcd(a, b)) * b;

// Which oscillators does the level actually place? Compare the cell arrays by
// identity against OSC — buildLevel stamps the very same arrays, so this is an
// exact answer rather than a guess about the level's intent.
const L = buildLevel();
const placedCells = new Set([
  ...L.banks.map(([cells]) => cells),
  ...L.shutter.map(([cells]) => cells),
]);

console.log('oscillator periods, measured in isolation');
console.log('  name        declared  measured  transient  population   placed');
console.log('  ----------  --------  --------  ---------  -----------  ------');

// The declared periods are the labels carried in level.mjs's OSC comments.
const DECLARED = { blinker: 2, toad: 2, beacon: 2, pulsar: 3, penta: 15 };

const measured = {};
let mismatches = 0;
for (const [name, cells] of Object.entries(OSC)) {
  const r = periodOf(cells);
  measured[name] = r.period;
  // xf() rotations produce fresh arrays, so identity matching finds the
  // unrotated placements; the level places these oscillators unrotated.
  const placed = placedCells.has(cells);
  const bad = r.period !== DECLARED[name];
  if (bad) mismatches++;
  console.log(
    `  ${name.padEnd(10)}  ${String(DECLARED[name] ?? '?').padStart(8)}  `
    + `${String(r.period ?? 'none').padStart(8)}  ${String(r.transient ?? '-').padStart(9)}  `
    + `${`${r.popMin}..${r.popMax}`.padStart(11)}  ${placed ? 'yes' : 'no'}`
    + (bad ? '   <- MISLABELLED' : ''),
  );
}

// The lcm arithmetic that level.mjs's PERIOD comment states in prose.
const placedNames = Object.entries(OSC).filter(([, c]) => placedCells.has(c)).map(([n]) => n);
const placedPeriods = placedNames.map((n) => measured[n]);
const expected = placedPeriods.length ? placedPeriods.reduce(lcm) : null;

console.log(`\n  placed: ${placedNames.join(', ')} -> periods ${placedPeriods.join(', ')}`);
console.log(`  lcm = ${expected}   declared PERIOD = ${PERIOD}   substrate (C11) = ${L.period}`);

const problems = [];
if (mismatches) problems.push(`${mismatches} oscillator(s) do not have their labelled period`);
if (expected !== PERIOD) problems.push(`lcm of placed periods is ${expected}, declared PERIOD is ${PERIOD}`);
// An unplaced oscillator whose period is not what its label says is not a bug
// today and IS a trap tomorrow, so it is reported above but does not fail here
// beyond the mislabel count.
if (problems.length === 0) {
  console.log('\n  OK: every oscillator has its labelled period, and PERIOD is their lcm.');
  process.exit(0);
}
for (const p of problems) console.log(`  PROBLEM: ${p}`);
process.exit(1);
