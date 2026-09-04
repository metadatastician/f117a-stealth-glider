// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jonathan D.A. Jewell (hyperpolymath) <j.d.a.jewell@open.ac.uk>
//
// The bundler (claim C10). A mechanical concatenation — imports stripped,
// exports unwrapped, CSS inlined — of exactly the modules the ledger audits,
// into one self-contained f117a-stealth-glider.html that runs from a file://
// URL with no network, no tooling and no runtime modules. Adapted from
// f19-stealth-glider's build.mjs; the concat set gains radar.mjs and
// render3d.mjs, and the smoke flight replays this level's committed witness
// (f19's flew straight with input null — Nightglass has no straight route,
// by measurement).
//
// Two checks run at every build, in order:
//   1. `node --check` on the exact script text that ships;
//   2. the TRANSFORMED core must still fly the witness to LANDED, trace 0,
//      never locked — so the strip/concat transform itself is inside the
//      verified perimeter, not trusted.
// CI and `just test` then require the committed bundle to be byte-identical
// to a fresh rebuild. Reproducibility is what makes the shipped file an
// artefact of the audited sources rather than a sibling of them.
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Project-local temp dir, mode 0700 — never the shared /tmp (CodeQL finding
// fixed upstream in f19; inherited here deliberately).
const tmpDir = join(__dirname, '.tmp', randomBytes(16).toString('hex'));
mkdirSync(tmpDir, { mode: 0o700, recursive: true });
const tmpFile = (ext = '') => join(tmpDir, `f117a-${randomBytes(8).toString('hex')}${ext}`);

const strip = src => src
  .split('\n')
  .filter(l => !/^\s*import\s/.test(l))
  .map(l => l.replace(/^export\s+/, ''))
  .join('\n');

const CORE = ['kernel/engine.mjs', 'radar.mjs', 'mission.mjs', 'level.mjs'];
const core = CORE.map(f => strip(readFileSync(join(__dirname, f), 'utf8'))).join('\n\n');
const render = strip(readFileSync(join(__dirname, 'render3d.mjs'), 'utf8'));
const ui = strip(readFileSync(join(__dirname, 'ui.js'), 'utf8'));
const js = core + '\n\n' + render + '\n\n' + ui;

// check 1: syntax of the exact shipped script
const bundlePath = tmpFile('.js');
writeFileSync(bundlePath, js);
// Syntax-check the exact shipped script WITHOUT executing it. `new Function`
// compiles the body and throws SyntaxError on bad input -- precisely what
// `node --check` did, but in-process. That matters: it needs no child runtime
// and no `--check` flag (Bun has none), so this check is runtime-agnostic.
// strip() above deletes every `import` line and the `export` keyword, so the
// bundle is a classic script and `new Function` is an exact equivalent.
try {
  new Function(js);
} catch (err) {
  console.error(`bundle syntax check failed: ${err.message}`);
  process.exit(1);
}

// check 2: the transformed CORE still flies the committed witness
const corePath = tmpFile('.mjs');
writeFileSync(corePath, core + `
const L = buildLevel();
const M = createMission(L);
const turns = new Map(L.witness.map(([t, hx, hy]) => [t, [hx, hy]]));
for (let t = 0; t < 1200 && !M.result; t++) missionStep(M, turns.get(t) ?? null);
if (M.result !== 'LANDED' || M.trace !== 0 || M.peakExposure >= LOCK) {
  throw new Error('bundle smoke failed: ' + M.result + ' trace ' + M.trace + ' peak ' + M.peakExposure);
}
console.log('bundle core smoke: LANDED trace 0 peak ' + M.peakExposure + '/' + LOCK);
`);
// process.execPath re-invokes WHICHEVER runtime is executing this file.
// Hardcoding `node` here made a runtime swap green and fake: the CI could be
// switched to Bun while this line silently kept using the host's Node.
execSync(`"${process.execPath}" "${corePath}"`, { stdio: 'inherit' });

const css = `
:root{color-scheme:dark}
*{box-sizing:border-box;margin:0}
body{background:#010409;color:#3fd0f0;font-family:'IBM Plex Mono','Cascadia Mono',ui-monospace,monospace;
  display:flex;min-height:100vh;align-items:center;justify-content:center;padding:10px}
#f117a{max-width:${172 * 6 + 4}px;width:100%}
.bar{display:flex;align-items:center;gap:12px;padding:7px 12px;border:1px solid #16405c;background:#04121f;font-size:12px}
.bar.top{border-bottom:none}.bar.bot{border-top:none;flex-wrap:wrap}
.ttl{color:#ffc23e;letter-spacing:2px;font-weight:700}
.sub{color:#6a5a16;letter-spacing:1px}
.tick{color:#ffb000;margin-left:auto;letter-spacing:1px;min-width:20ch;text-align:right;animation:tk 2.4s steps(2) infinite}
@keyframes tk{50%{opacity:.75}}
.gen{color:#1a7a9a}.gen b{color:#3fd0f0}
.stage{position:relative;border:1px solid #16405c;line-height:0}
canvas#cv{width:100%;height:auto;image-rendering:pixelated;background:#040a12;display:block}
.scan{position:absolute;inset:0;pointer-events:none;mix-blend-mode:overlay;
  background:repeating-linear-gradient(0deg,rgba(0,0,0,.28) 0 1px,transparent 1px 3px)}
.scan::after{content:'';position:absolute;inset:0;background:radial-gradient(ellipse at center,transparent 55%,rgba(0,0,0,.5))}
.card{position:absolute;inset:0;display:none;align-items:center;justify-content:center;pointer-events:none}
.card.show{display:flex;background:rgba(1,4,9,.45);padding:20px;flex-direction:column}
.card>*{display:none}
.card.show h1,.card.show p,.card.show ol{display:block}
.card h1{color:#ffc23e;font-size:17px;letter-spacing:2px;margin-bottom:10px}
.card.show>*{max-width:640px;background:rgba(4,10,18,.92);border-left:2px solid #ffc23e;border-right:2px solid #ffc23e;
  padding:6px 18px;font-size:12.5px;line-height:1.55;color:#9fd8e8}
.card.show>h1{padding-top:14px;position:static}
.card.show>*:last-child{padding-bottom:14px}
.card p.warn{color:#ff7a66}
.card p.stats{color:#ffb000}
.card p.go{color:#ffc23e;letter-spacing:1px}
.card ol{padding-left:34px}
.card li{margin:6px 0}
.card b,.card i{color:#eafcff}
.lbl{color:#6a5a16;font-size:10px;letter-spacing:1px}
.beat i{display:inline-block;width:9px;height:9px;border:1px solid #6a5a16;border-radius:50%;margin-right:4px;vertical-align:middle}
.beat i.on{background:#ffb000;box-shadow:0 0 6px #ffb000}
.beat i.latch{border-color:#ffc23e}
.rose i{font-style:normal;color:#16405c;margin-right:3px;font-size:14px}
.rose i.on{color:#7ef3ff;text-shadow:0 0 6px #7ef3ff}
.rose i.q{color:#ffc23e;animation:tk .5s steps(2) infinite}
.expo i{display:inline-block;width:7px;height:12px;border:1px solid #16405c;margin-right:2px;vertical-align:middle}
.expo i.on{background:#ffb000;border-color:#ffb000}
.expo i.hot{background:#ff5544;border-color:#ff5544;box-shadow:0 0 6px #ff5544}
.paint{color:#1a7a9a;min-width:8ch;display:inline-block;font-size:11px}
.paint.hot{color:#ff5544;text-shadow:0 0 6px #ff5544}
.trace{color:#3fd0f0;min-width:4ch;display:inline-block}
.trace.hot{color:#ffb000;text-shadow:0 0 6px #ffb000}
.keys{margin-left:auto;color:#1a7a9a;font-size:10px}
.tpad{position:absolute;left:8px;bottom:8px;display:grid;grid-template-columns:52px 52px;gap:6px}
.tpad button{background:rgba(4,10,18,.8);border:1px solid #16405c;color:#7ef3ff;font-size:20px;height:44px;font-family:inherit}
.tpad #tgo{grid-column:1/3;color:#ffc23e;font-size:12px;letter-spacing:2px}
`;

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>F117A Stealth Glider — Operation Nightglass</title>
<style>${css}</style></head>
<body><div id="f117a"></div>
<script>
${js}
</script></body></html>`;

writeFileSync(join(__dirname, 'f117a-stealth-glider.html'), html);
console.log('built f117a-stealth-glider.html:', (html.length / 1024).toFixed(1), 'KB');

rmSync(tmpDir, { recursive: true, force: true });
