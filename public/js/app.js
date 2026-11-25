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
function buildChiseledRaysMarkup() {
  const cx = 200;
  const cy = 182;
  const angles = [-75, -64.5, -54, -43.5, -33, -22.5, -11.2, 0, 11.2, 22.5, 33, 43.5, 54, 64.5, 75];

  return angles
    .map((deg, index) => {
      const rad = ((deg - 90) * Math.PI) / 180;
      const perpRad = rad + Math.PI / 2;

      // Alternate primary long rays and slightly shorter secondary rays like the logo
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

      // Center-outward stagger (center ray at index 7 fans out first)
      const distFromCenter = Math.abs(index - 7);
      const delaySec = (2.05 + distFromCenter * 0.14).toFixed(2);

      return `
        <g class="svg-sun-ray" style="--ray-delay: ${delaySec}s">
          <!-- Shaded left 3D groove facet -->
          <polygon
            points="${bx.toFixed(1)},${by.toFixed(1)} ${leftX.toFixed(1)},${leftY.toFixed(1)} ${tipX.toFixed(1)},${tipY.toFixed(1)}"
            fill="#C3850D"
            opacity="0.72"
          />
          <!-- Sunlit right 3D bevel facet -->
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

function renderAnimatedEmblemSVG({ staticMode = false } = {}) {
  const raysMarkup = buildChiseledRaysMarkup();

  if (staticMode) {
    return `
      <svg viewBox="0 0 400 225" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <defs>
          <linearGradient id="staticSunGrad" x1="270" y1="36" x2="120" y2="188" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stop-color="#FCE078" />
            <stop offset="52%" stop-color="#F2B728" />
            <stop offset="100%" stop-color="#DF9F15" />
          </linearGradient>
          <clipPath id="staticAboveBook">
            <path d="M 30 12 L 370 12 L 370 184 L 336 184 C 288 150, 234 154, 200 188 C 166 154, 112 150, 64 184 L 30 184 Z" />
          </clipPath>
        </defs>
        <g clip-path="url(#staticAboveBook)">
          <path d="M 69 184 A 126 126 0 0 1 321 184 Z" fill="#B2780B" transform="translate(-7, 2)" />
          <path d="M 74 184 A 126 126 0 0 1 326 184 Z" fill="url(#staticSunGrad)" />
        </g>
        <path d="M 52 188 C 108 148, 166 154, 200 188 C 234 154, 292 148, 348 188 L 338 202 C 286 172, 234 176, 200 206 C 166 176, 114 172, 62 202 Z" fill="#1E1F1D" />
      </svg>
    `;
  }

  return `
    <svg class="itutor-emblem-svg" viewBox="0 0 400 228" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="i-tutor rising sun and open book logo">
      <defs>
        <!-- Studio-lit Golden Sun Dome Gradient (top-right light source matching photo) -->
        <linearGradient id="sunDomeGrad" x1="278" y1="36" x2="115" y2="188" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#FDE27A" />
          <stop offset="48%" stop-color="#F2B728" />
          <stop offset="100%" stop-color="#DD9D13" />
        </linearGradient>

        <!-- 3D Left Extrusion Rim Gradient -->
        <linearGradient id="sunRimGrad" x1="70" y1="45" x2="140" y2="190" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#C98B12" />
          <stop offset="100%" stop-color="#9E6A07" />
        </linearGradient>

        <!-- Travelling Sun Sheen -->
        <linearGradient id="sunSheenGrad" x1="130" y1="40" x2="220" y2="185" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#FFFDF5" stop-opacity="0" />
          <stop offset="50%" stop-color="#FFFDF5" stop-opacity="0.55" />
          <stop offset="100%" stop-color="#FFFDF5" stop-opacity="0" />
        </linearGradient>

        <!-- Clip so the rising sun emerges cleanly from behind the open book -->
        <clipPath id="aboveOpenBookClip">
          <path d="M 24 8 L 376 8 L 376 186 L 346 186 C 292 148, 234 154, 200 188 C 166 154, 108 148, 54 186 L 24 186 Z" />
        </clipPath>

        <!-- Clip inside the sun semicircle for sheen sweep -->
        <clipPath id="sunDomeInteriorClip">
          <path d="M 74 186 A 126 126 0 0 1 326 186 Z" />
        </clipPath>
      </defs>

      <!-- RISING GOLDEN SUN + EMBOSSED CHISELED RAYS -->
      <g clip-path="url(#aboveOpenBookClip)">
        <g class="svg-sun-rise">
          <!-- 3D Left Extruded Gold Rim -->
          <path
            d="M 74 186 A 126 126 0 0 1 326 186 L 200 196 Z"
            fill="url(#sunRimGrad)"
            transform="translate(-8, 2.5)"
          />
          <!-- Main Sunburst Gold Face -->
          <path
            d="M 74 186 A 126 126 0 0 1 326 186 L 200 196 Z"
            fill="url(#sunDomeGrad)"
          />
          <!-- Subtle top-right highlight arc -->
          <path
            d="M 80 182 A 121 121 0 0 1 321 182"
            stroke="#FFF0A8"
            stroke-width="1.6"
            stroke-opacity="0.65"
            fill="none"
          />

          <!-- 15 Sculpted Sunbeam Rays -->
          ${raysMarkup}

          <!-- Soft Travelling Golden Sheen -->
          <g clip-path="url(#sunDomeInteriorClip)">
            <rect
              class="svg-sun-sheen"
              x="120"
              y="35"
              width="95"
              height="165"
              fill="url(#sunSheenGrad)"
              transform="skewX(-18)"
            />
          </g>
        </g>
      </g>

      <!-- 3D MATTE CHARCOAL OPEN BOOK -->
      <g class="svg-book-group">
        <!-- 3D Lower Book Bevel / Extrusion -->
        <path
          d="M 52 190 C 108 150, 166 156, 200 190 C 234 156, 292 150, 348 190 L 339 204 C 286 175, 234 179, 200 210 C 166 179, 114 175, 61 204 Z"
          fill="#10110F"
          transform="translate(-3.5, 4)"
        />

        <!-- Main Matte Charcoal Open Book Silhouette -->
        <path
          d="M 52 188 C 108 148, 166 154, 200 188 C 234 154, 292 148, 348 188 L 339 202 C 286 173, 234 177, 200 207 C 166 177, 114 173, 61 202 Z"
          fill="#1E1F1D"
        />

        <!-- Subtle Top Rim Highlight on Book Cover -->
        <path
          d="M 56 187 C 109 150, 166 155, 200 188 C 234 155, 291 150, 344 187"
          stroke="#3A3C38"
          stroke-width="1.4"
          stroke-linecap="round"
          fill="none"
        />

        <!-- Left Wing Sculpted Page Grooves (3 curved page lines) -->
        <path class="svg-page-line" d="M 74 187 C 118 160, 164 164, 195 190" stroke="#787B74" stroke-width="2.1" stroke-linecap="round" fill="none" />
        <path class="svg-page-line" d="M 82 193 C 122 169, 165 172, 195 195" stroke="#5F625C" stroke-width="1.8" stroke-linecap="round" fill="none" />
        <path class="svg-page-line" d="M 91 198 C 127 177, 166 180, 195 200" stroke="#484A45" stroke-width="1.6" stroke-linecap="round" fill="none" />

        <!-- Right Wing Sculpted Page Grooves (3 curved page lines) -->
        <path class="svg-page-line" d="M 326 187 C 282 160, 236 164, 205 190" stroke="#787B74" stroke-width="2.1" stroke-linecap="round" fill="none" />
        <path class="svg-page-line" d="M 318 193 C 278 169, 235 172, 205 195" stroke="#5F625C" stroke-width="1.8" stroke-linecap="round" fill="none" />
        <path class="svg-page-line" d="M 309 198 C 273 177, 234 180, 205 200" stroke="#484A45" stroke-width="1.6" stroke-linecap="round" fill="none" />
      </g>
    </svg>
  `;
}

function renderSplashScreenMarkup() {
  return `
    <main class="splash-screen" id="splash-screen" aria-label="Loading i-tutor">
      <div class="splash-centerpiece">
        <!-- Animated 3D Rising Sun & Open Book Emblem -->
        <div class="emblem-stage">
          <div class="emblem-aura"></div>
          ${renderAnimatedEmblemSVG()}
        </div>

        <!-- Animated 3D "i-tutor" Wordmark with Golden Dot -->
        <h1 class="wordmark-row" aria-label="i-tutor">
          <span class="wm-i-wrap">
            <span class="wm-i-gold-dot" aria-hidden="true"></span>
            <span class="wm-char wm-i-stem" style="--char-delay: 3.45s">&#305;</span>
          </span><span class="wm-char wm-hyphen" style="--char-delay: 3.60s">-</span><span class="wm-char" style="--char-delay: 3.74s">t</span><span class="wm-char" style="--char-delay: 3.88s">u</span><span class="wm-char" style="--char-delay: 4.02s">t</span><span class="wm-char" style="--char-delay: 4.16s">o</span><span class="wm-char" style="--char-delay: 4.30s">r</span>
        </h1>

        <!-- Animated 3D Golden Slogan -->
        <div class="slogan-wrap">
          <p class="slogan-text">Confidence in learning</p>
          <div class="slogan-shimmer" aria-hidden="true"></div>
        </div>

        <!-- 10-Second Smooth Golden Loading Bar -->
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

function renderReadyStageMarkup() {
  return `
    <main class="ready-stage" aria-live="polite">
      <div class="ready-mini-emblem">
        ${renderAnimatedEmblemSVG({ staticMode: true })}
      </div>
      <h1 class="ready-title"><span class="dot-gold">i</span>-tutor</h1>
      <p class="ready-slogan">Confidence in learning</p>

      <div class="offline-pill">
        <span class="offline-dot" aria-hidden="true"></span>
        <span>Standalone App · Offline Ready</span>
      </div>

      <p class="ready-note">
        Clean slate ready on your device — no internet connection required once loaded.
      </p>

      <button type="button" class="replay-btn" id="replay-splash-btn">
        <span class="replay-btn-accent">↻</span>
        <span>Replay 10s Loading Screen</span>
      </button>
    </main>
  `;
}

let activeAnimationFrame = null;

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

    // Subtle organic ease while strictly spanning the full 10,000 ms duration
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

      // Brief pause at 100% so user clearly sees completion, then smooth transition
      setTimeout(() => {
        if (splashEl) splashEl.classList.add('is-exiting');
        setTimeout(() => {
          appEl.innerHTML = renderReadyStageMarkup();
          const replayBtn = document.getElementById('replay-splash-btn');
          if (replayBtn) {
            replayBtn.addEventListener('click', () => startTenSecondLoadingSequence());
          }
        }, 620);
      }, 280);
    }
  }

  activeAnimationFrame = requestAnimationFrame(tick);
}

function registerOfflineServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Ignore in restricted sandboxed iframes if blocked
      });
    });
  }
}

registerOfflineServiceWorker();
startTenSecondLoadingSequence();
