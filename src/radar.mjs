// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jonathan D.A. Jewell (hyperpolymath) <j.d.a.jewell@open.ac.uk>
//
// F117A Stealth Glider — radar line-of-sight. NEW in this repository; the f19
// kernel has no equivalent. No DOM, no randomness, no I/O: same discipline as
// the vendored engine, because the verification ledger runs this headless.
//
// The premise, in one line: the F-117A's actual defence was terrain masking, so
// what hides you here is a live cell standing between you and the emitter — and
// because the substrate is an automaton, that cover MOVES. Reading the phase is
// how you stay masked.
//
// Two facts, both established by measurement rather than by reasoning, drive the
// design of this file. They are stated here because they are easy to
// re-introduce by "tidying" the code.
//
// (1) A RADAR MUST NOT OCCLUDE ITSELF.
//     Sensors are beehives: six live cells. A ray cast from the sensor's centroid
//     starts INSIDE those live cells, so a naive implementation reports every
//     target as blocked. Measured during design: 3 of 1025 lattice points
//     painted, i.e. the radar network was blind. Every sensor therefore carries
//     an `exempt` set of its own footprint, skipped during traversal.
//
// (2) THE LINE MUST BE SUPERCOVER, NOT BRESENHAM.
//     Bresenham picks ONE cell per major-axis step, so a ray crossing a diagonal
//     wall slips between two diagonally-adjacent live cells and sees through
//     solid cover. Supercover returns every cell the segment touches, including
//     both cells at an exact corner crossing. Claim C2 tests precisely this.

/**
 * Supercover line: every grid cell the segment (x0,y0)->(x1,y1) touches.
 *
 * Dedu's supercover variant of Bresenham. Where the segment passes exactly
 * through a lattice corner, BOTH straddling cells are emitted — that is the
 * property that stops a ray leaking through a diagonal wall.
 *
 * `visit(x, y)` may return `true` to stop early; the walk then returns `true`.
 */
export function supercover(x0, y0, x1, y1, visit) {
  let x = x0, y = y0;
  if (visit(x, y)) return true;

  let dx = x1 - x0, dy = y1 - y0;
  const xstep = dx < 0 ? -1 : 1;
  const ystep = dy < 0 ? -1 : 1;
  dx = Math.abs(dx); dy = Math.abs(dy);
  const ddx = 2 * dx, ddy = 2 * dy;

  if (ddx >= ddy) {
    let err = dx, errPrev = dx;
    for (let i = 0; i < dx; i++) {
      x += xstep;
      err += ddy;
      if (err > ddx) {
        y += ystep;
        err -= ddx;
        // Which cell(s) did we clip on the way through the corner?
        if (err + errPrev < ddx) { if (visit(x, y - ystep)) return true; }
        else if (err + errPrev > ddx) { if (visit(x - xstep, y)) return true; }
        else { // exact corner — both, or the ray leaks through the diagonal
          if (visit(x, y - ystep)) return true;
          if (visit(x - xstep, y)) return true;
        }
      }
      if (visit(x, y)) return true;
      errPrev = err;
    }
  } else {
    let err = dy, errPrev = dy;
    for (let i = 0; i < dy; i++) {
      y += ystep;
      err += ddx;
      if (err > ddy) {
        x += xstep;
        err -= ddy;
        if (err + errPrev < ddy) { if (visit(x - xstep, y)) return true; }
        else if (err + errPrev > ddy) { if (visit(x, y - ystep)) return true; }
        else {
          if (visit(x - xstep, y)) return true;
          if (visit(x, y - ystep)) return true;
        }
      }
      if (visit(x, y)) return true;
      errPrev = err;
    }
  }
  return false;
}

/**
 * Is (tx,ty) visible from (sx,sy) through `grid`?
 *
 * Endpoints never occlude: the emitter sits in its own footprint, and the
 * target is the thing being looked at. `exempt` (a Set of y*W+x) additionally
 * skips the emitter's whole footprint — see note (1) at the top of this file.
 */
export function hasLOS(grid, W, H, sx, sy, tx, ty, exempt) {
  const blocked = supercover(sx, sy, tx, ty, (x, y) => {
    if (x === sx && y === sy) return false;
    if (x === tx && y === ty) return false;
    if (x < 0 || y < 0 || x >= W || y >= H) return false;
    const i = y * W + x;
    if (exempt && exempt.has(i)) return false;
    return grid[i] === 1;
  });
  return !blocked;
}

/** Squared range test, kept integer so it cannot drift between callers. */
function inRange(sx, sy, tx, ty, range) {
  const dx = tx - sx, dy = ty - sy;
  return dx * dx + dy * dy <= range * range;
}

/**
 * Normalise a level's sensor declarations into the form this module wants:
 * a centroid to cast from, a footprint to exempt, and a range.
 */
export function prepareSensors(sensors, W, DEFAULT_RANGE = 45) {
  return sensors.map((s) => {
    let sx = 0, sy = 0;
    for (const [x, y] of s.cells) { sx += x; sy += y; }
    return {
      name: s.name,
      cx: Math.round(sx / s.cells.length),
      cy: Math.round(sy / s.cells.length),
      range: s.range ?? DEFAULT_RANGE,
      exempt: new Set(s.cells.map(([x, y]) => y * W + x)),
      cells: s.cells,
    };
  });
}

/**
 * Which sensors currently paint `cells`?
 *
 * A single exposed cell paints the aircraft. This is the CONSERVATIVE reading
 * and it is a design decision, not an accident: requiring every cell to be
 * exposed would make the glider's own 5-cell spread act as free cover, and the
 * mask you are reading off the substrate would stop meaning what it looks like
 * it means.
 */
export function paintedBy(grid, W, H, sensors, cells) {
  const hits = [];
  for (const s of sensors) {
    for (const [x, y] of cells) {
      if (!inRange(s.cx, s.cy, x, y, s.range)) continue;
      if (hasLOS(grid, W, H, s.cx, s.cy, x, y, s.exempt)) { hits.push(s.name); break; }
    }
  }
  return hits;
}

/**
 * Ground shadow: a Uint8Array over the whole grid, 1 where a hypothetical
 * target would be painted. Drives the on-screen shadow overlay and the C4
 * "is the shadow load-bearing?" metric.
 *
 * COST: O(W*H*sensors*ray). Recompute this ON CA TICK, never per animation
 * frame — the automaton advances at a couple of hertz and the renderer at
 * sixty, so a per-frame recompute is ~30x wasted work and will stutter.
 */
export function shadowMap(grid, W, H, sensors) {
  const out = new Uint8Array(W * H);
  for (const s of sensors) {
    const r = s.range;
    const x0 = Math.max(0, s.cx - r), x1 = Math.min(W - 1, s.cx + r);
    const y0 = Math.max(0, s.cy - r), y1 = Math.min(H - 1, s.cy + r);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const i = y * W + x;
        if (out[i]) continue;
        if (!inRange(s.cx, s.cy, x, y, r)) continue;
        if (hasLOS(grid, W, H, s.cx, s.cy, x, y, s.exempt)) out[i] = 1;
      }
    }
  }
  return out;
}

/**
 * Exposure accumulator. Dwell, not instant death.
 *
 * Instant death on first paint would be unreadable: the shadow breathes with
 * the oscillators, so a single-generation flicker of exposure is normal play,
 * not a mistake. Sustained exposure is the mistake. Rising and falling by one
 * per generation makes the HUD number a legible countdown in both directions.
 */
export const LOCK = 8;

export function stepExposure(prev, painted) {
  if (painted) return prev + 1;
  return prev > 0 ? prev - 1 : 0;
}
