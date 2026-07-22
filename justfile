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
    for v in verify-kernel-parity verify-los verify-level verify-determinism verify-witness; do
        echo "== node $v.mjs =="
        node "$v.mjs"
    done

# C6, the falsifier for the whole premise. CURRENTLY RED, deliberately.
# Not part of `verify` while it is known-red — see AUDIT.adoc. It is run and
# reported by CI so it cannot quietly rot.
falsifier:
    @cd src && node verify-falsifier.mjs || true

# Same, but red is fatal. Use this when working ON the falsifier.
falsifier-strict:
    cd src && node verify-falsifier.mjs

# The level's instrument panel: periodicity, exposure, cover.
measure:
    node design/measure.mjs

# Search the state space for a witness route.
solve:
    node design/solve.mjs

# Find the solvable / phase-critical parameter band.
sweep:
    node design/sweep.mjs

# Execute the contractile probes.
contracts:
    node scripts/contractiles.mjs

# Print every probe without running it.
contracts-list:
    node scripts/contractiles.mjs --list

# Everything CI gates on.
ci: verify contracts
    @echo "OK: gating ledger and contractiles green"
    @echo "NOTE: C6 (falsifier) is known-red — run 'just falsifier'"
