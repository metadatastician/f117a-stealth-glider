// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jonathan D.A. Jewell (hyperpolymath) <j.d.a.jewell@open.ac.uk>
//
// F117A Stealth Glider — the 3D layer: chase camera + draw-list renderer.
//
// PURE. This module owns no clock, no randomness, no DOM and no mission
// mutation. Everything here is (mission state, shadow, camera, dt) -> data.
// Claim C7 (verify-renderer.mjs) proves the whole layer inert by flying the
// witness with and without it and requiring byte-identical worlds; it also
// greps this file for the same nondeterminism primitives C8 bans from the
// simulation. The frame clock lives one layer up, in ui.js, where it is
// legitimate — dt arrives here as an argument.
//
// -------------------------------------------------------------------------
// COORDINATES (the defect-4 fix, stated once and used everywhere)
// -------------------------------------------------------------------------
// world x = grid column, world y = grid row, world z = UP. A cell (x, y)
// occupies the unit square [x, x+1) x [y, y+1) on the ground plane z = 0.
// spike/world.html died by disagreeing with itself about which axis was
// altitude — its renderer drew the CA's y as height while its collision took
// y as horizontal. Here there is exactly one convention, the camera has no
// collision at all (it is a ghost — the MISSION owns physics), and nothing
// converts between conventions because there is only one.
//
// -------------------------------------------------------------------------
// THE FLIGHT MODEL, AND WHERE IT CAME FROM
// -------------------------------------------------------------------------
// PIDController and ElevonMixer are adapted from spike/simulation.html — the
// UN-REGRESSED prototype (see spike/README.md: the other file deleted the
// mixer and lobotomised the PID to a bare P-term). The full aerodynamic model
// (lift/drag/pitching moment) is deliberately NOT ported: the camera needs
// smooth pursuit and honest-feeling banking, not wing area. What survives is
// the control architecture: PID loops computing commands, an elevon mixer
// turning pitch+roll commands into surface pairs — used here to drive the
// camera's visible bank and pitch, so the "airframe you are riding" leans
// into exactly the manoeuvres the glider actually makes.
//
// The aircraft the player sees is the glider's own 5 live cells, drawn as
// airframe panels at altitude — the game does not invent a fuselage the
// simulation doesn't have. Each panel projects INDEPENDENTLY, so clipping
// one never blanks the aircraft (the defect-7 fix; world.html's fill was
// gated on all five vertices surviving).

// --- controllers, adapted from spike/simulation.html (PIDController L74-88,
// --- ElevonMixer L90-99). Behaviour-identical; only formatting changed.
export class PIDController {
  constructor(kp, ki, kd) {
    this.kp = kp; this.ki = ki; this.kd = kd;
    this.integral = 0;
    this.prevError = 0;
  }
  compute(setpoint, current, dt) {
    const error = setpoint - current;
    this.integral += error * dt;
    const derivative = (error - this.prevError) / dt;
    this.prevError = error;
    return (this.kp * error) + (this.ki * this.integral) + (this.kd * derivative);
  }
}

export class ElevonMixer {
  mix(pitchCommand, rollCommand) {
    return {
      leftElevon: pitchCommand + rollCommand,
      rightElevon: pitchCommand - rollCommand,
      pitch: pitchCommand,
      roll: rollCommand,
    };
  }
}

// --- camera -----------------------------------------------------------------

// Chase geometry. BACK/UP place the eye behind and above the glider along its
// heading; FLY_Z is the altitude the airframe panels render at. All in cells.
const BACK = 13, UP = 9, FLY_Z = 2.0;
const NEAR = 0.5;               // camera-space clip plane (cells)
const FOV = 1.15;               // vertical field of view, radians

export function createCamera(L) {
  const [sx, sy] = L.spawn;
  const [hx, hy] = L.spawnHeading;
  const n = Math.hypot(hx, hy);
  const cam = {
    // pose
    pos: [sx - (hx / n) * BACK, sy - (hy / n) * BACK, UP],
    yaw: Math.atan2(hy, hx),    // 0 = +x, positive toward +y
    pitch: Math.atan2(UP - FLY_Z, BACK),
    roll: 0,
    // pursuit state
    vel: [0, 0, 0],
    // controllers: position pursuit per axis, yaw pursuit, and the mixer
    // shaping the visible attitude. Gains tuned for the glider's 1 cell per
    // 4 generations pace at the shipped speeds; deterministic by construction.
    pidX: new PIDController(6.0, 0.0, 4.4),
    pidY: new PIDController(6.0, 0.0, 4.4),
    pidZ: new PIDController(6.0, 0.0, 4.4),
    pidYaw: new PIDController(7.0, 0.0, 3.2),
    mixer: new ElevonMixer(),
  };
  return cam;
}

// Shortest signed angular difference a-b, in (-PI, PI].
function angDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d <= -Math.PI) d += 2 * Math.PI;
  return d;
}

/**
 * Advance the chase camera toward the glider. Pure in everything but `cam`,
 * which is renderer-owned state (never mission state). dt is supplied by the
 * caller — this module has no clock.
 *
 * target: [x, y] glider anchor (cells); heading: [hx, hy] current heading.
 */
export function stepCamera(cam, target, heading, dt) {
  if (dt <= 0) return cam;
  const n = Math.hypot(heading[0], heading[1]) || 1;
  const dir = [heading[0] / n, heading[1] / n];
  const want = [
    target[0] + 0.5 - dir[0] * BACK,
    target[1] + 0.5 - dir[1] * BACK,
    UP,
  ];
  // PID pursuit -> acceleration, integrated with damping. The damping factor
  // is what keeps the discrete 4-generation hops of the glider from arriving
  // in the camera as kicks.
  const acc = [
    cam.pidX.compute(want[0], cam.pos[0], dt),
    cam.pidY.compute(want[1], cam.pos[1], dt),
    cam.pidZ.compute(want[2], cam.pos[2], dt),
  ];
  for (let i = 0; i < 3; i++) {
    cam.vel[i] = (cam.vel[i] + acc[i] * dt) * Math.max(0, 1 - 2.2 * dt);
    cam.pos[i] += cam.vel[i] * dt;
  }
  // Yaw pursues the heading; the yaw-rate command becomes the roll command
  // through the mixer, so the view banks into turns and levels out of them.
  const wantYaw = Math.atan2(dir[1], dir[0]);
  const yawRate = cam.pidYaw.compute(0, angDiff(cam.yaw, wantYaw), dt);
  cam.yaw += yawRate * dt;
  const surfaces = cam.mixer.mix(
    0.22 * (cam.pos[2] - FLY_Z) / UP,     // pitch command: settle onto the sightline
    Math.max(-0.5, Math.min(0.5, -0.35 * yawRate)),
  );
  const wantPitch = Math.atan2(cam.pos[2] - FLY_Z, BACK) + surfaces.pitch * 0.2;
  cam.pitch += angDiff(wantPitch, cam.pitch) * Math.min(1, 3 * dt);
  cam.roll += angDiff(surfaces.roll, cam.roll) * Math.min(1, 4 * dt);
  return cam;
}

// --- projection --------------------------------------------------------------

/**
 * World point -> [screenX, screenY, camDepth], or null when the point is on
 * or behind the near plane. Null is PER POINT: callers that draw multi-point
 * shapes decide their own policy, and the airframe draws per panel precisely
 * so that one clipped panel cannot blank the aircraft.
 */
export function project(cam, x, y, z, vw, vh) {
  // translate
  let px = x - cam.pos[0], py = y - cam.pos[1], pz = z - cam.pos[2];
  // yaw: rotate world so camera looks along +x'
  const cy = Math.cos(-cam.yaw), sy = Math.sin(-cam.yaw);
  let tx = px * cy - py * sy, ty = px * sy + py * cy;
  // pitch: about the camera's y axis (looking down by cam.pitch)
  const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
  let dx = tx * cp - pz * sp;           // depth along the view axis
  let dz = tx * sp + pz * cp;           // up in camera frame
  // roll: about the view axis
  const cr = Math.cos(cam.roll), sr = Math.sin(cam.roll);
  const rx = ty * cr - dz * sr, rz = ty * sr + dz * cr;
  if (dx <= NEAR) return null;
  const f = (vh / 2) / Math.tan(FOV / 2);
  return [vw / 2 + (rx * f) / dx, vh / 2 - (rz * f) / dx, dx];
}

// --- draw list ---------------------------------------------------------------

// Palette keys, resolved to colours by ui.js. The renderer names WHAT things
// are; presentation decides what they look like.
//   ground | gridline | shadow | cell | sensorCell | hangarCell | player
//   corridor | gapMark | zoneMark | ring | horizon

function quad(cam, pts, vw, vh) {
  const out = [];
  let depth = 0;
  for (const [x, y, z] of pts) {
    const p = project(cam, x, y, z, vw, vh);
    if (!p) return null;                 // small quads: clip whole, never split
    out.push([p[0], p[1]]);
    depth += p[2];
  }
  return { pts: out, depth: depth / pts.length };
}

/**
 * Build the frame's draw list: an array of primitives sorted far-to-near
 * (painter's algorithm), each { kind, pts, depth } with pts in screen space.
 * Pure: reads M and shadow, writes nothing. `shadow` is the Uint8Array from
 * radar.shadowMap, recomputed by the CALLER on CA tick (see radar.mjs cost
 * note) — passing a stale-by-one frame shadow is a presentation choice, not
 * a simulation error, because nothing here feeds back into the mission.
 */
export function buildDrawList(M, shadow, cam, vw, vh, sets) {
  const { W, H } = M;
  const L = M.L;
  const prims = [];

  // Horizon/ground sheet: one big quad under everything, unsorted-first.
  const g = quad(cam, [[-40, -40, 0], [W + 40, -40, 0], [W + 40, H + 40, 0], [-40, H + 40, 0]], vw, vh);
  if (g) prims.push({ kind: 'ground', pts: g.pts, depth: Infinity });

  // Grid lines every 8 cells, as thin ground quads — orientation without
  // 18,576 per-cell tints.
  for (let x = 0; x <= W; x += 8) {
    const q = quad(cam, [[x, 0, 0], [x + 0.08, 0, 0], [x + 0.08, H, 0], [x, H, 0]], vw, vh);
    if (q) prims.push({ kind: 'gridline', ...q });
  }
  for (let y = 0; y <= H; y += 8) {
    const q = quad(cam, [[0, y, 0], [W, y, 0], [W, y + 0.08, 0], [0, y + 0.08, 0]], vw, vh);
    if (q) prims.push({ kind: 'gridline', ...q });
  }

  // Radar shadow: per-row RUN-LENGTH MERGED ground quads. The raw map has
  // thousands of painted cells; merging adjacent cells in a row keeps the
  // draw list in the hundreds, which is what lets canvas 2D hold frame rate.
  if (shadow) {
    for (let y = 0; y < H; y++) {
      let x = 0;
      while (x < W) {
        if (!shadow[y * W + x]) { x++; continue; }
        let x1 = x;
        while (x1 < W && shadow[y * W + x1]) x1++;
        const q = quad(cam, [[x, y, 0.02], [x1, y, 0.02], [x1, y + 1, 0.02], [x, y + 1, 0.02]], vw, vh);
        if (q) prims.push({ kind: 'shadow', ...q });
        x = x1;
      }
    }
  }

  // Live cells as unit boxes: top face plus the two side faces that can face
  // the camera. Colour class comes from the caller's prebuilt index sets —
  // set membership, not per-frame classification.
  const w = M.world;
  const CH = 1.0;                        // cell box height
  for (let i = 0; i < w.length; i++) {
    if (!w[i]) continue;
    const x = i % W, y = (i - x) / W;
    const kind = sets && sets.sensor.has(i) ? 'sensorCell'
      : sets && sets.hangar.has(i) ? 'hangarCell' : 'cell';
    const top = quad(cam, [[x, y, CH], [x + 1, y, CH], [x + 1, y + 1, CH], [x, y + 1, CH]], vw, vh);
    if (top) prims.push({ kind, pts: top.pts, depth: top.depth, face: 'top' });
    // south/east faces (grid interior is mostly viewed from the northwest
    // chase line; both faces are cheap and the sorter culls by depth anyway)
    const s = quad(cam, [[x, y + 1, CH], [x + 1, y + 1, CH], [x + 1, y + 1, 0], [x, y + 1, 0]], vw, vh);
    if (s) prims.push({ kind, pts: s.pts, depth: s.depth, face: 'side' });
    const e = quad(cam, [[x + 1, y, CH], [x + 1, y + 1, CH], [x + 1, y + 1, 0], [x + 1, y, 0]], vw, vh);
    if (e) prims.push({ kind, pts: e.pts, depth: e.depth, face: 'side' });
  }

  // Mission furniture on the ground plane: corridor, gap brackets, hangar zone.
  const c = L.corridor;
  const seg = quad(cam, [
    [c.from[0], c.from[1], 0.05], [c.from[0] + 0.4, c.from[1], 0.05],
    [c.to[0] + 0.4, c.to[1], 0.05], [c.to[0], c.to[1], 0.05],
  ], vw, vh);
  if (seg) prims.push({ kind: 'corridor', ...seg });
  const z = L.hangarZone;
  const zone = quad(cam, [[z[0], z[1], 0.05], [z[2] + 1, z[1], 0.05], [z[2] + 1, z[3] + 1, 0.05], [z[0], z[3] + 1, 0.05]], vw, vh);
  if (zone) prims.push({ kind: 'zoneMark', ...zone });

  // Sensor range rings, drawn as ground-plane polylines. RDR-GATE's own
  // short range is the one the whole level balances on; drawing it is not
  // decoration, it is the player's only view of the kill radius.
  for (const s of M.radar) {
    const pts = [];
    let depth = 0, nvis = 0;
    for (let a = 0; a <= 48; a++) {
      const th = (a / 48) * 2 * Math.PI;
      const p = project(cam, s.cx + s.range * Math.cos(th), s.cy + s.range * Math.sin(th), 0.05, vw, vh);
      if (!p) { pts.push(null); continue; }
      pts.push([p[0], p[1]]); depth += p[2]; nvis++;
    }
    if (nvis > 8) prims.push({ kind: 'ring', pts, depth: depth / nvis, open: true });
  }

  // The airframe: the glider's five live cells as independent panels at
  // altitude, each its own quad (the defect-7 fix). In CONTACT the aircraft
  // IS substrate — mission.mjs splices it — so there is nothing separate to
  // draw, which is honest: the player watches their airframe as cells.
  if (M.state === 'FLIGHT') {
    // playerCells arrives through `sets` so this module imports NOTHING —
    // the layering is visible in the import graph, not just asserted.
    const cells = sets.playerCells(M);
    for (const [x, y] of cells) {
      const q = quad(cam, [
        [x + 0.1, y + 0.1, FLY_Z], [x + 0.9, y + 0.1, FLY_Z],
        [x + 0.9, y + 0.9, FLY_Z], [x + 0.1, y + 0.9, FLY_Z],
      ], vw, vh);
      if (q) prims.push({ kind: 'player', pts: q.pts, depth: q.depth - 0.01 });
      // ground contact shadow: readability anchor for altitude
      const sq = quad(cam, [
        [x + 0.2, y + 0.2, 0.06], [x + 0.8, y + 0.2, 0.06],
        [x + 0.8, y + 0.8, 0.06], [x + 0.2, y + 0.8, 0.06],
      ], vw, vh);
      if (sq) prims.push({ kind: 'playerShadow', ...sq });
    }
  }

  prims.sort((a, b) => b.depth - a.depth);
  return prims;
}
