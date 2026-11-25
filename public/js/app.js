import { OrreryRenderer } from './orrery.js';
import { PlanetGlobeRenderer } from './planetGlobe.js';
import { SpaceAudioEngine } from './audio.js';

const GAS_COLORS = {
  N2: '#38bdf8',
  O2: '#10b981',
  H2O: '#0ea5e9',
  CO2: '#f59e0b',
  CH4: '#a78bfa',
  H2: '#6366f1',
  He: '#94a3b8',
  SO2: '#f43f5e',
  Ar: '#cbd5e1',
  CO: '#fb923c',
  SiO: '#ef4444',
  Na: '#fde047'
};

const RANDOM_COSMIC_SEEDS = [
  'velorum-singularity', 'kepler-emerald-reef', 'cassiopeia-glass-rain',
  'cygnus-binary-choir', 'lyra-obsidian-forge', 'centauri-golden-arch',
  'perseus-aurora-tide', 'tucana-cobalt-ring', 'orion-sapphire-cradle',
  'eridanus-silent-monolith', 'aquila-diamond-core', 'draco-crimson-halo'
];

// Application State
const state = {
  systems: [],
  topPlanets: [],
  currentSystem: null,
  selectedPlanet: null,
  activeFilter: 'all',
  searchQuery: '',
  apiCallCount: 0,
  networkLogs: []
};

// DOM Elements
const el = {
  healthSummary: document.getElementById('health-summary'),
  discoverForm: document.getElementById('discover-form'),
  seedInput: document.getElementById('seed-input'),
  spectralBias: document.getElementById('spectral-bias'),
  randomBtn: document.getElementById('random-btn'),
  audioToggle: document.getElementById('audio-toggle'),
  audioIcon: document.getElementById('audio-icon'),
  apiDrawerToggle: document.getElementById('api-drawer-toggle'),
  apiDrawer: document.getElementById('api-drawer'),
  apiDrawerClose: document.getElementById('api-drawer-close'),
  apiReqCount: document.getElementById('api-req-count'),

  systemsCountBadge: document.getElementById('systems-count-badge'),
  habitableCountBadge: document.getElementById('habitable-count-badge'),
  systemSearch: document.getElementById('system-search'),
  systemsList: document.getElementById('systems-list'),
  topPlanetsList: document.getElementById('top-planets-list'),

  orreryCanvas: document.getElementById('orrery-canvas'),
  canvasTooltip: document.getElementById('canvas-tooltip'),
  toggleHz: document.getElementById('toggle-hz'),
  toggleLabels: document.getElementById('toggle-labels'),
  zoomIn: document.getElementById('zoom-in'),
  zoomOut: document.getElementById('zoom-out'),
  zoomReset: document.getElementById('zoom-reset'),

  hudStarOrb: document.getElementById('hud-star-orb'),
  hudStarName: document.getElementById('hud-star-name'),
  hudStarSub: document.getElementById('hud-star-sub'),
  hudMass: document.getElementById('hud-mass'),
  hudTemp: document.getElementById('hud-temp'),
  hudLum: document.getElementById('hud-lum'),
  hudHz: document.getElementById('hud-hz'),
  hudEpoch: document.getElementById('hud-epoch'),

  planetOrbitTag: document.getElementById('planet-orbit-tag'),
  planetName: document.getElementById('planet-name'),
  planetType: document.getElementById('planet-type'),
  bookmarkBtn: document.getElementById('bookmark-btn'),
  planetGlobe: document.getElementById('planet-globe'),
  esiCircle: document.getElementById('esi-circle'),
  planetEsi: document.getElementById('planet-esi'),
  orbitStrip: document.getElementById('orbit-strip'),
  planetTemp: document.getElementById('planet-temp'),
  planetPeriod: document.getElementById('planet-period'),
  planetAu: document.getElementById('planet-au'),
  planetSize: document.getElementById('planet-size'),
  planetGravity: document.getElementById('planet-gravity'),
  planetMoons: document.getElementById('planet-moons'),
  atmoBar: document.getElementById('atmo-bar'),
  atmoLegend: document.getElementById('atmo-legend'),
  planetAnomaly: document.getElementById('planet-anomaly'),
  scanCountBadge: document.getElementById('scan-count-badge'),
  scanBtn: document.getElementById('scan-btn'),
  scansFeed: document.getElementById('scans-feed'),
  planetNotes: document.getElementById('planet-notes'),
  notesStatus: document.getElementById('notes-status'),

  playMethod: document.getElementById('play-method'),
  playPath: document.getElementById('play-path'),
  playBodyWrap: document.getElementById('play-body-wrap'),
  playBody: document.getElementById('play-body'),
  playSend: document.getElementById('play-send'),
  playCurl: document.getElementById('play-curl'),
  playStatus: document.getElementById('play-status'),
  playLatency: document.getElementById('play-latency'),
  playOutput: document.getElementById('play-output'),
  networkLogList: document.getElementById('network-log-list'),
  clearLogBtn: document.getElementById('clear-log-btn'),
  toast: document.getElementById('toast')
};

// Initialize Renderers & Audio
const audio = new SpaceAudioEngine();
const globe = new PlanetGlobeRenderer(el.planetGlobe);
const orrery = new OrreryRenderer(el.orreryCanvas, el.canvasTooltip, (planetId) => {
  selectPlanetById(planetId);
});

orrery.onTickEpoch = (days) => {
  el.hudEpoch.textContent = `Day ${days.toFixed(1)}`;
};

let toastTimer = null;
function showToast(msg) {
  el.toast.textContent = msg;
  el.toast.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.toast.classList.add('hidden'), 3200);
}

/**
 * Instrumented API client using strictly relative URLs (/api/...)
 * Records every request/response into the Live Network Stream
 */
async function apiFetch(path, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const t0 = performance.now();
  const fetchOpts = {
    method,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
  };
  if (options.body !== undefined) {
    fetchOpts.body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
  }

  const res = await fetch(path, fetchOpts);
  const clientMs = (performance.now() - t0).toFixed(1);
  const serverTime = res.headers.get('X-Response-Time') || `${clientMs}ms`;
  const data = await res.json().catch(() => ({}));

  state.apiCallCount += 1;
  el.apiReqCount.textContent = String(state.apiCallCount);

  state.networkLogs.unshift({
    id: state.apiCallCount,
    method,
    path,
    status: res.status,
    latency: serverTime,
    data
  });
  if (state.networkLogs.length > 45) state.networkLogs.pop();
  renderNetworkLog();

  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return { data, status: res.status, latency: serverTime };
}

function renderNetworkLog() {
  el.networkLogList.innerHTML = state.networkLogs.map((entry) => `
    <div class="net-entry" data-log-id="${entry.id}" title="Click to inspect JSON payload">
      <span class="m-tag m-${entry.method}">${entry.method}</span>
      <span class="net-path">${escapeHtml(entry.path)}</span>
      <span class="net-meta">${entry.status} · ${entry.latency}</span>
    </div>
  `).join('');

  el.networkLogList.querySelectorAll('.net-entry').forEach((node) => {
    node.addEventListener('click', () => {
      const item = state.networkLogs.find((x) => x.id === Number(node.dataset.logId));
      if (!item) return;
      el.playStatus.textContent = `${item.method} ${item.path} → ${item.status}`;
      el.playLatency.textContent = `Server: ${item.latency}`;
      el.playOutput.textContent = JSON.stringify(item.data, null, 2);
    });
  });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function refreshHealthAndCatalog() {
  const [healthRes, systemsRes, topRes] = await Promise.all([
    apiFetch('/api/health'),
    fetchFilteredSystems(),
    apiFetch('/api/planets?minEsi=0.55&limit=25')
  ]);

  const c = healthRes.data.catalog;
  el.healthSummary.textContent = `API ONLINE · ${c.systems} SYSTEMS · ${c.planets} WORLDS · ${c.habitableCandidates} HABITABLE`;

  state.topPlanets = topRes.data.planets;
  el.habitableCountBadge.textContent = String(c.habitableCandidates);
  renderTopPlanetsList();

  return systemsRes;
}

async function fetchFilteredSystems() {
  const params = new URLSearchParams();
  if (state.searchQuery) params.set('q', state.searchQuery);
  if (state.activeFilter === 'habitable') params.set('habitable', 'true');
  else if (state.activeFilter === 'PSR') params.set('spectral', 'PSR');

  const qs = params.toString();
  const { data } = await apiFetch(`/api/systems${qs ? `?${qs}` : ''}`);
  state.systems = data.systems;
  el.systemsCountBadge.textContent = String(data.count);
  renderSystemsList();
  return data.systems;
}

function renderSystemsList() {
  if (!state.systems.length) {
    el.systemsList.innerHTML = `<div style="padding:18px;text-align:center;color:#64748b">No matching star systems. Synthesize a new one above!</div>`;
    return;
  }

  el.systemsList.innerHTML = state.systems.map((sys) => {
    const isActive = state.currentSystem?.id === sys.id;
    const esiClass = sys.maxEsi >= 0.72 ? 'high' : sys.maxEsi >= 0.50 ? 'mid' : '';
    return `
      <div class="sys-card ${isActive ? 'active' : ''}" data-sys-id="${sys.id}">
        <div class="sys-card-left">
          <span class="sys-dot" style="background:${sys.starColor};box-shadow:0 0 10px ${sys.starGlow}"></span>
          <div style="min-width:0">
            <div class="sys-name">${escapeHtml(sys.name)}</div>
            <div class="sys-meta">${escapeHtml(sys.spectralType)} · ${sys.planetCount} worlds · ${sys.distanceLy} ly</div>
          </div>
        </div>
        <div class="sys-badges">
          <span class="esi-pill ${esiClass}">ESI ${Number(sys.maxEsi).toFixed(2)}</span>
        </div>
      </div>
    `;
  }).join('');

  el.systemsList.querySelectorAll('.sys-card').forEach((card) => {
    card.addEventListener('click', () => {
      loadSystem(Number(card.dataset.sysId));
    });
  });
}

function renderTopPlanetsList() {
  if (!state.topPlanets.length) {
    el.topPlanetsList.innerHTML = `<div style="padding:18px;text-align:center;color:#64748b">No habitable candidates yet.</div>`;
    return;
  }

  el.topPlanetsList.innerHTML = state.topPlanets.map((p) => {
    const isActive = state.selectedPlanet?.id === p.id;
    const esiClass = p.esi >= 0.72 ? 'high' : 'mid';
    return `
      <div class="sys-card ${isActive ? 'active' : ''}" data-p-id="${p.id}" data-s-id="${p.systemId}">
        <div class="sys-card-left">
          <span class="sys-dot" style="background:${p.palette.primary};box-shadow:0 0 8px ${p.palette.atmo}"></span>
          <div style="min-width:0">
            <div class="sys-name">${p.bookmarked ? '★ ' : ''}${escapeHtml(p.name)}</div>
            <div class="sys-meta">${escapeHtml(p.type)} · ${p.surfaceTempC}°C</div>
          </div>
        </div>
        <div class="sys-badges">
          <span class="esi-pill ${esiClass}">${p.esi.toFixed(2)} ESI</span>
        </div>
      </div>
    `;
  }).join('');

  el.topPlanetsList.querySelectorAll('.sys-card').forEach((card) => {
    card.addEventListener('click', async () => {
      const sysId = Number(card.dataset.sId);
      const pId = Number(card.dataset.pId);
      await loadSystem(sysId, pId);
    });
  });
}

async function loadSystem(systemId, preferredPlanetId = null) {
  const { data: sys } = await apiFetch(`/api/systems/${systemId}`);
  state.currentSystem = sys;

  // Update Star HUD
  el.hudStarOrb.style.background = sys.starColor;
  el.hudStarOrb.style.boxShadow = `0 0 16px ${sys.starGlow}`;
  el.hudStarName.textContent = `${sys.name} (${sys.spectralType})`;
  el.hudStarSub.textContent = `${sys.spectralLabel} · ${sys.sector} · ${sys.distanceLy} ly · ${sys.ageGyr} Gyr`;
  el.hudMass.textContent = `${sys.starMassSolar} M☉`;
  el.hudTemp.textContent = `${sys.starTempK.toLocaleString()} K`;
  el.hudLum.textContent = `${sys.luminositySolar} L☉`;
  el.hudHz.textContent = `${sys.hzInnerAu} – ${sys.hzOuterAu} AU`;

  // Pick preferred planet or highest ESI world by default
  let targetPlanet = sys.planets.find((p) => p.id === preferredPlanetId);
  if (!targetPlanet && sys.planets.length > 0) {
    targetPlanet = [...sys.planets].sort((a, b) => b.esi - a.esi)[0];
  }

  orrery.setSystem(sys, targetPlanet?.id);
  renderSystemsList();
  if (targetPlanet) {
    selectPlanetById(targetPlanet.id);
  }
}

function selectPlanetById(planetId) {
  if (!state.currentSystem) return;
  const planet = state.currentSystem.planets.find((p) => p.id === Number(planetId));
  if (!planet) return;

  state.selectedPlanet = planet;
  orrery.setSelectedPlanet(planet.id);
  globe.setPlanet(planet);
  audio.updateTuning(state.currentSystem, planet);

  renderPlanetDossier(planet);
  renderTopPlanetsList();
}

function renderPlanetDossier(p) {
  el.planetOrbitTag.textContent = `ORBIT 0${p.orbitIndex} · ${p.inHabitableZone ? 'HABITABLE ZONE' : 'OUTSIDE HZ'}`;
  el.planetOrbitTag.style.color = p.inHabitableZone ? '#34d399' : '#38bdf8';
  el.planetName.textContent = p.name;
  el.planetType.textContent = p.type;

  el.bookmarkBtn.textContent = p.bookmarked ? '★' : '☆';
  el.bookmarkBtn.classList.toggle('active', p.bookmarked);

  // ESI Circular Ring (circumference = 2 * pi * 33 = 207.35)
  const circumference = 207.35;
  const offset = circumference * (1 - Math.max(0, Math.min(1, p.esi)));
  el.esiCircle.style.strokeDashoffset = String(offset);
  el.esiCircle.style.stroke = p.esi >= 0.70 ? '#10b981' : p.esi >= 0.48 ? '#38bdf8' : p.esi >= 0.28 ? '#f59e0b' : '#f43f5e';
  el.planetEsi.textContent = p.esi.toFixed(2);

  // Orbit Quick Strip
  el.orbitStrip.innerHTML = state.currentSystem.planets.map((item) => `
    <button
      type="button"
      class="orbit-node ${item.id === p.id ? 'active' : ''} ${item.inHabitableZone ? 'hz' : ''}"
      data-orb-id="${item.id}"
      title="${escapeHtml(item.name)} (${item.type} · ESI ${item.esi})"
    >
      0${item.orbitIndex}
    </button>
  `).join('');

  el.orbitStrip.querySelectorAll('.orbit-node').forEach((btn) => {
    btn.addEventListener('click', () => selectPlanetById(Number(btn.dataset.orbId)));
  });

  // Telemetry values
  el.planetTemp.textContent = `${p.surfaceTempC > 0 ? '+' : ''}${p.surfaceTempC}°C (${p.surfaceTempK} K)`;
  el.planetPeriod.textContent = p.orbitalPeriodDays >= 1000
    ? `${(p.orbitalPeriodDays / 365.25).toFixed(1)} yr`
    : `${p.orbitalPeriodDays} d`;
  el.planetAu.textContent = `${p.semiMajorAu} AU (e=${p.eccentricity})`;
  el.planetSize.textContent = `${p.radiusEarth} R⊕ · ${p.massEarth} M⊕`;
  el.planetGravity.textContent = `${p.gravityG} g · ${p.axialTiltDeg}° tilt`;
  el.planetMoons.textContent = `${p.moons} moon${p.moons === 1 ? '' : 's'} · ${p.hasRings ? 'Ringed' : 'No rings'}`;

  // Atmospheric spectroscopy stacked bar
  const entries = Object.entries(p.atmosphere || {});
  el.atmoBar.innerHTML = entries.map(([gas, pct]) => `
    <div class="atmo-seg" style="width:${pct}%;background:${GAS_COLORS[gas] || '#64748b'}" title="${gas}: ${pct}%"></div>
  `).join('');

  el.atmoLegend.innerHTML = entries.map(([gas, pct]) => `
    <span class="legend-item">
      <span class="legend-swatch" style="background:${GAS_COLORS[gas] || '#64748b'}"></span>
      ${gas} ${pct}%
    </span>
  `).join('');

  // Anomaly & Deep Scans
  el.planetAnomaly.textContent = p.anomaly;
  el.scanCountBadge.textContent = `${p.scanCount} scan${p.scanCount === 1 ? '' : 's'}`;
  el.planetNotes.value = p.notes || '';

  const scans = p.scans || [];
  el.scansFeed.innerHTML = scans.slice(0, 4).map((sc) => `
    <div class="scan-item">
      <div class="scan-item-top">
        <span class="scan-tag">${escapeHtml(sc.tag)}</span>
        <span class="scan-snr">SNR ${sc.signalToNoise} · ${Math.round(sc.confidence * 100)}% conf</span>
      </div>
      <div class="scan-title">${escapeHtml(sc.title)}</div>
      <div class="scan-detail">${escapeHtml(sc.detail)}</div>
    </div>
  `).join('');
}

// Event Listeners
el.discoverForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const seed = el.seedInput.value.trim();
  const spectralBias = el.spectralBias.value;
  await synthesizeNewSystem({ seed: seed || undefined, spectralBias: spectralBias || undefined });
  el.seedInput.value = '';
});

el.randomBtn.addEventListener('click', async () => {
  const randomBase = RANDOM_COSMIC_SEEDS[Math.floor(Math.random() * RANDOM_COSMIC_SEEDS.length)];
  const seed = `${randomBase}-${Math.floor(100 + Math.random() * 899)}`;
  await synthesizeNewSystem({ seed });
});

document.querySelectorAll('.seed-chip').forEach((chip) => {
  chip.addEventListener('click', async () => {
    await synthesizeNewSystem({
      seed: chip.dataset.seed,
      spectralBias: chip.dataset.spectral || undefined
    });
  });
});

async function synthesizeNewSystem(payload) {
  try {
    const { data: created } = await apiFetch('/api/systems/discover', {
      method: 'POST',
      body: payload
    });
    await refreshHealthAndCatalog();
    await loadSystem(created.id);
    showToast(`✦ Discovered ${created.name} (${created.spectralType}) — ${created.planets.length} exoplanets cataloged!`);
  } catch (err) {
    showToast(`Error: ${err.message}`);
  }
}

// Left Sidebar Tabs & Filters
document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach((p) => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
  });
});

document.querySelectorAll('.pill').forEach((pill) => {
  pill.addEventListener('click', () => {
    document.querySelectorAll('.pill').forEach((p) => p.classList.remove('active'));
    pill.classList.add('active');
    state.activeFilter = pill.dataset.filter;
    fetchFilteredSystems();
  });
});

let searchDebounce = null;
el.systemSearch.addEventListener('input', () => {
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(() => {
    state.searchQuery = el.systemSearch.value.trim();
    fetchFilteredSystems();
  }, 200);
});

// Orrery Stage Controls
document.querySelectorAll('[data-speed]').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-speed]').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    orrery.speedMultiplier = Number(btn.dataset.speed);
  });
});

el.toggleHz.addEventListener('click', () => {
  orrery.showHz = !orrery.showHz;
  el.toggleHz.classList.toggle('active', orrery.showHz);
});

el.toggleLabels.addEventListener('click', () => {
  orrery.showLabels = !orrery.showLabels;
  el.toggleLabels.classList.toggle('active', orrery.showLabels);
});

el.zoomIn.addEventListener('click', () => orrery.adjustZoom(1.25));
el.zoomOut.addEventListener('click', () => orrery.adjustZoom(0.8));
el.zoomReset.addEventListener('click', () => orrery.resetCamera());

// Audio Sonification Toggle
el.audioToggle.addEventListener('click', () => {
  const active = audio.toggle();
  el.audioToggle.classList.toggle('active', active);
  el.audioIcon.textContent = active ? '🔊' : '🔇';
  if (active) {
    showToast('🔊 Radio-Telescope Acoustic Synth Active');
  }
});

// Deep-Space Spectroscopic Scan (POST /api/planets/:id/scan)
el.scanBtn.addEventListener('click', async () => {
  if (!state.selectedPlanet) return;
  el.scanBtn.disabled = true;
  try {
    audio.playScanSweep();
    const { data } = await apiFetch(`/api/planets/${state.selectedPlanet.id}/scan`, {
      method: 'POST'
    });
    // Merge updated planet into currentSystem
    const idx = state.currentSystem.planets.findIndex((p) => p.id === data.planet.id);
    if (idx !== -1) state.currentSystem.planets[idx] = data.planet;
    state.selectedPlanet = data.planet;
    orrery.setSystem(state.currentSystem, data.planet.id);
    renderPlanetDossier(data.planet);
    refreshHealthAndCatalog();
    showToast(`📡 ${data.scan.tag}: ${data.scan.title}`);
  } catch (err) {
    showToast(`Scan failed: ${err.message}`);
  } finally {
    el.scanBtn.disabled = false;
  }
});

// Bookmark Toggle (PATCH /api/planets/:id)
el.bookmarkBtn.addEventListener('click', async () => {
  if (!state.selectedPlanet) return;
  const nextFlag = !state.selectedPlanet.bookmarked;
  const { data: updated } = await apiFetch(`/api/planets/${state.selectedPlanet.id}`, {
    method: 'PATCH',
    body: { bookmarked: nextFlag }
  });
  const idx = state.currentSystem.planets.findIndex((p) => p.id === updated.id);
  if (idx !== -1) {
    updated.scans = state.currentSystem.planets[idx].scans;
    state.currentSystem.planets[idx] = updated;
  }
  state.selectedPlanet = updated;
  renderPlanetDossier(updated);
  refreshHealthAndCatalog();
  showToast(updated.bookmarked ? `★ Bookmarked ${updated.name}` : `Removed bookmark from ${updated.name}`);
});

// Explorer Notes Autosave (PATCH /api/planets/:id)
let notesTimer = null;
el.planetNotes.addEventListener('input', () => {
  if (!state.selectedPlanet) return;
  el.notesStatus.textContent = 'Saving...';
  const targetId = state.selectedPlanet.id;
  const notesVal = el.planetNotes.value;
  clearTimeout(notesTimer);
  notesTimer = setTimeout(async () => {
    const { data: updated } = await apiFetch(`/api/planets/${targetId}`, {
      method: 'PATCH',
      body: { notes: notesVal }
    });
    const idx = state.currentSystem.planets.findIndex((p) => p.id === updated.id);
    if (idx !== -1) state.currentSystem.planets[idx].notes = updated.notes;
    el.notesStatus.textContent = 'Saved ✓';
  }, 450);
});

// Live REST API Console & Playground
el.apiDrawerToggle.addEventListener('click', () => {
  const isHidden = el.apiDrawer.classList.toggle('hidden');
  el.apiDrawerToggle.classList.toggle('active', !isHidden);
  if (!isHidden && el.playOutput.textContent.startsWith('//')) {
    executePlaygroundRequest();
  }
});

el.apiDrawerClose.addEventListener('click', () => {
  el.apiDrawer.classList.add('hidden');
  el.apiDrawerToggle.classList.remove('active');
});

el.playMethod.addEventListener('change', () => {
  const hasBody = ['POST', 'PATCH'].includes(el.playMethod.value);
  el.playBodyWrap.classList.toggle('hidden', !hasBody);
});

document.querySelectorAll('.preset-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.preset-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    const method = btn.dataset.method;
    el.playMethod.value = method;
    el.playPath.value = btn.dataset.path;
    const hasBody = ['POST', 'PATCH'].includes(method);
    el.playBodyWrap.classList.toggle('hidden', !hasBody);
    if (btn.dataset.body) {
      el.playBody.value = JSON.stringify(JSON.parse(btn.dataset.body), null, 2);
    }
    executePlaygroundRequest();
  });
});

el.playSend.addEventListener('click', () => executePlaygroundRequest());

async function executePlaygroundRequest() {
  const method = el.playMethod.value;
  let path = el.playPath.value.trim();
  if (!path.startsWith('/')) path = `/${path}`;

  let parsedBody;
  if (['POST', 'PATCH'].includes(method) && el.playBody.value.trim()) {
    try {
      parsedBody = JSON.parse(el.playBody.value);
    } catch {
      el.playStatus.textContent = 'Invalid JSON Body';
      return;
    }
  }

  el.playStatus.textContent = 'Sending...';
  try {
    const res = await apiFetch(path, { method, body: parsedBody });
    el.playStatus.textContent = `${method} ${path} → ${res.status} OK`;
    el.playLatency.textContent = `Server: ${res.latency}`;
    el.playOutput.textContent = JSON.stringify(res.data, null, 2);

    // If playground mutated systems, keep sidebar synced!
    if (method !== 'GET') {
      await refreshHealthAndCatalog();
    }
  } catch (err) {
    el.playStatus.textContent = `Error: ${err.message}`;
  }
}

el.playCurl.addEventListener('click', async () => {
  const method = el.playMethod.value;
  const url = `${window.location.origin}${el.playPath.value.trim()}`;
  let cmd = `curl -X ${method} "${url}"`;
  if (['POST', 'PATCH'].includes(method) && el.playBody.value.trim()) {
    const compact = JSON.stringify(JSON.parse(el.playBody.value));
    cmd += ` -H "Content-Type: application/json" -d '${compact}'`;
  }
  await navigator.clipboard.writeText(cmd).catch(() => {});
  showToast('📋 Copied cURL command to clipboard');
});

el.clearLogBtn.addEventListener('click', () => {
  state.networkLogs = [];
  renderNetworkLog();
});

// Boot Observatory
(async function initObservatory() {
  try {
    const systems = await refreshHealthAndCatalog();
    if (systems.length > 0) {
      // Load Solara-442 first if present so user greets a vibrant solar system
      const solara = systems.find((s) => s.name === 'Solara-442') || systems[0];
      await loadSystem(solara.id);
    }
  } catch (err) {
    console.error('Failed to initialize observatory:', err);
    showToast(`Initialization error: ${err.message}`);
  }
})();
