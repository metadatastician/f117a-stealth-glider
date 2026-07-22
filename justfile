# F117A Stealth Glider — task runner
# SPDX-License-Identifier: AGPL-3.0-or-later
#
# Node >= 18 is the only requirement. There is nothing to install.

default:
    @just --list

# Run the cited verification ledger (fails on any red).
verify:
    #!/usr/bin/env bash
    set -euo pipefail
    cd src
    for v in verify1 verify2 verify3 verify8 verify9; do
        echo "== node $v.mjs =="
        node "$v.mjs"
    done

# Rebuild the self-contained playable HTML at the repo root.
build:
    #!/usr/bin/env bash
    set -euo pipefail
    cd src
    node build.mjs
    mv -f f117a-stealth-glider.html ../f117a-stealth-glider.html
    echo "built ../f117a-stealth-glider.html"

# Execute the contractile probes (Must/Trust/Bust/Dust/Intend/Adjust).
# Unlike most of the estate these are real: every `- run:` is a shell one-liner
# and this runs them. Exits non-zero on any critical breach.
contracts:
    node scripts/contractiles.mjs

# Also run the Bustfile recovery drills (slow — re-runs the ledger).
contracts-drills:
    node scripts/contractiles.mjs --drills

# Same, but warnings are gating too.
contracts-strict:
    node scripts/contractiles.mjs --strict

# Print every probe without running it.
contracts-list:
    node scripts/contractiles.mjs --list

# Full check: ledger + rebuild + reproducibility diff.
test: verify build
    #!/usr/bin/env bash
    set -euo pipefail
    cd src && node build.mjs
    if diff -q f117a-stealth-glider.html ../f117a-stealth-glider.html; then
        echo "OK: bundle reproducible, ledger green"
    else
        echo "STALE: run 'just build' and commit"; exit 1
    fi
    rm -f f117a-stealth-glider.html

# Everything CI runs, in one command.
ci: test contracts
    @echo "OK: ledger, bundle and contractiles all green"

# Run every script, including the exploratory (non-ledger) ones.
verify-all:
    #!/usr/bin/env bash
    cd src
    for v in verify1 verify2 verify3 verify4 verify5 verify6 verify7 verify8 verify9 verify10; do
        echo "== node $v.mjs =="; node "$v.mjs" || echo "[exit $? — exploratory, not a ledger claim]"
    done

# Open the game in the default browser.
play:
    #!/usr/bin/env bash
    set -euo pipefail
    f="$(pwd)/f117a-stealth-glider.html"
    test -f "$f" || { echo "missing bundle — run 'just build'"; exit 1; }
    if command -v xdg-open >/dev/null; then xdg-open "$f"
    elif command -v open >/dev/null; then open "$f"
    else echo "open this file in a browser: $f"; fi
