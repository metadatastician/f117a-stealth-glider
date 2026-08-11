<div align="center">

# F117A Stealth Glider

### *Cover moves.*

**Operation Nightglass** — a stealth puzzle on a live Conway's Game of Life field,
where what hides you is a cell standing between you and the radar.

**[▶ Play it](https://metadatastician.github.io/f117a-stealth-glider/)** —
one self-contained file, no dependencies, runs offline.

</div>

---

## What this is

Sibling to [`f19-stealth-glider`](https://github.com/metadatastician/f19-stealth-glider),
and modelled on **MicroProse F-117A Nighthawk 2.0** — the 3D successor to F-19
Stealth Fighter.

You fly a **glider**: five live cells of B3/S23, obeying the same two rules as
everything else on the map. f19 asked you to cross a hostile automaton without
*disturbing* it. This one adds the thing the real F-117A was actually built
around — **radar, and terrain masking**.

Sensors sweep the field. Live cells block line of sight. And because the terrain
is a cellular automaton rather than scenery, **your cover is on a timer**: the
oscillators breathe, sight lines open and close, and staying hidden means reading
the automaton's phase.

Two independent ways to lose:

- **TRACE** — any divergence you cause against a counterfactual shadow world.
  Inherited from f19, unchanged.
- **PAINTED** — sustained radar exposure. Exposure rises one per painted
  generation and decays one per clean one; reach the lock threshold and you are
  down. A flicker of exposure is ordinary play. Dwelling in the open is not.

A trace-0 flight down an exposed corridor is still a dead flight.

## Status: playable, and every claim gates

Of thirteen ledger claims, **all thirteen are green — including C6, the falsifier
for the whole premise**, which was red from this repository's creation until
the level geometry earned it. The game exists: a chase-camera 3D view over the
same 2D Conway world (TAB for the tactical map), an exposure HUD, and one
self-contained `f117a-stealth-glider.html` you can open from disk — built by
`just build`, proven byte-reproducible at every CI run (C10), with the whole
presentation layer proven unable to touch the mission (C7).

> **C6.** Fly the same route from every launch phase. **14 of 14 off-phase
> launches are shot down as PAINTED**, the on-phase flight lands with trace 0,
> and the exhaustive search finds **no route in the whole state space that
> stays below exposure 7**. The level is solvable only by reading phase.
>
> **C13.** And yet **all 15 launch beats are playable** — solving from each one
> and flying the result through the real engine gives 15/15 landed, trace 0, in
> 21/22/23/25 turns. A *canned* route dies off-phase; a *steered* one never has
> to. Reading the automaton is mandatory **and always sufficient**.

The gate got *stronger* before the level passed it. The majority assertion was
tightened to say what its sentence says (`painted > n/2`; the old form accepted
half the launches landing). And C6 gained a fourth assertion, because the
witness-scoped ones could not see a hole that measurement found: a zigzag route
hugging the gate sensor's range circle, dipping in for 3–4 generations and
letting the exposure counter drain between dips — peak exposure 4, landing at
every phase with no phase-reading at all. Every flyable route now grazes one
generation from LOCK; the only freedom left is *when*, and that is the game.

What closed it, each step measured (full history in the ledger): the wall had
to *be* a wall (0/30 → the chokepoint); shutter **tangency** beats coverage
(4/14 — squarely on the ray masks at every phase, grazing occludes only in
extended phases); the gate sensor moved three cells to where the route is
actually exposed (14/14 on the witness); and a **second pentadecathlon** at
(66,79) plus gate range 23 sealed the peak-4 escape — a one-cell optimum whose
neighbours measure 1/14 and 4/14.

C6 now gates the build with the rest of the ledger — and the once-reserved
claim numbers landed with the game layer: C4 pins the corridor's phase-shaped
danger, C7 proves the renderer a spectator, C9 lands the 3D-rule-search that
ruled the world stays 2D, C10 makes the shipped bundle an artefact of the
audited sources. See [`VERIFICATION.md`](./VERIFICATION.md),
[`AUDIT.adoc`](./AUDIT.adoc) and [`ARCHITECTURE.md`](./ARCHITECTURE.md).

## Run it

```bash
just play        # open the game (or just open f117a-stealth-glider.html)
just build       # rebuild the single-file bundle from src/ (C10)
just verify      # the gating ledger — the fast set
just beats       # C13 — every launch beat is playable (~80s)
just test        # ledger + bundle byte-reproducibility
just falsifier   # C6 on its own — the loop to re-run while tuning geometry
just measure     # the level's instrument panel
just solve       # search for a witness route
just sweep       # scalar sweep: range x LOCK
just place       # PLACEMENT sweep: chokepoint, shutter and sensor positions
just period      # every oscillator's period, measured in isolation
just contracts   # the contractile probes
just ci          # everything CI gates on
```

Controls: **←↑↓→ / WASD** steer (turns latch on beat 1) · **ENTER** launch ·
**TAB** chase camera / tactical map · **SPACE** hold · **1/2/3** speed ·
**H** the in-game honesty ledger.

Node ≥ 18. No dependencies — there is nothing to install. Without `just`, every
script runs directly: `cd src && node verify-los.mjs`.

## Design, and what measurement changed

Nearly every decision here was made by a measurement that contradicted a
reasonable-sounding assumption.

- **The world stays 2D and literally Conway.** The obvious move was a 3D
  automaton, so the player could be a genuine 3D spaceship. But 3D Life has no
  glider *ecology*: 180 random soups per rule on a 24³ torus, 160 generations,
  produced **0 translating patterns** in Bays 5766 and 0 in rule 4555. Carter
  Bays' glider exists, but it was found by directed search and is rare and
  fragile. 2D B3/S23 throws gliders out of almost any soup. **The three
  dimensions move to the camera instead.**

- **No Gosper gun.** f19's field takes **347 generations** to become periodic —
  the gun must fill the whole stream to the absorber first. Until then
  "substrate phase" does not exist, and the mission starts at t=0. Oscillators
  are periodic from the first tick, so the transient is 0 by construction.

- **f19's level could not carry the mechanic.** LOS over its terrain: of 528
  cells ever painted, **521 were painted at every generation**. Seven were
  phase-dependent. A radar layer over that would have been decoration.

- **A radar occludes itself** unless its own footprint is exempt — 3 of 1025
  points painted before that was found.

- **Bresenham leaks.** 1009 of 4489 rays passed through a solid diagonal wall.
  Hence supercover.

The v0 3D prototype is preserved verbatim in [`spike/`](./spike/) with its seven
measured defects recorded rather than fixed in place — including that its
`Conway3D` class does not implement Conway, and that its `seedGlider()` seeds no
glider.

## Documentation

| Document | What it answers |
|---|---|
| [`VERIFICATION.md`](./VERIFICATION.md) | The ledger. Every claim cites a script you can run. **Start here.** |
| [`AUDIT.adoc`](./AUDIT.adoc) | What is verified, what is argued, and what is **not** claimed. |
| [`ARCHITECTURE.md`](./ARCHITECTURE.md) | The layers, and why the world is 2D while the camera is 3D. |
| [`KERNEL-DIVERGENCE.md`](./KERNEL-DIVERGENCE.md) | Exactly how this reuses f19's kernel, and how that is enforced. |
| [`spike/README.md`](./spike/README.md) | The 3D prototype, and its seven defects with line cites. |

## Licence

[AGPL-3.0-or-later](./LICENSE) for code; `MPL-2.0` for the `.a2ml` metadata;
`CC-BY-SA-4.0` for documentation. Texts vendored under [`LICENSES/`](./LICENSES).
© 2026 Jonathan D.A. Jewell (hyperpolymath).

Contributions under the Developer Certificate of Origin 1.1 — sign off with
`git commit -s`.
