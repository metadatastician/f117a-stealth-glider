<!--
SPDX-License-Identifier: CC-BY-SA-4.0
Copyright (c) 2026 Jonathan D.A. Jewell (hyperpolymath)
-->

# Why there is no `codeql.yml`

Code scanning on this repository runs through **GitHub code-scanning default
setup**, which is already enabled:

```console
$ gh api repos/metadatastician/f117a-stealth-glider/code-scanning/default-setup
state=configured
```

An *advanced* `codeql.yml` conflicts with default setup and fails permanently.
One was added by an estate sweep on 2026-07-26 and did exactly that — every run
on `main` was red from the moment it landed.

It failed for a second, independent reason worth recording: the follow-up commit
"fix: update CodeQL actions to SHA-pinned v3 (29b1f65c)" pinned to a SHA that
**does not exist**:

```console
$ gh api repos/github/codeql-action/commits/29b1f65c1f735799893313399435a59f54045865
No commit found for SHA (HTTP 422)
```

SHA-pinning is the correct posture — the org enforces it — but a pin is only
worth anything if the object it names exists. Verify the SHA resolves before
committing it; an unresolvable pin produces `Unable to resolve action`, which
reads as an infrastructure blip rather than as the config error it is.

**Before adding an advanced CodeQL workflow here, check `default-setup` first.**
If you genuinely need one, disable default setup in the same change.
