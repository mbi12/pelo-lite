const LOADING_DURATION_MS = 10000; // ~10 seconds

const STATUS_PHASES = [
  { threshold: 0, text: 'Starting i-tutor…' },
  { threshold: 25, text: 'Loading standalone offline engine…' },
  { threshold: 55, text: 'Caching local workspace…' },
  { threshold: 82, text: 'Confidence in learning…' },
  { threshold: 100, text: 'Ready' }
];

/**
 * Generates the 15 sculpted 3D chiseled sunbeam rays radiating from the open book spine,
 * matching the physical 3D embossed rays on the i-tutor golden sun emblem.
 */
function buildChiseledRaysMarkup({ animated = true } = {}) {
  const cx = 200;
  const cy = 182;
  const angles = [-75, -64.5, -54, -43.5, -33, -22.5, -11.2, 0, 11.2, 22.5, 33, 43.5, 54, 64.5, 75];

  return angles
    .map((deg, index) => {
      const rad = ((deg - 90) * Math.PI) / 180;
      const perpRad = rad + Math.PI / 2;

      const length = index % 2 === 0 ? 104 : 92;
      const innerOffset = 10;
      const halfBase = index % 2 === 0 ? 3.1 : 2.5;

      const bx = cx + innerOffset * Math.cos(rad);
      const by = cy + innerOffset * Math.sin(rad);

      const tipX = cx + length * Math.cos(rad);
      const tipY = cy + length * Math.sin(rad);

      const leftX = bx - halfBase * Math.cos(perpRad);
      const leftY = by - halfBase * Math.sin(perpRad);

      const rightX = bx + halfBase * Math.cos(perpRad);
      const rightY = by + halfBase * Math.sin(perpRad);

      const distFromCenter = Math.abs(index - 7);
      const delaySec = (2.05 + distFromCenter * 0.14).toFixed(2);
      const groupAttr = animated
        ? `class="svg-sun-ray" style="--ray-delay: ${delaySec}s"`
        : '';

      return `
        <g ${groupAttr}>
          <polygon
            points="${bx.toFixed(1)},${by.toFixed(1)} ${leftX.toFixed(1)},${leftY.toFixed(1)} ${tipX.toFixed(1)},${tipY.toFixed(1)}"
            fill="#C3850D"
            opacity="0.72"
          />
          <polygon
            points="${bx.toFixed(1)},${by.toFixed(1)} ${tipX.toFixed(1)},${tipY.toFixed(1)} ${rightX.toFixed(1)},${rightY.toFixed(1)}"
            fill="#FCE382"
            opacity="0.88"
          />
        </g>
      `;
    })
    .join('');
}

/**
 * Renders the 3D Rising Golden Sun + Matte Charcoal Open Book emblem (no letters).
 * Used both in the animated 10s splash and as the emblem-only top logo in the app layout.
 */
function renderEmblemSVG({ animated = true, uid = 'main' } = {}) {
  const raysMarkup = buildChiseledRaysMarkup({ animated });
  const svgClass = animated ? 'itutor-emblem-svg' : 'topbar-emblem-svg';
  const sunRiseClass = animated ? 'class="svg-sun-rise"' : '';
  const bookGroupClass = animated ? 'class="svg-book-group"' : '';
  const pageLineClass = animated ? 'class="svg-page-line"' : '';

  return `
    <svg class="${svgClass}" viewBox="0 0 400 228" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Logo">
      <defs>
        <linearGradient id="sunDomeGrad-${uid}" x1="278" y1="36" x2="115" y2="188" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#FDE27A" />
          <stop offset="48%" stop-color="#F2B728" />
          <stop offset="100%" stop-color="#DD9D13" />
        </linearGradient>

        <linearGradient id="sunRimGrad-${uid}" x1="70" y1="45" x2="140" y2="190" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#C98B12" />
          <stop offset="100%" stop-color="#9E6A07" />
        </linearGradient>

        <linearGradient id="sunSheenGrad-${uid}" x1="130" y1="40" x2="220" y2="185" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#FFFDF5" stop-opacity="0" />
          <stop offset="50%" stop-color="#FFFDF5" stop-opacity="0.55" />
          <stop offset="100%" stop-color="#FFFDF5" stop-opacity="0" />
        </linearGradient>

        <clipPath id="aboveOpenBookClip-${uid}">
          <path d="M 24 8 L 376 8 L 376 186 L 346 186 C 292 148, 234 154, 200 188 C 166 154, 108 148, 54 186 L 24 186 Z" />
        </clipPath>

        <clipPath id="sunDomeInteriorClip-${uid}">
          <path d="M 74 186 A 126 126 0 0 1 326 186 Z" />
        </clipPath>
      </defs>

      <!-- RISING GOLDEN SUN + 15 CHISELED RAYS -->
      <g clip-path="url(#aboveOpenBookClip-${uid})">
        <g ${sunRiseClass}>
          <path
            d="M 74 186 A 126 126 0 0 1 326 186 L 200 196 Z"
            fill="url(#sunRimGrad-${uid})"
            transform="translate(-8, 2.5)"
          />
          <path
            d="M 74 186 A 126 126 0 0 1 326 186 L 200 196 Z"
            fill="url(#sunDomeGrad-${uid})"
          />
          <path
            d="M 80 182 A 121 121 0 0 1 321 182"
            stroke="#FFF0A8"
            stroke-width="1.6"
            stroke-opacity="0.65"
            fill="none"
          />

          ${raysMarkup}

          ${
            animated
              ? `
            <g clip-path="url(#sunDomeInteriorClip-${uid})">
              <rect
                class="svg-sun-sheen"
                x="120"
                y="35"
                width="95"
                height="165"
                fill="url(#sunSheenGrad-${uid})"
                transform="skewX(-18)"
              />
            </g>
          `
              : ''
          }
        </g>
      </g>

      <!-- 3D MATTE CHARCOAL OPEN BOOK -->
      <g ${bookGroupClass}>
        <path
          d="M 52 190 C 108 150, 166 156, 200 190 C 234 156, 292 150, 348 190 L 339 204 C 286 175, 234 179, 200 210 C 166 179, 114 175, 61 204 Z"
          fill="#10110F"
          transform="translate(-3.5, 4)"
        />
        <path
          d="M 52 188 C 108 148, 166 154, 200 188 C 234 154, 292 148, 348 188 L 339 202 C 286 173, 234 177, 200 207 C 166 177, 114 173, 61 202 Z"
          fill="#1E1F1D"
        />
        <path
          d="M 56 187 C 109 150, 166 155, 200 188 C 234 155, 291 150, 344 187"
          stroke="#3A3C38"
          stroke-width="1.4"
          stroke-linecap="round"
          fill="none"
        />

        <!-- Left Wing Sculpted Page Grooves -->
        <path ${pageLineClass} d="M 74 187 C 118 160, 164 164, 195 190" stroke="#787B74" stroke-width="2.1" stroke-linecap="round" fill="none" />
        <path ${pageLineClass} d="M 82 193 C 122 169, 165 172, 195 195" stroke="#5F625C" stroke-width="1.8" stroke-linecap="round" fill="none" />
        <path ${pageLineClass} d="M 91 198 C 127 177, 166 180, 195 200" stroke="#484A45" stroke-width="1.6" stroke-linecap="round" fill="none" />

        <!-- Right Wing Sculpted Page Grooves -->
        <path ${pageLineClass} d="M 326 187 C 282 160, 236 164, 205 190" stroke="#787B74" stroke-width="2.1" stroke-linecap="round" fill="none" />
        <path ${pageLineClass} d="M 318 193 C 278 169, 235 172, 205 195" stroke="#5F625C" stroke-width="1.8" stroke-linecap="round" fill="none" />
        <path ${pageLineClass} d="M 309 198 C 273 177, 234 180, 205 200" stroke="#484A45" stroke-width="1.6" stroke-linecap="round" fill="none" />
      </g>
    </svg>
  `;
}

function renderSplashScreenMarkup() {
  return `
    <main class="splash-screen" id="splash-screen" aria-label="Loading i-tutor">
      <div class="splash-centerpiece">
        <div class="emblem-stage">
          <div class="emblem-aura"></div>
          ${renderEmblemSVG({ animated: true, uid: 'splash' })}
        </div>

        <h1 class="wordmark-row" aria-label="i-tutor">
          <span class="wm-i-wrap">
            <span class="wm-i-gold-dot" aria-hidden="true"></span>
            <span class="wm-char wm-i-stem" style="--char-delay: 3.45s">&#305;</span>
          </span><span class="wm-char wm-hyphen" style="--char-delay: 3.60s">-</span><span class="wm-char" style="--char-delay: 3.74s">t</span><span class="wm-char" style="--char-delay: 3.88s">u</span><span class="wm-char" style="--char-delay: 4.02s">t</span><span class="wm-char" style="--char-delay: 4.16s">o</span><span class="wm-char" style="--char-delay: 4.30s">r</span>
        </h1>

        <div class="slogan-wrap">
          <p class="slogan-text">Confidence in learning</p>
          <div class="slogan-shimmer" aria-hidden="true"></div>
        </div>

        <div
          class="loader-panel"
          role="progressbar"
          aria-label="Loading i-tutor standalone app"
          aria-valuemin="0"
          aria-valuemax="100"
          aria-valuenow="0"
          id="loader-progressbar"
        >
          <div class="loader-track">
            <div class="loader-fill" id="loader-fill"></div>
          </div>
          <div class="loader-meta">
            <span class="loader-status" id="loader-status">${STATUS_PHASES[0].text}</span>
            <span class="loader-percent" id="loader-percent">0%</span>
          </div>
        </div>
      </div>
    </main>
  `;
}

/**
 * Standalone App Layout — Emblem-Only Logo on Top & Zero Letters Anywhere
 */
function renderAppLayoutMarkup() {
  return `
    <div class="app-layout" id="app-layout">
      <!-- Top Header with Emblem-Only Logo (No Letters) -->
      <header class="app-topbar">
        <div class="topbar-emblem-wrap" id="topbar-logo">
          ${renderEmblemSVG({ animated: false, uid: 'header' })}
        </div>
      </header>

      <!-- Clean Standalone Structural Layout (Zero Letters) -->
      <main class="app-workspace">
        <!-- Hero Card Container -->
        <section class="layout-hero-card">
          <div class="hero-slot-top">
            <div class="slot-badge-gold">
              <span class="slot-badge-dot"></span>
            </div>
            <div class="slot-pill-charcoal"></div>
          </div>
          <div class="hero-slot-bars">
            <div class="slot-bar w-65"></div>
            <div class="slot-bar w-42"></div>
          </div>
        </section>

        <!-- 2x2 Module Grid -->
        <section class="layout-grid">
          <div class="layout-tile is-selected" data-tile="0">
            <div class="tile-node"><span class="tile-node-core"></span></div>
            <div class="tile-lines">
              <div class="tile-line primary"></div>
              <div class="tile-line secondary"></div>
            </div>
          </div>

          <div class="layout-tile" data-tile="1">
            <div class="tile-node"><span class="tile-node-core"></span></div>
            <div class="tile-lines">
              <div class="tile-line primary"></div>
              <div class="tile-line secondary"></div>
            </div>
          </div>

          <div class="layout-tile" data-tile="2">
            <div class="tile-node"><span class="tile-node-core"></span></div>
            <div class="tile-lines">
              <div class="tile-line primary"></div>
              <div class="tile-line secondary"></div>
            </div>
          </div>

          <div class="layout-tile" data-tile="3">
            <div class="tile-node"><span class="tile-node-core"></span></div>
            <div class="tile-lines">
              <div class="tile-line primary"></div>
              <div class="tile-line secondary"></div>
            </div>
          </div>
        </section>

        <!-- Wide Lower Workspace Panel -->
        <section class="layout-wide-panel">
          <div class="panel-row">
            <span class="panel-ring"></span>
            <div class="panel-track">
              <div class="panel-track-fill" id="panel-track-fill"></div>
            </div>
          </div>
        </section>
      </main>

      <!-- Bottom Floating Icon-Only Navigation Dock (Zero Letters) -->
      <nav class="app-bottom-dock">
        <button type="button" class="dock-slot is-active" data-dock="0" aria-label="1">
          <svg class="dock-icon" viewBox="0 0 24 24">
            <path d="M3 10.5L12 3l9 7.5" />
            <path d="M5.5 9.5V20h13V9.5" />
          </svg>
        </button>

        <button type="button" class="dock-slot" data-dock="1" aria-label="2">
          <svg class="dock-icon" viewBox="0 0 24 24">
            <path d="M2 5.5C6.5 4 10 5 12 7c2-2 5.5-3 10-1.5v13C17.5 17 14 18 12 20c-2-2-5.5-3-10-1.5v-13z" />
            <path d="M12 7v13" />
          </svg>
        </button>

        <button type="button" class="dock-slot" data-dock="2" aria-label="3">
          <svg class="dock-icon" viewBox="0 0 24 24">
            <rect x="3.5" y="3.5" width="7" height="7" rx="2" />
            <rect x="13.5" y="3.5" width="7" height="7" rx="2" />
            <rect x="3.5" y="13.5" width="7" height="7" rx="2" />
            <rect x="13.5" y="13.5" width="7" height="7" rx="2" />
          </svg>
        </button>

        <button type="button" class="dock-slot" data-dock="3" aria-label="4">
          <svg class="dock-icon" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8" />
          </svg>
        </button>
      </nav>
    </div>
  `;
}

let activeAnimationFrame = null;

function bindAppLayoutInteractions() {
  const tiles = document.querySelectorAll('.layout-tile');
  const trackFill = document.getElementById('panel-track-fill');
  const widths = ['58%', '76%', '44%', '88%'];

  tiles.forEach((tile, idx) => {
    tile.addEventListener('click', () => {
      tiles.forEach((t) => t.classList.remove('is-selected'));
      tile.classList.add('is-selected');
      if (trackFill) {
        trackFill.style.width = widths[idx % widths.length];
      }
    });
  });

  const dockButtons = document.querySelectorAll('.dock-slot');
  dockButtons.forEach((btn, idx) => {
    btn.addEventListener('click', () => {
      dockButtons.forEach((b) => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      if (tiles[idx]) {
        tiles.forEach((t) => t.classList.remove('is-selected'));
        tiles[idx].classList.add('is-selected');
      }
      if (trackFill) {
        trackFill.style.width = widths[idx % widths.length];
      }
    });
  });

  // Double-tap / double-click the top emblem to replay the 10-second intro anytime
  const topLogo = document.getElementById('topbar-logo');
  if (topLogo) {
    topLogo.addEventListener('dblclick', () => startTenSecondLoadingSequence());
  }
}

function showAppLayout() {
  const appEl = document.getElementById('app');
  if (!appEl) return;
  appEl.innerHTML = renderAppLayoutMarkup();
  bindAppLayoutInteractions();
}

function startTenSecondLoadingSequence() {
  const appEl = document.getElementById('app');
  if (!appEl) return;

  if (activeAnimationFrame) {
    cancelAnimationFrame(activeAnimationFrame);
    activeAnimationFrame = null;
  }

  appEl.innerHTML = renderSplashScreenMarkup();

  const splashEl = document.getElementById('splash-screen');
  const fillEl = document.getElementById('loader-fill');
  const percentEl = document.getElementById('loader-percent');
  const statusEl = document.getElementById('loader-status');
  const progressbarEl = document.getElementById('loader-progressbar');

  const startTime = performance.now();
  let lastStatusText = STATUS_PHASES[0].text;

  function tick(now) {
    const elapsed = Math.max(0, now - startTime);
    const rawRatio = Math.min(1, elapsed / LOADING_DURATION_MS);

    const pct = rawRatio * 100;
    const roundedPct = Math.min(100, Math.floor(pct));

    if (fillEl) {
      fillEl.style.width = `${pct.toFixed(2)}%`;
    }
    if (percentEl) {
      percentEl.textContent = `${roundedPct}%`;
    }
    if (progressbarEl) {
      progressbarEl.setAttribute('aria-valuenow', String(roundedPct));
    }

    let currentPhase = STATUS_PHASES[0].text;
    for (const phase of STATUS_PHASES) {
      if (pct >= phase.threshold) {
        currentPhase = phase.text;
      }
    }
    if (statusEl && currentPhase !== lastStatusText) {
      lastStatusText = currentPhase;
      statusEl.textContent = currentPhase;
    }

    if (rawRatio < 1) {
      activeAnimationFrame = requestAnimationFrame(tick);
    } else {
      activeAnimationFrame = null;
      if (fillEl) fillEl.style.width = '100%';
      if (percentEl) percentEl.textContent = '100%';
      if (statusEl) statusEl.textContent = 'Ready';

      setTimeout(() => {
        if (splashEl) splashEl.classList.add('is-exiting');
        setTimeout(() => {
          showAppLayout();
        }, 620);
      }, 280);
    }
  }

  activeAnimationFrame = requestAnimationFrame(tick);
}

function registerOfflineServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    });
  }
}

registerOfflineServiceWorker();
startTenSecondLoadingSequence();
