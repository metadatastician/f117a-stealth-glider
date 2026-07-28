// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jonathan D.A. Jewell (hyperpolymath) <j.d.a.jewell@open.ac.uk>
//
// Ledger claim C7 — the renderer and camera are INERT.
//
// verify-determinism.mjs (C8) deliberately excludes the renderer from its
// banned-primitive scope, "because claim C7 proves they cannot influence the
// mission outcome, not merely because they are awkward". This file is that
// proof, and it is a measurement, not an argument:
//
//   Fly the committed witness TWICE. Run A is headless. Run B invokes the
//   full presentation path every generation — camera pursuit, shadow map on
//   CA tick, draw-list construction — exactly as ui.js does, minus the DOM.
//   Every generation's world must hash identically between the runs, and the
//   outcomes must match. If the renderer can write one bit of mission state,
//   this fails.
//
// Three supporting checks close the obvious holes:
//   - a CANARY: a deliberately mutating renderer run through the same harness
//     MUST be caught, or the twin-run comparison proves nothing;
//   - the C8 primitive grep applied to render3d.mjs: the pure layer gets no
//     clock and no randomness (ui.js above it legitimately owns the frame
//     clock — that is the layer C7 exists to fence off);
//   - render3d.mjs must import NOTHING. The layering claim is then visible in
//     the import graph rather than asserted in prose.
//
// Run: node verify-renderer.mjs

import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { buildLevel } from './level.mjs';
import { createMission, missionStep, playerCells } from './mission.mjs';
import { shadowMap } from './radar.mjs';
import { createCamera, stepCamera, buildDrawList } from './render3d.mjs';

const GENS = 600;               // witness lands at t=469; ambient tail included
const VW = 960, VH = 540;
const DT = 1 / 60;              // a fixed dt: the camera gets the same clock twice

function sets(L, W) {
  const sensor = new Set();
  for (const s of L.sensors) for (const [x, y] of s.cells) sensor.add(y * W + x);
  const hangar = new Set(L.hangarCells.map(([x, y]) => y * W + x));
  return { sensor, hangar, playerCells };
}

// Fly the witness; per generation, call `present(M, shadow)` if given.
// Returns { hashes, result, trace, peak }.
function fly(present) {
  const L = buildLevel();
  const M = createMission(L);
  const turns = new Map(L.witness.map(([t, hx, hy]) => [t, [hx, hy]]));
  const cam = createCamera(L);
  const S = sets(L, M.W);
  const hashes = [];
  let shadow = null;
  for (let t = 0; t < GENS && !M.result; t++) {
    missionStep(M, turns.get(t) ?? null);
    if (present) {
      shadow = shadowMap(M.world, M.W, M.H, M.radar);   // on CA tick, as ui.js does
      stepCamera(cam, M.player.anchor, M.player.heading, DT);
      const prims = present(M, shadow, cam, S);
      if (!Array.isArray(prims)) throw new Error('renderer returned no draw list');
    }
    hashes.push(createHash('sha1').update(Buffer.from(M.world)).digest('hex'));
  }
  return { hashes, result: M.result, trace: M.trace, peak: M.peakExposure };
}

let failures = 0;
const ok = (cond, msg) => {
  if (cond) console.log(`  ok   ${msg}`);
  else { console.log(`  RED  ${msg}`); failures++; }
};

console.log('C7 — the renderer and camera cannot influence the mission');

// --- the twin flight ---------------------------------------------------------
const plain = fly(null);
const drawn = fly((M, shadow, cam, S) => buildDrawList(M, shadow, cam, VW, VH, S));

let firstDiff = -1;
for (let i = 0; i < Math.max(plain.hashes.length, drawn.hashes.length); i++) {
  if (plain.hashes[i] !== drawn.hashes[i]) { firstDiff = i; break; }
}
ok(firstDiff === -1 && plain.hashes.length === drawn.hashes.length,
  `every generation hashes identically with and without the renderer `
  + `(${plain.hashes.length} generations${firstDiff >= 0 ? `, first divergence at t=${firstDiff}` : ''})`);
ok(plain.result === drawn.result && plain.trace === drawn.trace && plain.peak === drawn.peak,
  `outcomes agree: ${plain.result} trace ${plain.trace} peak ${plain.peak} `
  + `vs ${drawn.result} trace ${drawn.trace} peak ${drawn.peak}`);

// --- the canary: the harness must be able to FAIL ----------------------------
const evil = fly((M) => { M.world[0] ^= 1; return []; });
const evilDiffers = evil.hashes.some((h, i) => h !== plain.hashes[i]);
ok(evilDiffers,
  'canary: a deliberately mutating renderer IS caught by the same comparison');

// --- the pure layer gets no clock and no randomness ---------------------------
const banned = [
  [/\bMath\s*\.\s*random\b/, 'Math.random'],
  [/\bDate\s*\.\s*now\b/, 'Date.now'],
  [/new\s+Date\s*\(\s*\)/, 'new Date()'],
  [/performance\s*\.\s*now/, 'performance.now'],
];
const src = readFileSync(new URL('render3d.mjs', import.meta.url), 'utf8');
const hits = banned.filter(([re]) => re.test(src)).map(([, n]) => n);
ok(hits.length === 0,
  `render3d.mjs contains no nondeterminism primitive${hits.length ? ` — found ${hits.join(', ')}` : ''}`);

// --- and no imports: the layering is in the import graph ----------------------
const imports = src.split('\n').filter((l) => /^\s*import\s/.test(l));
ok(imports.length === 0,
  `render3d.mjs imports nothing (${imports.length} import lines) — mission state arrives as arguments`);

if (failures === 0) {
  console.log('\nC7: PASS — the presentation layer is provably a spectator.');
  process.exit(0);
}
console.log(`\nC7: RED (${failures})`);
process.exit(1);
