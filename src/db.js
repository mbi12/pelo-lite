const fs = require('node:fs');
const path = require('node:path');
const { synthesizeSystem, performSpectroscopicScan } = require('./astrophysics');

let SqliteDatabaseSync = null;
if (!process.env.FORCE_JSON_STORE) {
  try {
    SqliteDatabaseSync = require('node:sqlite').DatabaseSync;
  } catch {
    SqliteDatabaseSync = null;
  }
}

let storeInstance = null;

const STARTER_SEEDS = [
  { seed: 'solara-horizon-prime', customName: 'Solara-442', spectralBias: 'G' },
  { seed: 'vela-millisecond-lighthouse', customName: 'Vela-PSR9', spectralBias: 'PSR' },
  { seed: 'aurelia-emerald-archipelago', customName: 'Aurelia-7', spectralBias: 'K' },
  { seed: 'trappist-crimson-chain', customName: 'Cygni-M8', spectralBias: 'M' },
  { seed: 'hyperion-sapphire-forge', customName: 'Hyperion-B2', spectralBias: 'B' }
];

function resolveDbPath() {
  if (process.env.DB_PATH) return process.env.DB_PATH;
  if (process.env.VERCEL) return path.join('/tmp', 'pelo-observatory.db');
  const localDir = path.join(__dirname, '..', 'data');
  try {
    fs.mkdirSync(localDir, { recursive: true });
    fs.accessSync(localDir, fs.constants.W_OK);
    return path.join(localDir, 'observatory.db');
  } catch {
    return path.join('/tmp', 'pelo-observatory.db');
  }
}

// ---------- Fallback Portable JSON Store (for Node <22.5 serverless runtimes) ----------
class JsonFallbackAdapter {
  constructor(filePath) {
    this.filePath = filePath === ':memory:' ? null : `${filePath}.json`;
    this.state = { nextSysId: 1, nextPlanetId: 1, nextScanId: 1, systems: [], planets: [], scans: [] };
    if (this.filePath && fs.existsSync(this.filePath)) {
      try {
        this.state = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
      } catch {
        // start clean
      }
    }
  }

  save() {
    if (!this.filePath) return;
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.state));
    } catch {
      // ignore ephemeral write errors
    }
  }
}

function getDb() {
  if (storeInstance) return storeInstance;

  const dbPath = resolveDbPath();
  if (SqliteDatabaseSync) {
    const db = new SqliteDatabaseSync(dbPath);
    db.exec('PRAGMA foreign_keys = ON;');
    if (dbPath !== ':memory:') {
      try { db.exec('PRAGMA journal_mode = WAL;'); } catch { /* ignore on /tmp */ }
    }

    db.exec(`
      CREATE TABLE IF NOT EXISTS systems (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        seed TEXT NOT NULL,
        name TEXT NOT NULL,
        sector TEXT NOT NULL,
        spectral_class TEXT NOT NULL,
        spectral_type TEXT NOT NULL,
        spectral_label TEXT NOT NULL,
        star_color TEXT NOT NULL,
        star_glow TEXT NOT NULL,
        star_mass_solar REAL NOT NULL,
        star_radius_solar REAL NOT NULL,
        star_temp_k INTEGER NOT NULL,
        luminosity_solar REAL NOT NULL,
        hz_inner_au REAL NOT NULL,
        hz_outer_au REAL NOT NULL,
        distance_ly REAL NOT NULL,
        age_gyr REAL NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS planets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        system_id INTEGER NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
        designation TEXT NOT NULL,
        custom_name TEXT,
        orbit_index INTEGER NOT NULL,
        type TEXT NOT NULL,
        semi_major_au REAL NOT NULL,
        eccentricity REAL NOT NULL,
        orbital_period_days REAL NOT NULL,
        initial_phase_rad REAL NOT NULL,
        axial_tilt_deg REAL NOT NULL,
        radius_earth REAL NOT NULL,
        mass_earth REAL NOT NULL,
        gravity_g REAL NOT NULL,
        albedo REAL NOT NULL,
        surface_temp_k INTEGER NOT NULL,
        esi REAL NOT NULL,
        has_rings INTEGER NOT NULL DEFAULT 0,
        moons INTEGER NOT NULL DEFAULT 0,
        palette_json TEXT NOT NULL,
        atmosphere_json TEXT NOT NULL,
        anomaly TEXT NOT NULL,
        in_habitable_zone INTEGER NOT NULL DEFAULT 0,
        bookmarked INTEGER NOT NULL DEFAULT 0,
        notes TEXT NOT NULL DEFAULT '',
        scan_count INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS scans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        planet_id INTEGER NOT NULL REFERENCES planets(id) ON DELETE CASCADE,
        scan_number INTEGER NOT NULL,
        title TEXT NOT NULL,
        detail TEXT NOT NULL,
        confidence REAL NOT NULL,
        tag TEXT NOT NULL,
        signal_to_noise REAL NOT NULL,
        wavelength_um TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);

    db._mode = 'sqlite';
    storeInstance = db;
  } else {
    const adapter = new JsonFallbackAdapter(dbPath);
    adapter._mode = 'json';
    storeInstance = adapter;
  }

  seedInitialCatalog(storeInstance);
  return storeInstance;
}

function seedInitialCatalog(db) {
  const existingCount = db._mode === 'sqlite'
    ? db.prepare('SELECT COUNT(*) AS cnt FROM systems').get().cnt
    : db.state.systems.length;

  if (existingCount > 0) return;

  for (const s of STARTER_SEEDS) {
    const synth = synthesizeSystem(s);
    const created = insertSynthesizedSystem(db, synth);
    if (s.customName === 'Solara-442' && created.planets.length > 0) {
      const best = [...created.planets].sort((a, b) => b.esi - a.esi)[0];
      updatePlanetFields(db, best.id, {
        bookmarked: true,
        notes: 'Primary habitable candidate — atmospheric water vapor & oxygen disequilibrium confirmed.'
      });
      runScanOnPlanet(db, best.id);
    }
  }
}

function insertSynthesizedSystem(db, synth) {
  if (db._mode === 'json') {
    const sysId = db.state.nextSysId++;
    const now = new Date().toISOString();
    db.state.systems.push({
      id: sysId,
      seed: synth.seed,
      name: synth.name,
      sector: synth.sector,
      spectral_class: synth.spectralClass,
      spectral_type: synth.spectralType,
      spectral_label: synth.spectralLabel,
      star_color: synth.starColor,
      star_glow: synth.starGlow,
      star_mass_solar: synth.starMassSolar,
      star_radius_solar: synth.starRadiusSolar,
      star_temp_k: synth.starTempK,
      luminosity_solar: synth.luminositySolar,
      hz_inner_au: synth.hzInnerAu,
      hz_outer_au: synth.hzOuterAu,
      distance_ly: synth.distanceLy,
      age_gyr: synth.ageGyr,
      created_at: now
    });

    for (const p of synth.planets) {
      db.state.planets.push({
        id: db.state.nextPlanetId++,
        system_id: sysId,
        designation: p.designation,
        custom_name: null,
        orbit_index: p.orbitIndex,
        type: p.type,
        semi_major_au: p.semiMajorAu,
        eccentricity: p.eccentricity,
        orbital_period_days: p.orbitalPeriodDays,
        initial_phase_rad: p.initialPhaseRad,
        axial_tilt_deg: p.axialTiltDeg,
        radius_earth: p.radiusEarth,
        mass_earth: p.massEarth,
        gravity_g: p.gravityG,
        albedo: p.albedo,
        surface_temp_k: p.surfaceTempK,
        esi: p.esi,
        has_rings: p.hasRings ? 1 : 0,
        moons: p.moons,
        palette_json: JSON.stringify(p.palette),
        atmosphere_json: JSON.stringify(p.atmosphere),
        anomaly: p.anomaly,
        in_habitable_zone: p.inHabitableZone ? 1 : 0,
        bookmarked: 0,
        notes: '',
        scan_count: 0
      });
    }
    db.save();
    return getSystemById(db, sysId);
  }

  const insertSys = db.prepare(`
    INSERT INTO systems (
      seed, name, sector, spectral_class, spectral_type, spectral_label,
      star_color, star_glow, star_mass_solar, star_radius_solar, star_temp_k,
      luminosity_solar, hz_inner_au, hz_outer_au, distance_ly, age_gyr
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const res = insertSys.run(
    synth.seed, synth.name, synth.sector, synth.spectralClass, synth.spectralType,
    synth.spectralLabel, synth.starColor, synth.starGlow, synth.starMassSolar,
    synth.starRadiusSolar, synth.starTempK, synth.luminositySolar, synth.hzInnerAu,
    synth.hzOuterAu, synth.distanceLy, synth.ageGyr
  );

  const systemId = Number(res.lastInsertRowid);
  const insertPlanet = db.prepare(`
    INSERT INTO planets (
      system_id, designation, orbit_index, type, semi_major_au, eccentricity,
      orbital_period_days, initial_phase_rad, axial_tilt_deg, radius_earth,
      mass_earth, gravity_g, albedo, surface_temp_k, esi, has_rings, moons,
      palette_json, atmosphere_json, anomaly, in_habitable_zone
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const p of synth.planets) {
    insertPlanet.run(
      systemId, p.designation, p.orbitIndex, p.type, p.semiMajorAu, p.eccentricity,
      p.orbitalPeriodDays, p.initialPhaseRad, p.axialTiltDeg, p.radiusEarth,
      p.massEarth, p.gravityG, p.albedo, p.surfaceTempK, p.esi, p.hasRings ? 1 : 0,
      p.moons, JSON.stringify(p.palette), JSON.stringify(p.atmosphere),
      p.anomaly, p.inHabitableZone ? 1 : 0
    );
  }

  return getSystemById(db, systemId);
}

function formatPlanetRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    systemId: row.system_id,
    designation: row.designation,
    name: row.custom_name || row.designation,
    customName: row.custom_name || null,
    orbitIndex: row.orbit_index,
    type: row.type,
    semiMajorAu: row.semi_major_au,
    eccentricity: row.eccentricity,
    orbitalPeriodDays: row.orbital_period_days,
    initialPhaseRad: row.initial_phase_rad,
    axialTiltDeg: row.axial_tilt_deg,
    radiusEarth: row.radius_earth,
    massEarth: row.mass_earth,
    gravityG: row.gravity_g,
    albedo: row.albedo,
    surfaceTempK: row.surface_temp_k,
    surfaceTempC: Math.round(row.surface_temp_k - 273.15),
    esi: row.esi,
    hasRings: Boolean(row.has_rings),
    moons: row.moons,
    palette: JSON.parse(row.palette_json),
    atmosphere: JSON.parse(row.atmosphere_json),
    anomaly: row.anomaly,
    inHabitableZone: Boolean(row.in_habitable_zone),
    bookmarked: Boolean(row.bookmarked),
    notes: row.notes,
    scanCount: row.scan_count,
    starName: row.star_name || undefined,
    spectralType: row.spectral_type || undefined,
    starColor: row.star_color || undefined
  };
}

function formatSystemRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    seed: row.seed,
    name: row.name,
    sector: row.sector,
    spectralClass: row.spectral_class,
    spectralType: row.spectral_type,
    spectralLabel: row.spectral_label,
    starColor: row.star_color,
    starGlow: row.star_glow,
    starMassSolar: row.star_mass_solar,
    starRadiusSolar: row.star_radius_solar,
    starTempK: row.star_temp_k,
    luminositySolar: row.luminosity_solar,
    hzInnerAu: row.hz_inner_au,
    hzOuterAu: row.hz_outer_au,
    distanceLy: row.distance_ly,
    ageGyr: row.age_gyr,
    createdAt: row.created_at,
    planetCount: row.planet_count !== undefined ? Number(row.planet_count) : undefined,
    maxEsi: row.max_esi !== undefined ? Number(row.max_esi || 0) : undefined,
    habitableCount: row.habitable_count !== undefined ? Number(row.habitable_count || 0) : undefined
  };
}

function formatScanRow(row) {
  return {
    id: row.id,
    planetId: row.planet_id,
    planetDesignation: row.planet_designation,
    scanNumber: row.scan_number,
    title: row.title,
    detail: row.detail,
    confidence: row.confidence,
    tag: row.tag,
    signalToNoise: row.signal_to_noise,
    wavelengthUm: row.wavelength_um,
    createdAt: row.created_at
  };
}

function listSystems(db, { q, spectral, habitable } = {}) {
  if (db._mode === 'json') {
    const qLower = q ? String(q).trim().toLowerCase() : '';
    const specUpper = spectral ? String(spectral).trim().toUpperCase() : '';
    const needHab = habitable === 'true' || habitable === true;

    return [...db.state.systems]
      .sort((a, b) => b.id - a.id)
      .map((s) => {
        const sysPlanets = db.state.planets.filter((p) => p.system_id === s.id);
        const maxEsi = sysPlanets.reduce((m, p) => Math.max(m, p.esi), 0);
        const habCount = sysPlanets.filter((p) => p.esi >= 0.65).length;
        return { ...s, planet_count: sysPlanets.length, max_esi: Math.round(maxEsi * 100) / 100, habitable_count: habCount };
      })
      .filter((s) => {
        if (qLower && ![s.name, s.sector, s.seed, s.spectral_type].some((v) => v.toLowerCase().includes(qLower))) return false;
        if (specUpper && s.spectral_class.toUpperCase() !== specUpper) return false;
        if (needHab && s.max_esi < 0.65) return false;
        return true;
      })
      .map(formatSystemRow);
  }

  const clauses = [];
  const params = [];
  if (q && String(q).trim()) {
    const term = `%${String(q).trim()}%`;
    clauses.push('(s.name LIKE ? OR s.sector LIKE ? OR s.seed LIKE ? OR s.spectral_type LIKE ?)');
    params.push(term, term, term, term);
  }
  if (spectral && String(spectral).trim()) {
    clauses.push('UPPER(s.spectral_class) = UPPER(?)');
    params.push(String(spectral).trim());
  }

  const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const havingSql = habitable === 'true' || habitable === true ? 'HAVING MAX(p.esi) >= 0.65' : '';

  const rows = db.prepare(`
    SELECT
      s.*,
      COUNT(p.id) AS planet_count,
      ROUND(MAX(p.esi), 2) AS max_esi,
      SUM(CASE WHEN p.esi >= 0.65 THEN 1 ELSE 0 END) AS habitable_count
    FROM systems s
    LEFT JOIN planets p ON p.system_id = s.id
    ${whereSql}
    GROUP BY s.id
    ${havingSql}
    ORDER BY s.id DESC
  `).all(...params);

  return rows.map(formatSystemRow);
}

function getSystemById(db, id) {
  const numId = Number(id);
  if (db._mode === 'json') {
    const s = db.state.systems.find((x) => x.id === numId);
    if (!s) return null;
    const pRows = db.state.planets.filter((p) => p.system_id === numId).sort((a, b) => a.orbit_index - b.orbit_index);
    const maxEsi = pRows.reduce((m, p) => Math.max(m, p.esi), 0);
    const formatted = formatSystemRow({
      ...s,
      planet_count: pRows.length,
      max_esi: Math.round(maxEsi * 100) / 100,
      habitable_count: pRows.filter((p) => p.esi >= 0.65).length
    });
    formatted.planets = pRows.map((r) => {
      const p = formatPlanetRow(r);
      p.scans = db.state.scans
        .filter((sc) => sc.planet_id === r.id)
        .sort((a, b) => b.id - a.id)
        .map(formatScanRow);
      return p;
    });
    return formatted;
  }

  const sysRow = db.prepare(`
    SELECT
      s.*,
      COUNT(p.id) AS planet_count,
      ROUND(MAX(p.esi), 2) AS max_esi,
      SUM(CASE WHEN p.esi >= 0.65 THEN 1 ELSE 0 END) AS habitable_count
    FROM systems s
    LEFT JOIN planets p ON p.system_id = s.id
    WHERE s.id = ?
    GROUP BY s.id
  `).get(numId);

  if (!sysRow) return null;

  const planetRows = db.prepare('SELECT * FROM planets WHERE system_id = ? ORDER BY orbit_index ASC').all(numId);
  const scansRows = db.prepare(`
    SELECT sc.*, p.designation AS planet_designation
    FROM scans sc
    JOIN planets p ON p.id = sc.planet_id
    WHERE p.system_id = ?
    ORDER BY sc.id DESC
    LIMIT 20
  `).all(numId);

  const formatted = formatSystemRow(sysRow);
  formatted.planets = planetRows.map((r) => {
    const p = formatPlanetRow(r);
    p.scans = scansRows.filter((s) => s.planet_id === r.id).map(formatScanRow);
    return p;
  });
  return formatted;
}

function deleteSystemById(db, id) {
  const numId = Number(id);
  const total = db._mode === 'json'
    ? db.state.systems.length
    : db.prepare('SELECT COUNT(*) AS cnt FROM systems').get().cnt;

  if (total <= 1) {
    return { error: 'Cannot delete the last remaining star system in the observatory.', status: 400 };
  }

  const existing = getSystemById(db, numId);
  if (!existing) {
    return { error: 'Star system not found', status: 404 };
  }

  if (db._mode === 'json') {
    const pIds = new Set(db.state.planets.filter((p) => p.system_id === numId).map((p) => p.id));
    db.state.systems = db.state.systems.filter((s) => s.id !== numId);
    db.state.planets = db.state.planets.filter((p) => p.system_id !== numId);
    db.state.scans = db.state.scans.filter((sc) => !pIds.has(sc.planet_id));
    db.save();
  } else {
    db.prepare('DELETE FROM systems WHERE id = ?').run(numId);
  }

  return { deleted: true, id: numId, name: existing.name };
}

function getPlanetById(db, planetId) {
  const numId = Number(planetId);
  if (db._mode === 'json') {
    const p = db.state.planets.find((x) => x.id === numId);
    if (!p) return null;
    const s = db.state.systems.find((x) => x.id === p.system_id);
    const formatted = formatPlanetRow({
      ...p,
      star_name: s?.name,
      spectral_type: s?.spectral_type,
      star_color: s?.star_color
    });
    formatted.scans = db.state.scans.filter((sc) => sc.planet_id === numId).sort((a, b) => b.id - a.id).map(formatScanRow);
    return formatted;
  }

  const row = db.prepare(`
    SELECT p.*, s.name AS star_name, s.spectral_type, s.star_color
    FROM planets p
    JOIN systems s ON s.id = p.system_id
    WHERE p.id = ?
  `).get(numId);

  if (!row) return null;
  const planet = formatPlanetRow(row);
  const scans = db.prepare('SELECT * FROM scans WHERE planet_id = ? ORDER BY id DESC').all(numId);
  planet.scans = scans.map(formatScanRow);
  return planet;
}

function updatePlanetFields(db, planetId, { customName, notes, bookmarked }) {
  const existing = getPlanetById(db, planetId);
  if (!existing) return null;

  const nextName = customName !== undefined
    ? (String(customName).trim().slice(0, 60) || null)
    : existing.customName;
  const nextNotes = notes !== undefined
    ? String(notes).slice(0, 800)
    : existing.notes;
  const nextBookmarked = bookmarked !== undefined
    ? (bookmarked ? 1 : 0)
    : (existing.bookmarked ? 1 : 0);

  if (db._mode === 'json') {
    const target = db.state.planets.find((p) => p.id === existing.id);
    if (target) {
      target.custom_name = nextName;
      target.notes = nextNotes;
      target.bookmarked = nextBookmarked;
      db.save();
    }
    return getPlanetById(db, existing.id);
  }

  db.prepare(`
    UPDATE planets SET custom_name = ?, notes = ?, bookmarked = ? WHERE id = ?
  `).run(nextName, nextNotes, nextBookmarked, existing.id);

  return getPlanetById(db, existing.id);
}

function runScanOnPlanet(db, planetId) {
  const planet = getPlanetById(db, planetId);
  if (!planet) return null;

  const nextCount = planet.scanCount + 1;
  const scanReport = performSpectroscopicScan(planet, nextCount);
  const updatedMoons = planet.moons + scanReport.bonusMoon;

  if (db._mode === 'json') {
    db.state.scans.push({
      id: db.state.nextScanId++,
      planet_id: planet.id,
      scan_number: scanReport.scanNumber,
      title: scanReport.title,
      detail: scanReport.detail,
      confidence: scanReport.confidence,
      tag: scanReport.tag,
      signal_to_noise: scanReport.signalToNoise,
      wavelength_um: scanReport.wavelengthUm,
      created_at: new Date().toISOString()
    });
    const pRow = db.state.planets.find((p) => p.id === planet.id);
    if (pRow) {
      pRow.scan_count = nextCount;
      pRow.moons = updatedMoons;
      db.save();
    }
    return { scan: scanReport, planet: getPlanetById(db, planet.id) };
  }

  db.prepare(`
    INSERT INTO scans (planet_id, scan_number, title, detail, confidence, tag, signal_to_noise, wavelength_um)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    planet.id, scanReport.scanNumber, scanReport.title, scanReport.detail,
    scanReport.confidence, scanReport.tag, scanReport.signalToNoise, scanReport.wavelengthUm
  );

  db.prepare('UPDATE planets SET scan_count = ?, moons = ? WHERE id = ?').run(nextCount, updatedMoons, planet.id);
  return { scan: scanReport, planet: getPlanetById(db, planet.id) };
}

function listPlanets(db, { minEsi, type, bookmarked, limit = 30 } = {}) {
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 30));

  if (db._mode === 'json') {
    return db.state.planets
      .filter((p) => {
        if (minEsi !== undefined && minEsi !== '' && p.esi < Number(minEsi)) return false;
        if (type && String(type).trim() && !p.type.toLowerCase().includes(String(type).trim().toLowerCase())) return false;
        if ((bookmarked === 'true' || bookmarked === true) && !p.bookmarked) return false;
        return true;
      })
      .sort((a, b) => b.esi - a.esi || b.id - a.id)
      .slice(0, safeLimit)
      .map((p) => {
        const s = db.state.systems.find((x) => x.id === p.system_id);
        return formatPlanetRow({
          ...p,
          star_name: s?.name,
          spectral_type: s?.spectral_type,
          star_color: s?.star_color
        });
      });
  }

  const clauses = [];
  const params = [];
  if (minEsi !== undefined && minEsi !== '') {
    clauses.push('p.esi >= ?');
    params.push(Number(minEsi));
  }
  if (type && String(type).trim()) {
    clauses.push('LOWER(p.type) LIKE LOWER(?)');
    params.push(`%${String(type).trim()}%`);
  }
  if (bookmarked === 'true' || bookmarked === true) {
    clauses.push('p.bookmarked = 1');
  }

  const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = db.prepare(`
    SELECT p.*, s.name AS star_name, s.spectral_type, s.star_color
    FROM planets p
    JOIN systems s ON s.id = p.system_id
    ${whereSql}
    ORDER BY p.esi DESC, p.id DESC
    LIMIT ?
  `).all(...params, safeLimit);

  return rows.map(formatPlanetRow);
}

function getObservatoryStats(db) {
  if (db._mode === 'json') {
    const specMap = new Map();
    for (const s of db.state.systems) {
      specMap.set(s.spectral_class, (specMap.get(s.spectral_class) || 0) + 1);
    }
    const typeMap = new Map();
    for (const p of db.state.planets) {
      const curr = typeMap.get(p.type) || { count: 0, esiSum: 0 };
      curr.count += 1;
      curr.esiSum += p.esi;
      typeMap.set(p.type, curr);
    }

    return {
      totalSystems: db.state.systems.length,
      totalPlanets: db.state.planets.length,
      habitableCandidates: db.state.planets.filter((p) => p.esi >= 0.65).length,
      bookmarkedPlanets: db.state.planets.filter((p) => p.bookmarked).length,
      totalScans: db.state.scans.length,
      peakEsi: db.state.planets.reduce((m, p) => Math.max(m, p.esi), 0),
      spectralBreakdown: [...specMap.entries()].map(([spectralClass, count]) => ({ spectralClass, count })).sort((a, b) => b.count - a.count),
      planetTypes: [...typeMap.entries()].map(([type, v]) => ({ type, count: v.count, avgEsi: Math.round((v.esiSum / v.count) * 100) / 100 })).sort((a, b) => b.count - a.count),
      topHabitable: listPlanets(db, { minEsi: 0.60, limit: 6 })
    };
  }

  const counts = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM systems) AS total_systems,
      (SELECT COUNT(*) FROM planets) AS total_planets,
      (SELECT COUNT(*) FROM planets WHERE esi >= 0.65) AS habitable_candidates,
      (SELECT COUNT(*) FROM planets WHERE bookmarked = 1) AS bookmarked_planets,
      (SELECT COUNT(*) FROM scans) AS total_scans,
      (SELECT ROUND(MAX(esi), 2) FROM planets) AS peak_esi
  `).get();

  const spectralBreakdown = db.prepare(`
    SELECT spectral_class AS spectralClass, COUNT(*) AS count
    FROM systems GROUP BY spectral_class ORDER BY count DESC
  `).all();

  const planetTypes = db.prepare(`
    SELECT type, COUNT(*) AS count, ROUND(AVG(esi), 2) AS avgEsi
    FROM planets GROUP BY type ORDER BY count DESC
  `).all();

  return {
    totalSystems: Number(counts.total_systems),
    totalPlanets: Number(counts.total_planets),
    habitableCandidates: Number(counts.habitable_candidates),
    bookmarkedPlanets: Number(counts.bookmarked_planets),
    totalScans: Number(counts.total_scans),
    peakEsi: Number(counts.peak_esi || 0),
    spectralBreakdown,
    planetTypes,
    topHabitable: listPlanets(db, { minEsi: 0.60, limit: 6 })
  };
}

module.exports = {
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
};
