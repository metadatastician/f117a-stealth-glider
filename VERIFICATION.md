<!--
SPDX-License-Identifier: CC-BY-SA-4.0
Copyright (c) 2026 Jonathan D.A. Jewell (hyperpolymath)
-->

# Verification ledger

Every claim below cites a script you can run with plain `node`. No dependencies,
no framework. `just verify` runs the gating set; `just falsifier` runs the one
that is currently red.

**One claim is RED, on purpose: [C6](#c6--falsifier--red).** It is the falsifier
for the whole premise, and it does not pass yet. It is reported rather than
hidden, and it does not gate the build while it is known-red — see
[`AUDIT.adoc`](./AUDIT.adoc).

| # | Claim | Script | Status |
|---|---|---|---|
| C1 | The reused f19 kernel is provably the f19 kernel | `src/verify-kernel-parity.mjs` | green |
| C2 | Supercover LOS never leaks through a diagonal wall; LOS is symmetric | `src/verify-los.mjs` | green |
| C3 | A radar does not occlude itself | `src/verify-los.mjs` | green |
| C5 | The witness route lands, trace 0, never locked | `src/verify-witness.mjs` | green |
| C6 | **Falsifier: the level is solvable only by reading phase** | `src/verify-falsifier.mjs` | **RED** |
| C8 | The simulation is deterministic | `src/verify-determinism.mjs` | green |
| C11 | The substrate is periodic from generation 0 | `src/verify-level.mjs` | green |
| C12 | No two stamped patterns can react | `src/verify-level.mjs` | green |

C4, C7, C9 and C10 are reserved for work not yet landed: the corridor
phase-dependence metric currently lives in `design/measure.mjs` rather than in
the gating ledger, and the 3D renderer, its inertness proof and the bundle do
not exist yet. They are listed in `AUDIT.adoc` under *not claimed*.

---

## C1 — kernel parity

`src/kernel/engine.mjs` is byte-identical to
`metadatastician/f19-stealth-glider@9effa596:src/engine.mjs`, and `src/mission.mjs`
is that repository's `mission.mjs` plus explicitly fenced additions.

Both are asserted as **git blob ids** — `sha1("blob <len>\0" + bytes)`, the same
identifiers f19's own tree records — so the check is cryptographic and entirely
offline. `verify-kernel-parity.mjs` strips every `>>> FORK … <<< FORK` block from
`mission.mjs`, reverses the two declared substitutions, and requires the result
to hash to `30f93a70…`.

Vendoring has failed the same way repeatedly across this estate — a copy is
taken, improved locally, and later nobody can say which is authoritative. A
comment saying "do not edit" prevents none of it, because comments do not
execute. See [`KERNEL-DIVERGENCE.md`](./KERNEL-DIVERGENCE.md).

Includes a canary: a one-token edit outside a fence must break parity.

## C2 — supercover line of sight

Radar cover has to be honest, which means a ray must not slip between two
diagonally-adjacent live cells. Bresenham picks one cell per major-axis step and
does exactly that; supercover returns every cell the segment touches, including
both cells at an exact corner crossing.

Tested on a full diagonal wall: **0 of 4489 cross-wall pairs** have line of
sight. The canary in the same test shows naive Bresenham leaking **1009 of 4489
(22%)** through that identical wall — so the test demonstrably has teeth. The
anti-diagonal is checked separately in case the algorithm is lopsided, along with
symmetry (`LOS(a,b) == LOS(b,a)`) and the superset property
(supercover ⊇ Bresenham).

## C3 — a radar does not occlude itself

Sensors are beehives — six live cells — and a ray cast from the sensor's centroid
starts *inside* them. Without an exemption for the emitter's own footprint, every
target reads as blocked.

This was not hypothetical. It was hit while designing this repository, and it
measured as **3 of 1025** lattice points painted: a radar network that was, in
effect, switched off. It looked like a balance problem rather than a bug, which
is why it is pinned here with a canary showing the sensor blinding itself 5/5
without the exemption. The exemption is also shown to be scoped — foreign cover
still blocks.

## C5 — the witness route

`node src/verify-witness.mjs`

The route is **found, not designed**: `design/solve.mjs` searches the state space
`(anchor × heading × substrate phase × exposure)` — 20,062,080 states — and emits
it. The solver is an *approximation* of the mission engine (it orders the
collision and radar tests differently for speed), so it is only allowed to
propose. The claim is the flight through the real `missionStep()`:

> **LANDED at t=485, trace 0, peak exposure 7 of 8.**

Peak exposure 7 matters: a route that was never painted at all would satisfy
"lands cleanly" while proving nothing about the radar.

The landing itself is constrained. The eater absorbs an arriving glider cleanly
on only **3 of 21** approach lanes measured (`glidepaths: [-10, -4, 3]`); 12 lanes
reach the hangar and still crash-land, and 6 run off the edge. The solver is
constrained to arrive on a clean lane, or it returns routes that lose.

## C6 — falsifier — RED

`node src/verify-falsifier.mjs`

**The claim that decides whether this is a game or a diorama, and it does not
pass.**

Fly the *same* route from every launch phase. If the level is a phase puzzle,
most off-phase launches must die, and die specifically as `PAINTED` — because
that is what shows phase-reading defeats the **radar** rather than the terrain.
Asserting merely that off-phase runs "fail" would pass on a route that flies into
a still life at every phase alike.

Measured, at `radarRange` 40 and `LOCK` 8:

> **4 of 14 off-phase launches are shot down as PAINTED; peak exposure varies
> 7..8 across phases.**

Two of the three assertions pass — the failures are dominated by radar rather
than terrain, and at least one launch is locked. The majority clause does not.

This is a large improvement on the first design, which measured **0 of 30** with
peak exposure flat at 7..7. Two geometry fixes got it here, both measured:

1. **The wall had to be a wall.** It spanned ~50 cells of a line whose in-bounds
   length is ~106, so the route flew round the end and the shutter was guarding
   an optional path.
2. **Tangency beats coverage.** A 72-position sweep shows the shutter placed
   squarely on the gate-to-gap sight line masking at *every* phase (15/15 land,
   peak 7..7); grazing the ray at [68,68] leaves only its extended phases
   occluding (4/15 shot down, peak 7..8).

Untried: a second gate sensor onto the same gap (safe only when both rays are
blocked), a narrower gap, a shorter-period shutter.

## C8 — determinism

Two independent checks, because either alone is weak: no non-determinism
primitive (`Math.random`, `Date.now`, `performance.now`, …) appears in the four
simulation modules, **and** two complete runs hash identically across every
generation.

This is the defect that disqualified `spike/world.html` as a foundation: it
seeded its automaton with 150 `Math.random()` cells and applied random
turbulence, so no two runs agreed. Every other claim here is a statement about a
reproducible run.

The scope is deliberately the four *simulation* modules, not all of `src/`. The
first draft globbed the directory and produced two false positives — this file's
own pattern list, and a comment in `verify-los.mjs`. A check that cries wolf gets
switched off.

## C11 — the substrate is periodic from generation 0

`transient = 0`, `period = 15` (the declared value), population `198..254`.

This is a precondition, not decoration. The solver indexes states by
`t mod period`; if a transient existed, it would be searching a space that has not
formed yet. f19's own level takes **347 generations** to settle, because its
Gosper gun must fill the stream to the absorber before anything repeats — which
is why Nightglass uses no gun. Oscillators are periodic from the first tick.

## C12 — no two stamped patterns can react

All 20 patterns sit inside the border with a margin; no pair is within Chebyshev
3; the declared landing lanes exist; the hangar zone is inside the grid; and spawn
sits on a clean lane.

Each of those clauses is scar tissue. A 13×13 pulsar placed every 9 cells made
every bank member collide with its neighbour, spraying debris and pushing the
transient from 0 to **183** generations. Two still lifes within 2 cells of a bank
pushed it to **621**. And a hangar whose zone ran one row past the grid made
*every* approach report `CRASH_LANDING` — off-grid reads return `undefined`, which
never equals 0, so the cleanliness test could not succeed. None of the three was
visible by inspection; all three were found by bisection and measurement.
