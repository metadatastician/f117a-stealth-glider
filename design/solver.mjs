// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jonathan D.A. Jewell (hyperpolymath) <j.d.a.jewell@open.ac.uk>
//
// design/solver.mjs — the reachability search itself, as a callable function so
// design/sweep.mjs can run it across parameter sets. See design/solve.mjs for
// the full commentary on state, precomputation and why this may only PROPOSE.

import { createMission, ambientStep, T } from '../src/mission.mjs';
import { prepareSensors, shadowMap, LOCK } from '../src/radar.mjs';

const HEADINGS = ['1,1', '1,-1', '-1,1', '-1,-1'];

export function solve(L, buildFn, opts = {}) {
  const W = L.W, H = L.H, P = L.period;
  const EXP_MAX = opts.lock ?? LOCK;

  const worlds = [], shadows = [];
  {
    const m = createMission(buildFn());
    const sensors = prepareSensors(L.sensors, W, L.radarRange);
    for (let p = 0; p < P; p++) {
      worlds.push(Uint8Array.from(m.world));
      shadows.push(shadowMap(m.world, W, H, sensors));
      ambientStep(m);
    }
  }

  const danger = worlds.map((w) => {
    const d = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!w[y * W + x]) continue;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < W && ny < H) d[ny * W + nx] = 1;
      }
    }
    return d;
  });

  const hz = L.hangarZone;
  const inHangar = (x, y) => x >= hz[0] && y >= hz[1] && x <= hz[2] && y <= hz[3];
  // Reaching the hangar is not landing. The eater absorbs a glider cleanly only
  // on L.glidepaths; every other approach reaches the zone and CRASH_LANDs. The
  // search must therefore treat arrival off-lane as failure, or it will happily
  // return a route that loses.
  const paths = new Set(L.glidepaths ?? []);
  const laneOK = (ax, ay, nh) => nh === 0 && paths.has(ax - ay);

  const STRIDE_E = EXP_MAX + 1;
  const STRIDE_P = P * STRIDE_E;
  const idx = (x, y, h, p, e) => ((y * W + x) * 4 + h) * STRIDE_P + p * STRIDE_E + e;
  const TOTAL = W * H * 4 * STRIDE_P;

  const seen = new Uint8Array(TOTAL);
  const prev = new Int32Array(TOTAL).fill(-1);
  const prevH = new Int8Array(TOTAL).fill(-1);
  const decode = (s) => {
    const e = s % STRIDE_E, r1 = (s - e) / STRIDE_E;
    const p = r1 % P, r2 = (r1 - p) / P;
    const h = r2 % 4, cell = (r2 - h) / 4;
    return { x: cell % W, y: (cell - (cell % W)) / W, h, p, e };
  };

  const startH = HEADINGS.indexOf(L.spawnHeading.join(','));
  // The substrate phase AT LAUNCH. The player chooses when to press go, and the
  // automaton has been running the whole time, so a launch at generation t
  // begins at phase t mod P. Defaulting to 0 answers "is there a route if you
  // launch on the beat"; sweeping it answers the far more interesting question
  // of whether EVERY launch beat has a route of its own — see design/beats.mjs.
  const startPhase = ((opts.startPhase ?? 0) % P + P) % P;
  const start = idx(L.spawn[0], L.spawn[1], startH, startPhase, 0);
  seen[start] = 1;

  let frontier = [start], goal = -1, depth = 0, visited = 1;
  const why = { oob: 0, contact: 0, exposure: 0, ok: 0 };
  let bestProgress = -1, bestState = null;

  search:
  while (frontier.length && depth < 4000) {
    const next = [];
    depth++;
    for (const s of frontier) {
      const { x, y, p, e } = decode(s);
      for (let nh = 0; nh < 4; nh++) {
        const tbl = T[HEADINGS[nh]];
        let ax = x, ay = y, ex = e, ok = true, landed = false;
        // MIRRORS missionStep's ordering exactly, and that ordering is not the
        // obvious one. missionStep tests collision against the CURRENT world,
        // then moves, then advances the world, then evaluates radar. So radar
        // sees the POST-move aircraft against the NEXT generation's shadow.
        //
        // The first version of this loop tested both against the same (phase,
        // position). It produced routes that died at every phase when flown
        // through the real engine — including their own. An off-by-one here is
        // not a rounding error; it silently searches a different game.
        for (let k = 0; k < 4; k++) {
          const ph = (p + k) % P;
          let hitHangar = false, contact = false, oob = false;
          for (const [sx, sy] of tbl.shapes[k]) {
            const cx = ax + sx, cy = ay + sy;
            if (cx < 1 || cy < 1 || cx >= W - 1 || cy >= H - 1) { oob = true; break; }
            if (danger[ph][cy * W + cx]) contact = true;
            if (inHangar(cx, cy)) hitHangar = true;
          }
          if (oob) { ok = false; why.oob++; break; }
          if (contact) { if (hitHangar && laneOK(ax, ay, nh)) { landed = true; break; } ok = false; why.contact++; break; }

          const d = tbl.deltas[k];
          ax += d[0]; ay += d[1];                       // move

          const nph = (p + k + 1) % P;                  // world advances
          let painted = false;
          for (const [sx, sy] of tbl.shapes[(k + 1) % 4]) {
            const cx = ax + sx, cy = ay + sy;
            if (cx < 0 || cy < 0 || cx >= W || cy >= H) continue;
            if (shadows[nph][cy * W + cx]) { painted = true; break; }
          }
          ex = painted ? ex + 1 : (ex > 0 ? ex - 1 : 0);
          if (ex >= EXP_MAX) { ok = false; why.exposure++; break; }
        }
        if (landed) {
          const s2 = idx(Math.max(0, Math.min(W - 1, ax)), Math.max(0, Math.min(H - 1, ay)), nh, (p + 4) % P, ex);
          prev[s2] = s; prevH[s2] = nh; goal = s2;
          break search;
        }
        if (!ok) continue;
        const s2 = idx(ax, ay, nh, (p + 4) % P, ex);
        if (seen[s2]) continue;
        seen[s2] = 1; prev[s2] = s; prevH[s2] = nh; why.ok++; visited++;
        if (ax + ay > bestProgress) { bestProgress = ax + ay; bestState = { x: ax, y: ay, e: ex }; }
        next.push(s2);
      }
    }
    frontier = next;
  }

  if (goal < 0) return { solved: false, why, bestState, visited, depth, total: TOTAL };

  const route = [];
  for (let s = goal; s !== -1 && prev[s] !== -1; s = prev[s]) route.push(prevH[s]);
  route.reverse();
  const moves = route.map((h) => HEADINGS[h]);
  const turns = [];
  let cur = null;
  moves.forEach((m, i) => { if (m !== cur) { turns.push([i * 4, ...m.split(',').map(Number)]); cur = m; } });
  return { solved: true, why, visited, depth, total: TOTAL, moves, turns, gens: moves.length * 4 };
}
