# F117A Stealth Glider — task runner
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# Node >= 18 is the only requirement. There is nothing to install.

default:
    @just --list

# The gating verification ledger. Fails on any red.
verify:
    #!/usr/bin/env bash
    set -euo pipefail
    cd src
    for v in verify-kernel-parity verify-los verify-level verify-corridor verify-determinism verify-witness verify-falsifier verify-renderer verify-3d-rule-search; do
        echo "== node $v.mjs =="
        node "$v.mjs"
    done

# Build the shipped single-file bundle (C10). build.mjs syntax-checks the
# exact shipped script and replays the witness on the transformed core.
build:
    cd src && node build.mjs && mv -f f117a-stealth-glider.html ../

# The full gate: ledger, then prove the committed bundle is byte-identical
# to a fresh rebuild. A stale bundle is a shipped artefact nobody verified.
# (Compared with cmp against the root copy, not via git — git diff is silent
# about untracked files, which is exactly the case that must fail.)
test: verify
    #!/usr/bin/env bash
    set -euo pipefail
    (cd src && node build.mjs >/dev/null)
    if cmp -s src/f117a-stealth-glider.html f117a-stealth-glider.html; then
        rm -f src/f117a-stealth-glider.html
        echo "OK: bundle reproducible, ledger green"
    else
        rm -f src/f117a-stealth-glider.html
        echo "STALE: committed f117a-stealth-glider.html differs from a fresh rebuild — run 'just build' and commit"; exit 1
    fi

# Open the game.
play:
    xdg-open f117a-stealth-glider.html 2>/dev/null || open f117a-stealth-glider.html

# C6, the falsifier for the whole premise, on its own. GREEN, and part of
# `verify` — kept as a separate recipe because it is the one to re-run in a
# loop while tuning level geometry.
falsifier:
    cd src && node verify-falsifier.mjs

# The level's instrument panel: periodicity, exposure, cover.
measure:
    node design/measure.mjs

# Search the state space for a witness route.
solve:
    node design/solve.mjs

# Scalar sweep: radar range x LOCK.
sweep:
    node design/sweep.mjs

# PLACEMENT sweep: chokepoint, shutter and sensor POSITIONS. This is the one
# that moved C6 - scalar tuning cannot fix a geometry problem.
place:
    node design/place.mjs

# Execute the contractile probes.
contracts:
    node scripts/contractiles.mjs

# Print every probe without running it.
contracts-list:
    node scripts/contractiles.mjs --list

# Everything CI gates on.
ci: test contracts
    @echo "OK: gating ledger, bundle reproducibility and contractiles green"
