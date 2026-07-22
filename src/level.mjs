// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jonathan D.A. Jewell (hyperpolymath) <j.d.a.jewell@open.ac.uk>
//
// Operation Nightglass — level data. NEW; f19's Operation Nightstep level is not
// reused, and the reason is a measurement rather than a preference.
//
// -------------------------------------------------------------------------
// WHY NOT f19's LEVEL
// -------------------------------------------------------------------------
// Nightstep's terrain is still lifes and a glider stream. Supercover LOS was run
// over it from its three sensors, range 45, for 60 generations on a 1025-cell
// lattice. Of 528 cells ever painted, 521 were painted at EVERY generation.
// Seven were phase-dependent. Mean churn: 1.14 cells per generation.
//
// A radar layer over that terrain would be scenery — the exact failure the f19
// design falsifier names. Cover has to MOVE, so the terrain here is oscillators.
//
// -------------------------------------------------------------------------
// WHY NO GOSPER GUN
// -------------------------------------------------------------------------
// Nightstep's field takes 347 generations to become periodic: the gun at (2,2)
// must fill the whole stream to the absorber at (114,100) before anything
// repeats. Until then "substrate phase" does not exist, and the mission starts
// at t=0 — inside the transient. A solver indexing states by `t mod 30` would be
// searching a space that has not formed yet.
//
// Oscillators are periodic from generation 0. Dropping the gun makes the
// transient ZERO by construction rather than by tuning, so `phase = t mod P` is
// well-defined on the very first tick. Claim C11 measures this rather than
// trusting it. The stream is not missed: in this game the threat is being SEEN,
// not being hit.
//
// -------------------------------------------------------------------------
// THE SHAPE OF THE PUZZLE
// -------------------------------------------------------------------------
// A glider flies one diagonal step per four generations and may only turn at
// phase 0, so the route is a coarse diagonal staircase. The corridor runs
// north-west to south-east along y = x + 4.
//
// Sensors sit off the corridor's flanks, looking ACROSS it — north-east and
// south-west, i.e. perpendicular to the direction of travel, so a sight line
// crosses the route rather than running along it. Between each sensor and the
// corridor stands a SHUTTER BANK of oscillators, laid parallel to the corridor.
// As the bank cycles, the sight lines through it open and close.
//
// Periods present: pentadecathlon 15, pulsar 3, and the glider's own 4. The
// substrate period is therefore lcm(3,15) = 15 — measured, not assumed, by
// design/measure.mjs and pinned by claim C11.

import { xf, P, parseRLE } from './kernel/engine.mjs';

// --- oscillators. Periods verified empirically; see C11 and design/period.mjs.
export const OSC = {
  blinker: parseRLE('3o!'),                                    // p2
  toad: parseRLE('b3o$3o!'),                                   // p2
  beacon: parseRLE('2o2b$2o2b$2b2o$2b2o!'),                    // p2
  pulsar: parseRLE(                                            // p3, 13x13
    '2b3o3b3o2b$9b$o4bobo4bo$o4bobo4bo$o4bobo4bo$2b3o3b3o2b$9b$'
    + '2b3o3b3o2b$o4bobo4bo$o4bobo4bo$o4bobo4bo$9b$2b3o3b3o2b!'),
  penta: parseRLE('2bo4bo2b$2ob4ob2o$2bo4bo2b!'),              // p15, 10x3
};

// lcm of the oscillator periods actually placed. This was 30 while the level
// carried blinkers/beacons/toads (p2) in its flanking banks; removing those
// banks removed the factor of 2, and C11 caught the stale declaration at once —
// "period is the declared 30 (measured 15)". Declared values that are not
// re-measured are how a level quietly stops meaning what its docs say.
export const PERIOD = 15;   // lcm(15 pentadecathlon, 3 pulsar). Asserted by C11.

/**
 * A shutter bank: `n` oscillators laid along the corridor direction (1,1),
 * starting at (x,y) and stepping by `gap` diagonally. `kinds` cycles.
 *
 * `gap` MUST exceed the largest pattern's bounding box, or neighbouring
 * oscillators touch and react. The first draft of this level used gap 9 with a
 * 13x13 pulsar in the cycle: every bank member overlapped its neighbour, the
 * collisions sprayed debris, population ran to 579 against ~200 placed cells,
 * and the substrate took 183 generations to settle instead of being periodic
 * at t=0. The level looked fine; only design/measure.mjs found it.
 *
 * Claim C12 (verify-level-sanity.mjs) now enforces the separation mechanically,
 * so this cannot regress by someone nudging a number.
 */
function bank(x, y, n, gap, kinds) {
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push([kinds[i % kinds.length], x + i * gap, y + i * gap]);
  }
  return out;
}

/**
 * A wall laid ACROSS the corridor — along (1,-1), perpendicular to the flight
 * direction — with a single gap.
 *
 * This is what makes phase load-bearing. Shutter banks flanking an open
 * corridor do not: the solver simply routes around them through permanent
 * cover, which is exactly what made claim C6 red. A wall the route MUST pass
 * through turns "where is there cover?" into "WHEN is the gap masked?".
 *
 * Blocks are 2x2 spaced 5 along the wall, so bounding boxes clear by 3 (C12's
 * minimum) while the 3-cell openings between them are far too narrow to fly:
 * the aircraft dies within Chebyshev 2 of any live cell, so a passable gap
 * needs roughly 7 clear cells. Only the declared gap is passable.
 */
function wall(cx, cy, W, H, gapWide = 1, step = 5) {
  const out = [];
  // Walk the line (cx+k*step, cy-k*step) in BOTH directions until it leaves the
  // grid. A fixed half-width is what made the first chokepoint fake: it spanned
  // 50 cells of a line whose in-bounds length is about 106, so there was open
  // map beyond both ends and the solver simply flew around. A gap is only a
  // chokepoint if there is no way past the ends.
  for (let k = -60; k <= 60; k++) {
    if (k >= 0 && k < gapWide) continue;               // the one way through
    const x = cx + k * step, y = cy - k * step;
    if (x < 2 || y < 2 || x > W - 4 || y > H - 4) continue;
    out.push([P.block, x, y]);
  }
  return out;
}

export function buildLevel(opts = {}) {
  const W = 172, H = 108;
  const { withSensors = true, radarRange = 40 } = opts;

  // The hangar is a sym-4 eater, as in f19: it catches an arriving SE glider.
  const E4 = xf(P.eater1, 4);
  const hangarAt = [92, 96];
  const hangarCells = E4.map(([x, y]) => [x + hangarAt[0], y + hangarAt[1]]);
  let hx0 = Infinity, hy0 = Infinity, hx1 = -1, hy1 = -1;
  for (const [x, y] of hangarCells) {
    hx0 = Math.min(hx0, x); hy0 = Math.min(hy0, y);
    hx1 = Math.max(hx1, x); hy1 = Math.max(hy1, y);
  }

  // --- shutter banks, laid parallel to the corridor between sensor and route.
  // Flanking shutter banks were REMOVED after claim C6 measured them ineffective:
  // with an open corridor the solver simply routed around them through permanent
  // cover, and the witness route's exposure came out phase-invariant (7/8 at all
  // 30 phases). Cover beside a route you need not take is scenery. The
  // chokepoint below replaces them. Only the late bank is kept, far from the
  // gate, as terrain interest.
  // gap 16 > the 13x13 pulsar, so no two members touch. See bank() and C12.
  const banks = [
    ...bank(96, 68, 2, 16, [OSC.penta, OSC.pulsar]),
  ];

  // --- THE CHOKEPOINT. The corridor is y = x + 4; the wall crosses it at
  // (chokeX, chokeX + 4) and the gap is the only way south.
  const {
    chokeX = 56, shutterAt = [65, 66], gateSensor = [76, 74], wallN = 5,
    gateRange = 20, gapWide = 1,
    // A SECOND sight line onto the same gap. With one emitter the gap is safe
    // whenever its single ray is blocked, which is most phases; with two the gap
    // is safe only when BOTH are blocked, which is far fewer. This is the lever
    // that turns "the radar can kill you" into "the radar kills you unless you
    // read the phase".
    gate2 = null, gate2Range = 22, shutter2At = null,
  } = opts;
  const choke = wall(chokeX, chokeX + 4, W, H, gapWide);

  // The shutter: a p15 pentadecathlon on the sight line between the gate sensor
  // and the gap, so the gap is masked at some phases and open at others.
  const shutter = [
    [OSC.penta, shutterAt[0], shutterAt[1]],
    ...(shutter2At ? [[OSC.penta, shutter2At[0], shutter2At[1]]] : []),
  ];

  // --- still-life terrain: collision hazard, and permanent cover. Kept sparse:
  // permanent cover that is too generous makes the moving cover irrelevant.
  // Every one of these must clear every bank member. Two of them originally did
  // not — a beehive at (60,30) sat 2 cells from the first pulsar and a block at
  // (110,70) sat 1 cell from the third — and those two contacts alone took the
  // substrate from periodic-at-t=0 to a 621-generation transient. Bisection,
  // not inspection, found them; C12 now enforces the clearance.
  const terrain = [
    [P.beehive, 20, 12], [P.boat, 140, 92], [P.block, 128, 30], [P.tub, 150, 50],
  ];

  // --- sensors. RDR-GATE watches the chokepoint gap specifically; the others
  // deny the flanks so the gap cannot simply be walked around.
  const sensors = withSensors ? [
    { name: 'RDR-1', cells: P.beehive.map(([x, y]) => [x + 88, y + 8]) },
    { name: 'RDR-2', cells: P.beehive.map(([x, y]) => [x + 14, y + 74]) },
    { name: 'RDR-3', cells: P.beehive.map(([x, y]) => [x + 140, y + 66]) },
    // RDR-GATE has its OWN, short range. At the shared range it covered the
    // whole ingress and killed the aircraft 20 cells before the wall, which
    // makes the approach the puzzle instead of the gate. A short range is what
    // localises the threat to the chokepoint, where the shutter can modulate it.
    {
      name: 'RDR-GATE', range: gateRange,
      cells: P.beehive.map(([x, y]) => [x + gateSensor[0], y + gateSensor[1]]),
    },
    ...(gate2 ? [{
      name: 'RDR-GATE2', range: gate2Range,
      cells: P.beehive.map(([x, y]) => [x + gate2[0], y + gate2[1]]),
    }] : []),
  ] : [];

  const stamps = [
    [E4, ...hangarAt],
    ...banks.map(([cells, x, y]) => [cells, x, y]),
    ...choke.map(([cells, x, y]) => [cells, x, y]),
    ...shutter.map(([cells, x, y]) => [cells, x, y]),
    ...terrain,
    ...sensors.map((s) => [s.cells, 0, 0]),
  ];

  return {
    W, H, stamps, sensors, terrain, banks, choke, shutter, hangarCells,
    // CLAMPED TO THE GRID, and that is load-bearing rather than tidy.
    // missionStep's landing check sweeps this zone comparing world cells to the
    // eater's footprint. Off-grid reads return undefined, which is never equal
    // to 0, so ANY zone extending past the last row makes every landing report
    // CRASH_LANDING — with no error and no clue. The hangar originally sat at
    // (92,100), pushing the zone to y=109 against a 108-row grid, and every one
    // of 29 approach lanes duly "crashed". f19 never met this because its
    // hangar sat high enough for the zone to fit.
    hangarZone: [
      Math.max(0, hx0 - 6), Math.max(0, hy0 - 6),
      Math.min(W - 1, hx1 + 6), Math.min(H - 1, hy1 + 6),
    ],
    // Spawn shares the eater's diagonal lane: laneOf('1,1') = x - y, and the
    // eater anchors at (92,96), so the lane is -4 and spawn must be on it.
    spawn: [12, 16], spawnHeading: [1, 1],
    hangarAt,
    // The ONLY diagonals on which the eater absorbs an arriving glider cleanly.
    // MEASURED by sweeping every approach lane, not chosen: of 21 lanes tried,
    // 3 land, 12 crash-land and 6 run off the edge. Arriving on any other lane
    // reaches the hangar and still loses. The solver is constrained to these.
    glidepaths: [-10, -4, 3],
    radarRange,
    period: PERIOD,
    transient: 0,             // asserted by C11
    // The nominal corridor, for the design tools and the C4 metric: the
    // diagonal the aircraft would fly with no input at all.
    corridor: { from: [12, 16], to: [92, 96] },

    // The witness route: [generation, headingX, headingY] at each turn.
    //
    // FOUND, NOT DESIGNED. design/solve.mjs searched the full state space
    // (anchor x heading x substrate phase x exposure) and emitted this. It is
    // then FLOWN through the real missionStep() by verify-witness.mjs — the
    // solver is an approximation and is only allowed to propose, so claim C5 is
    // the flight, not the search.
    //
    // The radar range this route depends on is knife-edged, and that is
    // measured: design/sweep.mjs shows range <=36 solvable with ONE turn (the
    // radar is then decoration), 38 and 40 playable, and >=42 unsolvable. 40 is
    // chosen as the richest playable setting — 12 turns, 23 corridor cells able
    // to reach LOCK. Changing radarRange without re-running the sweep will
    // silently produce either a walkover or an impossibility.
    witness: [
      [0, 1, 1], [84, 1, -1], [88, 1, 1], [100, 1, -1],
      [104, 1, 1], [176, -1, 1], [180, 1, 1], [196, -1, 1],
      [208, 1, 1], [216, -1, 1], [224, 1, 1], [228, -1, 1],
      [232, 1, 1], [236, -1, 1], [240, 1, 1], [244, -1, 1],
      [252, 1, 1], [260, -1, 1], [264, 1, 1], [268, -1, 1],
      [272, 1, 1], [280, -1, 1], [284, 1, 1], [300, -1, 1],
      [304, 1, 1], [368, 1, -1], [372, 1, 1], [376, 1, -1],
      [380, 1, 1], [384, 1, -1], [412, 1, 1],
    ],
  };
}
