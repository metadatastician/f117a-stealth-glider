// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jonathan D.A. Jewell (hyperpolymath) <j.d.a.jewell@open.ac.uk>
//
// Ledger claim C1 — the reused f19 kernel is provably the f19 kernel.
//
// This repository reuses f19-stealth-glider's simulation core. Estate-wide,
// that kind of reuse has failed the same way every time: a copy is taken, it is
// "improved" locally, and months later nobody can say which of the two is
// authoritative. It happened to the BoJ cartridge shim (~230 divergent copies)
// and to maa-framework's vendored aletheia (in-tree silently ahead of its
// mirror). A comment saying "vendored from X, do not edit" prevents none of it,
// because comments are not executable.
//
// So parity is a hash equality, checked on every push:
//
//   src/kernel/engine.mjs   MUST equal upstream byte for byte.
//   src/mission.mjs         MUST equal upstream after FORK-fenced blocks are
//                           removed and the two declared substitutions are
//                           reversed.
//
// Both are stated as git blob ids — sha1("blob <len>\0" + bytes) — which are
// the SAME ids f19's own tree records. So this runs entirely offline and needs
// no network, no submodule and no second checkout, yet it still pins these
// files to a specific commit of a specific repository.
//
// If upstream is deliberately re-based onto a newer f19, update UPSTREAM below
// and say why in KERNEL-DIVERGENCE.md. That is a decision; drift is not.
//
// Run: node verify-kernel-parity.mjs

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const UPSTREAM = {
  repo: 'metadatastician/f19-stealth-glider',
  commit: '9effa596f974f3330cbeac826e147f84086515a1',
  blobs: {
    'engine.mjs': 'c7a016ecd9003422bf46252a4713e69dabf266fe',
    'mission.mjs': '30f93a704a63c18e0e74c4cc7c7ef7044c9f35d9',
  },
};

/** git's object id for a blob: sha1 over "blob <bytelength>\0" + content. */
function gitBlobId(buf) {
  const header = Buffer.from(`blob ${buf.length}\0`, 'utf8');
  return createHash('sha1').update(Buffer.concat([header, buf])).digest('hex');
}

/**
 * Reduce our mission.mjs back to the upstream text.
 *
 * Removing the fences is deliberately unforgiving: an unterminated `>>> FORK`
 * would swallow the rest of the file and could make an arbitrarily mangled file
 * hash correctly, so the fence structure is validated first.
 */
function reverseFork(text) {
  const lines = text.split('\n');
  const out = [];
  let depth = 0;
  for (const line of lines) {
    if (line.includes('>>> FORK')) {
      if (depth !== 0) throw new Error('nested >>> FORK fence');
      depth = 1; continue;
    }
    if (line.includes('<<< FORK')) {
      if (depth !== 1) throw new Error('<<< FORK without a matching opener');
      depth = 0; continue;
    }
    if (depth === 0) out.push(line);
  }
  if (depth !== 0) throw new Error('unterminated >>> FORK fence');

  let s = out.join('\n');
  // The two declared substitutions, reversed.
  s = s.replace(
    '// F117A Stealth Glider — mission core.',
    '// F19 Stealth Glider — mission core.',
  );
  s = s.replace("from './kernel/engine.mjs'", "from './engine.mjs'");
  return s;
}

let failures = 0;
const ok = (cond, msg) => {
  if (cond) console.log(`  ok   ${msg}`);
  else { console.log(`  FAIL ${msg}`); failures++; }
};

console.log(`C1 — kernel parity with ${UPSTREAM.repo}@${UPSTREAM.commit.slice(0, 8)}`);

// --- engine.mjs: byte-identical, no exceptions ------------------------------
{
  const buf = readFileSync(new URL('./kernel/engine.mjs', import.meta.url));
  const id = gitBlobId(buf);
  ok(id === UPSTREAM.blobs['engine.mjs'],
    `src/kernel/engine.mjs blob ${id.slice(0, 8)} == upstream ${UPSTREAM.blobs['engine.mjs'].slice(0, 8)}`);
  if (id !== UPSTREAM.blobs['engine.mjs']) {
    console.log('       engine.mjs is VENDORED VERBATIM. It has no local changes by design.');
    console.log('       Do not "fix" it here — fix it upstream, then re-vendor and re-pin.');
  }
}

// --- mission.mjs: upstream + declared fork ----------------------------------
{
  const text = readFileSync(new URL('./mission.mjs', import.meta.url), 'utf8');
  let reversed = null, err = null;
  try { reversed = reverseFork(text); } catch (e) { err = e; }

  ok(err === null, `mission.mjs FORK fences are well-formed${err ? ` — ${err.message}` : ''}`);

  if (reversed !== null) {
    const id = gitBlobId(Buffer.from(reversed, 'utf8'));
    ok(id === UPSTREAM.blobs['mission.mjs'],
      `mission.mjs minus FORK blocks: blob ${id.slice(0, 8)} == upstream ${UPSTREAM.blobs['mission.mjs'].slice(0, 8)}`);
    if (id !== UPSTREAM.blobs['mission.mjs']) {
      console.log('       Something outside a FORK fence was edited. Either move the change');
      console.log('       inside a fence, or — if it genuinely belongs upstream — send it there.');
    }
  }

  // The fork must actually BE a fork: if the fences are empty, this check has
  // quietly become a no-op that only proves we copied a file.
  const fenced = (text.match(/>>> FORK/g) ?? []).length;
  ok(fenced >= 3, `mission.mjs declares ${fenced} FORK block(s) — the fork is real, not vestigial`);
}

// --- the canary: the reversal must be capable of failing --------------------
// A parity check built on "strip some lines, then hash" is exactly the shape
// that silently passes when the stripping is too aggressive. Prove it bites.
{
  const text = readFileSync(new URL('./mission.mjs', import.meta.url), 'utf8');
  const tampered = text.replace('M.contactT++;', 'M.contactT += 2;');
  const changed = tampered !== text;
  let id = null;
  try { id = gitBlobId(Buffer.from(reverseFork(tampered), 'utf8')); } catch { /* fence error is also a fail */ }
  ok(changed && id !== UPSTREAM.blobs['mission.mjs'],
    'canary: a one-token edit OUTSIDE a fence breaks parity — the check is not a no-op');
}

console.log(failures === 0 ? '\nC1: PASS' : `\nC1: ${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
