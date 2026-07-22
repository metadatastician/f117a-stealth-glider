// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jonathan D.A. Jewell (hyperpolymath) <j.d.a.jewell@open.ac.uk>
//
// Ledger claim C8 — the simulation is deterministic.
//
// This is the defect that disqualified spike/world.html as a foundation. It
// seeded its automaton with 150 Math.random() cells and applied Math.random()
// turbulence, so no two runs agreed. Every other claim in this ledger is a
// statement about a reproducible run; without C8 none of them means anything,
// and "the substrate is phase-readable, therefore learnable, therefore fair"
// cannot even be stated.
//
// Two independent checks, because either alone is weak:
//   - textual: no non-determinism primitive appears in shipped src/
//   - behavioural: two full runs are byte-identical
// The textual check catches a source that has not run yet; the behavioural one
// catches non-determinism arriving by some route the grep did not imagine.
//
// Run: node verify-determinism.mjs

import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { buildLevel } from './level.mjs';
import { createMission, missionStep } from './mission.mjs';

let failures = 0;
const ok = (cond, msg) => {
  if (cond) console.log(`  ok   ${msg}`);
  else { console.log(`  FAIL ${msg}`); failures++; }
};

console.log('C8 — determinism');

// --- textual -----------------------------------------------------------------
{
  const dir = new URL('.', import.meta.url);
  const banned = [
    [/Math\s*\.\s*random/, 'Math.random'],
    [/crypto\s*\.\s*getRandomValues/, 'crypto.getRandomValues'],
    [/\bDate\s*\.\s*now\b/, 'Date.now'],
    [/new\s+Date\s*\(\s*\)/, 'new Date()'],
    [/performance\s*\.\s*now/, 'performance.now'],
  ];
  // Scope: the SIMULATION modules — the ones build.mjs bundles into the game.
  //
  // Deliberately not "every file in src/". The first draft globbed the whole
  // directory and flagged two files it should never have looked at: this one,
  // for containing the banned-pattern list itself, and verify-los.mjs, for a
  // comment noting that the repo uses no Math.random. Both were false
  // positives, and a check that cries wolf gets switched off.
  //
  // The renderer and camera are excluded on purpose too — a frame clock is
  // legitimate there — but they are excluded because claim C7 proves they
  // cannot influence the mission outcome, not merely because they are awkward.
  const SIMULATION = ['kernel/engine.mjs', 'mission.mjs', 'radar.mjs', 'level.mjs'];
  const offenders = [];
  for (const f of SIMULATION) {
    const src = readFileSync(new URL(f, dir), 'utf8');
    for (const [re, name] of banned) if (re.test(src)) offenders.push(`${f}: ${name}`);
  }
  ok(offenders.length === 0,
    `no non-determinism primitive in the ${SIMULATION.length} simulation modules`
    + `${offenders.length ? ` — found ${offenders.join(', ')}` : ''}`);

  // The scope list must not silently go stale: every simulation module must exist.
  const present = readdirSync(dir).filter((f) => f.endsWith('.mjs') || f.endsWith('.js'));
  void present;
  ok(SIMULATION.every((f) => { try { readFileSync(new URL(f, dir)); return true; } catch { return false; } }),
    `all ${SIMULATION.length} named simulation modules exist — the scope list is not stale`);

  // The check must be able to fail.
  ok(banned.some(([re]) => re.test('const x = Math.random();')),
    'canary: the pattern set does match Math.random when it is present');
}

// --- behavioural -------------------------------------------------------------
function runDigest() {
  const L = buildLevel();
  const M = createMission(L);
  const turns = new Map(L.witness.map(([t, hx, hy]) => [t, [hx, hy]]));
  const h = createHash('sha256');
  for (let t = 0; t < 600 && !M.result; t++) {
    missionStep(M, turns.get(t) ?? null);
    h.update(Buffer.from(M.world));
    h.update(`${M.exposure}|${M.trace}|${M.state}|${M.player.anchor.join(',')}`);
  }
  return { digest: h.digest('hex'), result: M.result, trace: M.trace, t: M.endT };
}

{
  const a = runDigest();
  const b = runDigest();
  ok(a.digest === b.digest,
    `two full runs are byte-identical across every generation (${a.digest.slice(0, 16)}…)`);
  ok(a.result === b.result && a.trace === b.trace && a.t === b.t,
    `and agree on outcome: ${a.result} trace ${a.trace} at t=${a.t}`);
}

console.log(failures === 0 ? '\nC8: PASS' : `\nC8: ${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
