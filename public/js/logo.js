export function renderBrandEmblem({ size = 'md', showTagline = true } = {}) {
  const cls = `brand-lockup brand-${size}`;
  return `
    <div class="${cls}" aria-label="i-tutor — Confidence in learning">
      <svg class="brand-mark-svg" viewBox="0 0 220 126" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="itutorSun" x1="110" y1="8" x2="110" y2="104" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stop-color="#FCE078"/>
            <stop offset="52%" stop-color="#F2B728"/>
            <stop offset="100%" stop-color="#D49210"/>
          </linearGradient>
          <filter id="soft3d" x="-8%" y="-8%" width="116%" height="124%">
            <feDropShadow dx="0" dy="3" stdDeviation="2.5" flood-color="#1E1F1D" flood-opacity="0.18"/>
          </filter>
        </defs>
        <g filter="url(#soft3d)">
          <!-- 3D Golden Sun Rim -->
          <path d="M36 96 A74 74 0 0 1 184 96 L110 108 Z" fill="#BA7E0B" transform="translate(-3, 2)"/>
          <!-- Rising Sun Dome -->
          <path d="M38 96 A72 72 0 0 1 182 96 L110 108 Z" fill="url(#itutorSun)"/>
          <!-- Sunbeam Grooves -->
          <g stroke="#B37608" stroke-width="1.9" stroke-linecap="round" opacity="0.58">
            <line x1="110" y1="100" x2="110" y2="30"/>
            <line x1="110" y1="100" x2="93" y2="33"/>
            <line x1="110" y1="100" x2="127" y2="33"/>
            <line x1="110" y1="100" x2="76" y2="41"/>
            <line x1="110" y1="100" x2="144" y2="41"/>
            <line x1="110" y1="100" x2="62" y2="54"/>
            <line x1="110" y1="100" x2="158" y2="54"/>
            <line x1="110" y1="100" x2="51" y2="71"/>
            <line x1="110" y1="100" x2="169" y2="71"/>
            <line x1="110" y1="100" x2="45" y2="88"/>
            <line x1="110" y1="100" x2="175" y2="88"/>
          </g>
          <!-- Open Matte Charcoal Book -->
          <path d="M22 106 C56 80, 89 84, 110 106 C131 84, 164 80, 198 106 L192 116 C162 96, 131 99, 110 118 C89 99, 58 96, 28 116 Z" fill="#1E1F1D"/>
          <path d="M36 106 C64 89, 89 92, 106 107" stroke="#62655F" stroke-width="1.6" stroke-linecap="round"/>
          <path d="M44 111 C68 96, 90 99, 106 112" stroke="#4B4D48" stroke-width="1.4" stroke-linecap="round"/>
          <path d="M184 106 C156 89, 131 92, 114 107" stroke="#62655F" stroke-width="1.6" stroke-linecap="round"/>
          <path d="M176 111 C152 96, 130 99, 114 112" stroke="#4B4D48" stroke-width="1.4" stroke-linecap="round"/>
        </g>
      </svg>
      <div class="brand-text-stack">
        <div class="brand-wordmark">
          <span class="brand-i-wrap"><span class="brand-i-dot"></span>i</span><span class="brand-hyphen">-</span>tutor
        </div>
        ${showTagline ? `<div class="brand-tagline">Confidence in learning</div>` : ''}
      </div>
    </div>
  `;
}

export function renderSunriseGauge(score = 75, label = 'Confidence Score') {
  const clamped = Math.max(0, Math.min(100, Number(score) || 0));
  // Semicircle arc length = pi * R, with R = 74 -> ~232.48
  const arcLen = 232.5;
  const dashOffset = (arcLen * (1 - clamped / 100)).toFixed(1);
  const activeRays = Math.max(1, Math.round((clamped / 100) * 9));

  const rayAngles = [-72, -54, -36, -18, 0, 18, 36, 54, 72];
  const raysMarkup = rayAngles
    .map((deg, idx) => {
      const rad = ((deg - 90) * Math.PI) / 180;
      const x1 = (100 + 46 * Math.cos(rad)).toFixed(1);
      const y1 = (102 + 46 * Math.sin(rad)).toFixed(1);
      const x2 = (100 + 62 * Math.cos(rad)).toFixed(1);
      const y2 = (102 + 62 * Math.sin(rad)).toFixed(1);
      const lit = idx < activeRays;
      return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${
        lit ? '#F2B728' : 'currentColor'
      }" stroke-opacity="${lit ? '0.95' : '0.15'}" stroke-width="3" stroke-linecap="round"/>`;
    })
    .join('');

  return `
    <div class="sunrise-gauge" role="img" aria-label="${label}: ${clamped}%">
      <svg viewBox="0 0 200 124" class="sunrise-gauge-svg">
        <defs>
          <linearGradient id="gaugeGoldGrad" x1="20" y1="100" x2="180" y2="30" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stop-color="#C88B14"/>
            <stop offset="55%" stop-color="#F2B728"/>
            <stop offset="100%" stop-color="#FAD463"/>
          </linearGradient>
        </defs>
        <!-- Background Track -->
        <path d="M26 102 A74 74 0 0 1 174 102" fill="none" stroke="currentColor" stroke-opacity="0.11" stroke-width="12" stroke-linecap="round"/>
        <!-- Active Golden Sunrise Arc -->
        <path d="M26 102 A74 74 0 0 1 174 102" fill="none" stroke="url(#gaugeGoldGrad)" stroke-width="12" stroke-linecap="round"
          stroke-dasharray="${arcLen}" stroke-dashoffset="${dashOffset}"/>
        <!-- Inner Rising Sun Core -->
        <path d="M62 102 A38 38 0 0 1 138 102 Z" fill="#F2B728" fill-opacity="0.22"/>
        ${raysMarkup}
        <!-- Open Book Base Silhouette -->
        <path d="M52 108 C72 96, 89 98, 100 108 C111 98, 128 96, 148 108" fill="none" stroke="currentColor" stroke-opacity="0.55" stroke-width="3.2" stroke-linecap="round"/>
      </svg>
      <div class="sunrise-gauge-readout">
        <span class="sunrise-gauge-value">${clamped}<small>%</small></span>
        <span class="sunrise-gauge-caption">${label}</span>
      </div>
    </div>
  `;
}
