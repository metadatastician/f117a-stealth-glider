// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jonathan D.A. Jewell (hyperpolymath) <j.d.a.jewell@open.ac.uk>
//
// design/place.mjs — sweep SPATIAL PLACEMENT, not scalars.
//
// The first attempt at claim C6 swept radarRange, LOCK and pattern spacing and
// concluded the level could not be made phase-critical. That was unearned: it
// never moved a sensor. "The shutters do not lie across the sight lines the
// viable route uses" is a statement about geometry, and tuning numbers cannot
// fix geometry.
//
// Candidates are GENERATED around the chokepoint gap rather than taken from a
// blind grid. A blind grid spent 426 of 486 trials colliding with the wall it
// was trying to place sensors near, which is a lot of compute to learn nothing.
//
// Scored by the falsifier itself. A corridor can measure 43% phase-dependent
// while the witness sails through at every phase, so only re-flying the route
// at every launch phase is evidence.
import { buildLevel } from '../src/level.mjs';
import { createMission, missionStep, ambientStep } from '../src/mission.mjs';
import { solve } from './solver.mjs';
import { createHash } from 'node:crypto';

const boxesOf = (L) => L.stamps.map(([cells, ox, oy]) => {
  let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
  for (const [x, y] of cells) {
    const a = x + ox, b = y + oy;
    x0 = Math.min(x0, a); y0 = Math.min(y0, b); x1 = Math.max(x1, a); y1 = Math.max(y1, b);
  }
  return { x0, y0, x1, y1 };
});

function collisions(L) {
  const b = boxesOf(L);
  let n = 0;
  for (let i = 0; i < b.length; i++) for (let j = i + 1; j < b.length; j++) {
    const gx = Math.max(0, Math.max(b[i].x0 - b[j].x1, b[j].x0 - b[i].x1));
    const gy = Math.max(0, Math.max(b[i].y0 - b[j].y1, b[j].y0 - b[i].y1));
    if (Math.max(gx, gy) < 3) n++;
  }
  return n + b.filter((k) => k.x0 < 1 || k.y0 < 1 || k.x1 > L.W - 2 || k.y1 > L.H - 2).length;
}

function transientOf(mk) {
  const M = createMission(mk());
  const seen = new Map();
  for (let t = 0; t < 200; t++) {
    const h = createHash('sha1').update(Buffer.from(M.world)).digest('hex');
    if (seen.has(h)) return seen.get(h);
    seen.set(h, t); ambientStep(M);
  }
  return 999;
}

// Off-phase launches ONLY (off = 1..period-1), the same population
// verify-falsifier.mjs asserts over. The first version of this tallied off=0
// as well, so `landed` mixed the on-phase launch — which is SUPPOSED to land —
// into the failure statistic, and a config could grade one launch better than
// the ledger would ever measure it.
function falsify(mk, witness) {
  const L0 = mk();
  let landed = 0, painted = 0, other = 0, onPhase = null; const peaks = [];
  for (let off = 0; off < L0.period; off++) {
    const M = createMission(mk());
    const turns = new Map(witness.map(([t, hx, hy]) => [t, [hx, hy]]));
    for (let k = 0; k < off; k++) ambientStep(M);
    for (let t = 0; t < 3000 && !M.result; t++) missionStep(M, turns.get(t) ?? null);
    if (off === 0) { onPhase = M.result; continue; }
    if (M.result === 'LANDED') landed++; else if (M.result === 'PAINTED') painted++; else other++;
    peaks.push(M.peakExposure);
  }
  return { onPhase, landed, painted, other, lo: Math.min(...peaks), hi: Math.max(...peaks), n: L0.period - 1 };
}

// Candidate ring around the gap. The gap sits at (chokeX, chokeX+4); the wall
// runs along (1,-1) through it, so anything with |dx+dy| small is ON the wall.
function ring(cx, cy, radii, minOff) {
  const out = [];
  for (const r of radii) {
    for (let a = 0; a < 16; a++) {
      const th = (a / 16) * 2 * Math.PI;
      const dx = Math.round(r * Math.cos(th)), dy = Math.round(r * Math.sin(th));
      if (Math.abs(dx + dy) < minOff) continue;            // on the wall line
      out.push([cx + dx, cy + dy]);
    }
  }
  return out;
}

const results = [];
const why = { collision: 0, transient: 0, unsolvable: 0 };
let tried = 0;

for (const chokeX of [52, 56, 60]) {
  const gap = [chokeX, chokeX + 4];
  const gates = ring(gap[0], gap[1], [18, 24], 8);
  const shutters = ring(gap[0], gap[1], [9, 12], 6);
  for (const gate2 of gates) {
    for (const shutter2At of shutters) {
      for (const gateRange of [22]) {
        tried++;
        const opts = { chokeX, gate2, gate2Range: gateRange, shutter2At, gateRange };
        const mk = () => buildLevel(opts);
        let L; try { L = mk(); } catch { why.collision++; continue; }
        if (collisions(L) > 0) { why.collision++; continue; }
        if (transientOf(mk) !== 0) { why.transient++; continue; }
        const r = solve(L, mk);
        if (!r.solved) { why.unsolvable++; continue; }
        const f = falsify(mk, r.turns);
        results.push({ ...opts, turns: r.turns.length, ...f });
      }
    }
  }
}

console.log(`tried ${tried}  rejected ${JSON.stringify(why)}  viable ${results.length}\n`);
results.sort((a, b) => (b.painted - a.painted) || (a.landed - b.landed));
console.log('chokeX gate2       shutter2    turns | landed painted other peak    verdict');
for (const r of results.slice(0, 12)) {
  // C6's statement is "a MAJORITY of off-phase launches fail as PAINTED" —
  // that is painted > n/2, not landed <= n/2. The landed form permits exactly
  // half landing with painted as low as 4, which satisfies no reading of
  // "majority". The on-phase launch must LAND or the config is not a level.
  const verdict = (r.onPhase === 'LANDED' && r.painted > r.n / 2) ? '*** C6 GREEN ***'
    : r.onPhase !== 'LANDED' ? `route dies on-phase (${r.onPhase})`
    : r.painted === 0 ? 'decorative' : `partial (${r.painted}/${r.n})`;
  console.log(
    String(r.chokeX).padStart(6), `[${r.gate2}]`.padEnd(11), `[${r.shutter2At}]`.padEnd(11),
    String(r.turns).padStart(5), '|',
    String(r.landed).padStart(6), String(r.painted).padStart(7), String(r.other).padStart(5),
    ` ${r.lo}..${r.hi}`.padStart(6), ' ' + verdict,
  );
}
if (results.length) {
  const b = results[0];
  console.log('\nbest:', JSON.stringify({ chokeX: b.chokeX, gate2: b.gate2, shutter2At: b.shutter2At, gateRange: b.gateRange }));
}
