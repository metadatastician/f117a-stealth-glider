// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jonathan D.A. Jewell (hyperpolymath) <j.d.a.jewell@open.ac.uk>
// F19 Stealth Glider — core engine. B3/S23, bounded grid, outside is permanently dead.

export function mkGrid(W, H) { return new Uint8Array(W * H); }

export function step(src, dst, W, H) {
  for (let y = 0; y < H; y++) {
    const y0 = y > 0, y1 = y < H - 1;
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      let n = 0;
      const x0 = x > 0, x1 = x < W - 1;
      if (y0) { const r = i - W; if (x0) n += src[r - 1]; n += src[r]; if (x1) n += src[r + 1]; }
      if (x0) n += src[i - 1];
      if (x1) n += src[i + 1];
      if (y1) { const r = i + W; if (x0) n += src[r - 1]; n += src[r]; if (x1) n += src[r + 1]; }
      dst[i] = (n === 3 || (src[i] && n === 2)) ? 1 : 0;
    }
  }
}

// --- RLE ---
export function parseRLE(s) {
  const cells = [];
  let x = 0, y = 0, num = '';
  for (const line of s.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#') || t.startsWith('x')) continue;
    for (const ch of t) {
      if (ch >= '0' && ch <= '9') { num += ch; continue; }
      const n = num ? parseInt(num, 10) : 1; num = '';
      if (ch === 'b') x += n;
      else if (ch === 'o') { for (let k = 0; k < n; k++) cells.push([x + k, y]); x += n; }
      else if (ch === '$') { y += n; x = 0; }
      else if (ch === '!') return norm(cells).cells;
    }
  }
  return norm(cells).cells;
}

export function norm(cells) {
  let mx = Infinity, my = Infinity;
  for (const [x, y] of cells) { if (x < mx) mx = x; if (y < my) my = y; }
  const out = cells.map(([x, y]) => [x - mx, y - my]).sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  return { cells: out, ox: mx, oy: my };
}

export function key(cells) { return norm(cells).cells.map(c => c.join(',')).join(';'); }

// 8 symmetries: sym = r*2+m, r in 0..3 rotations (90° CW), m mirror-x first
export function xf(cells, sym) {
  const m = sym & 1, r = sym >> 1;
  let cs = cells.map(([x, y]) => m ? [-x, y] : [x, y]);
  for (let k = 0; k < r; k++) cs = cs.map(([x, y]) => [-y, x]);
  return norm(cs).cells;
}

export function stamp(grid, W, cells, ox, oy) {
  const H = grid.length / W;
  for (const [x, y] of cells) {
    const gx = x + ox, gy = y + oy;
    if (gx < 0 || gy < 0 || gx >= W || gy >= H) throw new Error(`stamp out of bounds: ${gx},${gy}`);
    grid[gy * W + gx] = 1;
  }
}

export function live(grid, W, H) {
  const out = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (grid[y * W + x]) out.push([x, y]);
  return out;
}

export function pop(grid) { let s = 0; for (let i = 0; i < grid.length; i++) s += grid[i]; return s; }

// 8-connected clusters of live cells
export function clusters(grid, W, H) {
  const seen = new Uint8Array(W * H), out = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (!grid[i] || seen[i]) continue;
    const q = [[x, y]], comp = []; seen[i] = 1;
    while (q.length) {
      const [cx, cy] = q.pop(); comp.push([cx, cy]);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const j = ny * W + nx;
        if (grid[j] && !seen[j]) { seen[j] = 1; q.push([nx, ny]); }
      }
    }
    out.push(comp);
  }
  return out;
}

// --- Patterns ---
export const P = {
  gliderSE0: [[1, 0], [2, 1], [0, 2], [1, 2], [2, 2]],
  eater1: parseRLE('2o2b$bo2b$bobo$2b2o!'),           // fishhook
  block: [[0, 0], [1, 0], [0, 1], [1, 1]],
  blinker: [[0, 0], [1, 0], [2, 0]],
  beehive: parseRLE('b2ob$o2bo$b2o!'),
  boat: parseRLE('2ob$obo$bo!'),
  tub: parseRLE('bob$obo$bo!'),
  gun: parseRLE('24bo$22bobo$12b2o6b2o12b2o$11bo3bo4b2o12b2o$2o8bo5bo3b2o$2o8bo3bob2o4bobo$10bo5bo7bo$11bo3bo$12b2o!'),
};

// Derive the 4 glider phases + per-step anchor deltas for heading (+1,+1) by simulation.
export function deriveGlider() {
  const W = 40, H = 40;
  let a = mkGrid(W, H), b = mkGrid(W, H);
  stamp(a, W, P.gliderSE0, 12, 12);
  const shapes = [], anchors = [];
  for (let t = 0; t < 9; t++) {
    const cs = live(a, W, H);
    const n = norm(cs);
    shapes.push(n.cells); anchors.push([n.ox, n.oy]);
    step(a, b, W, H); [a, b] = [b, a];
  }
  // sanity: phase 4 shape == phase 0 shape, anchor advanced (1,1)
  if (key(shapes[4]) !== key(shapes[0])) throw new Error('glider period != 4?');
  const d40 = [anchors[4][0] - anchors[0][0], anchors[4][1] - anchors[0][1]];
  if (d40[0] !== 1 || d40[1] !== 1) throw new Error('glider displacement != (1,1)/4: ' + d40);
  const deltas = [];
  for (let p = 0; p < 4; p++) deltas.push([anchors[p + 1][0] - anchors[p][0], anchors[p + 1][1] - anchors[p][1]]);
  return { shapes: shapes.slice(0, 4), deltas };
}

// Build glider tables for all 4 headings via mirroring. heading key: `${sx}${sy}` with s in {1,-1}
export function gliderTables() {
  const base = deriveGlider(); // heading (+1,+1)
  const T = {};
  for (const sx of [1, -1]) for (const sy of [1, -1]) {
    const shapes = base.shapes.map(sh => norm(sh.map(([x, y]) => [sx > 0 ? x : -x, sy > 0 ? y : -y])).cells);
    const deltas = base.deltas.map(([dx, dy]) => [sx * dx, sy * dy]);
    T[`${sx},${sy}`] = { shapes, deltas };
  }
  return T;
}

// Exact-match scan: find any isolated glider (any heading, any phase) inside a window.
// Isolated = shape matches and the bbox expanded by 1 contains no other live cells.
export function findGlider(grid, W, H, T, x0, y0, x1, y1, notInGrid) {
  for (const hk of Object.keys(T)) {
    const { shapes } = T[hk];
    for (let p = 0; p < 4; p++) {
      const sh = shapes[p];
      let bw = 0, bh = 0;
      for (const [x, y] of sh) { if (x + 1 > bw) bw = x + 1; if (y + 1 > bh) bh = y + 1; }
      for (let oy = Math.max(0, y0); oy <= Math.min(H - bh, y1); oy++) {
        for (let ox = Math.max(0, x0); ox <= Math.min(W - bw, x1); ox++) {
          let ok = true;
          // interior must match exactly; ring of 1 around bbox must be empty
          for (let yy = -1; yy <= bh && ok; yy++) for (let xx = -1; xx <= bw && ok; xx++) {
            const gx = ox + xx, gy = oy + yy;
            const v = (gx < 0 || gy < 0 || gx >= W || gy >= H) ? 0 : grid[gy * W + gx];
            const inShape = sh.some(([sx2, sy2]) => sx2 === xx && sy2 === yy) ? 1 : 0;
            if (v !== inShape) ok = false;
          }
          if (ok && notInGrid) {
            let allShadow = true;
            for (const [sx2, sy2] of sh) if (!notInGrid[(oy + sy2) * W + (ox + sx2)]) { allShadow = false; break; }
            if (allShadow) ok = false; // ambient glider — exists in the counterfactual too
          }
          if (ok) return { heading: hk.split(',').map(Number), phase: p, ox, oy };
        }
      }
    }
  }
  return null;
}
