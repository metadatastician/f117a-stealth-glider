// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jonathan D.A. Jewell (hyperpolymath) <j.d.a.jewell@open.ac.uk>
//
// Ledger claims C2 and C3 — the radar's line-of-sight is sound.
//
//   C2  A supercover ray never leaks through a diagonal wall, and LOS is
//       symmetric: hasLOS(a,b) == hasLOS(b,a).
//   C3  A radar does not occlude itself.
//
// C3 is a regression test for a bug hit while designing this repository: rays
// cast from a sensor's centroid start inside the sensor's own live beehive, so
// every target reads as blocked. It measured as 3 of 1025 lattice points
// painted — a radar network that was, in effect, switched off. It looked like a
// balance problem, not a bug, which is exactly why it is pinned here.
//
// Run: node verify-los.mjs

import { supercover, hasLOS, prepareSensors, paintedBy, stepExposure } from './radar.mjs';

let failures = 0;
const ok = (cond, msg) => {
  if (cond) { console.log(`  ok   ${msg}`); } else { console.log(`  FAIL ${msg}`); failures++; }
};

const W = 32, H = 32;
const mk = () => new Uint8Array(W * H);
const set = (g, x, y) => { g[y * W + x] = 1; };

// A deliberately naive Bresenham, present ONLY as a canary. If the diagonal-wall
// test below cannot tell this apart from supercover, the test proves nothing.
function bresenhamBlocked(grid, x0, y0, x1, y1) {
  let dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx - dy, x = x0, y = y0;
  for (;;) {
    if (!(x === x0 && y === y0) && !(x === x1 && y === y1) && grid[y * W + x]) return true;
    if (x === x1 && y === y1) return false;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x += sx; }
    if (e2 < dx) { err += dx; y += sy; }
  }
}

console.log('C2 — supercover geometry');

// --- open field: everything sees everything -------------------------------
{
  const g = mk();
  let clear = true;
  for (let i = 0; i < 200; i++) {
    const a = [i % W, (i * 7) % H], b = [(i * 13) % W, (i * 3) % H];
    if (!hasLOS(g, W, H, a[0], a[1], b[0], b[1], null)) clear = false;
  }
  ok(clear, 'empty grid: 200 sampled pairs all have clear LOS');
}

// --- one cell in the way blocks --------------------------------------------
{
  const g = mk(); set(g, 10, 5);
  ok(!hasLOS(g, W, H, 5, 5, 15, 5, null), 'a single live cell on the ray blocks it');
  ok(hasLOS(g, W, H, 5, 6, 15, 6, null), 'the adjacent row is unaffected');
}

// --- THE DIAGONAL WALL ------------------------------------------------------
// Cells (k,k) form a wall with no orthogonal thickness. Every cell strictly
// below the wall must be invisible from every cell strictly above it. This is
// the property Bresenham violates.
{
  const g = mk();
  for (let k = 0; k < W; k++) set(g, k, k);
  const above = [], below = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (y < x - 1) above.push([x, y]);
    if (y > x + 1) below.push([x, y]);
  }
  let leaks = 0, bleaks = 0, pairs = 0;
  for (let i = 0; i < above.length; i += 7) {
    for (let j = 0; j < below.length; j += 7) {
      const [ax, ay] = above[i], [bx, by] = below[j];
      pairs++;
      if (hasLOS(g, W, H, ax, ay, bx, by, null)) leaks++;
      if (!bresenhamBlocked(g, ax, ay, bx, by)) bleaks++;
    }
  }
  ok(leaks === 0, `diagonal wall: 0 of ${pairs} cross-wall pairs have LOS (supercover) — got ${leaks}`);
  // Canary: the test must be capable of failing.
  ok(bleaks > 0, `canary: naive Bresenham DOES leak through the same wall (${bleaks}/${pairs}) — so the test has teeth`);
}

// --- anti-diagonal too, in case the algorithm is lopsided -------------------
{
  const g = mk();
  for (let k = 0; k < W; k++) set(g, k, W - 1 - k);
  let leaks = 0, pairs = 0;
  for (let y = 0; y < H; y += 3) for (let x = 0; x < W; x += 3) {
    if (!(y < W - 1 - x - 1)) continue;
    for (let y2 = 0; y2 < H; y2 += 3) for (let x2 = 0; x2 < W; x2 += 3) {
      if (!(y2 > W - 1 - x2 + 1)) continue;
      pairs++;
      if (hasLOS(g, W, H, x, y, x2, y2, null)) leaks++;
    }
  }
  ok(leaks === 0, `anti-diagonal wall: 0 of ${pairs} cross-wall pairs have LOS — got ${leaks}`);
}

// --- symmetry ---------------------------------------------------------------
{
  const g = mk();
  // scattered obstacles, deterministic (no Math.random anywhere in this repo)
  for (let k = 0; k < 120; k++) set(g, (k * 11 + 3) % W, (k * 17 + 5) % H);
  let asym = 0, pairs = 0;
  for (let i = 0; i < W * H; i += 13) {
    for (let j = i + 7; j < W * H; j += 29) {
      const a = [i % W, (i / W) | 0], b = [j % W, (j / W) | 0];
      pairs++;
      if (hasLOS(g, W, H, a[0], a[1], b[0], b[1], null) !== hasLOS(g, W, H, b[0], b[1], a[0], a[1], null)) asym++;
    }
  }
  ok(asym === 0, `symmetry: hasLOS(a,b) == hasLOS(b,a) over ${pairs} pairs — ${asym} asymmetric`);
}

// --- supercover is a superset of Bresenham ----------------------------------
{
  let missing = 0, rays = 0;
  for (let k = 0; k < 60; k++) {
    const x0 = k % W, y0 = (k * 5) % H, x1 = (k * 7 + 3) % W, y1 = (k * 3 + 11) % H;
    const sc = new Set();
    supercover(x0, y0, x1, y1, (x, y) => { sc.add(`${x},${y}`); return false; });
    // walk Bresenham and check every cell is in the supercover set
    let dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx - dy, x = x0, y = y0;
    rays++;
    for (;;) {
      if (!sc.has(`${x},${y}`)) missing++;
      if (x === x1 && y === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x += sx; }
      if (e2 < dx) { err += dx; y += sy; }
    }
  }
  ok(missing === 0, `supercover ⊇ Bresenham over ${rays} rays — ${missing} cells missing`);
}

// --- endpoints never occlude ------------------------------------------------
{
  const g = mk(); set(g, 5, 5); set(g, 20, 20);
  ok(hasLOS(g, W, H, 5, 5, 20, 20, null), 'a live emitter and a live target do not block their own ray');
}

console.log('C3 — a radar does not occlude itself');

// --- the regression: beehive-shaped sensor, ray from its centroid ------------
{
  const g = mk();
  // beehive footprint, as level.mjs builds sensors
  const beehive = [[1, 0], [2, 0], [0, 1], [3, 1], [1, 2], [2, 2]];
  const at = [8, 8];
  const cells = beehive.map(([x, y]) => [x + at[0], y + at[1]]);
  for (const [x, y] of cells) set(g, x, y);

  const [s] = prepareSensors([{ name: 'RDR-T', cells }], W, 40);
  const targets = [[24, 8], [8, 24], [24, 24], [2, 2], [20, 12]];

  const withExempt = targets.filter(([x, y]) => hasLOS(g, W, H, s.cx, s.cy, x, y, s.exempt)).length;
  const without = targets.filter(([x, y]) => hasLOS(g, W, H, s.cx, s.cy, x, y, null)).length;

  ok(withExempt === targets.length, `with footprint exempt, the sensor sees all ${targets.length} clear targets (saw ${withExempt})`);
  ok(without < targets.length, `canary: WITHOUT the exemption it blinds itself (${without}/${targets.length} visible) — the bug is real, not hypothetical`);

  // And the exemption must not turn into a general licence to see through cover.
  // A full-height wall, so this asserts the property rather than a guess about
  // which cell the ray happens to cross — the first draft of this test blocked
  // (16,8) when the ray actually passes through (16,9), and failed for that
  // reason alone.
  for (let y = 0; y < H; y++) set(g, 16, y);
  ok(!hasLOS(g, W, H, s.cx, s.cy, 24, 8, s.exempt), 'the exemption is scoped to its own footprint — foreign cover still blocks');
}

// --- paintedBy plumbing -----------------------------------------------------
{
  const g = mk();
  const beehive = [[1, 0], [2, 0], [0, 1], [3, 1], [1, 2], [2, 2]];
  const cells = beehive.map(([x, y]) => [x + 8, y + 8]);
  for (const [x, y] of cells) set(g, x, y);
  const sensors = prepareSensors([{ name: 'RDR-T', cells, range: 12 }], W);

  ok(paintedBy(g, W, H, sensors, [[16, 9]]).length === 1, 'in range with clear LOS: painted');
  ok(paintedBy(g, W, H, sensors, [[30, 30]]).length === 0, 'out of range: not painted, however clear the line');

  // one exposed cell of a 5-cell aircraft is enough
  for (let y = 0; y < H; y++) set(g, 14, y);            // full vertical wall
  g[9 * W + 14] = 0;                                    // one gap
  const partly = paintedBy(g, W, H, sensors, [[16, 7], [16, 8], [16, 9], [16, 10], [16, 11]]);
  ok(partly.length === 1, 'a single exposed cell paints the whole aircraft (conservative rule holds)');
}

// --- exposure dwell ---------------------------------------------------------
{
  let e = 0;
  for (let i = 0; i < 5; i++) e = stepExposure(e, true);
  ok(e === 5, 'exposure rises by one per painted generation');
  for (let i = 0; i < 3; i++) e = stepExposure(e, false);
  ok(e === 2, 'exposure decays by one per clean generation');
  for (let i = 0; i < 10; i++) e = stepExposure(e, false);
  ok(e === 0, 'exposure floors at zero and does not go negative');
}

console.log(failures === 0 ? '\nC2, C3: PASS' : `\nC2, C3: ${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
