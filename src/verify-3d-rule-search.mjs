// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jonathan D.A. Jewell (hyperpolymath) <j.d.a.jewell@open.ac.uk>
//
// Ledger claim C9 — 3D Life has no glider ecology, MEASURED.
//
// This repository's world is 2D and literally Conway, and its three
// dimensions live entirely in the camera. That was not an aesthetic call: it
// was decided by this search, run during planning and landed here as a
// permanent test so the decision cannot quietly become folklore.
//
// Protocol (the one cited in spike/README.md and README.adoc):
//   180 random soups per rule on a 24^3 torus, up to 160 generations each,
//   spaceship detection by exact normalised-shape repeat plus displacement.
//
// Rules, in Bays' r1r2r3r4 notation (survive r1..r2 neighbours of 26, born
// r3..r4): 5766 — the classic 3D Life candidate — and 4555, the rule
// spike/world.html actually implemented while calling itself Conway
// (spike defect #1). Both are Bays' own candidates precisely because they
// DON'T explode; both have known gliders from DIRECTED search. The claim
// here is ecological, not existential: random soups produce zero translating
// patterns, so a soup-seeded 3D world has no players and no traffic, and a
// game that needs a glider cannot be built on it by seeding.
//
// Determinism: soups come from a seeded xorshift32 — the same 360 soups every
// run, on every machine. A verification script with Math.random in it would
// be a different measurement every time it ran, i.e. not a measurement.
//
// Soup shape: every cell of a centred 10x10x10 box live with probability
// ~1/3. Scattered sparse seeding (spike/world.html used 150 cells across the
// whole torus) is vacuous for these rules — with births needing 5 or 6
// neighbours, isolated cells die on the first tick and the test would pass
// on any rule whatsoever. A dense block is the honest soup: it gives the
// rule something to work with.
//
// Run: node verify-3d-rule-search.mjs

const N = 24, N3 = N * N * N;
const SOUPS = 180, MAXGEN = 160, POPCAP = 6000;

// --- seeded PRNG (xorshift32) ------------------------------------------------
function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

// --- torus neighbourhood, precomputed once ------------------------------------
const idx = (x, y, z) => x + N * (y + N * z);
const NB = new Int32Array(N3 * 26);
{
  let k = 0;
  for (let z = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    for (let dz = -1; dz <= 1; dz++) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy && !dz) continue;
      NB[k++] = idx((x + dx + N) % N, (y + dy + N) % N, (z + dz + N) % N);
    }
  }
}

// One generation, sparse: touch only live cells and their neighbourhoods.
function step(live, world, counts, touched, stamp, gen, s1, s2, b1, b2) {
  let nt = 0;
  for (const i of live) {
    const base = i * 26;
    for (let k = 0; k < 26; k++) {
      const j = NB[base + k];
      if (stamp[j] !== gen) { stamp[j] = gen; counts[j] = 0; touched[nt++] = j; }
      counts[j]++;
    }
    if (stamp[i] !== gen) { stamp[i] = gen; counts[i] = 0; touched[nt++] = i; }
  }
  const next = [];
  for (let t = 0; t < nt; t++) {
    const j = touched[t];
    const n = counts[j];
    if (world[j]) { if (n >= s1 && n <= s2) next.push(j); }
    else if (n >= b1 && n <= b2) next.push(j);
  }
  for (const i of live) world[i] = 0;
  for (const j of next) world[j] = 1;
  return next;
}

// Normalise a live set against torus wrap: per axis, find an empty gap of at
// least 2 planes and rebase the origin just after it; if an axis has no such
// gap the pattern spans the torus and this generation is skipped (returns
// null) — no soup in practice grows that far without hitting POPCAP first.
function canonical(live) {
  const occ = [new Uint8Array(N), new Uint8Array(N), new Uint8Array(N)];
  for (const i of live) {
    occ[0][i % N] = 1;
    occ[1][((i / N) | 0) % N] = 1;
    occ[2][(i / (N * N)) | 0] = 1;
  }
  const base = [];
  for (let a = 0; a < 3; a++) {
    let found = -1;
    for (let p = 0; p < N; p++) {
      if (!occ[a][p] && !occ[a][(p + 1) % N]) { found = (p + 2) % N; break; }
    }
    if (found < 0) return null;
    base.push(found);
  }
  const rel = [];
  let minx = N, miny = N, minz = N;
  for (const i of live) {
    const x = (i % N - base[0] + N) % N;
    const y = (((i / N) | 0) % N - base[1] + N) % N;
    const z = (((i / (N * N)) | 0) - base[2] + N) % N;
    rel.push([x, y, z]);
    if (x < minx) minx = x; if (y < miny) miny = y; if (z < minz) minz = z;
  }
  rel.sort((a, b) => (a[2] - b[2]) || (a[1] - b[1]) || (a[0] - b[0]));
  const shape = rel.map(([x, y, z]) => `${x - minx},${y - miny},${z - minz}`).join(';');
  // absolute anchor, unwrapped against the rebased origin — displacement of
  // this anchor between shape repeats is what distinguishes a spaceship from
  // an oscillator.
  return { shape, anchor: [base[0] + minx, base[1] + miny, base[2] + minz] };
}

function runRule(name, s1, s2, b1, b2) {
  const world = new Uint8Array(N3);
  const counts = new Uint16Array(N3);
  const stamp = new Int32Array(N3).fill(-1);
  const touched = new Int32Array(N3);
  let ships = 0;
  const fate = { died: 0, still: 0, oscillator: 0, ranOut: 0, popcap: 0, spaceship: 0 };

  for (let soup = 0; soup < SOUPS; soup++) {
    const rand = rng(0xF117A0 + soup * 2654435761);
    world.fill(0);
    let live = [];
    const lo = (N - 10) / 2;
    for (let z = lo; z < lo + 10; z++) for (let y = lo; y < lo + 10; y++) for (let x = lo; x < lo + 10; x++) {
      if (rand() < 0.34) { const i = idx(x, y, z); world[i] = 1; live.push(i); }
    }
    const seen = new Map();          // shape -> { gen, anchor }
    let outcome = 'ranOut';
    for (let g = 1; g <= MAXGEN; g++) {
      live = step(live, world, counts, touched, stamp, soup * (MAXGEN + 1) + g, s1, s2, b1, b2);
      if (live.length === 0) { outcome = 'died'; break; }
      if (live.length > POPCAP) { outcome = 'popcap'; break; }
      const c = canonical(live);
      if (!c) continue;
      const prev = seen.get(c.shape);
      if (prev) {
        const moved = prev.anchor.some((v, a) => v !== c.anchor[a]);
        if (moved) { outcome = 'spaceship'; ships++; }
        else outcome = prev.gen === g - 1 ? 'still' : 'oscillator';
        break;
      }
      seen.set(c.shape, { gen: g, anchor: c.anchor });
    }
    fate[outcome]++;
  }
  console.log(`  ${name}: ${SOUPS} soups -> ${JSON.stringify(fate)}`);
  return ships;
}

let failures = 0;
const ok = (cond, msg) => {
  if (cond) console.log(`  ok   ${msg}`);
  else { console.log(`  RED  ${msg}`); failures++; }
};

console.log('C9 — 3D Life has no glider ecology (24^3 torus, 180 seeded soups per rule)');
const ships5766 = runRule('Bays 5766 (S5..7 / B6)', 5, 7, 6, 6);
const ships4555 = runRule('Bays 4555 (S4..5 / B5)', 4, 5, 5, 5);
ok(ships5766 === 0, `Bays 5766: ${ships5766} translating patterns from ${SOUPS} soups`);
ok(ships4555 === 0, `4555 (the spike's actual rule): ${ships4555} translating patterns from ${SOUPS} soups`);

if (failures === 0) {
  console.log('\nC9: PASS — soup-seeded 3D Life produces no players; the third dimension');
  console.log('stays in the camera. (Bays\'s gliders exist — from DIRECTED search, which');
  console.log('is the point: an ecology you must construct by hand is not an ecology.)');
  process.exit(0);
}
console.log(`\nC9: RED (${failures}) — a random soup produced a traveller; the 2D ruling needs re-examination.`);
process.exit(1);
