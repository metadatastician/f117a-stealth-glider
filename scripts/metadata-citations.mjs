// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jonathan D.A. Jewell (hyperpolymath) <j.d.a.jewell@open.ac.uk>
//
// scripts/metadata-citations.mjs — the machine-readable metadata must describe
// THIS repository.
//
// -------------------------------------------------------------------------
// WHY THIS EXISTS
// -------------------------------------------------------------------------
// This repository was scaffolded by copying f19-stealth-glider, and the
// machine-readable/ tree arrived describing f19's game. Not approximately —
// literally: a Gosper gun as this level's "level-primitive", a fence row and
// breach columns this level does not have, a spawn and hangar at the wrong
// coordinates, and a [settled-questions] block recording f19's rulings as
// CLOSED here, with two other files pointing agents at it as authority.
//
// None of it could fail a check. Of the stale statements in the contractiles,
// nearly all sat behind fields the runner does not execute: `tolerance:` and
// `corrective:` are not probe keys, `injection_probe:` is not a probe key,
// `recovery_probe:` is drill-only, and `- probe:` is reported at info and
// gates nothing. The contamination was therefore invisible to CI while being
// the first thing an agent reads.
//
// Two failure modes are checked here, both mechanical:
//
//   1. DEAD CITATIONS. Every `src/...` and `design/...` path mentioned
//      anywhere in the metadata must exist. This is what catches
//      `src/engine.mjs` (the real path is src/kernel/engine.mjs, so every
//      rule claiming to protect the vendored kernel protected nothing) and
//      `src/verify8.mjs` (a copy-pasteable command that cannot run).
//
//   2. FOREIGN-LEVEL VOCABULARY. Tokens that belong to f19's level and
//      cannot be true of this one. A Gosper gun is not a matter of taste
//      here: src/level.mjs carries a block titled WHY NO GOSPER GUN
//      explaining that a gun's 347-generation transient destroys C11, on
//      which the solver and C6 both rest. Metadata asserting one invites an
//      agent to reintroduce it.
//
// Lineage references are NOT contamination and must keep working: this repo
// genuinely vendors f19's kernel and forks its mission core, and C1 asserts
// exactly that. So the denylist names f19's LEVEL FURNITURE, never f19
// itself.
//
// And a level's design is often best stated by contrast — "this level has no
// gun, and here is what that buys" is the single most useful sentence in
// level.mjs. A check that forbade saying so would trade one lie for a
// silence, so any line carrying the marker `f19-contrast:` is exempt from the
// vocabulary check (never from the dead-path check: a contrast is still not
// allowed to cite a file that does not exist). The marker is greppable, so
// every deliberate mention stays auditable in one command.
//
// One trap, hit while writing this: a line that DOCUMENTS the marker contains
// the marker, and so exempts itself. The first draft of the contractile note
// describing this check quietly excused its own example sentence. Prose about
// the marker must therefore name it without the colon, and this paragraph is
// written that way on purpose.
//
// Run: node scripts/metadata-citations.mjs

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.(a2ml|adoc|toml)$/.test(name)) out.push(p);
  }
  return out;
}

// f19 LEVEL furniture. Each entry is a thing that cannot be true of Operation
// Nightglass, with the reason it matters stated where it is not obvious.
const FOREIGN = [
  [/\bGosper\b/i, 'this level has no gun — a gun\'s transient destroys C11 (see level.mjs WHY NO GOSPER GUN)'],
  [/\bstream[- ]lane\b/i, 'no glider stream in this level'],
  [/\bgun-box\b/i, 'no gun in this level'],
  [/\bsearchlight\b/i, 'f19\'s p30 stream gate; this level\'s gate is a radar chokepoint'],
  [/\bfence-row\b/i, 'this level has a chokepoint wall with one gap, not a fence'],
  [/\bqueen[- ]bee\b/i, 'f19 roadmap furniture'],
  [/\bno-go lemma\b/i, 'f19\'s stream-crossing lemma was never derived here'],
  [/\bverify\d+\.mjs\b/, 'f19\'s numbered scripts; this repo uses named verify-*.mjs'],
  [/\bverify\d+(?:\s*,\s*\d+)+\b/, 'f19\'s numbered script list'],
  [/\b11-claim ledger\b/i, 'this ledger has 12 claims (C1..C12)'],
];

// Paths the metadata cites. Anything shaped like a repo-relative source path.
const PATH_RE = /\b((?:src|design|scripts)\/[A-Za-z0-9_./-]*\.(?:mjs|js))\b/g;

let dead = 0, foreign = 0, scanned = 0;
const files = walk(join(ROOT, 'machine-readable'));

for (const file of files) {
  const rel = file.slice(ROOT.length + 1);
  const text = readFileSync(file, 'utf8');
  scanned++;
  const lines = text.split('\n');

  lines.forEach((line, i) => {
    // 1. dead citations
    for (const m of line.matchAll(PATH_RE)) {
      const cited = m[1];
      if (!existsSync(join(ROOT, cited))) {
        console.log(`  DEAD   ${rel}:${i + 1}  cites ${cited} — no such file`);
        dead++;
      }
    }
    // 2. foreign level vocabulary — unless the line is a declared contrast
    if (line.includes('f19-contrast:')) return;
    for (const [re, why] of FOREIGN) {
      if (re.test(line)) {
        console.log(`  ALIEN  ${rel}:${i + 1}  ${re.source} — ${why}`);
        foreign++;
      }
    }
  });
}

console.log(`\nmetadata citations: ${scanned} file(s) scanned, ${dead} dead path(s), ${foreign} foreign-level reference(s)`);

if (dead === 0 && foreign === 0) {
  console.log('OK: the metadata describes this repository.');
  process.exit(0);
}
console.log('\nThe machine-readable tree is the first thing an agent reads. A citation');
console.log('to a file that does not exist, or to another game\'s level, is not a typo —');
console.log('it is an instruction to act on something untrue.');
process.exit(1);
