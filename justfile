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
    for v in verify-kernel-parity verify-los verify-level verify-determinism verify-witness verify-falsifier; do
        echo "== node $v.mjs =="
        node "$v.mjs"
    done

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
ci: verify contracts
    @echo "OK: gating ledger (incl. C6) and contractiles green"
