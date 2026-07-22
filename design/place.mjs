// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jonathan D.A. Jewell (hyperpolymath) <j.d.a.jewell@open.ac.uk>
//
// design/place.mjs — sweep SPATIAL PLACEMENT, not just scalars.
//
// The first attempt at claim C6 swept radarRange, LOCK and pattern spacing, and
// concluded the level could not be made phase-critical. That conclusion was
// unearned: it never moved a sensor or a shutter. Placement is the dimension
// the diagnosis actually pointed at — "the banks do not lie across the sight
// lines the viable route uses" is a statement about geometry, and no amount of
// range tuning addresses it.
//
// Scored by the falsifier itself, not by proxy statistics: a corridor can look
// 43% phase-dependent while the witness route sails through at every phase.
import { buildLevel } from '../src/level.mjs';
import { createMission, missionStep, ambientStep } from '../src/mission.mjs';
import { solve } from './solver.mjs';
import { createHash } from 'node:crypto';

function collisions(L) {
  const boxes = L.stamps.map(([cells, ox, oy]) => {
    let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
    for (const [x, y] of cells) {
      const a = x + ox, b = y + oy;
      x0 = Math.min(x0, a); y0 = Math.min(y0, b); x1 = Math.max(x1, a); y1 = Math.max(y1, b);
    }
    return { x0, y0, x1, y1 };
  });
  let n = 0;
  for (let a = 0; a < boxes.length; a++) for (let b = a + 1; b < boxes.length; b++) {
    const A = boxes[a], B = boxes[b];
    const gx = Math.max(0, Math.max(A.x0 - B.x1, B.x0 - A.x1));
    const gy = Math.max(0, Math.max(A.y0 - B.y1, B.y0 - A.y1));
    if (Math.max(gx, gy) < 3) n++;
  }
  const oob = boxes.filter((b) => b.x0 < 1 || b.y0 < 1 || b.x1 > L.W - 2 || b.y1 > L.H - 2).length;
  return n + oob;
}

function transientOf(mk) {
  const M = createMission(mk());
  const seen = new Map();
  for (let t = 0; t < 300; t++) {
    const h = createHash('sha1').update(Buffer.from(M.world)).digest('hex');
    if (seen.has(h)) return t - seen.get(h) > 0 ? seen.get(h) : 0;
    seen.set(h, t); ambientStep(M);
  }
  return 999;
}

function falsify(mk, witness) {
  const L0 = mk();
  let landed = 0, painted = 0, other = 0; const peaks = [];
  for (let off = 0; off < L0.period; off++) {
    const M = createMission(mk());
    const turns = new Map(witness.map(([t, hx, hy]) => [t, [hx, hy]]));
    for (let k = 0; k < off; k++) ambientStep(M);
    for (let t = 0; t < 3000 && !M.result; t++) missionStep(M, turns.get(t) ?? null);
    if (M.result === 'LANDED') landed++; else if (M.result === 'PAINTED') painted++; else other++;
    peaks.push(M.peakExposure);
  }
  return { landed, painted, other, lo: Math.min(...peaks), hi: Math.max(...peaks) };
}

const results = [];
let tried = 0, rejected = 0;
const why = { collision: 0, transient: 0, unsolvable: 0, threw: 0 };
for (const chokeX of [44, 48, 52, 56]) {
  for (const sdx of [-12, -9, -6, 6, 9, 12]) {
    for (const sdy of [-12, -9, -6, 6, 9, 12]) {
      for (const gdx of [12, 16, 20, 24]) {
       for (const wallN of [5])
       for (const gateRange of [12, 16, 20, 24]) {
        tried++;
          if (Math.abs(sdx + sdy) < 4) continue;   // on the wall line
        const shutterAt = [chokeX + sdx, chokeX + 4 + sdy];
        const gateSensor = [chokeX + gdx, chokeX + 4 + gdx - 6];
        const mk = () => buildLevel({ chokeX, shutterAt, gateSensor, wallN, gateRange });
        let L; try { L = mk(); } catch { rejected++; why.threw++; continue; }
        const nc = collisions(L);
        if (nc > 0) { rejected++; why.collision++; continue; }
        if (transientOf(mk) !== 0) { rejected++; why.transient++; continue; }
        const r = solve(L, mk);
        if (!r.solved) { rejected++; why.unsolvable++; continue; }
        const f = falsify(mk, r.turns);
        results.push({ chokeX, shutterAt, gateSensor, gateRange, turns: r.turns.length, ...f });
       }
      }
    }
  }
}

console.log('rejection breakdown:', JSON.stringify(why));
console.log(`tried ${tried}, rejected ${rejected} (collision / transient / unsolvable), viable ${results.length}\n`);
results.sort((a, b) => (b.painted - a.painted) || (a.landed - b.landed));
console.log('chokeX rng shutter      gate         turns | landed painted other  peak    verdict');
for (const r of results.slice(0, 14)) {
  const verdict = r.painted > r.other && r.landed > 0 && r.landed <= 15 ? '*** PHASE-CRITICAL ***'
    : r.painted === 0 ? 'radar decorative' : 'partial';
  console.log(
    String(r.chokeX).padStart(6), String(r.gateRange).padStart(4),
    `[${r.shutterAt}]`.padEnd(12), `[${r.gateSensor}]`.padEnd(12),
    String(r.turns).padStart(5), '|',
    String(r.landed).padStart(6), String(r.painted).padStart(7), String(r.other).padStart(5),
    ` ${r.lo}..${r.hi}`.padStart(7), ' ' + verdict,
  );
}
