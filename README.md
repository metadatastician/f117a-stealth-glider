<div align="center">

# F117A Stealth Glider

### *Cover moves.*

**Operation Nightglass** — a stealth puzzle on a live Conway's Game of Life field,
where what hides you is a cell standing between you and the radar.

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

## Status: mechanic proven, level not finished

This is honest rather than modest. Of eight ledger claims, **seven are green and
one is red — and the red one is the falsifier for the whole premise.**

> **C6.** Fly the same route from every launch phase. **4 of 14 off-phase
> launches are shot down as PAINTED**, and peak exposure varies 7..8 across
> phases. Two of C6's three assertions pass: the failures are dominated by
> radar rather than terrain. The third still fails — a *majority* must die, and
> 4/14 is not a majority.

So the radar is no longer decoration, but the level is not yet a phase puzzle
either. Getting here took replacing the flanking shutter banks with a
**chokepoint**: a wall across the corridor with a single gap, watched by a
short-range gate sensor, with a p15 pentadecathlon shuttering the sight line to
that gap. Cover beside a route you need not take is scenery; cover over the only
way through is a puzzle. The earlier design had 0/30 phases fail with peak
exposure constant at 7 — the route ignored the shutters entirely.

Two measurements pin what is left to do. First, the wall had to *be* a wall: it
originally spanned ~50 cells of a line whose in-bounds length is ~106, so the
route simply flew round the end and the shutter was guarding an optional path.
Second, shutter **tangency** matters more than shutter presence — a 72-position
sweep shows a pentadecathlon squarely on the sight line masking the gap at
*every* phase (15/15 land, peak flat at 7..7), while the same oscillator moved
to graze the ray occludes only on its extended phases (4/15 shot down, peak
7..8). Grazing beats covering; it is simply not yet decisive enough.

It is reported, not hidden, and it does not gate the build while it is known-red.
See [`VERIFICATION.md`](./VERIFICATION.md) and [`AUDIT.adoc`](./AUDIT.adoc).

## Run it

```bash
just verify      # the gating ledger (C1,C2,C3,C5,C8,C11,C12)
just falsifier   # C6 — currently RED, deliberately
just measure     # the level's instrument panel
just solve       # search for a witness route
just sweep       # scalar sweep: range x LOCK
just place       # PLACEMENT sweep: chokepoint, shutter and sensor positions
```

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
| [`KERNEL-DIVERGENCE.md`](./KERNEL-DIVERGENCE.md) | Exactly how this reuses f19's kernel, and how that is enforced. |
| [`spike/README.md`](./spike/README.md) | The 3D prototype, and its seven defects with line cites. |

## Licence

[AGPL-3.0-or-later](./LICENSE) for code; `MPL-2.0` for the `.a2ml` metadata;
`CC-BY-SA-4.0` for documentation. Texts vendored under [`LICENSES/`](./LICENSES).
© 2026 Jonathan D.A. Jewell (hyperpolymath).

Contributions under the Developer Certificate of Origin 1.1 — sign off with
`git commit -s`.
