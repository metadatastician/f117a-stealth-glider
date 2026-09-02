// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jonathan D.A. Jewell (hyperpolymath) <j.d.a.jewell@open.ac.uk>
// F117A Stealth Glider — mission core. No DOM. Used by verify harness AND the shipped game.
// >>> FORK
// ===========================================================================
// DECLARED FORK of f19-stealth-glider@4af642af:src/mission.mjs
// (upstream git blob 62591769529d73f06fd99e24a177231569d1262f).
//
// Claim C1 proves this file is upstream-plus-declared-changes offline and
// cryptographically: verify-kernel-parity.mjs strips every FORK-fenced block,
// reverses the two declared substitutions below, and requires the result to
// hash to that exact blob id. No network, no vendored copy to drift.
//
// The two substitutions. EVERYTHING else must sit inside a FORK fence:
//   1. title line   "F117A Stealth Glider"  <-  "F19 Stealth Glider"
//   2. import path  './kernel/engine.mjs'   <-  './engine.mjs'
//
// Unfenced code is therefore byte-identical to upstream, and must stay that
// way: it is what the inherited verification ledger was established against.
// See ../KERNEL-DIVERGENCE.adoc for the human-readable account.
// ===========================================================================
// <<< FORK
import { mkGrid, step, stamp, norm, live, gliderTables, findGlider } from './kernel/engine.mjs';
// >>> FORK: radar line-of-sight. No equivalent upstream.
import { prepareSensors, paintedBy, stepExposure, LOCK } from './radar.mjs';
// <<< FORK

export const T = gliderTables();
const CUM = {};
for (const hk of Object.keys(T)) {
  const d = T[hk].deltas, c = [[0, 0]];
  for (let p = 0; p < 3; p++) c.push([c[p][0] + d[p][0], c[p][1] + d[p][1]]);
  CUM[hk] = c;
}
export function laneOf(hk, ax, ay, p) {
  const [cx, cy] = CUM[hk][p];
  const [sx, sy] = hk.split(',').map(Number);
  return sx * sy > 0 ? (ax - cx) - (ay - cy) : (ax - cx) + (ay - cy);
}

export function createMission(L) {
  const { W, H } = L;
  const world = mkGrid(W, H), scratch = mkGrid(W, H);
  for (const [cells, ox, oy] of L.stamps) stamp(world, W, cells, ox, oy);
  return {
    L, W, H, world, scratch, shadow: null, sscratch: null,
    t: 0, state: 'FLIGHT',
    player: { anchor: [...L.spawn], heading: [...L.spawnHeading], phase: 0, queued: null },
    contactT: 0, contactPos: null, landT: 0,
    diverged: new Uint8Array(W * H), trace: 0,
    alarm: null, splices: [], result: null, endT: null,
    // >>> FORK: radar state.
    // `radar` is the prepared sensor list (centroid + own-footprint exemption +
    // range); `exposure` is the dwell counter; `painted` is who sees you right
    // now, for the HUD. `peakExposure` is kept for the debrief: "you were never
    // seen" and "you were at 7 of 8 twice" are very different flights, and
    // without it the debrief cannot tell them apart.
    radar: prepareSensors(L.sensors, W, L.radarRange ?? 45),
    exposure: 0, peakExposure: 0, painted: [], lockedBy: null,
    // <<< FORK
  };
}

export function playerCells(M) {
  const { anchor, heading, phase } = M.player;
  return T[heading.join(',')].shapes[phase].map(([x, y]) => [x + anchor[0], y + anchor[1]]);
}

function nearWorld(M, cells, r) {
  const { world, W, H } = M;
  for (const [x, y] of cells) {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      if (world[ny * W + nx]) return true;
    }
  }
  return false;
}

function inHangar(M, cells) {
  const z = M.L.hangarZone;
  return cells.some(([x, y]) => x >= z[0] && y >= z[1] && x <= z[2] && y <= z[3]);
}

function splice(M, cells) {
  if (!M.shadow) { M.shadow = M.world.slice(); M.sscratch = new Uint8Array(M.W * M.H); }
  for (const [x, y] of cells) M.world[y * M.W + x] = 1;
  M.splices.push({ t: M.t, cells });
}

function checkSensors(M) {
  if (!M.shadow || M.state === 'LANDING' || M.result) return;
  for (const s of M.L.sensors) {
    for (const [x, y] of s.cells) {
      const i = y * M.W + x;
      if (M.world[i] !== M.shadow[i]) {
        // direct if any splice happened within Chebyshev 3 of this sensor
        let direct = false;
        for (const sp of M.splices) for (const [px, py] of sp.cells) {
          for (const [qx, qy] of s.cells) if (Math.max(Math.abs(px - qx), Math.abs(py - qy)) <= 3) direct = true;
        }
        M.alarm = { sensor: s.name, mode: direct ? 'DIRECT' : 'WAKE', t: M.t };
        M.state = 'ENDED'; M.result = 'DETECTED'; M.endT = M.t;
        return;
      }
    }
  }
}

function updateTrace(M) {
  if (!M.shadow || M.state === 'LANDING' || (M.state === 'ENDED' && (M.result === 'LANDED' || M.result === 'CRASH_LANDING'))) return;
  const { world, shadow, diverged, W, H } = M;
  for (let i = 0; i < W * H; i++) {
    if (!diverged[i] && world[i] !== shadow[i]) { diverged[i] = 1; M.trace++; }
  }
}

// World + shadow keep evolving (used after mission end, and by the harness's ash-reach probe).
export function ambientStep(M) {
  step(M.world, M.scratch, M.W, M.H); [M.world, M.scratch] = [M.scratch, M.world];
  if (M.shadow) {
    step(M.shadow, M.sscratch, M.W, M.H); [M.shadow, M.sscratch] = [M.sscratch, M.shadow];
    const { world, shadow, diverged, W, H } = M;
    for (let i = 0; i < W * H; i++) if (!diverged[i] && world[i] !== shadow[i]) { diverged[i] = 1; M.trace++; }
  }
  M.t++;
}
// >>> FORK: radar evaluation. No equivalent upstream.
//
//
// Exposure rises by one per painted generation and decays by one per clean one.
// Reaching LOCK ends the mission as PAINTED. Dwell rather than instant death is
// deliberate: the shadow breathes with the oscillators, so a one-generation
// flicker of exposure is ordinary play. Sustained exposure is the mistake.
export function checkRadar(M) {
  if (M.result || M.state !== 'FLIGHT') return;
  const cells = playerCells(M);
  M.painted = paintedBy(M.world, M.W, M.H, M.radar, cells);
  M.exposure = stepExposure(M.exposure, M.painted.length > 0);
  if (M.exposure > M.peakExposure) M.peakExposure = M.exposure;
  if (M.exposure >= LOCK) {
    M.lockedBy = M.painted[0] ?? M.lockedBy;
    M.state = 'ENDED'; M.result = 'PAINTED'; M.endT = M.t;
  }
}
// <<< FORK

// One generation. input = desired heading [hx,hy] or null.
export function missionStep(M, input) {
  const { W, H } = M;
  if (M.result) return;

  if (M.state === 'FLIGHT') {
    if (input) M.player.queued = input;
    if (M.player.queued && M.player.phase === 0) {
      const q = M.player.queued;
      if (q[0] !== M.player.heading[0] || q[1] !== M.player.heading[1]) M.player.heading = [q[0], q[1]];
      M.player.queued = null;
    }
    const cells = playerCells(M);
    // bounds
    for (const [x, y] of cells) if (x < 1 || y < 1 || x >= W - 1 || y >= H - 1) {
      M.state = 'ENDED'; M.result = 'ABORT_EDGE'; M.endT = M.t; return;
    }
    if (nearWorld(M, cells, 2)) {
      splice(M, cells);
      if (inHangar(M, cells)) { M.state = 'LANDING'; M.landT = 0; }
      else { M.state = 'CONTACT'; M.contactT = 0; M.contactPos = [...M.player.anchor]; }
    } else {
      const d = T[M.player.heading.join(',')].deltas[M.player.phase];
      M.player.anchor = [M.player.anchor[0] + d[0], M.player.anchor[1] + d[1]];
      M.player.phase = (M.player.phase + 1) % 4;
    }
  }

  step(M.world, M.scratch, W, H); [M.world, M.scratch] = [M.scratch, M.world];
  if (M.shadow) { step(M.shadow, M.sscratch, W, H); [M.shadow, M.sscratch] = [M.sscratch, M.shadow]; }
  M.t++;
  updateTrace(M);
  checkSensors(M);
  if (M.result) return;
  // >>> FORK: the radar channel.
  //
  // Independent of trace. Trace is what you DISTURB; radar is what SEES you.
  // A perfect trace-0 flight down an exposed corridor is still a dead flight,
  // and that separation is the whole F-117A premise.
  //
  // Evaluated only in FLIGHT. In CONTACT the aircraft has been spliced into the
  // substrate and its cells ARE substrate cells, so "painted" has no referent;
  // that state already resolves within 26 generations to reacquisition or MIA,
  // and trace is accruing throughout. In LANDING the approach is committed.
  checkRadar(M);
  if (M.result) return;
  // <<< FORK

  if (M.state === 'CONTACT') {
    M.contactT++;
    const [cx, cy] = M.contactPos, R = 15;
    const g = findGlider(M.world, W, H, T, cx - R, cy - R, cx + R, cy + R, M.shadow);
    if (g) {
      const sh = T[g.heading.join(',')].shapes[g.phase];
      for (const [x, y] of sh) M.world[(y + g.oy) * W + (x + g.ox)] = 0;
      M.player = { anchor: [g.ox, g.oy], heading: g.heading, phase: g.phase, queued: null };
      M.state = 'FLIGHT'; M.reacquired = (M.reacquired || 0) + 1;
    } else if (M.contactT > 26) {
      M.state = 'ENDED'; M.result = 'MIA'; M.endT = M.t;
    }
  } else if (M.state === 'LANDING') {
    M.landT++;
    if (M.landT >= 70) {
      const z = M.L.hangarZone;
      const eset = new Set(M.L.hangarCells.map(([x, y]) => `${x},${y}`));
      let clean = true;
      for (let y = z[1]; y <= z[3]; y++) for (let x = z[0]; x <= z[2]; x++) {
        const v = M.world[y * W + x];
        if (v !== (eset.has(`${x},${y}`) ? 1 : 0)) clean = false;
      }
      M.state = 'ENDED'; M.endT = M.t;
      M.result = clean ? 'LANDED' : 'CRASH_LANDING';
    }
  }
}
