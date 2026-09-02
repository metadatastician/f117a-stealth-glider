// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jonathan D.A. Jewell (hyperpolymath) <j.d.a.jewell@open.ac.uk>
// F117A Stealth Glider — UI shell. Everything below the DOM boundary is the
// audited core; this file is presentation only (see ARCHITECTURE.adoc). It owns
// the repository's only frame clock — legitimate here because claim C7 proves
// the layer beneath it cannot influence the mission.
'use strict';

function bootF117A() {
  const CELL = 6;
  const L = buildLevel();
  const CW = L.W * CELL, CH = L.H * CELL;

  // ---------- DOM ----------
  const root = document.getElementById('f117a');
  root.innerHTML = `
    <div class="bar top">
      <span class="ttl">F117A STEALTH GLIDER</span><span class="sub">OPERATION NIGHTGLASS</span>
      <span class="tick" id="tick">SYSTEMS NOMINAL</span>
      <span class="gen">GEN <b id="gen">0</b></span>
    </div>
    <div class="stage"><canvas id="cv" width="${CW}" height="${CH}"></canvas>
      <div class="scan"></div><div class="card" id="card"></div>
      <div class="tpad" id="tpad" hidden>
        <button data-h="-1,-1">◤</button><button data-h="1,-1">◥</button>
        <button data-h="-1,1">◣</button><button data-h="1,1">◢</button>
        <button id="tgo">LAUNCH</button>
      </div>
    </div>
    <div class="bar bot">
      <span class="lbl">BEAT</span><span class="beat" id="beat"></span>
      <canvas id="dial" width="56" height="56"></canvas>
      <span class="lbl">HDG</span><span class="rose" id="rose"></span>
      <span class="lbl">EXPO</span><span class="expo" id="expo"></span>
      <span class="lbl">PAINT</span><b class="paint" id="paint">—</b>
      <span class="lbl">TRACE</span><b class="trace" id="trace">0</b>
      <span class="lbl">SPD</span><b id="spd">2</b>
      <span class="keys">←↑↓→ steer · ENTER launch · TAB view · SPACE recon · 1/2/3 speed · H ledger</span>
    </div>`;
  const cv = document.getElementById('cv'), cx = cv.getContext('2d');
  const dial = document.getElementById('dial'), dx = dial.getContext('2d');
  const $ = id => document.getElementById(id);

  // ---------- palette ----------
  const C = {
    bg: '#040a12', sky: '#020610', grid: 'rgba(60,140,190,0.14)',
    cell: '#3fd0f0', cellSide: '#1a7a9a', cellDim: '#155a72',
    sensor: '#ff5544', sensorSide: '#8a2018',
    gold: '#ffc23e', goldSide: '#8a6a1a', amber: '#ffb000',
    shadow: 'rgba(255,60,50,0.16)', shadowTac: 'rgba(255,60,50,0.13)',
    player: '#eafcff', playerGlow: '#7ef3ff',
    div: 'rgba(255,176,0,', glow: 'rgba(63,208,240,',
    corridor: 'rgba(255,194,62,0.35)', ring: 'rgba(255,85,68,0.4)',
  };
  const FILL3D = {
    ground: '#04101c', gridline: C.grid, shadow: C.shadow,
    cell: C.cell, sensorCell: C.sensor, hangarCell: C.gold,
    corridor: C.corridor, zoneMark: 'rgba(255,194,62,0.18)',
    player: C.player, playerShadow: 'rgba(126,243,255,0.25)',
  };
  const SIDE3D = { cell: C.cellSide, sensorCell: C.sensorSide, hangarCell: C.goldSide };

  // ---------- static sets ----------
  const sensorSet = new Set();
  for (const s of L.sensors) for (const [x, y] of s.cells) sensorSet.add(y * L.W + x);
  const hangarSet = new Set(L.hangarCells.map(([x, y]) => y * L.W + x));
  const SETS = { sensor: sensorSet, hangar: hangarSet, playerCells };

  // ---------- state ----------
  let M = createMission(L);
  let cam = createCamera(L);
  let lastAlive = new Int32Array(L.W * L.H).fill(-99);
  let mode = 'BRIEF';          // BRIEF | RUN | DEBRIEF
  let view = '3D';             // 3D | TAC
  let ledger = false, paused = false;
  let desired = [...L.spawnHeading];
  let speed = 2; const GPS = [0, 8, 16, 30];
  let launchT = 0, endSnapshot = null;
  let acc = 0, lastTs = 0;
  // The shadow map, memoised BY SUBSTRATE PHASE.
  //
  // shadowMap is O(W*H*sensors*ray) and measures 23.5 ms on this level — one
  // call already exceeds a 16.7 ms frame budget, and at speed 3 (30 gens/sec)
  // recomputing it every tick costs about 70% of a core. Recomputing it per
  // FRAME, which radar.mjs warns against, would be ~85x a frame budget.
  //
  // But the substrate is periodic from generation 0 with period 15 (C11), so
  // while the world is pure substrate there are only ever FIFTEEN distinct
  // shadow maps. Computing each once and looking it up thereafter turns the
  // dominant per-tick cost into an array index. The property that makes the
  // level fair — that the automaton repeats, so the player can read it — is
  // the same property that makes drawing it cheap.
  //
  // The exception is exact rather than cautious: once the aircraft has been
  // SPLICED into the world (contact), the world is no longer the pure
  // substrate and the phase no longer identifies it, so the cache is bypassed
  // for the rest of the mission. That state resolves within 26 generations to
  // reacquisition or MIA, so the slow path is short-lived by construction.
  let shadowByPhase = new Array(L.period).fill(null);
  let shadow = null, shadowT = -1;
  function refreshShadow() {
    if (M.splices.length) { shadow = shadowMap(M.world, M.W, M.H, M.radar); shadowT = M.t; return; }
    const ph = ((M.t % L.period) + L.period) % L.period;
    if (!shadowByPhase[ph]) shadowByPhase[ph] = shadowMap(M.world, M.W, M.H, M.radar);
    shadow = shadowByPhase[ph]; shadowT = M.t;
  }
  refreshShadow();

  function markAlive() { const w = M.world, la = lastAlive; for (let i = 0; i < w.length; i++) if (w[i]) la[i] = M.t; }
  markAlive();

  function newMission() {
    // Read the OUTGOING mission's splice state before M is reassigned: the
    // cache survives a refly — same level, same substrate, same fifteen maps —
    // but a mission that spliced must not hand its polluted maps on.
    const wasPolluted = M.splices.length > 0;
    M = createMission(L); cam = createCamera(L);
    lastAlive = new Int32Array(L.W * L.H).fill(-99);
    desired = [...L.spawnHeading]; endSnapshot = null; paused = false; markAlive();
    if (wasPolluted) shadowByPhase = new Array(L.period).fill(null);
    refreshShadow();
  }

  // ---------- flavors ----------
  function crashFlavor() {
    const z = L.hangarZone; let eaterOK = true, extras = 0, any = 0;
    const eset = new Set(L.hangarCells.map(([x, y]) => `${x},${y}`));
    for (let y = z[1]; y <= z[3]; y++) for (let x = z[0]; x <= z[2]; x++) {
      const v = M.world[y * L.W + x]; if (v) any++;
      if (eset.has(`${x},${y}`)) { if (!v) eaterOK = false; } else if (v) extras++;
    }
    void extras;
    if (!any) return ['FIREBALL ON THE APRON', 'Nothing left of airframe or hangar. The touchdown lane is one cell wide for a reason.'];
    if (!eaterOK) return ['YOU DEMOLISHED YOUR OWN HANGAR', 'The catch mechanism is gone. Wrong lane — the eater only swallows a glider dead on the marked line.'];
    return ['DEBRIS ON THE APRON', 'The hangar stands, but wreckage is strewn across the zone. Close. Not clean.'];
  }
  function debriefText() {
    const dur = (M.endT ?? M.t) - launchT;
    const trFinal = endSnapshot ? endSnapshot.trace : M.trace;
    const stats = `launch tick ${launchT} · flight ${dur} gen · peak exposure ${M.peakExposure}/${LOCK} · trace ${trFinal} · reacquisitions ${M.reacquired || 0}`;
    let head = '', body = '';
    if (M.result === 'LANDED' && M.trace === 0) { head = 'THE MISSION NEVER HAPPENED'; body = 'Wheels down, hangar intact, zero divergence — and the radar never held you long enough to matter. The world cannot prove you were ever in it.'; }
    else if (M.result === 'LANDED') { head = 'WHEELS DOWN — BUT THE SKY REMEMBERS'; body = `Clean catch, yet ${trFinal} cells diverged from the counterfactual along the way. Somebody may put it together.`; }
    else if (M.result === 'PAINTED') { head = `LOCKED — ${M.lockedBy || 'RADAR'} HELD YOU ${LOCK} STRAIGHT`; body = 'Exposure is a dwell, not a flashbulb: one flicker is weather, eight consecutive generations is a firing solution. The shutter was open and you were in the light the whole time. Launch on a different beat of the fifteen.'; }
    else if (M.result === 'CRASH_LANDING') { const f = crashFlavor(); head = f[0]; body = f[1]; }
    else if (M.result === 'DETECTED') {
      head = M.alarm.mode === 'DIRECT' ? `RADAR PAINT — ${M.alarm.sensor} HAD YOU` : `YOUR WAKE REACHED ${M.alarm.sensor}`;
      body = M.alarm.mode === 'DIRECT'
        ? 'You flew into the sensor\'s lap. Contact splashed cells straight onto the array.'
        : 'You never touched it. But the ash you kicked up crawled across the garden and brushed the array. Divergence is loud.';
    }
    else if (M.result === 'MIA') { head = 'CONTACT LOST — AIRFRAME NOT RECOVERED'; body = 'The scan found no surviving glider that isn\'t also in the counterfactual. Whatever flies on out there, it isn\'t you.'; }
    else if (M.result === 'ABORT_EDGE') { head = 'LEFT THE OPERATIONS AREA'; body = 'The world is bounded and outside is dead. The mission does not follow you off the map.'; }
    return `<h1>${head}</h1><p>${body}</p><p class="stats">${stats}</p><p class="go">ENTER — refly · H — honesty ledger</p>`;
  }
  const BRIEF = `
    <h1>OPERATION NIGHTGLASS</h1>
    <p>South-east of you sits a friendly hangar. In between: a block wall clean across the corridor with <b>one gap</b>, and a radar garden. The gate sensor watching the far side of that gap has been flown against at every launch phase. <b>14 of 14 off-phase runs died locked.</b> One beat in fifteen is survivable. Find it.</p>
    <p class="warn">Being seen is a dwell, not a flashbulb. Exposure climbs 1 per painted generation and decays 1 per clean one; at <b>${LOCK}</b> you are locked. Red ground is painted ground — but the shutters breathe with the automaton, so where the light falls <i>changes on a 15-beat cycle</i>.</p>
    <p>Steer with ←↑↓→ (or WASD). Turns latch on <b>beat 1</b> — watch the dots. Any live cell within Chebyshev 2 is <b>contact</b>: you are spliced into the world and physics owns you. TAB swaps the chase camera for the tactical map; the dial is the substrate's 15-phase clock.</p>
    <p>Land by arriving on the marked lane into the hangar catch. Sensors also alarm on divergence — your trace is every cell where the world differs from a world without you. The perfect flight lands with trace 0, and was still painted once: there is no route that never grazes the light.</p>
    <p class="go">ENTER — launch (the clock is live · your launch beat is your choice) · H — honesty ledger</p>`;
  const LEDGER = `
    <h1>HONESTY LEDGER</h1>
    <ol>
      <li>The world is pure Conway B3/S23 on a bounded 172×108 grid; outside is dead. Every pattern — wall, shutters, sensors, hangar — is real and evolves by the rule, always. The kernel is byte-locked to f19's, cryptographically (C1).</li>
      <li>The one fiction: pre-contact, your airframe is a kinematic overlay flying true glider shapes. Within Chebyshev 2 of any live cell you are spliced into the grid and the rule owns you.</li>
      <li>Radar is supercover line of sight — a ray cannot slip between diagonal cells (C2) — and a sensor cannot see through its own antenna (C3). One exposed cell paints the whole airframe. Exposure dwells: +1 painted, −1 clean, locked at ${LOCK} (PAINTED).</li>
      <li>The level is solvable only by reading phase, and that is measured, not scripted: the shipped route flown at all 14 off-phases dies PAINTED 14 times (C6), and an exhaustive search finds <i>no route anywhere</i> that stays below exposure ${LOCK - 1} — every flyable line grazes one generation from death.</li>
      <li>This camera is a spectator, provably: the mission was flown with and without the whole 3D layer and every generation hashed identical (C7). The substrate is periodic from tick 0 with period 15 (C11), the simulation is deterministic (C8), and no two placed patterns can react (C12).</li>
      <li>The world stays 2D because 3D Life has no glider ecology — 180 random soups per rule on a 24³ torus, 0 translating patterns (C9). The three dimensions you are looking at live entirely in the camera.</li>
    </ol>
    <p class="go">H / ESC — close</p>`;

  // ---------- input ----------
  const setH = (ax, v) => { desired = [...(M.player.queued || desired)]; desired[ax] = v; };
  addEventListener('keydown', e => {
    const k = e.key;
    if (k === 'h' || k === 'H') { ledger = !ledger; return; }
    if (k === 'Escape') { ledger = false; return; }
    if (ledger) return;
    if (k === 'Tab') { view = view === '3D' ? 'TAC' : '3D'; e.preventDefault(); return; }
    if (k === 'Enter') {
      if (mode === 'BRIEF') { mode = 'RUN'; launchT = M.t; }
      else if (mode === 'DEBRIEF') { newMission(); mode = 'BRIEF'; }
      return;
    }
    if (k === ' ') { if (mode === 'RUN') paused = !paused; e.preventDefault(); return; }
    if (k === '1' || k === '2' || k === '3') { speed = +k; return; }
    if (k === 'ArrowLeft' || k === 'a' || k === 'A') setH(0, -1);
    else if (k === 'ArrowRight' || k === 'd' || k === 'D') setH(0, 1);
    else if (k === 'ArrowUp' || k === 'w' || k === 'W') setH(1, -1);
    else if (k === 'ArrowDown' || k === 's' || k === 'S') setH(1, 1);
  });
  if ('ontouchstart' in window) {
    const tp = $('tpad'); tp.hidden = false;
    tp.querySelectorAll('button[data-h]').forEach(b => b.addEventListener('touchstart', ev => {
      ev.preventDefault(); desired = b.dataset.h.split(',').map(Number);
    }));
    $('tgo').addEventListener('touchstart', ev => {
      ev.preventDefault();
      if (mode === 'BRIEF') { mode = 'RUN'; launchT = M.t; }
      else if (mode === 'DEBRIEF') { newMission(); mode = 'BRIEF'; }
    });
  }

  // ---------- sim advance ----------
  function advance(gens) {
    for (let i = 0; i < gens; i++) {
      if (mode === 'RUN' && !M.result) missionStep(M, desired);
      else ambientStep(M);
      markAlive();
      if (mode === 'RUN' && M.result && !endSnapshot) {
        endSnapshot = { trace: M.trace }; mode = 'DEBRIEF';
      }
    }
    // On CA tick, never per frame — see the cost note in radar.mjs and the
    // phase-cache note above.
    if (M.t !== shadowT) refreshShadow();
  }

  // ---------- 3D view ----------
  function draw3D() {
    cx.fillStyle = C.sky; cx.fillRect(0, 0, CW, CH);
    const prims = buildDrawList(M, shadow, cam, CW, CH, SETS);
    for (const p of prims) {
      if (p.open) {                       // polylines with per-point clip gaps
        cx.strokeStyle = C.ring; cx.beginPath();
        let pen = false;
        for (const pt of p.pts) {
          if (!pt) { pen = false; continue; }
          if (!pen) { cx.moveTo(pt[0], pt[1]); pen = true; } else cx.lineTo(pt[0], pt[1]);
        }
        cx.stroke(); continue;
      }
      const fill = p.face === 'side' ? (SIDE3D[p.kind] || FILL3D[p.kind]) : FILL3D[p.kind];
      if (!fill) continue;
      cx.fillStyle = fill;
      if (p.kind === 'player') { cx.save(); cx.shadowColor = C.playerGlow; cx.shadowBlur = 10; }
      cx.beginPath();
      cx.moveTo(p.pts[0][0], p.pts[0][1]);
      for (let i = 1; i < p.pts.length; i++) cx.lineTo(p.pts[i][0], p.pts[i][1]);
      cx.closePath(); cx.fill();
      if (p.kind === 'player') cx.restore();
    }
    if (M.state === 'CONTACT') banner('AIRFRAME CONTACT', '#ff6655');
    if (mode === 'BRIEF') banner('READY — ENTER TO LAUNCH', C.playerGlow);
  }
  function banner(txt, col) {
    cx.fillStyle = col; cx.font = '12px monospace'; cx.textAlign = 'center';
    cx.fillText(txt, CW / 2, CH - 16); cx.textAlign = 'left';
  }

  // ---------- tactical view ----------
  function drawTac() {
    cx.fillStyle = C.bg; cx.fillRect(0, 0, CW, CH);
    // painted ground: run-length rows straight off the shadow map
    cx.fillStyle = C.shadowTac;
    for (let y = 0; y < L.H; y++) {
      let x = 0;
      while (x < L.W) {
        if (!shadow[y * L.W + x]) { x++; continue; }
        let x1 = x; while (x1 < L.W && shadow[y * L.W + x1]) x1++;
        cx.fillRect(x * CELL, y * CELL, (x1 - x) * CELL, CELL);
        x = x1;
      }
    }
    // corridor + hangar zone + gap label
    cx.strokeStyle = C.corridor; cx.setLineDash([6, 6]);
    cx.beginPath();
    cx.moveTo((L.corridor.from[0] + .5) * CELL, (L.corridor.from[1] + .5) * CELL);
    cx.lineTo((L.corridor.to[0] + .5) * CELL, (L.corridor.to[1] + .5) * CELL);
    cx.stroke(); cx.setLineDash([]);
    const z = L.hangarZone;
    cx.strokeStyle = 'rgba(255,194,62,0.55)'; cx.setLineDash([4, 4]);
    cx.strokeRect(z[0] * CELL + .5, z[1] * CELL + .5, (z[2] - z[0] + 1) * CELL, (z[3] - z[1] + 1) * CELL);
    cx.setLineDash([]);
    cx.fillStyle = 'rgba(255,194,62,0.6)'; cx.font = '9px monospace';
    cx.fillText('HANGAR', z[0] * CELL, z[1] * CELL - 4);
    cx.fillText('THE GAP', 57 * CELL, 58 * CELL);
    // sensor rings + labels, from the PREPARED radar (real centroid + range)
    for (const s of M.radar) {
      cx.strokeStyle = C.ring;
      cx.beginPath(); cx.arc((s.cx + .5) * CELL, (s.cy + .5) * CELL, s.range * CELL, 0, 7); cx.stroke();
      cx.fillStyle = 'rgba(255,85,68,0.7)';
      cx.fillText(s.name, (s.cx + 2) * CELL, (s.cy - 2) * CELL);
    }
    // afterglow + divergence
    const w = M.world, t = M.t;
    for (let i = 0; i < w.length; i++) {
      const x = i % L.W, y = (i - x) / L.W;
      if (!w[i]) {
        const age = t - lastAlive[i];
        if (age >= 0 && age < 14) { cx.fillStyle = C.glow + (0.28 * (1 - age / 14)) + ')'; cx.fillRect(x * CELL, y * CELL, CELL, CELL); }
        if (M.diverged[i]) { cx.fillStyle = C.div + '0.22)'; cx.fillRect(x * CELL + 2, y * CELL + 2, 2, 2); }
      }
    }
    // live cells
    for (let i = 0; i < w.length; i++) if (w[i]) {
      const x = i % L.W, y = (i - x) / L.W;
      cx.fillStyle = sensorSet.has(i) ? C.sensor : hangarSet.has(i) ? C.gold : C.cell;
      cx.fillRect(x * CELL, y * CELL, CELL - 1, CELL - 1);
    }
    // player
    if (mode !== 'DEBRIEF' && M.state === 'FLIGHT') {
      const cells = playerCells(M);
      cx.save(); cx.shadowColor = C.playerGlow; cx.shadowBlur = 8; cx.fillStyle = C.player;
      const dim = mode === 'BRIEF';
      cx.globalAlpha = dim ? 0.55 + 0.25 * Math.sin(performance.now() / 220) : 1;
      for (const [x, y] of cells) cx.fillRect(x * CELL, y * CELL, CELL - 1, CELL - 1);
      cx.restore(); cx.globalAlpha = 1;
      if (dim) { cx.fillStyle = C.playerGlow; cx.font = '9px monospace'; cx.fillText('READY', (M.player.anchor[0] + 4) * CELL, (M.player.anchor[1]) * CELL); }
    }
    if (M.state === 'CONTACT') {
      const [ax, ay] = M.contactPos;
      const blink = (Math.floor(performance.now() / 140) % 2) === 0;
      cx.strokeStyle = blink ? '#ff6655' : '#992222';
      cx.beginPath(); cx.arc((ax + 1.5) * CELL, (ay + 1.5) * CELL, 20 + (M.contactT % 8), 0, 7); cx.stroke();
    }
    if (M.state === 'LANDING') {
      const p = 0.5 + 0.5 * Math.sin(performance.now() / 160);
      cx.strokeStyle = `rgba(255,194,62,${0.35 + 0.5 * p})`; cx.lineWidth = 2;
      cx.strokeRect(z[0] * CELL - 2, z[1] * CELL - 2, (z[2] - z[0] + 1) * CELL + 4, (z[3] - z[1] + 1) * CELL + 4);
      cx.lineWidth = 1;
    }
  }

  // ---------- dial + HUD ----------
  function drawDial() {
    dx.clearRect(0, 0, 56, 56);
    const P = L.period, ph = M.t % P;
    for (let s = 0; s < P; s++) {
      const a = (s / P) * Math.PI * 2 - Math.PI / 2;
      const r0 = 18, r1 = 25, lit = s === ph;
      dx.strokeStyle = lit ? C.amber : 'rgba(255,176,0,0.22)';
      dx.lineWidth = lit ? 3 : 1;
      dx.beginPath();
      dx.moveTo(28 + r0 * Math.cos(a), 28 + r0 * Math.sin(a));
      dx.lineTo(28 + r1 * Math.cos(a), 28 + r1 * Math.sin(a));
      dx.stroke();
    }
    dx.fillStyle = 'rgba(255,176,0,0.7)'; dx.font = '8px monospace'; dx.textAlign = 'center';
    dx.fillText(String(ph).padStart(2, '0'), 28, 31);
    dx.textAlign = 'left';
  }

  function drawHud() {
    $('gen').textContent = M.t;
    const ph = M.state === 'FLIGHT' ? M.player.phase : M.t % 4;
    $('beat').innerHTML = [0, 1, 2, 3].map(i =>
      `<i class="${i === ph ? 'on' : ''}${i === 0 ? ' latch' : ''}"></i>`).join('');
    const hk = (M.player.queued || (mode === 'RUN' ? desired : M.player.heading)).join(',');
    const cur = M.player.heading.join(',');
    $('rose').innerHTML = [['-1,-1', '◤'], ['1,-1', '◥'], ['-1,1', '◣'], ['1,1', '◢']].map(([k2, g]) =>
      `<i class="${k2 === cur ? 'on' : ''} ${k2 === hk && k2 !== cur ? 'q' : ''}">${g}</i>`).join('');
    // the exposure gauge: the dwell counter against LOCK, pip by pip
    $('expo').innerHTML = Array.from({ length: LOCK }, (_, i) =>
      `<i class="${i < M.exposure ? (M.exposure >= LOCK - 2 ? 'hot' : 'on') : ''}"></i>`).join('');
    $('paint').textContent = M.painted.length ? M.painted.join('+') : '—';
    $('paint').className = 'paint' + (M.painted.length ? ' hot' : '');
    const tr = $('trace');
    tr.textContent = endSnapshot ? endSnapshot.trace : M.trace;
    tr.className = 'trace' + (M.trace > 0 ? ' hot' : '');
    $('spd').textContent = speed;
    const tk = $('tick');
    if (mode === 'BRIEF') tk.textContent = 'AWAITING LAUNCH — CLOCK IS LIVE';
    else if (M.state === 'FLIGHT') tk.textContent = paused ? 'RECON HOLD'
      : M.exposure > 0 ? `PAINTED — LOCK IN ${LOCK - M.exposure}` : 'AIRBORNE — TURNS LATCH ON BEAT 1';
    else if (M.state === 'CONTACT') tk.textContent = `AIRFRAME CONTACT — REACQUIRING ${26 - M.contactT}`;
    else if (M.state === 'LANDING') tk.textContent = `TOUCHDOWN SEQUENCE ${M.landT}/70`;
    else if (M.result) tk.textContent = M.result.replace('_', ' ');
    const card = $('card');
    if (ledger) { card.className = 'card show'; card.innerHTML = LEDGER; }
    else if (mode === 'BRIEF') { card.className = 'card show'; card.innerHTML = BRIEF; }
    else if (mode === 'DEBRIEF') { card.className = 'card show'; card.innerHTML = debriefText(); }
    else card.className = 'card';
  }

  // ---------- loop ----------
  function frame(ts) {
    if (!lastTs) lastTs = ts;
    let dt = Math.min(0.1, (ts - lastTs) / 1000); lastTs = ts;
    if (!(paused && mode === 'RUN') && !ledger) {
      acc += dt * GPS[speed];
      const n = Math.floor(acc); acc -= n;
      if (n) advance(Math.min(n, 8));
    }
    stepCamera(cam, [M.player.anchor[0], M.player.anchor[1]], M.player.heading, dt);
    if (view === '3D') draw3D(); else drawTac();
    drawDial(); drawHud();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootF117A);
else bootF117A();
