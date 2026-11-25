# PELO // Deep-Space Exoplanet Observatory & Telemetry API

An interactive **60fps Keplerian Exoplanet Observatory** paired with a full **Express + SQLite (`node:sqlite`) REST API**, real astrophysical synthesis engine, 3D-shaded procedural planet renderer, Web Audio radio-telescope sonification, and a built-in **Live API Playground**.

## Highlights

- **Real Astrophysical Synthesis (`src/astrophysics.js`)**:
  - Deterministic generation from any seed word, coordinate, or spectral class (`O`, `B`, `A`, `F`, `G`, `K`, `M`, `PSR` Millisecond Pulsar, `WD` White Dwarf).
  - Stefan-Boltzmann stellar luminosity ($L/L_\odot = R^2 (T/5778)^4$) and Circumstellar Habitable Zone bounds.
  - Exact Newton-Raphson Keplerian 2-body orbital solver ($M = E - e\sin E$) and vis-viva orbital velocity.
  - Schulze-Makuch Earth Similarity Index (`ESI` from `0.01` to `0.99`).
- **Interactive Mission Control (`public/`)**:
  - Smooth 60fps HTML5 Canvas Keplerian Orrery with zoom, pan, time-warp multipliers, habitable-zone band, orbiting moons, and relativistic pulsar beams.
  - High-resolution rotating 3D-shaded exoplanet globe renderer with continents, specular ocean glint, polar caps, cloud wisps, lava fissures, and planetary rings.
  - Procedural Web Audio radio-telescope acoustic synth tuned to each star & exoplanet.
  - Slide-up **⚡ Live API Console** logging every real HTTP call with server `X-Response-Time` latency, interactive JSON request builder, and one-click `cURL` export.

## REST API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api` | Self-documenting API manifest & active runtime metadata |
| `GET` | `/api/health` | Service health & live catalog counts |
| `GET` | `/api/stats` | Galactic breakdown by spectral class, planet archetypes & top habitable worlds |
| `GET` | `/api/systems` | List star systems (`?q=`, `?spectral=`, `?habitable=true`) |
| `POST` | `/api/systems/discover` | Synthesize & persist a new star system from `{ seed, name, spectralBias }` |
| `GET` | `/api/systems/:id` | Full star system telemetry, exoplanets & spectroscopic scan history |
| `DELETE` | `/api/systems/:id` | Remove a star system from the catalog |
| `GET` | `/api/planets` | Query exoplanets across all systems (`?minEsi=0.65`, `?type=`, `?bookmarked=true`) |
| `GET` | `/api/planets/:id` | Detailed single-exoplanet dossier |
| `POST` | `/api/planets/:id/scan` | Perform a deep-space spectroscopic & radar scan |
| `PATCH` | `/api/planets/:id` | Update explorer notes, custom name, or bookmark status |
| `POST` | `/api/simulate/orbit` | Stateless Keplerian orbital state solver |

## Quick Start

```bash
npm install
npm start
# Run automated API test suite:
npm test
```
