// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jonathan D.A. Jewell (hyperpolymath) <j.d.a.jewell@open.ac.uk>
//
// contractiles.mjs — execute the contractile probes in .machine_readable/contractiles/.
//
// Why this exists: across the estate, contractiles are declarative documents whose
// paired Nickel runners (x.ncl / x.k9.ncl) were never built, so every `- run:` line
// is an assertion nobody ever evaluates. That is the same false-green pattern the
// contractiles are supposed to catch. Every probe in this repo is a plain shell
// one-liner, so running them is a twenty-line problem — this is those twenty lines.
//
// Usage:
//   node scripts/contractiles.mjs            # gate on critical failures
//   node scripts/contractiles.mjs --strict   # gate on warnings too
//   node scripts/contractiles.mjs --drills   # also run the Bustfile recovery drills
//   node scripts/contractiles.mjs --list     # print the probes without running them
//
// Bustfile `recovery_probe`s are excluded by default: they re-run the full
// verification ledger, which takes about three minutes, and the Bustfile itself
// describes them as drills rather than day-to-day gates. CI runs them in the
// ledger job already, so running them here as well would only double the wait.
//
// Exit codes: 0 = clean, 1 = a gating probe failed, 2 = the runner itself is broken.

import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// `import.meta.dirname` only landed in Node 20.11; package.json declares >= 18.
const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const CONTRACTILES = join(ROOT, '.machine_readable', 'contractiles');

const STRICT = process.argv.includes('--strict');
const LIST_ONLY = process.argv.includes('--list');
const DRILLS = process.argv.includes('--drills');

// `- run:` is a gate at its declared severity. `- probe:` (intend) and
// `- recovery_probe:` (bust) are informational: they are executed and reported,
// but a red one is a prompt to look, not a build failure.
//
// `drillOnly` probes are skipped unless --drills is passed; see the header note.
const PROBE_KEYS = {
  run: { gating: true, defaultSeverity: 'warning', drillOnly: false },
  probe: { gating: false, defaultSeverity: 'info', drillOnly: false },
  recovery_probe: { gating: false, defaultSeverity: 'info', drillOnly: true },
};

const COLOUR = process.stdout.isTTY && !process.env.NO_COLOR;
const c = (code, s) => (COLOUR ? `[${code}m${s}[0m` : s);
const red = (s) => c('31', s);
const green = (s) => c('32', s);
const yellow = (s) => c('33', s);
const dim = (s) => c('2', s);
const bold = (s) => c('1', s);

/** Recursively collect every .a2ml file under a directory. */
function findA2ml(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) out.push(...findA2ml(p));
    else if (entry.endsWith('.a2ml')) out.push(p);
  }
  return out.sort();
}

/**
 * Unquote an A2ML scalar. Probes containing shell metacharacters are wrapped in
 * double quotes and internally escape `"` and `\`; bare probes are taken as-is.
 */
function unquote(raw) {
  const v = raw.trim();
  if (v.length >= 2 && v.startsWith('"') && v.endsWith('"')) {
    return v.slice(1, -1).replace(/\\(["\\])/g, '$1');
  }
  return v;
}

/**
 * Parse a contractile file into checks.
 *
 * The format is heading-delimited: `### name` (or `####`) opens a check, and
 * `- key: value` lines populate it. Text inside an `@abstract: ... @end` block is
 * prose and is skipped, as are `##` section headings.
 */
function parseChecks(file) {
  const checks = [];
  let current = null;
  let inAbstract = false;

  for (const line of readFileSync(file, 'utf8').split('\n')) {
    if (/^@abstract:/.test(line)) { inAbstract = true; continue; }
    if (inAbstract) { if (/^@end\s*$/.test(line)) inAbstract = false; continue; }

    const heading = line.match(/^#{3,4}\s+(\S.*?)\s*$/);
    if (heading) {
      current = { name: heading[1], file, severity: null, description: null, probes: [] };
      checks.push(current);
      continue;
    }
    if (!current) continue;

    const field = line.match(/^-\s+([a-z_]+):\s*(.*)$/);
    if (!field) continue;
    const [, key, rawValue] = field;

    if (key === 'severity') current.severity = rawValue.trim();
    else if (key === 'description') current.description = rawValue.trim();
    else if (PROBE_KEYS[key]) {
      const command = unquote(rawValue);
      // `injection_probe: "true"` and friends carry no signal; skip trivial probes.
      if (command && command !== 'true') current.probes.push({ key, command });
    }
  }

  return checks.filter((ch) => ch.probes.length > 0);
}

/** Run one probe from the repository root. Returns null on success, else stderr. */
function runProbe(command) {
  try {
    execFileSync('bash', ['-c', command], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
    return null;
  } catch (err) {
    const stderr = (err.stderr?.toString() ?? '').trim();
    return stderr || `exited ${err.status ?? '?'}`;
  }
}

function main() {
  let files;
  try {
    files = findA2ml(CONTRACTILES);
  } catch {
    console.error(red(`contractiles: cannot read ${relative(ROOT, CONTRACTILES)}`));
    process.exit(2);
  }

  const failures = [];
  let ran = 0;
  let skippedDeclarative = 0;
  let skippedDrills = 0;

  for (const file of files) {
    const rel = relative(ROOT, file);
    const checks = parseChecks(file);
    if (checks.length === 0) { skippedDeclarative++; continue; }

    console.log(`\n${bold(rel)}`);
    for (const check of checks) {
      for (const { key, command } of check.probes) {
        const meta = PROBE_KEYS[key];
        if (meta.drillOnly && !DRILLS && !LIST_ONLY) { skippedDrills++; continue; }
        const severity = check.severity ?? meta.defaultSeverity;
        const gating = meta.gating && (severity === 'critical' || (STRICT && severity === 'warning'));

        if (LIST_ONLY) {
          console.log(`  ${dim('·')} ${check.name} ${dim(`[${severity}]`)}\n      ${dim(command)}`);
          continue;
        }

        ran++;
        const error = runProbe(command);
        if (!error) {
          console.log(`  ${green('PASS')} ${check.name} ${dim(`[${severity}]`)}`);
        } else {
          const label = gating ? red('FAIL') : yellow('WARN');
          console.log(`  ${label} ${check.name} ${dim(`[${severity}${gating ? ', gating' : ''}]`)}`);
          if (check.description) console.log(`       ${dim(check.description)}`);
          console.log(`       ${dim(`$ ${command}`)}`);
          if (error) console.log(`       ${dim(error.split('\n')[0])}`);
          if (gating) failures.push(`${rel}: ${check.name}`);
        }
      }
    }
  }

  if (LIST_ONLY) return;

  console.log();
  if (skippedDeclarative > 0) {
    console.log(dim(`${skippedDeclarative} file(s) are declarative (no executable probes) — not a failure.`));
  }
  // Announce the skip rather than letting it read as coverage.
  if (skippedDrills > 0) {
    console.log(dim(`${skippedDrills} Bustfile recovery drill(s) skipped — re-run with --drills (slow: re-runs the ledger).`));
  }
  if (failures.length === 0) {
    console.log(green(`contractiles: ${ran} probes ran, no gating failures${STRICT ? ' (strict)' : ''}.`));
    return;
  }
  console.log(red(`contractiles: ${failures.length} gating failure(s) of ${ran} probes:`));
  for (const f of failures) console.log(red(`  - ${f}`));
  process.exit(1);
}

main();
