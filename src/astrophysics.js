// Deterministic PRNG & Astrophysical Synthesis Engine for PELO Observatory

function hashSeed(str) {
  let h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762;
  for (let i = 0, k; i < str.length; i++) {
    k = str.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  return (h1 ^ h2 ^ h3 ^ h4) >>> 0;
}

function createRng(seedString) {
  let a = hashSeed(String(seedString));
  return function next() {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SPECTRAL_PROFILES = {
  O: {
    code: 'O',
    label: 'Blue Hypergiant',
    color: '#60a5fa',
    glow: '#2563eb',
    massRange: [16.0, 32.0],
    radiusRange: [6.8, 12.0],
    tempRange: [31000, 41000],
    weight: 0.03
  },
  B: {
    code: 'B',
    label: 'Blue-White Star',
    color: '#93c5fd',
    glow: '#3b82f6',
    massRange: [2.5, 9.0],
    radiusRange: [2.0, 4.8],
    tempRange: [10500, 22000],
    weight: 0.06
  },
  A: {
    code: 'A',
    label: 'Hydrogen White Star',
    color: '#e2e8f0',
    glow: '#94a3b8',
    massRange: [1.5, 2.2],
    radiusRange: [1.4, 1.9],
    tempRange: [7500, 9800],
    weight: 0.09
  },
  F: {
    code: 'F',
    label: 'Yellow-White Star',
    color: '#fef08a',
    glow: '#eab308',
    massRange: [1.08, 1.45],
    radiusRange: [1.15, 1.42],
    tempRange: [6050, 7350],
    weight: 0.16
  },
  G: {
    code: 'G',
    label: 'Solar-Type Yellow Dwarf',
    color: '#fcd34d',
    glow: '#f59e0b',
    massRange: [0.84, 1.08],
    radiusRange: [0.86, 1.14],
    tempRange: [5250, 6000],
    weight: 0.25
  },
  K: {
    code: 'K',
    label: 'Orange K-Dwarf',
    color: '#fb923c',
    glow: '#ea580c',
    massRange: [0.52, 0.82],
    radiusRange: [0.62, 0.85],
    tempRange: [3850, 5150],
    weight: 0.22
  },
  M: {
    code: 'M',
    label: 'Red M-Dwarf',
    color: '#f87171',
    glow: '#dc2626',
    massRange: [0.14, 0.49],
    radiusRange: [0.18, 0.58],
    tempRange: [2650, 3750],
    weight: 0.13
  },
  PSR: {
    code: 'PSR',
    label: 'Millisecond Pulsar',
    color: '#c084fc',
    glow: '#9333ea',
    massRange: [1.35, 2.08],
    radiusRange: [0.08, 0.14], // Effective magnetospheric emission scale for HZ calculation
    tempRange: [14000, 26000],
    weight: 0.04
  },
  WD: {
    code: 'WD',
    label: 'Crystalline White Dwarf',
    color: '#67e8f9',
    glow: '#0891b2',
    massRange: [0.55, 1.05],
    radiusRange: [0.06, 0.12],
    tempRange: [8500, 16500],
    weight: 0.02
  }
};

const SECTORS = [
  'Cygnus Rift', 'Vela Spur', 'Carina Nebula', 'Lyra Reach', 'Orion Arm',
  'Centauri Verge', 'Cassiopeia Deep', 'Perseus Transit', 'Aquila Drift',
  'Hydra Vault', 'Eridanus Expanse', 'Tucana Cluster', 'Pavo Sector', 'Draco Halo'
];

const STAR_PREFIXES = [
  'Kepler', 'Vela', 'Solara', 'Talyx', 'Aurelia', 'Cygni', 'Kestrel', 'Nyx',
  'Hyperion', 'Zeta', 'Ophiuchi', 'Vega', 'Altair', 'Luyten', 'Trappist',
  'Elysia', 'Helios', 'Meridian', 'Siren', 'Caelum', 'Veritas', 'Orpheus'
];

const ROMAN_NUMERALS = ['b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function round(val, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round(val * factor) / factor;
}

function pickWeightedSpectral(rng, bias) {
  if (bias && SPECTRAL_PROFILES[bias.toUpperCase()]) {
    return SPECTRAL_PROFILES[bias.toUpperCase()];
  }
  const r = rng();
  let acc = 0;
  for (const profile of Object.values(SPECTRAL_PROFILES)) {
    acc += profile.weight;
    if (r <= acc) return profile;
  }
  return SPECTRAL_PROFILES.G;
}

/**
 * Compute Earth Similarity Index (Schulze-Makuch et al., 2011)
 * Reference values: R = 1 R_earth, density_proxy/gravity = 1 g, v_esc = 1 v_earth, T_surf = 288 K
 */
function computeESI({ radiusEarth, massEarth, surfaceTempK }) {
  const vEscRatio = Math.sqrt(Math.max(0.01, massEarth / Math.max(0.1, radiusEarth)));
  const densityRatio = massEarth / Math.max(0.05, radiusEarth ** 3);

  const esiR = Math.pow(1 - Math.abs((radiusEarth - 1.0) / (radiusEarth + 1.0)), 0.57 / 4);
  const esiD = Math.pow(1 - Math.abs((densityRatio - 1.0) / (densityRatio + 1.0)), 1.07 / 4);
  const esiV = Math.pow(1 - Math.abs((vEscRatio - 1.0) / (vEscRatio + 1.0)), 0.70 / 4);
  const esiT = Math.pow(1 - Math.abs((surfaceTempK - 288) / (surfaceTempK + 288)), 5.58 / 4);

  const raw = esiR * esiD * esiV * esiT;
  return round(Math.max(0.01, Math.min(0.99, raw)), 2);
}

function classifyPlanet({ radiusEarth, surfaceTempK, semiMajorAu, hzInner, hzOuter, rng, isPulsar }) {
  // Decide gas/ice giant vs terrestrial/sub-neptune based on orbital zone and RNG
  const inSnowLine = semiMajorAu > hzOuter * 2.1;
  const inHabitableBand = semiMajorAu >= hzInner * 0.82 && semiMajorAu <= hzOuter * 1.18;

  let type, palette, atmosphere, radius, mass, albedo, greenhouseK, hasRings, moons;

  const roll = rng();

  if (inHabitableBand && roll < 0.72) {
    // High chance of intriguing terrestrial / ocean / desert super-earth in HZ
    radius = lerp(0.76, 1.68, rng());
    const densityFactor = lerp(0.88, 1.16, rng());
    mass = Math.pow(radius, 3) * densityFactor;
    albedo = lerp(0.24, 0.38, rng());
    greenhouseK = lerp(18, 38, rng());

    const estTemp = surfaceTempK + greenhouseK;
    if (estTemp > 325) {
      type = 'Desert Dune World';
      palette = { primary: '#d97706', secondary: '#92400e', ocean: '#451a03', cloud: '#fde68a', atmo: '#fbbf24' };
      atmosphere = { N2: 64, CO2: 28, O2: 5, Ar: 3 };
    } else if (rng() < 0.45) {
      type = 'Archipelago Ocean World';
      palette = { primary: '#0284c7', secondary: '#10b981', ocean: '#0369a1', cloud: '#f8fafc', atmo: '#38bdf8' };
      atmosphere = { N2: 73, O2: 23, H2O: 3, Ar: 1 };
    } else {
      type = 'Temperate Terran';
      palette = { primary: '#16a34a', secondary: '#ca8a04', ocean: '#1d4ed8', cloud: '#ffffff', atmo: '#60a5fa' };
      atmosphere = { N2: 77, O2: 21, Ar: 1, CO2: 1 };
    }
    hasRings = rng() < 0.14;
    moons = Math.floor(rng() * 3);
  } else if (surfaceTempK > 580 && roll < 0.8) {
    // Scorching close-in planet
    if (roll < 0.22) {
      // Hot Jupiter!
      radius = lerp(8.5, 13.5, rng());
      mass = lerp(95, 380, rng());
      albedo = lerp(0.08, 0.22, rng());
      greenhouseK = 120;
      type = 'Hot Gas Giant';
      palette = { primary: '#ea580c', secondary: '#7c2d12', ocean: '#431407', cloud: '#fdba74', atmo: '#fb923c' };
      atmosphere = { H2: 81, He: 16, CO: 2, Na: 1 };
      hasRings = rng() < 0.18;
      moons = Math.floor(rng() * 4);
    } else {
      radius = lerp(0.55, 1.75, rng());
      mass = Math.pow(radius, 3) * lerp(1.05, 1.45, rng());
      albedo = lerp(0.09, 0.18, rng());
      greenhouseK = lerp(30, 95, rng());
      type = 'Lava World';
      palette = { primary: '#27272a', secondary: '#ef4444', ocean: '#f97316', cloud: '#7f1d1d', atmo: '#f43f5e' };
      atmosphere = { SO2: 56, CO2: 34, SiO: 7, N2: 3 };
      hasRings = false;
      moons = rng() < 0.2 ? 1 : 0;
    }
  } else if (inSnowLine && roll < 0.68) {
    // Outer Gas Giants & Ringed Ice Giants
    if (rng() < 0.52) {
      radius = lerp(7.2, 12.4, rng());
      mass = lerp(75, 340, rng());
      albedo = lerp(0.34, 0.54, rng());
      greenhouseK = 45;
      type = 'Gas Giant';
      palette = { primary: '#d97706', secondary: '#fde68a', ocean: '#78350f', cloud: '#fef3c7', atmo: '#fbbf24' };
      atmosphere = { H2: 86, He: 13, CH4: 1 };
      hasRings = rng() < 0.58;
      moons = 2 + Math.floor(rng() * 7);
    } else {
      radius = lerp(3.4, 5.6, rng());
      mass = lerp(12, 32, rng());
      albedo = lerp(0.30, 0.48, rng());
      greenhouseK = 25;
      type = 'Ringed Ice Giant';
      palette = { primary: '#06b6d4', secondary: '#3b82f6', ocean: '#164e63', cloud: '#cffafe', atmo: '#22d3ee' };
      atmosphere = { H2: 79, He: 18, CH4: 3 };
      hasRings = rng() < 0.78;
      moons = 1 + Math.floor(rng() * 5);
    }
  } else if (roll < 0.35) {
    // Sub-Neptune / Hycean world
    radius = lerp(1.9, 3.2, rng());
    mass = lerp(4.5, 11.5, rng());
    albedo = lerp(0.28, 0.44, rng());
    greenhouseK = lerp(35, 65, rng());
    type = 'Sub-Neptune';
    palette = { primary: '#6366f1', secondary: '#38bdf8', ocean: '#312e81', cloud: '#e0e7ff', atmo: '#818cf8' };
    atmosphere = { H2: 68, He: 21, H2O: 8, CH4: 3 };
    hasRings = rng() < 0.28;
    moons = Math.floor(rng() * 4);
  } else if (surfaceTempK < 195) {
    // Cryo-Titan / Frozen Super-Earth
    radius = lerp(0.62, 1.65, rng());
    mass = Math.pow(radius, 3) * lerp(0.72, 1.02, rng());
    albedo = lerp(0.45, 0.68, rng());
    greenhouseK = lerp(8, 22, rng());
    type = isPulsar ? 'Crystalline Carbon World' : 'Cryo-Titan';
    palette = isPulsar
      ? { primary: '#a855f7', secondary: '#ec4899', ocean: '#3b0764', cloud: '#f3e8ff', atmo: '#c084fc' }
      : { primary: '#cbd5e1', secondary: '#64748b', ocean: '#0f172a', cloud: '#f1f5f9', atmo: '#94a3b8' };
    atmosphere = { N2: 88, CH4: 9, Ar: 3 };
    hasRings = rng() < 0.22;
    moons = Math.floor(rng() * 3);
  } else {
    // Rocky Core / Greenhouse Super-Earth
    radius = lerp(0.58, 1.85, rng());
    mass = Math.pow(radius, 3) * lerp(0.92, 1.25, rng());
    albedo = lerp(0.16, 0.34, rng());
    greenhouseK = lerp(12, 55, rng());
    type = radius > 1.32 ? 'Super-Earth' : 'Rocky Core';
    palette = { primary: '#a16207', secondary: '#78716c', ocean: '#292524', cloud: '#e7e5e4', atmo: '#d6d3d1' };
    atmosphere = { CO2: 72, N2: 24, SO2: 3, Ar: 1 };
    hasRings = rng() < 0.12;
    moons = Math.floor(rng() * 2);
  }

  return { type, palette, atmosphere, radius, mass, albedo, greenhouseK, hasRings, moons };
}

function generateInitialAnomaly(type, esi, isPulsar, rng) {
  if (isPulsar && rng() < 0.6) {
    return 'Relativistic aurorae triggered by millisecond pulsar beam';
  }
  if (esi >= 0.80) {
    const bio = [
      'Strong O₂ + CH₄ atmospheric disequilibrium marker',
      'Red-edge surface reflectance consistent with photosynthetic flora',
      'Seasonal H₂O vapor transport across equatorial archipelagos',
      'Stable dipolar magnetosphere shielding surface oceans'
    ];
    return bio[Math.floor(rng() * bio.length)];
  }
  const map = {
    'Lava World': 'Tidal magma ocean with silicate vapor plumes',
    'Archipelago Ocean World': 'Global pelagic ocean dotted with volcanic island chains',
    'Temperate Terran': 'Liquid water hydrological cycle & silicate continental shelves',
    'Desert Dune World': 'Equatorial erg dune seas & polar twilight aquifers',
    'Gas Giant': 'Anticyclonic super-storm spanning 28,000 km',
    'Hot Gas Giant': 'Supersonic equatorial jet streams & titanium oxide clouds',
    'Ringed Ice Giant': 'High-albedo water-ice ring arcs shepherded by inner moonlets',
    'Sub-Neptune': 'Deep supercritical water mantle beneath hydrogen envelope',
    'Cryo-Titan': 'Liquid methane lakes & active nitrogen cryovolcanoes',
    'Crystalline Carbon World': 'High-pressure diamond mantle formed from pulsar fallback disk',
    'Super-Earth': 'High-gravity tectonic plateaus & dense cloud decks',
    'Rocky Core': 'Ancient multi-ring impact basin exposing iron-nickel regolith'
  };
  return map[type] || 'Unclassified orbital resonance signature';
}

/**
 * Deterministically generate a complete star system + exoplanets from any seed string
 */
function synthesizeSystem({ seed, customName, spectralBias } = {}) {
  const effectiveSeed = (seed && String(seed).trim()) || `sector-${Date.now()}-${Math.floor(Math.random() * 9999)}`;
  const rng = createRng(effectiveSeed.toLowerCase());

  const profile = pickWeightedSpectral(rng, spectralBias);
  const subType = profile.code === 'PSR' || profile.code === 'WD' ? '' : Math.floor(rng() * 10);
  const lumClass = profile.code === 'PSR' ? '' : profile.code === 'WD' ? 'VII' : profile.code === 'O' ? 'III' : 'V';
  const spectralType = `${profile.code}${subType}${lumClass}`;

  const starMassSolar = round(lerp(profile.massRange[0], profile.massRange[1], rng()), 3);
  const starRadiusSolar = round(lerp(profile.radiusRange[0], profile.radiusRange[1], rng()), 3);
  const starTempK = Math.round(lerp(profile.tempRange[0], profile.tempRange[1], rng()));

  // Stefan-Boltzmann luminosity in Solar units: L/L_sun = (R/R_sun)^2 * (T/5778)^4
  const rawLuminosity = (starRadiusSolar ** 2) * Math.pow(starTempK / 5778, 4);
  const luminositySolar = round(Math.max(0.0004, rawLuminosity), 4);

  // Circumstellar Habitable Zone bounds in AU
  const hzInnerAu = round(Math.sqrt(luminositySolar / 1.1), 3);
  const hzOuterAu = round(Math.sqrt(luminositySolar / 0.53), 3);
  const hzCenterAu = (hzInnerAu + hzOuterAu) * 0.5;

  const sector = SECTORS[Math.floor(rng() * SECTORS.length)];
  const catalogNum = 100 + Math.floor(rng() * 899);
  const prefix = STAR_PREFIXES[Math.floor(rng() * STAR_PREFIXES.length)];
  const autoName = customName && String(customName).trim()
    ? String(customName).trim()
    : `${prefix}-${catalogNum}`;

  const distanceLy = round(lerp(11.5, 1480, Math.pow(rng(), 1.4)), 1);
  const ageGyr = round(lerp(0.4, 11.2, rng()), 2);

  // Number of planets: 4 to 8
  const planetCount = 4 + Math.floor(rng() * 5);

  // Generate orbital semi-major axes centered nicely around the star's HZ scale
  // So even ultra-compact M-dwarfs (HZ ~ 0.08 AU) and bright F-stars (HZ ~ 1.9 AU) have well-spaced systems
  const minAu = Math.max(0.015, hzInnerAu * lerp(0.18, 0.36, rng()));
  const growthBase = lerp(1.48, 1.78, rng());

  const semiMajorList = [];
  for (let i = 0; i < planetCount; i++) {
    const jitter = lerp(0.90, 1.12, rng());
    semiMajorList.push(minAu * Math.pow(growthBase, i) * jitter);
  }

  // Nudge one planet toward the habitable zone 75% of the time if none landed inside it
  const hasHzPlanet = semiMajorList.some((a) => a >= hzInnerAu * 0.85 && a <= hzOuterAu * 1.15);
  if (!hasHzPlanet && rng() < 0.78) {
    // Pick planet closest to hzCenterAu and gently adjust
    let closestIdx = 0;
    let bestDiff = Infinity;
    semiMajorList.forEach((a, idx) => {
      const diff = Math.abs(Math.log(a / hzCenterAu));
      if (diff < bestDiff) {
        bestDiff = diff;
        closestIdx = idx;
      }
    });
    semiMajorList[closestIdx] = lerp(hzInnerAu * 0.92, hzOuterAu * 1.05, rng());
    semiMajorList.sort((a, b) => a - b);
  }

  const isPulsar = profile.code === 'PSR';

  const planets = semiMajorList.map((rawAu, i) => {
    const semiMajorAu = round(rawAu, 4);
    const eccentricity = round(lerp(0.005, 0.16, Math.pow(rng(), 1.8)), 3);

    // Kepler's Third Law: P (years) = sqrt(a^3 / M_star)
    const periodYears = Math.sqrt(Math.pow(semiMajorAu, 3) / starMassSolar);
    const orbitalPeriodDays = round(Math.max(0.4, periodYears * 365.256), 2);

    // Bare blackbody equilibrium temperature at semiMajorAu (initial albedo ~0.3)
    // T_eq = 278.5 * (L^0.25) / sqrt(a)
    const baseEqTempK = (278.5 * Math.pow(luminositySolar, 0.25)) / Math.sqrt(semiMajorAu);

    const trait = classifyPlanet({
      radiusEarth: 1,
      surfaceTempK: baseEqTempK,
      semiMajorAu,
      hzInner: hzInnerAu,
      hzOuter: hzOuterAu,
      rng,
      isPulsar
    });

    const trueEqTempK = baseEqTempK * Math.pow((1 - trait.albedo) / 0.7, 0.25);
    const surfaceTempK = Math.round(Math.max(28, trueEqTempK + trait.greenhouseK));

    const radiusEarth = round(trait.radius, 2);
    const massEarth = round(trait.mass, 2);
    const gravityG = round(massEarth / Math.pow(radiusEarth, 2), 2);

    // Gas/Ice giants cannot have high terrestrial ESI
    const isGiant = ['Gas Giant', 'Hot Gas Giant', 'Ringed Ice Giant', 'Sub-Neptune'].includes(trait.type);
    const rawEsi = computeESI({ radiusEarth, massEarth, surfaceTempK });
    const esi = isGiant ? round(Math.min(0.42, rawEsi * 0.62), 2) : rawEsi;

    const initialPhaseRad = round(rng() * Math.PI * 2, 4);
    const axialTiltDeg = round(lerp(1.5, 42.0, rng()), 1);
    const anomaly = generateInitialAnomaly(trait.type, esi, isPulsar, rng);

    return {
      designation: `${autoName} ${ROMAN_NUMERALS[i] || `p${i + 1}`}`,
      orbitIndex: i + 1,
      type: trait.type,
      semiMajorAu,
      eccentricity,
      orbitalPeriodDays,
      initialPhaseRad,
      axialTiltDeg,
      radiusEarth,
      massEarth,
      gravityG,
      albedo: round(trait.albedo, 2),
      surfaceTempK,
      esi,
      hasRings: trait.hasRings,
      moons: trait.moons,
      palette: trait.palette,
      atmosphere: trait.atmosphere,
      anomaly,
      inHabitableZone: semiMajorAu >= hzInnerAu * 0.85 && semiMajorAu <= hzOuterAu * 1.15
    };
  });

  return {
    seed: effectiveSeed,
    name: autoName,
    sector,
    spectralClass: profile.code,
    spectralType,
    spectralLabel: profile.label,
    starColor: profile.color,
    starGlow: profile.glow,
    starMassSolar,
    starRadiusSolar,
    starTempK,
    luminositySolar,
    hzInnerAu,
    hzOuterAu,
    distanceLy,
    ageGyr,
    planets
  };
}

/**
 * Exact Keplerian 2-body orbital solver (Newton-Raphson on M = E - e*sin(E))
 */
function solveKepler({ starMassSolar = 1.0, semiMajorAxisAu = 1.0, eccentricity = 0.02, timeDays = 0, initialPhaseRad = 0 }) {
  const M_star = Math.max(0.05, Number(starMassSolar));
  const a = Math.max(0.005, Number(semiMajorAxisAu));
  const e = Math.min(0.92, Math.max(0, Number(eccentricity)));
  const periodDays = Math.sqrt(Math.pow(a, 3) / M_star) * 365.256;

  const meanMotion = (2 * Math.PI) / periodDays;
  let M = (initialPhaseRad + meanMotion * Number(timeDays)) % (2 * Math.PI);
  if (M < 0) M += 2 * Math.PI;

  // Newton-Raphson for Eccentric Anomaly E
  let E = M + e * Math.sin(M);
  for (let iter = 0; iter < 8; iter++) {
    const f = E - e * Math.sin(E) - M;
    const fp = 1 - e * Math.cos(E);
    E -= f / fp;
  }

  const cosE = Math.cos(E);
  const sinE = Math.sin(E);
  const sqrtFactor = Math.sqrt(1 - e * e);

  const xAu = a * (cosE - e);
  const yAu = a * sqrtFactor * sinE;
  const distanceAu = Math.hypot(xAu, yAu);
  const trueAnomalyRad = Math.atan2(sqrtFactor * sinE, cosE - e);

  // Vis-viva equation: v = 29.78 * sqrt(M_star * (2/r - 1/a)) km/s
  const velocityKmS = 29.7847 * Math.sqrt(M_star * Math.max(0, 2 / distanceAu - 1 / a));

  return {
    orbitalPeriodDays: round(periodDays, 3),
    meanAnomalyRad: round(M, 5),
    eccentricAnomalyRad: round(E, 5),
    trueAnomalyRad: round(trueAnomalyRad, 5),
    distanceAu: round(distanceAu, 5),
    velocityKmS: round(velocityKmS, 3),
    xAu: round(xAu, 5),
    yAu: round(yAu, 5)
  };
}

/**
 * Generate a rich Deep-Space Spectroscopic & Radar Scan report
 */
function performSpectroscopicScan(planet, nextScanCount) {
  const rng = createRng(`${planet.designation}-scan-${nextScanCount}-${planet.surfaceTempK}`);

  const findingsPool = [];
  if (planet.esi >= 0.72) {
    findingsPool.push(
      { title: 'Biosignature Disequilibrium', detail: 'High-resolution JWST-class transmission spectrum confirms simultaneous O₃, CH₄, and H₂O absorption bands.', confidence: round(lerp(0.78, 0.97, rng()), 2), tag: 'BIOSIGNATURE' },
      { title: 'Chlorophyll Red-Edge Shift', detail: 'Polarimetric phase curve exhibits sharp 710 nm reflectance jump across mid-latitude landmasses.', confidence: round(lerp(0.71, 0.94, rng()), 2), tag: 'HABITABILITY' },
      { title: 'Sub-crustal Tidal Hydrosphere', detail: 'Radar altimetry indicates deep liquid ocean circulation moderating day-night thermal gradients.', confidence: round(lerp(0.82, 0.96, rng()), 2), tag: 'HYDROLOGY' }
    );
  }

  if (planet.surfaceTempK > 550) {
    findingsPool.push(
      { title: 'Corundum & Perovskite Clouds', detail: 'Dayside thermal emission reveals refractory mineral clouds condensing near the evening terminator.', confidence: round(lerp(0.84, 0.98, rng()), 2), tag: 'THERMAL' },
      { title: 'Active Silicate Volcanism', detail: 'Transient SO₂ spike detected (+340 ppm), pointing to a planetary-scale caldera eruption.', confidence: round(lerp(0.79, 0.95, rng()), 2), tag: 'GEOLOGY' }
    );
  }

  findingsPool.push(
    { title: 'Magnetospheric Cyclotron Burst', detail: `Coherent decametric radio emission measured at ${round(lerp(14, 88, rng()), 1)} MHz — confirms active core dynamo.`, confidence: round(lerp(0.80, 0.98, rng()), 2), tag: 'MAGNETOSPHERE' },
    { title: 'Shepherd Moonlet Perturbation', detail: 'Transit timing variations (TTV ±4.2 min) reveal a previously unresolved exomoon in 3:2 orbital resonance.', confidence: round(lerp(0.76, 0.93, rng()), 2), tag: 'ORBITAL' },
    { title: 'Isotopic Noble Gas Ratio', detail: '⁴⁰Ar/³⁶Ar enrichment suggests prolonged crustal outgassing and active plate recycling.', confidence: round(lerp(0.74, 0.91, rng()), 2), tag: 'GEOCHEMISTRY' },
    { title: 'Narrowband Telemetry Echo', detail: 'Unexplained 1.420 GHz hydrogen-line harmonic pulse lasting 11.4 seconds; flagged for SETI follow-up.', confidence: round(lerp(0.58, 0.89, rng()), 2), tag: 'ANOMALY' }
  );

  const chosen = findingsPool[(nextScanCount - 1 + Math.floor(rng() * findingsPool.length)) % findingsPool.length];
  const bonusMoon = chosen.tag === 'ORBITAL' && nextScanCount <= 3 ? 1 : 0;

  return {
    scanNumber: nextScanCount,
    title: chosen.title,
    detail: chosen.detail,
    confidence: chosen.confidence,
    tag: chosen.tag,
    bonusMoon,
    signalToNoise: round(lerp(18.5, 94.2, rng()), 1),
    wavelengthUm: `${round(lerp(0.6, 2.4, rng()), 1)}–${round(lerp(5.2, 24.0, rng()), 1)} μm`
  };
}

module.exports = {
  SPECTRAL_PROFILES,
  synthesizeSystem,
  solveKepler,
  performSpectroscopicScan,
  computeESI
};
