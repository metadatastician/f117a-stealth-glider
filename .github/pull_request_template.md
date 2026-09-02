<!-- SPDX-License-Identifier: CC-BY-SA-4.0 -->

## What this changes

<!-- One or two sentences. What is different after this PR? -->

## Why

<!-- Link the issue if there is one. If this changes gameplay or geometry, say
     what problem it solves — and why the fix is in the right layer. -->

---

## Verification

**Which ledger claims does this affect?**

<!-- List them by number from VERIFICATION.md, or write "none" if this is docs,
     CI, or tooling only. -->

**Paste the output of the scripts you ran.** A claim without a run is not a
result — asserting that a script "would pass" is not sufficient.

<details>
<summary><code>just test</code></summary>

```
(paste output here)
```

</details>

<details>
<summary><code>just contracts</code></summary>

```
(paste output here)
```

</details>

---

## Checklist

- [ ] `just test` is green — ledger, rebuild, and bundle-reproducibility diff.
- [ ] `just contracts` is green — no `critical` breach.
- [ ] If I touched `src/`, I ran `just build` and committed the regenerated
      `f117a-stealth-glider.html`.
- [ ] Every new or changed `src/*.mjs` / `src/*.js` still has
      `// SPDX-License-Identifier: AGPL-3.0-or-later` as its **first** line.
- [ ] I added no dependencies (`package.json` has no `dependencies` /
      `devDependencies`).
- [ ] Commits are signed off — `git commit -s` (DCO 1.1).
- [ ] Any new GitHub Action `uses:` is pinned to a full commit SHA, with a
      trailing version comment.

## Design invariants

Tick only if applicable — and if you tick either box, say where the decision
record is.

- [ ] **This PR changes a design invariant** (the B3/S23 substrate,
      `src/level.mjs` geometry, the contact rule in `src/mission.mjs`, or
      `stamp()`'s out-of-bounds behaviour).
      Decision record: `D-__` in `machine-readable/descriptiles/META.a2ml`

- [ ] **This PR re-opens a question recorded as settled** in
      `machine-readable/descriptiles/STATE.a2ml` `[settled-questions]`
      (for example, the stream no-go lemma).
      New evidence:

<!--
A reminder rather than a hurdle. The project's premise is that the automaton is
a genuine antagonist rather than atmosphere, and the fastest way to destroy that
is a reasonable-looking change that makes the game feel better while removing
the reason it exists.

If a route fails verification: redesign the crossing, or record the negative
result. Do not tune the rule until the test passes.
-->
