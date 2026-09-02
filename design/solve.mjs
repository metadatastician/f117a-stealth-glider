// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jonathan D.A. Jewell (hyperpolymath) <j.d.a.jewell@open.ac.uk>
//
// design/solve.mjs — CLI over design/solver.mjs. Emits the witness route, or
// explains why the level is unsolvable.
//
// A level whose solvability is eyeballed is a level that is probably not
// solvable. This searches the state space exhaustively.
//
// STATE. A glider advances one diagonal cell per four generations and may only
// change heading at phase 0, so decisions occur every four generations. The
// state is (anchorX, anchorY, heading, substratePhase, exposure). The substrate
// is periodic from generation 0 with no transient (see level.mjs), so
// `substratePhase = t mod P` is well defined at every decision point — which is
// what makes this space finite at all.
//
// HONESTY. This is an APPROXIMATION of mission.mjs, not a second copy: it orders
// the collision and radar tests differently to keep the search cheap. So it may
// only PROPOSE. Any route it finds is flown through the real missionStep() by
// verify-witness.mjs, and that run — not this one — is the ledger claim.
//
// Run: node design/solve.mjs

import { buildLevel } from '../src/level.mjs';
import { solve } from './solver.mjs';

const L = buildLevel();
const r = solve(L, buildLevel);

console.log(`state space ${r.total.toLocaleString()}  visited ${r.visited.toLocaleString()}  depth ${r.depth}`);
console.log('death causes:', JSON.stringify(r.why));

if (!r.solved) {
  console.log('furthest reached:', JSON.stringify(r.bestState), '- hangar at', L.hangarAt.join(','));
  console.log('\nNO ROUTE. The level as configured is unsolvable.');
  const d = r.why;
  const worst = Object.entries({ exposure: d.exposure, contact: d.contact, edge: d.oob })
    .sort((a, b) => b[1] - a[1])[0];
  console.log(`Dominant cause: ${worst[0]} (${worst[1]}).`);
  console.log(worst[0] === 'exposure'
    ? 'Radar is too lethal: cut range, move a sensor back, or add cover on the ingress.'
    : worst[0] === 'contact'
      ? 'Terrain is too dense: widen the gaps between oscillators.'
      : 'The route runs off the map: move spawn or hangar inward.');
  process.exit(1);
}

console.log(`\nROUTE FOUND - ${r.moves.length} decision points (${r.gens} generations), ${r.turns.length} turns`);
for (const [at, hx, hy] of r.turns) console.log(`   t=${String(at).padStart(4)}  heading ${hx},${hy}`);
console.log('\nWitness (paste into level.mjs as `witness`):');
console.log('  ' + JSON.stringify(r.turns));
