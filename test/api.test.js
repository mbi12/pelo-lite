const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');

process.env.DB_PATH = ':memory:';
const app = require('../server');

let server;
let baseUrl;

describe('PELO Deep-Space Observatory REST API', () => {
  before(async () => {
    await new Promise((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  it('GET /api returns self-documenting manifest and X-Response-Time header', async () => {
    const res = await fetch(`${baseUrl}/api`);
    assert.equal(res.status, 200);
    assert.ok(res.headers.get('x-response-time'));
    const body = await res.json();
    assert.equal(body.version, '1.0.0');
    assert.ok(Array.isArray(body.endpoints));
    assert.ok(body.endpoints.length >= 10);
  });

  it('GET /api/health reports seeded starter star systems and exoplanets', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'ok');
    assert.ok(body.catalog.systems >= 5);
    assert.ok(body.catalog.planets >= 20);
  });

  it('POST /api/systems/discover deterministically synthesizes & persists a new system', async () => {
    const res = await fetch(`${baseUrl}/api/systems/discover`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seed: 'amsterdam-zenith', name: 'Amsterdam-1', spectralBias: 'G' })
    });
    assert.equal(res.status, 201);
    const created = await res.json();
    assert.equal(created.name, 'Amsterdam-1');
    assert.equal(created.spectralClass, 'G');
    assert.ok(created.planets.length >= 4);
    assert.ok(created.hzOuterAu > created.hzInnerAu);
  });

  it('POST /api/planets/:id/scan performs spectroscopic scan and PATCH updates notes', async () => {
    const listRes = await fetch(`${baseUrl}/api/planets?limit=1`);
    const { planets } = await listRes.json();
    const target = planets[0];

    const scanRes = await fetch(`${baseUrl}/api/planets/${target.id}/scan`, { method: 'POST' });
    assert.equal(scanRes.status, 201);
    const scanData = await scanRes.json();
    assert.equal(scanData.planet.scanCount, target.scanCount + 1);
    assert.ok(scanData.scan.title);

    const patchRes = await fetch(`${baseUrl}/api/planets/${target.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookmarked: true, notes: 'Confirmed liquid water spectral band.' })
    });
    assert.equal(patchRes.status, 200);
    const patched = await patchRes.json();
    assert.equal(patched.bookmarked, true);
    assert.equal(patched.notes, 'Confirmed liquid water spectral band.');
  });

  it('POST /api/simulate/orbit computes exact Keplerian orbital state for Earth-like 1 AU orbit', async () => {
    const res = await fetch(`${baseUrl}/api/simulate/orbit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        starMassSolar: 1.0,
        semiMajorAxisAu: 1.0,
        eccentricity: 0.0,
        timeDays: 365.256 / 4,
        initialPhaseRad: 0
      })
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(Math.abs(body.orbitalState.orbitalPeriodDays - 365.256) < 0.01);
    assert.ok(Math.abs(body.orbitalState.distanceAu - 1.0) < 0.001);
    assert.ok(Math.abs(body.orbitalState.velocityKmS - 29.785) < 0.05);
  });
});
