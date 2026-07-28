<!--
SPDX-License-Identifier: CC-BY-SA-4.0
Copyright (c) 2026 Jonathan D.A. Jewell (hyperpolymath)
-->

# Verification ledger

Every claim below cites a script you can run with plain `node`. No dependencies,
no framework. `just verify` runs the gating set — all twelve claims, including
[C6](#c6--falsifier--green), the falsifier for the whole premise, which was
known-red until the level geometry was made to earn it. The history of that red,
and what closed it, is kept below and in [`AUDIT.adoc`](./AUDIT.adoc).
`just test` additionally proves the committed bundle byte-identical to a fresh
rebuild (C10).

| # | Claim | Script | Status |
|---|---|---|---|
| C1 | The reused f19 kernel is provably the f19 kernel | `src/verify-kernel-parity.mjs` | green |
| C2 | Supercover LOS never leaks through a diagonal wall; LOS is symmetric | `src/verify-los.mjs` | green |
| C3 | A radar does not occlude itself | `src/verify-los.mjs` | green |
| C4 | The shadow is load-bearing on the nominal corridor, and its shape is pinned | `src/verify-corridor.mjs` | green |
| C5 | The witness route lands, trace 0, never locked | `src/verify-witness.mjs` | green |
| C6 | **Falsifier: the level is solvable only by reading phase** | `src/verify-falsifier.mjs` | green |
| C7 | The renderer and camera are inert — provably spectators | `src/verify-renderer.mjs` | green |
| C8 | The simulation is deterministic | `src/verify-determinism.mjs` | green |
| C9 | 3D Life has no glider ecology — the third dimension stays in the camera | `src/verify-3d-rule-search.mjs` | green |
| C10 | The shipped bundle is byte-reproducible and re-proved completable at build | `src/build.mjs` + CI diff | green |
| C11 | The substrate is periodic from generation 0 | `src/verify-level.mjs` | green |
| C12 | No two stamped patterns can react | `src/verify-level.mjs` | green |

No claim numbers are reserved any more: C4, C7, C9 and C10 — held open while
the corridor metric lived only in `design/measure.mjs` and the renderer,
inertness proof and bundle did not exist — landed with the game layer.

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

## C4 — the shadow is load-bearing

`node src/verify-corridor.mjs`

Walk the nominal corridor — the diagonal flown with no input — and classify
each of its 81 cells over one full substrate period, using the same supercover
LOS the mission uses. Three structural facts must hold: **phase-dependent
cells exist** (8 — the cells that are the game), **at least one cell's longest
consecutive painted run reaches `LOCK`** (36 do — the radar has teeth; exposure
decays one per clean generation, so a flickering cell can never kill), and
**cover exists** (42 cells are painted at no phase).

The counts are then pinned as declared values, C11-style: 31 always / 42 never
/ 8 phase-dependent, 36 lethal, 3 survivable. Any geometry change that shifts
them without re-measuring turns this claim red — which is the point. The
computation is the gating subset of `design/measure.mjs`, the instrument panel
the level is tuned against.

## C5 — the witness route

`node src/verify-witness.mjs`

The route is **found, not designed**: `design/solve.mjs` searches the state space
`(anchor × heading × substrate phase × exposure)` — 20,062,080 states — and emits
it. The solver is an *approximation* of the mission engine (it orders the
collision and radar tests differently for speed), so it is only allowed to
propose. The claim is the flight through the real `missionStep()`:

> **LANDED at t=469, trace 0, peak exposure 7 of 8.**

Peak exposure 7 matters: a route that was never painted at all would satisfy
"lands cleanly" while proving nothing about the radar.

The landing itself is constrained. The eater absorbs an arriving glider cleanly
on only **3 of 21** approach lanes measured (`glidepaths: [-10, -4, 3]`); 12 lanes
reach the hangar and still crash-land, and 6 run off the edge. The solver is
constrained to arrive on a clean lane, or it returns routes that lose.

## C6 — falsifier — GREEN

`node src/verify-falsifier.mjs`

**The claim that decides whether this is a game or a diorama.**

Fly the *same* route from every launch phase. If the level is a phase puzzle,
most off-phase launches must die, and die specifically as `PAINTED` — because
that is what shows phase-reading defeats the **radar** rather than the terrain.
Asserting merely that off-phase runs "fail" would pass on a route that flies into
a still life at every phase alike.

Measured, at `radarRange` 40 and `LOCK` 8:

> **14 of 14 off-phase launches are shot down as PAINTED; the on-phase flight
> lands with trace 0; and the exhaustive search finds no route in the whole
> state space that stays below exposure 7.**

The gate is stronger than it was while red, not weaker. Two things were
tightened *before* the level was made to pass:

- The majority clause now asserts what its sentence says — `painted > n/2` —
  where it previously accepted `landed <= n/2`, a form satisfiable with only
  4 of 14 painted.
- A **fourth assertion** was added, because the first three quantify over the
  witness and cannot see a *different* route that lands at every phase. Such a
  route existed and was measured: a zigzag hugging the gate sensor's range
  circle, dipping into the disc for 3–4 generations and letting the dwell
  counter drain between dips — peak exposure 4, landing at all 15 phases with
  no phase-reading at all. The fourth assertion runs the same exhaustive
  search that proposed the witness and requires that it finds **no** route
  that never reaches exposure `LOCK-1`. It is solver-relative by nature (a
  non-existence claim has no flight to replay), and it is what makes "solvable
  only by reading phase" a statement about the level rather than about one
  route.

Four geometry fixes got it from 0/30 to here, all measured:

1. **The wall had to be a wall.** It spanned ~50 cells of a line whose in-bounds
   length is ~106, so the route flew round the end and the shutter was guarding
   an optional path.
2. **Tangency beats coverage.** A 72-position sweep shows the shutter placed
   squarely on the gate-to-gap sight line masking at *every* phase (15/15 land,
   peak 7..7); grazing the ray at [68,68] leaves only its extended phases
   occluding (4/14).
3. **The sensor had to sit where the route is exposed.** An exposure diagnostic
   showed every launch phase peaking at 7 or 8 of `LOCK` 8 — one dwell
   generation decides every flight — and a 507-point placement sweep moved the
   gate from (76,74) to (79,73): 14/14 on the witness.
4. **The witness was not the loophole.** Sealing the peak-4 escape took gate
   range 23 (closing the "duck" cells on the range circle) plus a second
   pentadecathlon at (66,79) across the gate-to-egress rays to re-open the
   crossing in its extended phases. The pair is a one-cell optimum: (67,79)
   measures 1/14, (66,80) measures 4/14, (66,79) measures 14/14 with the
   escape gone.

Of the hypotheses the red ledger listed as untried, the second gate sensor was
swept (2,016 configurations) and measured **dead** — every candidate collided,
broke periodicity, or sealed the map at all phases. The second *shutter* on the
existing sensor is what shipped.

## C7 — the renderer and camera are inert

`node src/verify-renderer.mjs`

C8 excludes the presentation layer from its banned-primitive scope "because
claim C7 proves they cannot influence the mission outcome, not merely because
they are awkward". This is that proof, and it is a measurement: **fly the
committed witness twice — headless, and with the full camera-pursuit,
shadow-map and draw-list path invoked every generation — and require every
generation's world to hash identically and the outcomes to match.** 469
generations, byte-identical.

Ships with a canary (a deliberately mutating renderer must be caught by the
same comparison — it is), plus two structural fences: `render3d.mjs` contains
none of C8's nondeterminism primitives (the frame clock lives in `ui.js`,
*above* the proven line), and `render3d.mjs` imports **nothing** — mission
state arrives as arguments, so the layering is visible in the import graph
rather than asserted in prose. See `ARCHITECTURE.md`.

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

## C9 — 3D Life has no glider ecology

`node src/verify-3d-rule-search.mjs`

The world stays 2D and literally Conway because this measurement said it must:
**180 seeded random soups per rule on a 24³ torus, up to 160 generations each,
produce 0 translating patterns** in Bays 5766 and in 4555 — the rule
`spike/world.html` actually implemented while calling itself Conway. Spaceship
detection is exact normalised-shape repeat plus anchor displacement, with
torus-wrap handled by empty-gap rebasing.

Two honesty notes are part of the claim. Soups are seeded from a fixed-seed
xorshift — a verification script with `Math.random` in it is a different
measurement every run, i.e. not a measurement. And the soup is a dense 10³
block at ~1/3 fill: scattered sparse seeding is vacuous for rules whose births
need 5–6 neighbours (everything dies on tick one and any rule "passes").
Bays's gliders exist — from *directed* search, which is the point: an ecology
you must construct by hand is not an ecology, and a soup-seeded 3D world has
no players. The three dimensions moved to the camera instead (C7).

## C10 — the bundle is reproducible

`src/build.mjs`, gated by `just test` and CI.

The shipped `f117a-stealth-glider.html` is a mechanical concatenation of
`kernel/engine.mjs + radar.mjs + mission.mjs + level.mjs + render3d.mjs +
ui.js` — imports stripped, exports unwrapped, CSS inlined — into one
self-contained file that runs offline from a `file://` URL. Every build runs
two checks: `node --check` on the exact script text that ships, and a smoke
flight of the committed witness through the **transformed** core (must LAND,
trace 0, never locked) — so the strip/concat transform sits inside the
verified perimeter rather than being trusted. `just test` and CI then require
the committed bundle to be **byte-identical** to a fresh rebuild: the shipped
file is an artefact of the audited sources, not a sibling of them.

## C11 — the substrate is periodic from generation 0

`transient = 0`, `period = 15` (the declared value), population `210..294`.

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
