// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jonathan D.A. Jewell (hyperpolymath) <j.d.a.jewell@open.ac.uk>
//
// Ledger claims C11 and C12 — the level is well-formed.
//
//   C11  The substrate is periodic from generation 0, with the period the level
//        declares, and a bounded population.
//   C12  No two stamped patterns are close enough to react.
//
// These are preconditions, not decoration. C11 is what makes "substrate phase"
// mean anything: the solver indexes states by `t mod P`, so if a transient
// exists the search is exploring a space that has not formed yet. C12 is what
// keeps C11 true — the first draft of this level had a 13x13 pulsar every 9
// cells and two still lifes within 2 cells of a bank, and those contacts alone
// pushed the transient from 0 to 621 generations while the level still looked
// entirely reasonable on screen.
//
// Run: node verify-level.mjs

import { createHash } from 'node:crypto';
import { buildLevel } from './level.mjs';
import { createMission, ambientStep } from './mission.mjs';

let failures = 0;
const ok = (cond, msg) => {
  if (cond) console.log(`  ok   ${msg}`);
  else { console.log(`  FAIL ${msg}`); failures++; }
};

const L = buildLevel();

console.log('C11 — the substrate is periodic from generation 0');
{
  const M = createMission(buildLevel());
  const seen = new Map();
  let popMin = Infinity, popMax = 0, transient = null, period = null;
  for (let t = 0; t < 800; t++) {
    const h = createHash('sha1').update(Buffer.from(M.world)).digest('hex');
    let p = 0; for (let i = 0; i < M.world.length; i++) p += M.world[i];
    popMin = Math.min(popMin, p); popMax = Math.max(popMax, p);
    if (seen.has(h)) { transient = seen.get(h); period = t - transient; break; }
    seen.set(h, t);
    ambientStep(M);
  }
  ok(period !== null, `the substrate cycles (within 800 generations)`);
  ok(transient === 0, `transient is 0 — 'phase = t mod P' is defined at launch (got ${transient})`);
  ok(period === L.period, `period is the declared ${L.period} (measured ${period})`);
  ok(popMax < 4 * popMin, `population is bounded and stable: ${popMin}..${popMax}`);
}

console.log('\nC12 — no two stamped patterns can react');
{
  const boxes = L.stamps.map(([cells, ox, oy], i) => {
    let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
    for (const [x, y] of cells) {
      const a = x + ox, b = y + oy;
      x0 = Math.min(x0, a); y0 = Math.min(y0, b);
      x1 = Math.max(x1, a); y1 = Math.max(y1, b);
    }
    return { i, x0, y0, x1, y1, n: cells.length };
  });

  // Everything must be on the grid, with a one-cell margin: B3/S23 here treats
  // outside as permanently dead, so a pattern touching the border is truncated
  // rather than evolving, which quietly changes its period.
  const oob = boxes.filter((b) => b.x0 < 1 || b.y0 < 1 || b.x1 > L.W - 2 || b.y1 > L.H - 2);
  ok(oob.length === 0, `all ${boxes.length} patterns sit inside the border (${oob.length} outside)`);

  // Chebyshev gap of 3 between bounding boxes. Two is the minimum that cannot
  // interact in B3/S23; three leaves a margin for oscillators whose cells move
  // within their box across the cycle.
  const close = [];
  for (let a = 0; a < boxes.length; a++) {
    for (let b = a + 1; b < boxes.length; b++) {
      const A = boxes[a], B = boxes[b];
      const gx = Math.max(0, Math.max(A.x0 - B.x1, B.x0 - A.x1));
      const gy = Math.max(0, Math.max(A.y0 - B.y1, B.y0 - A.y1));
      if (Math.max(gx, gy) < 3) close.push([a, b, Math.max(gx, gy)]);
    }
  }
  ok(close.length === 0,
    `no pattern pair within Chebyshev 3 (${close.length} too close`
    + `${close.length ? ': ' + close.map(([a, b, g]) => `#${a}~#${b} gap ${g}`).join(', ') : ''})`);

  // The declared clean landing lanes must actually be clean. This is the check
  // that would have caught the hangar sitting so low that its zone ran off the
  // grid, which made every approach report CRASH_LANDING with no diagnostic.
  ok(Array.isArray(L.glidepaths) && L.glidepaths.length > 0,
    `the level declares ${L.glidepaths?.length ?? 0} clean landing lane(s)`);
  ok(L.hangarZone[2] <= L.W - 1 && L.hangarZone[3] <= L.H - 1,
    `hangarZone [${L.hangarZone}] is inside the grid ${L.W}x${L.H} — off-grid reads`
    + ' return undefined and make every landing a CRASH_LANDING');
  ok(L.glidepaths.includes(L.spawn[0] - L.spawn[1]),
    `spawn lane ${L.spawn[0] - L.spawn[1]} is one of the clean landing lanes [${L.glidepaths}]`);
}

console.log(failures === 0 ? '\nC11, C12: PASS' : `\nC11, C12: ${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
