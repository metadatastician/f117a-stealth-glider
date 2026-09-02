// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jonathan D.A. Jewell (hyperpolymath) <j.d.a.jewell@open.ac.uk>
//
// design/sweep.mjs — search the parameter space for a level that is BOTH
// solvable AND phase-critical.
//
// The metric that matters is not "how exposed is the corridor" but the
// falsifier itself: solve the level, then fly the SAME route from every launch
// phase and count how many are locked by radar. A level where every phase lands
// has a decorative radar however dangerous its corridor statistics look. That
// is the trap the earlier corridor-percentage metric walked into: it reported
// 35% phase-dependence for a level whose witness route survived all 30 phases.
import { buildLevel } from '../src/level.mjs';
import { createMission, missionStep, ambientStep } from '../src/mission.mjs';
import { solve } from './solver.mjs';

// Off-phase launches ONLY (off = 1..period-1) — the population the ledger's
// verify-falsifier.mjs asserts over. The on-phase flight is reported
// separately: it is supposed to land, so counting it among the survivors
// flattered every config by one launch.
function falsifier(mk, witness) {
  const out = { onPhase: null, LANDED: 0, PAINTED: 0, other: 0, peaks: [], n: 0 };
  const L0 = mk();
  out.n = L0.period - 1;
  for (let off = 0; off < L0.period; off++) {
    const M = createMission(mk());
    const turns = new Map(witness.map(([t, hx, hy]) => [t, [hx, hy]]));
    for (let k = 0; k < off; k++) ambientStep(M);
    for (let t = 0; t < 3000 && !M.result; t++) missionStep(M, turns.get(t) ?? null);
    if (off === 0) { out.onPhase = M.result; continue; }
    if (M.result === 'LANDED') out.LANDED++;
    else if (M.result === 'PAINTED') out.PAINTED++;
    else out.other++;
    out.peaks.push(M.peakExposure);
  }
  return out;
}

console.log('range lock  solved gens turns | landed painted other  peak(min..max)  verdict');
console.log('----- ----  ------ ---- ----- | ------ ------- -----  --------------  -------');
for (const range of [40, 42, 44, 46, 50, 54, 58]) {
  for (const lock of [5, 6, 8]) {
    const mk = () => buildLevel({ radarRange: range });
    const L = mk();
    const r = solve(L, mk, { lock });
    if (!r.solved) {
      console.log(String(range).padStart(5), String(lock).padStart(4), '  UNSOLVABLE');
      continue;
    }
    const f = falsifier(mk, r.turns);
    // C6 means "a MAJORITY of off-phase launches fail as PAINTED": painted >
    // n/2 over the 14 off-phase flights, with the on-phase flight landing.
    const verdict = f.onPhase !== 'LANDED' ? `route dies on-phase (${f.onPhase})`
      : f.PAINTED === 0 ? 'radar decorative'
        : (f.PAINTED > f.n / 2) ? '*** PHASE-CRITICAL ***'
          : 'partial';
    console.log(
      String(range).padStart(5), String(lock).padStart(4),
      String(r.solved).padStart(8), String(r.gens).padStart(4), String(r.turns.length).padStart(5),
      '|', String(f.LANDED).padStart(6), String(f.PAINTED).padStart(7), String(f.other).padStart(5),
      ` ${Math.min(...f.peaks)}..${Math.max(...f.peaks)}`.padStart(15), ' ' + verdict,
    );
  }
}
