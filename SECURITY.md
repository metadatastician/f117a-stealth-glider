<!-- SPDX-License-Identifier: CC-BY-SA-4.0 -->
<!-- Copyright (c) 2026 Jonathan D.A. Jewell <j.d.a.jewell@open.ac.uk> -->

# Security Policy

## The honest threat model

F117A Stealth Glider is a single, self-contained HTML file that runs entirely in
the browser. It has:

- **no runtime dependencies** — nothing from npm, no CDN, no vendored libraries;
- **no network access** — the game makes no `fetch`, `XMLHttpRequest`, or
  `WebSocket` calls, and a Trustfile probe enforces this;
- **no server component**, no backend, and no deployed service;
- **no user accounts, no authentication, no persistence, and no telemetry** — it
  collects and stores nothing about the person playing it;
- **no file, clipboard, camera, microphone, or location access.**

Nothing in that list is aspirational; each is checkable, and several are
enforced by probes in
[`Trustfile.a2ml`](.machine_readable/contractiles/trust/Trustfile.a2ml).

The realistic consequence is that the attack surface is very small. A
vulnerability here would most plausibly be one of:

1. **Supply-chain compromise of the published artefact** — the file served from
   GitHub Pages differing from the file in the repository.
2. **A CI/workflow weakness** — an unpinned or compromised GitHub Action.
3. **A browser-side flaw in the bundle itself**, such as an injection path
   through URL parameters or `localStorage`.

## Supported versions

| Version | Supported |
|---------|-----------|
| `main` (latest commit) | Yes |
| Anything else | No |

This is a small project with a single maintainer and no release branches.
Security fixes land on `main`; there is no backporting.

## Reporting a vulnerability

**Please do not open a public issue for a security report.**

Use GitHub's private vulnerability reporting:

> **Security** tab → **Report a vulnerability**

on <https://github.com/metadatastician/f117a-stealth-glider>.

If that is unavailable to you, contact the maintainer through the address listed
in [`.well-known/security.txt`](.well-known/security.txt).

Please include what you did, what happened, what you expected, and — if the
issue is in the game itself — the browser and version.

### What to expect

| Stage | Target |
|-------|--------|
| Acknowledgement | 7 days |
| Initial assessment | 14 days |
| Fix or documented decision not to fix | 90 days |

These are targets for a volunteer single-maintainer project, not a contractual
SLA. If you have not heard back within the acknowledgement window, please chase
— it means the message was missed, not ignored.

You will be credited in the release notes unless you prefer otherwise. There is
no bug bounty.

## Out of scope

The following are not vulnerabilities in this project:

- **Cheating.** The game is client-side and fully open source. Editing the
  page's JavaScript to skip a level is not a security issue — it is the licence
  working as intended.
- **Findings against the published bundle that are equally true of the source.**
  The bundle is a mechanical concatenation of `src/`; report the source issue.
- **Reports of "no Content-Security-Policy"** on a static file with no network
  access and no third-party content.
- **Automated scanner output submitted without a demonstrated impact.**

## Security practices in this repository

- Every GitHub Action is **pinned to a full commit SHA**, never a tag or branch.
  A Mustfile probe fails the build otherwise. The organisation also enforces
  `sha_pinning_required`, so an unpinned action does not merely fail review — it
  fails to start at all.
- **Code scanning** is enabled via GitHub's default setup (actions and
  javascript, extended query suite, weekly).
- **Dependabot** monitors GitHub Actions versions. There are no package
  ecosystems to monitor, because there are no packages.
- Trustfile probes assert that no credential files, private keys, hardcoded
  tokens, or network calls are present in the tree, and CI runs them.
- The project is **dependency-free by design**, which removes the largest single
  source of vulnerabilities in comparable JavaScript projects.
