<!-- SPDX-License-Identifier: CC-BY-SA-4.0 -->
<!-- Copyright (c) 2026 Jonathan D.A. Jewell <j.d.a.jewell@open.ac.uk> -->

# Contributing to F117A Stealth Glider

Thank you for considering a contribution. This document is short, because the
project is small — but please read the section on **design invariants**, because
this project can be broken in a way that leaves every test green.

## Getting set up

There is nothing to install.

```bash
git clone https://github.com/metadatastician/f117a-stealth-glider
cd f117a-stealth-glider

just              # list every recipe
just test         # the full gate: ledger + rebuild + reproducibility diff
just contracts    # run the contractile probes
```

You need **Node ≥ 18** and, optionally, [`just`](https://github.com/casey/just).
Without `just`, every script runs directly:

```bash
cd src && node verify8.mjs
```

Toolchain versions are pinned in `mise.toml` if you use
[mise](https://mise.jdx.dev): `mise trust && mise install`.

To play, open `f117a-stealth-glider.html` in a browser. No server needed.

## The one thing to understand first

This project makes a falsifiable claim: **the cellular automaton is a genuine
antagonist, not scenery.** The level is meant to be unsolvable by feel and
solvable only by reading the automaton's phase and geometry.

That claim is easy to destroy with a change that looks like an improvement.
Widening the contact rule, nudging a lane offset, or adding a forgiving
"near-miss" window each make the game feel better and each quietly remove the
reason the game exists. So:

> **If a route fails verification, redesign the crossing or record the negative
> result. Do not tune the rule until the test passes.**

The invariants that carry this are listed in
[GOVERNANCE.adoc](GOVERNANCE.adoc#invariants) and enforced as CI probes in
[`Mustfile.a2ml`](.machine_readable/contractiles/must/Mustfile.a2ml). Changing
one requires a decision record in
[`META.a2ml`](.machine_readable/descriptiles/META.a2ml).

## Evidence, not assertion

**A claim without a runnable script is not a result.**

Every row in [VERIFICATION.md](VERIFICATION.md) cites a script that runs with
plain `node`. Accordingly:

- Adding a claim means adding the script that discharges it.
- Changing behaviour means re-running the affected scripts **and pasting the
  output into the pull request** — not asserting that they would pass.
- Claims are quantified over **all 30 launch phases**, never sampled. A result
  from one phase is an anecdote.

If a script crashes, that is a **harness bug**, not a finding — fix the harness.
If a script runs to completion and reports "no viable candidate", that **is** a
finding; record it. `verify4`, `5`, `6`, `7` and `10` are exactly this: design
searches that found nothing, kept in the tree so the ruled-out space stays
visible. Please don't delete them.

One cautionary tale, because it shaped the codebase: `stamp()` once absorbed
out-of-bounds writes silently, and a sweep consequently reported a second clean
landing lane that did not exist. The claim survived review because the harness
was *lying* rather than *failing*. `stamp()` now throws. If your sweep needs
negative coordinates, enlarge the grid and co-shift the whole configuration —
Life is translation-invariant away from borders, so the measured *relative* lane
is preserved.

## Making a change

1. Open an issue first for anything beyond a typo or an obvious bug.
2. Branch from `main`.
3. Match the surrounding style. There is no linter and no formatter — the code
   is compact, comments explain *why* rather than *what*, and that is the
   standard to match.
4. Keep the first line of every `src/*.mjs` and `src/*.js` exactly:
   `// SPDX-License-Identifier: AGPL-3.0-or-later`. CI checks this.
5. If you touched `src/`, run `just build` and commit the regenerated
   `f117a-stealth-glider.html`. CI compares it byte-for-byte.
6. Run `just test` **and** `just contracts`. Both must be green.
7. Sign off your commits: `git commit -s` (DCO 1.1).

## Pull requests

Fill in the pull request template. It asks which ledger claims your change
affects and for the output of the scripts you ran — that is the part reviewers
actually need.

CI runs the cited ledger, the licence-header check, the contractile probes, and
the bundle-reproducibility diff. All must pass.

## Adding dependencies

Please don't. Zero dependencies is a design property, and there is a CI probe
that fails the build if `dependencies` or `devDependencies` appears in
`package.json`. If you have a case that genuinely needs one, open an issue
proposing a decision record that supersedes `D-08`.

## Code of Conduct

By participating you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).

## Licensing

Contributions are accepted under the **Developer Certificate of Origin 1.1**
(`git commit -s`) and licensed `AGPL-3.0-or-later` for code, `MPL-2.0` for
`.a2ml` metadata, `CC-BY-SA-4.0` for documentation.
