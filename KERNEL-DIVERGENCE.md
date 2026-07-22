<!--
SPDX-License-Identifier: CC-BY-SA-4.0
Copyright (c) 2026 Jonathan D.A. Jewell (hyperpolymath)
-->

# Kernel divergence from f19-stealth-glider

Upstream: `metadatastician/f19-stealth-glider` @ `9effa596f974f3330cbeac826e147f84086515a1`

This repository reuses f19's simulation core. Across this estate that kind of
reuse has failed the same way every time: a copy is taken, improved locally, and
months later nobody can say which of the two is authoritative. So the reuse here
is stated as hash equality and checked on every push by
[`src/verify-kernel-parity.mjs`](./src/verify-kernel-parity.mjs) (claim C1).

## `src/kernel/engine.mjs` — VERBATIM

| | |
|---|---|
| upstream blob | `c7a016ecd9003422bf46252a4713e69dabf266fe` |
| local changes | **none, and none are permitted** |

B3/S23, RLE parsing, the eight symmetries, glider tables, cluster finding. It
still carries its original `F19 Stealth Glider — core engine` header, and that is
deliberate: the file documents where it came from, and byte-identity is the
point. Do not fix anything here. Fix it upstream, re-vendor, re-pin.

## `src/mission.mjs` — DECLARED FORK

| | |
|---|---|
| upstream blob | `30f93a704a63c18e0e74c4cc7c7ef7044c9f35d9` |
| local changes | five fenced blocks, plus two substitutions |

C1 strips every `// >>> FORK … // <<< FORK` block, reverses the two
substitutions, and requires the remainder to hash to the upstream blob id. So
"upstream plus declared changes" is a mechanical fact, not an intention. A
one-token edit outside a fence breaks the build, and the check ships with a
canary proving exactly that.

### The two substitutions

1. title line — `F117A Stealth Glider` for `F19 Stealth Glider`
2. import path — `./kernel/engine.mjs` for `./engine.mjs`

### The five fenced blocks

| Block | What it adds | Why |
|---|---|---|
| header | this contract, restated in the file | so it is read by whoever edits it |
| import | `./radar.mjs` | no upstream equivalent |
| `createMission` | `radar`, `exposure`, `peakExposure`, `painted`, `lockedBy` | radar state |
| `checkRadar()` | the whole function | the new threat channel |
| `missionStep` | one `checkRadar(M)` call after the world advances | wires it in |

### Why radar is a second, independent channel

Upstream has one way to lose: **trace** — any divergence between the world and a
counterfactual shadow world, i.e. what you *disturb*. This repository adds
**radar** — what *sees* you.

They are deliberately not merged. The player is a kinematic overlay that is not
simulated into the world while it stays independent of the substrate, and splices
in only on near-contact. So radar traces line-of-sight **to the overlay cells** —
you can be painted without disturbing a single cell — whereas trace accrues only
**on splice**. A trace-0 flight down an exposed corridor is still a dead flight,
and that separation is the entire F-117A premise.

`checkRadar` runs only in `FLIGHT`. In `CONTACT` the aircraft has been spliced
into the substrate and its cells *are* substrate cells, so "painted" has no
referent; that state resolves within 26 generations to reacquisition or MIA, with
trace accruing throughout. In `LANDING` the approach is committed.

## Re-basing onto a newer f19

Update `UPSTREAM` in `src/verify-kernel-parity.mjs`, re-run the ledger, and record
what changed here. That is a decision. Drift is not.
