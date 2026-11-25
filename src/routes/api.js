const express = require('express');
const {
  getDb,
  insertSynthesizedSystem,
  listSystems,
  getSystemById,
  deleteSystemById,
  getPlanetById,
  updatePlanetFields,
  listPlanets,
  runScanOnPlanet,
  getObservatoryStats
} = require('../db');
const { synthesizeSystem, solveKepler, SPECTRAL_PROFILES } = require('../astrophysics');

const router = express.Router();
const bootTime = Date.now();

// GET /api — Self-documenting API manifest
router.get('/', (req, res) => {
  res.json({
    service: 'PELO Deep-Space Exoplanet Observatory & Telemetry API',
    version: '1.0.0',
    engine: 'Keplerian 2-Body + Stefan-Boltzmann + Schulze-Makuch ESI',
    storage: 'SQLite (node:sqlite WAL)',
    uptimeSeconds: Math.round((Date.now() - bootTime) / 1000),
    spectralClasses: Object.keys(SPECTRAL_PROFILES),
    endpoints: [
      { method: 'GET', path: '/api/health', description: 'Service health & live catalog counts' },
      { method: 'GET', path: '/api/stats', description: 'Galactic statistics, spectral histogram & top habitable worlds' },
      { method: 'GET', path: '/api/systems', description: 'List star systems (?q=, ?spectral=, ?habitable=true)' },
      { method: 'POST', path: '/api/systems/discover', description: 'Procedurally synthesize & store a star system from { seed, name, spectralBias }' },
      { method: 'GET', path: '/api/systems/:id', description: 'Full star system telemetry, exoplanets & spectroscopic scans' },
      { method: 'DELETE', path: '/api/systems/:id', description: 'Remove a star system from the catalog' },
      { method: 'GET', path: '/api/planets', description: 'Query exoplanets across all systems (?minEsi=, ?type=, ?bookmarked=true)' },
      { method: 'GET', path: '/api/planets/:id', description: 'Single exoplanet dossier & scan log' },
      { method: 'POST', path: '/api/planets/:id/scan', description: 'Run deep-space spectroscopic & radar scan on an exoplanet' },
      { method: 'PATCH', path: '/api/planets/:id', description: 'Update planet explorer notes, custom name, or bookmark flag' },
      { method: 'POST', path: '/api/simulate/orbit', description: 'Stateless Newton-Raphson Keplerian orbit state calculator' }
    ]
  });
});

// GET /api/health
router.get('/health', (req, res) => {
  const db = getDb();
  const stats = getObservatoryStats(db);
  res.json({
    status: 'ok',
    database: 'connected',
    uptimeSeconds: Math.round((Date.now() - bootTime) / 1000),
    catalog: {
      systems: stats.totalSystems,
      planets: stats.totalPlanets,
      habitableCandidates: stats.habitableCandidates,
      scans: stats.totalScans
    }
  });
});

// GET /api/stats
router.get('/stats', (req, res) => {
  const db = getDb();
  res.json(getObservatoryStats(db));
});

// GET /api/systems
router.get('/systems', (req, res) => {
  const db = getDb();
  const systems = listSystems(db, {
    q: req.query.q,
    spectral: req.query.spectral,
    habitable: req.query.habitable
  });
  res.json({ count: systems.length, systems });
});

// POST /api/systems/discover
router.post('/systems/discover', (req, res) => {
  const db = getDb();
  const { seed, name, spectralBias } = req.body || {};

  if (spectralBias && !SPECTRAL_PROFILES[String(spectralBias).toUpperCase()]) {
    return res.status(400).json({
      error: `Invalid spectralBias "${spectralBias}". Valid options: ${Object.keys(SPECTRAL_PROFILES).join(', ')}`
    });
  }

  const synth = synthesizeSystem({
    seed: seed ? String(seed).slice(0, 120) : undefined,
    customName: name ? String(name).slice(0, 60) : undefined,
    spectralBias
  });

  const created = insertSynthesizedSystem(db, synth);
  res.status(201).json(created);
});

// GET /api/systems/:id
router.get('/systems/:id', (req, res) => {
  const db = getDb();
  const system = getSystemById(db, req.params.id);
  if (!system) {
    return res.status(404).json({ error: 'Star system not found' });
  }
  res.json(system);
});

// DELETE /api/systems/:id
router.delete('/systems/:id', (req, res) => {
  const db = getDb();
  const result = deleteSystemById(db, req.params.id);
  if (result.error) {
    return res.status(result.status || 400).json({ error: result.error });
  }
  res.json(result);
});

// GET /api/planets
router.get('/planets', (req, res) => {
  const db = getDb();
  const planets = listPlanets(db, {
    minEsi: req.query.minEsi,
    type: req.query.type,
    bookmarked: req.query.bookmarked,
    limit: req.query.limit
  });
  res.json({ count: planets.length, planets });
});

// GET /api/planets/:id
router.get('/planets/:id', (req, res) => {
  const db = getDb();
  const planet = getPlanetById(db, req.params.id);
  if (!planet) {
    return res.status(404).json({ error: 'Exoplanet not found' });
  }
  res.json(planet);
});

// POST /api/planets/:id/scan
router.post('/planets/:id/scan', (req, res) => {
  const db = getDb();
  const result = runScanOnPlanet(db, req.params.id);
  if (!result) {
    return res.status(404).json({ error: 'Exoplanet not found' });
  }
  res.status(201).json(result);
});

// PATCH /api/planets/:id
router.patch('/planets/:id', (req, res) => {
  const db = getDb();
  const updated = updatePlanetFields(db, req.params.id, req.body || {});
  if (!updated) {
    return res.status(404).json({ error: 'Exoplanet not found' });
  }
  res.json(updated);
});

// POST /api/simulate/orbit
router.post('/simulate/orbit', (req, res) => {
  const {
    starMassSolar = 1.0,
    semiMajorAxisAu = 1.0,
    eccentricity = 0.0167,
    timeDays = 90,
    initialPhaseRad = 0
  } = req.body || {};

  if (Number(semiMajorAxisAu) <= 0 || Number(starMassSolar) <= 0) {
    return res.status(400).json({ error: 'starMassSolar and semiMajorAxisAu must be positive numbers.' });
  }

  const state = solveKepler({
    starMassSolar,
    semiMajorAxisAu,
    eccentricity,
    timeDays,
    initialPhaseRad
  });

  res.json({
    input: { starMassSolar, semiMajorAxisAu, eccentricity, timeDays, initialPhaseRad },
    orbitalState: state
  });
});

module.exports = router;
