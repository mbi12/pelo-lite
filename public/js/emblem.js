/**
 * 3D i-tutor Emblem, Sunrise Confidence Gauge, and Vector Icon Suite
 * Zero external icon fonts or internet dependencies.
 */

export function buildChiseledRaysMarkup({ animated = true } = {}) {
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

export function renderEmblemSVG({ animated = true, uid = 'main', className = '' } = {}) {
  const raysMarkup = buildChiseledRaysMarkup({ animated });
  const svgClass = className || (animated ? 'itutor-emblem-svg' : 'brand-emblem-svg');
  const sunRiseClass = animated ? 'class="svg-sun-rise"' : '';
  const bookGroupClass = animated ? 'class="svg-book-group"' : '';
  const pageLineClass = animated ? 'class="svg-page-line"' : '';

  return `
    <svg class="${svgClass}" viewBox="0 0 400 228" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="i-tutor emblem">
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

        <path ${pageLineClass} d="M 74 187 C 118 160, 164 164, 195 190" stroke="#787B74" stroke-width="2.1" stroke-linecap="round" fill="none" />
        <path ${pageLineClass} d="M 82 193 C 122 169, 165 172, 195 195" stroke="#5F625C" stroke-width="1.8" stroke-linecap="round" fill="none" />
        <path ${pageLineClass} d="M 91 198 C 127 177, 166 180, 195 200" stroke="#484A45" stroke-width="1.6" stroke-linecap="round" fill="none" />

        <path ${pageLineClass} d="M 326 187 C 282 160, 236 164, 205 190" stroke="#787B74" stroke-width="2.1" stroke-linecap="round" fill="none" />
        <path ${pageLineClass} d="M 318 193 C 278 169, 235 172, 205 195" stroke="#5F625C" stroke-width="1.8" stroke-linecap="round" fill="none" />
        <path ${pageLineClass} d="M 309 198 C 273 177, 234 180, 205 200" stroke="#484A45" stroke-width="1.6" stroke-linecap="round" fill="none" />
      </g>
    </svg>
  `;
}

export function renderSunriseGaugeSVG(score = 78) {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const arcLen = 220;
  const offset = (arcLen * (1 - clamped / 100)).toFixed(1);

  return `
    <svg viewBox="0 0 180 104" class="sunrise-arc-svg" aria-hidden="true">
      <defs>
        <linearGradient id="sunriseArcGold" x1="18" y1="90" x2="162" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#B57A0D" />
          <stop offset="55%" stop-color="#F2B728" />
          <stop offset="100%" stop-color="#FCE078" />
        </linearGradient>
      </defs>
      <path d="M 20 90 A 70 70 0 0 1 160 90" fill="none" stroke="currentColor" stroke-opacity="0.12" stroke-width="11" stroke-linecap="round" />
      <path d="M 20 90 A 70 70 0 0 1 160 90" fill="none" stroke="url(#sunriseArcGold)" stroke-width="11" stroke-linecap="round" stroke-dasharray="${arcLen}" stroke-dashoffset="${offset}" />
      <path d="M 58 90 A 32 32 0 0 1 122 90 Z" fill="#F2B728" fill-opacity="0.22" />
    </svg>
  `;
}

export const ICONS = {
  home: `
    <svg viewBox="0 0 24 24" class="nav-svg" aria-hidden="true">
      <path d="M3 10.5L12 3l9 7.5" />
      <path d="M5.5 9.5V20h13V9.5" />
    </svg>
  `,
  timetable: `
    <svg viewBox="0 0 24 24" class="nav-svg" aria-hidden="true">
      <rect x="3.5" y="4.5" width="17" height="16" rx="2.6" />
      <path d="M8 3v3.5M16 3v3.5M3.5 9.5h17" />
      <path d="M8 13.5h3.5M13.5 13.5H16M8 17h5" />
    </svg>
  `,
  assignment: `
    <svg viewBox="0 0 24 24" class="nav-svg" aria-hidden="true">
      <path d="M8 3.5h8a2 2 0 0 1 2 2V19a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5.5a2 2 0 0 1 2-2z" />
      <path d="M9.5 8.5h5M9.5 12.5h5M9.5 16.5h3" />
    </svg>
  `,
  toolkit: `
    <svg viewBox="0 0 24 24" class="nav-svg" aria-hidden="true">
      <path d="M3 5.5C7 4.2 10.2 5 12 6.8 13.8 5 17 4.2 21 5.5v13c-4-1.3-7.2-.5-9 1.3-1.8-1.8-5-2.6-9-1.3v-13z" />
      <path d="M12 6.8v13" />
    </svg>
  `,
  messages: `
    <svg viewBox="0 0 24 24" class="nav-svg" aria-hidden="true">
      <path d="M4 5.5h16a2 2 0 0 1 2 2v8.5a2 2 0 0 1-2 2H8.5L4 21v-3a2 2 0 0 1-2-2V7.5a2 2 0 0 1 2-2z" />
      <path d="M8 10.5h8M8 14h5" />
    </svg>
  `,
  broadcast: `
    <svg viewBox="0 0 24 24" class="nav-svg" aria-hidden="true">
      <path d="M4 10.5v3a1.5 1.5 0 0 0 1.5 1.5H8l6.5 4V5L8 9H5.5A1.5 1.5 0 0 0 4 10.5z" />
      <path d="M18 9.2a4.2 4.2 0 0 1 0 5.6M20.5 6.8a7.5 7.5 0 0 1 0 10.4" />
    </svg>
  `,
  attendance: `
    <svg viewBox="0 0 24 24" class="nav-svg" aria-hidden="true">
      <path d="M9 11.5l2.2 2.2 4.8-4.8" />
      <rect x="3.5" y="3.5" width="17" height="17" rx="3" />
    </svg>
  `,
  tuition: `
    <svg viewBox="0 0 24 24" class="nav-svg" aria-hidden="true">
      <path d="M12 3L2.5 8 12 13l9.5-5L12 3z" />
      <path d="M6 10.2v5.3c0 1.8 2.7 3.5 6 3.5s6-1.7 6-3.5v-5.3" />
    </svg>
  `,
  quiz: `
    <svg viewBox="0 0 24 24" class="nav-svg" aria-hidden="true">
      <path d="M13 2L4.5 13.5h6.2L9.8 22l9.7-12h-6.3L13 2z" />
    </svg>
  `,
  flashcards: `
    <svg viewBox="0 0 24 24" class="nav-svg" aria-hidden="true">
      <rect x="6" y="3.5" width="14" height="15" rx="2.6" />
      <path d="M4 7.5v11A2.5 2.5 0 0 0 6.5 21H16" />
    </svg>
  `,
  timer: `
    <svg viewBox="0 0 24 24" class="nav-svg-sm" aria-hidden="true">
      <circle cx="12" cy="13" r="7.5" />
      <path d="M10 3h4M12 9.5v3.8l2.4 1.6" />
    </svg>
  `,
  search: `
    <svg viewBox="0 0 24 24" class="nav-svg-sm" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4.5 4.5" />
    </svg>
  `,
  download: `
    <svg viewBox="0 0 24 24" class="nav-svg-sm" aria-hidden="true">
      <path d="M12 4v11M8 11.5l4 4 4-4" />
      <path d="M4.5 19h15" />
    </svg>
  `,
  sync: `
    <svg viewBox="0 0 24 24" class="nav-svg-sm" aria-hidden="true">
      <path d="M20 11a8 8 0 0 0-14.5-4.6L4 8M4 4v4h4" />
      <path d="M4 13a8 8 0 0 0 14.5 4.6L20 16M20 20v-4h-4" />
    </svg>
  `,
  plus: `
    <svg viewBox="0 0 24 24" class="nav-svg-sm" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  `,
  check: `
    <svg viewBox="0 0 24 24" class="nav-svg-sm" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  `,
  send: `
    <svg viewBox="0 0 24 24" class="nav-svg-sm" aria-hidden="true">
      <path d="M21 3L10 14" />
      <path d="M21 3l-7 18-4-7-7-4 18-7z" />
    </svg>
  `,
  bookmark: `
    <svg viewBox="0 0 24 24" class="nav-svg-sm" aria-hidden="true">
      <path d="M6 4h12v16l-6-4-6 4V4z" />
    </svg>
  `
};
