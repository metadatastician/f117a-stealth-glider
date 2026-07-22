<!--
SPDX-License-Identifier: CC-BY-SA-4.0
Copyright (c) 2026 Jonathan D.A. Jewell (hyperpolymath)
-->

# `spike/` — the v0 provenance, landed verbatim

These two files are **not built, not linted, not shipped, and not fixed in place.** They are the
prior art this repository grew out of, recorded so the design decisions in
[`../VERIFICATION.md`](../VERIFICATION.md) can be read against what actually existed beforehand.

Nothing under `spike/` is imported by `src/`. Changing a file here changes nothing about the game.

| File | Origin | SHA-256 |
|---|---|---|
| `world.html` | `developer/world.html`, mtime 2026-07-21 19:58 BST | `a7689fe15d8a0095…2c93ba1a` |
| `simulation.html` | `developer/simulation.js`, mtime 2026-07-21 19:22 BST | `9756d73f4e025991…0eb7fd1d9` |

`simulation.html` is byte-identical to the file that was on disk as `simulation.js`. **It was
always HTML** — a full `<!DOCTYPE html>` document — and the `.js` extension was simply wrong. It
is renamed here and otherwise untouched.

## Lineage

```
simulation.js  ──►  world.html  ──►  (this repository)
2-DOF flight        6-DOF flight         2D B3/S23 substrate
model, cleanly      + 3D voxel CA        + 3D renderer
decomposed          + 3D renderer        + radar LOS
```

`world.html` **regressed** the flight model it inherited. `simulation.js` had a real
`PIDController` (proportional, integral *and* derivative) and an `ElevonMixer` that resolved
pitch and roll into left/right elevon deflections. `world.html` flattened both away: its
autopilot is a bare proportional term (`(targetPitch - theta) * 2.0`), and the mixer is gone.
Where this repository needs a flight model — for the **camera only**, see
[`../ARCHITECTURE.md`](../ARCHITECTURE.md) — it takes it from `simulation.html`, the
un-regressed one.

## Why `world.html` was not simply adopted

It is a spike doing a spike's job, and it succeeded at that job: it established that a 3D
perspective renderer over a live cellular automaton looks right. But it is not a foundation.
Seven defects, all measured, with line cites into the file as landed:

1. **It is not Conway's Game of Life.** The class is named `Conway3D` (L23) but the rule
   implemented at L50–L70 (declared in the comment at L51) is 3D **4555** — survive on 4 or 5, born on 5. Conway is B3/S23 and is
   two-dimensional. The name and the rule disagree.

2. **`seedGlider()` seeds no glider** (L40–L48). It writes 150 cells at `Math.random()`
   positions. There is no glider, and nothing in the file ever constructs one.

3. **It is non-deterministic, twice over.** The seed is random (L43–L45) and the turbulence
   response is random (L126–L127). Two runs of the same input differ. This is the disqualifying
   defect: a verification ledger cannot exist over a non-reproducible simulation, and the whole
   premise inherited from f19-stealth-glider — that the substrate is *phase-readable*, therefore
   *learnable*, therefore *fair* — requires determinism to even be stated.

4. **Collision and rendering disagree about which axis is up.** `project()` (L176–L196) treats
   its second argument as the vertical screen axis, and cells are drawn as
   `project(wx, wy, wz, …)` at L275 — so the CA's **y** index renders as altitude. But
   `checkCollision(glider.state.x, glider.state.y, glider.state.z)` at L233 passes the aircraft's
   **horizontal** `y` into that same slot, while `state.z` is altitude everywhere in the physics
   (L163, L319). The obstacle you see and the obstacle you hit are in different places.

5. **Collision silently disables outside the positive octant** (L79–L87). `Math.floor(x_m / 20)
   % 30` is *negative* for negative `x_m`, because JavaScript's `%` is remainder, not modulo.
   The `gx >= 0` guard then returns `false` — reported as "no obstacle". Fly to negative world
   coordinates and collision detection quietly stops existing. No error, no warning.

6. **There is no player.** `targetPitch` and `targetRoll` (L217–L218) are constants, and the
   file contains no keyboard, pointer or gamepad handler of any kind. It is an autopilot flying
   a fixed bank, i.e. a demo.

7. **Renderer defects.** `v_earth_z` is computed at L159 and never read — altitude comes solely
   from `state.z -= w*dt` at L163. Vertex 1 (`Top canopy`) is declared at L201 and never drawn:
   the fill path at L309–L313 uses indices 0, 2, 4, 3 only. And the aircraft **vanishes entirely**
   if any single vertex clips behind the camera, because `project()` returns `null` (L188) and the
   draw is gated on `projectedVerts.length === 5` (L305).

Defects 4, 5 and 7 are ordinary bugs and are simply fixed in `src/render3d.mjs`. Defects 1, 2
and 3 are not bugs — they are the architecture, and they are the reason this repository keeps the
substrate two-dimensional and deterministic.

## The measurement that settled the dimensionality

Defect 1 raises an obvious question: rather than going back to 2D, why not keep the volumetric
world and pick a 3D rule that *does* support a glider, so the player could be a genuine 3D
spaceship?

Because the gliders are not there to be found. 3D Life has no glider **ecology**. This was
measured, not assumed — see ledger claim **C9**, `src/verify-3d-rule-search.mjs`, which is the
planning probe landed as a permanent test:

> 180 random soups per rule on a 24³ torus, 160 generations each, detecting spaceships by exact
> normalised-shape repeat plus centroid displacement.
> **Bays 5766 (S5,6/B6,7): 0 translating patterns. 4555 (the rule `world.html` uses): 0.**

Carter Bays' 5766 glider does exist in the literature, but it was found by directed search and is
rare and fragile. 2D B3/S23 throws gliders out of almost any soup — which is precisely why
f19-stealth-glider could build a game on them, with eaters, guns, streams and a whole vocabulary
of interactions. In 3D there is no such vocabulary, and a coupled design would rest on
reproducing one delicate hand-found pattern with no ecology around it.

So the world stays 2D and literally Conway. **The three dimensions move to the camera**, which is
what the 3D form was always contributing anyway.
