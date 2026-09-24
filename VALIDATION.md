# Validation, 2026-09-24

## Original project tests

Executed `npm test` against the provided original archive in Node.js 22.16.0. All 195 checks passed:

| Suite | Passed |
| --- | ---: |
| Simulation | 19 |
| Operations | 32 |
| Camera | 27 |
| Upgrade | 36 |
| Release | 33 |
| Network | 30 |
| MQTT | 18 |

Network checks used loopback TCP and simulated clients. MQTT checks used a local independent MQTT fixture, actual WebCrypto, and a worker_threads browser-worker adapter. They cover encrypted joining, readiness, per-player state filtering, commands, reconnect, eight clients, and host exit. These are not a physical multi-device or public-broker acceptance test.

## Import and build

Checked the waiting-for-archive path, rejection of a wrong SHA-256, import of all 162 original files, and preservation of later source edits. The generated site is a self-contained HTML page with the small invitation-link adapter. Server code is retained in `game/` but is not deployed as a running service on Pages.

## Browser UI checks

Five checks passed in headed Chromium with Xvfb, in-memory HTML, and software WebGL: menu startup and private MQTT defaults; LAN/MQTT switching; invitation-link generation preserving the project path and compatibility with the original parser; malformed-invitation rejection; no uncaught browser errors during this smoke test. The invitation parser check used a syntax-only fixture, not a joinable public room.

The environment blocks browser URL navigation by administrator policy. No claim is made that the live GitHub Pages URL, real public broker, two physical machines, or a long multiplayer match has been tested.

## Deployment status

This validation document is not proof of a successful live deployment. The original ZIP must first be uploaded into this repository and GitHub Pages must be enabled with GitHub Actions. See the latest workflow run and its deploy job for the actual publishing status.
