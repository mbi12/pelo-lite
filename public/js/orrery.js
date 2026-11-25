// Interactive 60fps Keplerian Orrery Renderer (HTML5 Canvas)

function solveKeplerClient(meanAnomaly, e) {
  let E = meanAnomaly + e * Math.sin(meanAnomaly);
  for (let i = 0; i < 6; i++) {
    E -= (E - e * Math.sin(E) - meanAnomaly) / (1 - e * Math.cos(E));
  }
  const cosE = Math.cos(E);
  const sinE = Math.sin(E);
  const sqrtOneMinusE2 = Math.sqrt(1 - e * e);
  const rNorm = 1 - e * cosE; // r / a
  const trueAnomaly = Math.atan2(sqrtOneMinusE2 * sinE, cosE - e);
  return { rNorm, trueAnomaly };
}

export class OrreryRenderer {
  constructor(canvas, tooltipEl, onSelectPlanet) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.tooltipEl = tooltipEl;
    this.onSelectPlanet = onSelectPlanet;

    this.system = null;
    this.selectedPlanetId = null;
    this.hoveredPlanetId = null;

    this.simDays = 0;
    this.speedMultiplier = 1; // 1x = ~12 sim days per real second (adjusted to system inner period)
    this.showHz = true;
    this.showLabels = true;

    this.zoom = 1.0;
    this.targetZoom = 1.0;
    this.panX = 0;
    this.panY = 0;
    this.isDragging = false;
    this.dragMoved = false;
    this.lastMouse = { x: 0, y: 0 };

    this.planetScreenPositions = [];
    this.bgStars = this.generateStarfield(220);
    this.lastFrameTs = performance.now();

    this.bindEvents();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    requestAnimationFrame((ts) => this.loop(ts));
  }

  generateStarfield(count) {
    const stars = [];
    const tints = ['#ffffff', '#cbd5e1', '#bae6fd', '#fef08a', '#ddd6fe'];
    for (let i = 0; i < count; i++) {
      stars.push({
        x: Math.random(),
        y: Math.random(),
        r: 0.4 + Math.random() * 1.35,
        alpha: 0.18 + Math.random() * 0.65,
        twinkleSpeed: 0.6 + Math.random() * 2.2,
        phase: Math.random() * Math.PI * 2,
        depth: 0.15 + Math.random() * 0.85,
        color: tints[i % tints.length]
      });
    }
    return stars;
  }

  resize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = rect.width;
    this.height = rect.height;
    this.canvas.width = Math.floor(this.width * dpr);
    this.canvas.height = Math.floor(this.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  setSystem(system, selectedPlanetId = null) {
    this.system = system;
    this.selectedPlanetId = selectedPlanetId || (system?.planets?.[0]?.id ?? null);
    this.simDays = 0;
    this.targetZoom = 1.0;
    this.panX = 0;
    this.panY = 0;
  }

  setSelectedPlanet(planetId) {
    this.selectedPlanetId = planetId;
  }

  resetCamera() {
    this.targetZoom = 1.0;
    this.panX = 0;
    this.panY = 0;
  }

  adjustZoom(factor) {
    this.targetZoom = Math.min(3.8, Math.max(0.42, this.targetZoom * factor));
  }

  auToPx(au, maxAu, baseRadius) {
    const safeMax = Math.max(0.05, maxAu);
    const minInnerPx = 38 * this.zoom;
    return minInnerPx + (baseRadius * this.zoom - minInnerPx) * Math.pow(Math.max(0, au) / safeMax, 0.54);
  }

  bindEvents() {
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.12 : 0.89;
      this.adjustZoom(factor);
    }, { passive: false });

    this.canvas.addEventListener('mousedown', (e) => {
      this.isDragging = true;
      this.dragMoved = false;
      this.lastMouse = { x: e.clientX, y: e.clientY };
    });

    window.addEventListener('mouseup', () => {
      this.isDragging = false;
    });

    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      if (this.isDragging) {
        const dx = e.clientX - this.lastMouse.x;
        const dy = e.clientY - this.lastMouse.y;
        if (Math.hypot(dx, dy) > 3) this.dragMoved = true;
        this.panX += dx;
        this.panY += dy;
        this.lastMouse = { x: e.clientX, y: e.clientY };
        this.tooltipEl.classList.add('hidden');
        return;
      }

      // Hit-test orbiting planets
      let hit = null;
      for (const item of this.planetScreenPositions) {
        const dist = Math.hypot(mx - item.x, my - item.y);
        if (dist <= Math.max(13, item.pxRadius + 6)) {
          hit = item;
          break;
        }
      }

      if (hit) {
        this.hoveredPlanetId = hit.planet.id;
        this.canvas.style.cursor = 'pointer';
        const p = hit.planet;
        this.tooltipEl.innerHTML = `
          <div style="font-weight:700;color:#fff">${p.name}</div>
          <div style="color:#94a3b8;font-size:10.5px">${p.type} · ${p.semiMajorAu} AU</div>
          <div style="margin-top:2px;font-family:monospace;font-size:10.5px;color:${p.esi >= 0.65 ? '#6ee7b7' : '#bae6fd'}">
            ESI ${p.esi.toFixed(2)} · ${p.surfaceTempC}°C (${p.surfaceTempK} K)
          </div>
        `;
        this.tooltipEl.style.left = `${Math.min(this.width - 190, mx)}px`;
        this.tooltipEl.style.top = `${Math.max(36, my)}px`;
        this.tooltipEl.classList.remove('hidden');
      } else {
        this.hoveredPlanetId = null;
        this.canvas.style.cursor = this.isDragging ? 'grabbing' : 'grab';
        this.tooltipEl.classList.add('hidden');
      }
    });

    this.canvas.addEventListener('mouseleave', () => {
      this.hoveredPlanetId = null;
      this.tooltipEl.classList.add('hidden');
    });

    this.canvas.addEventListener('click', () => {
      if (this.dragMoved) return;
      if (this.hoveredPlanetId && this.onSelectPlanet) {
        this.onSelectPlanet(this.hoveredPlanetId);
      }
    });
  }

  loop(ts) {
    const dtSec = Math.min(0.05, (ts - this.lastFrameTs) / 1000);
    this.lastFrameTs = ts;

    // Smooth zoom interpolation
    this.zoom += (this.targetZoom - this.zoom) * 0.16;

    if (this.system && this.speedMultiplier > 0) {
      // Scale base simulation rate relative to innermost planet period so compact M-dwarfs & wide O-stars both animate gracefully
      const innerPeriod = this.system.planets?.[0]?.orbitalPeriodDays || 30;
      const baseDaysPerSec = Math.max(0.4, innerPeriod * 0.16);
      this.simDays += dtSec * baseDaysPerSec * this.speedMultiplier;
    }

    this.render(ts / 1000);
    if (this.onTickEpoch) {
      this.onTickEpoch(this.simDays);
    }

    requestAnimationFrame((nextTs) => this.loop(nextTs));
  }

  render(timeSec) {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    ctx.clearRect(0, 0, w, h);

    const cx = w * 0.5 + this.panX;
    const cy = (h - 32) * 0.5 + this.panY;

    // 1. Twinkling parallax starfield
    for (const s of this.bgStars) {
      const sx = ((s.x * w + this.panX * 0.08 * s.depth) % w + w) % w;
      const sy = ((s.y * h + this.panY * 0.08 * s.depth) % h + h) % h;
      const twinkle = 0.65 + 0.35 * Math.sin(timeSec * s.twinkleSpeed + s.phase);
      ctx.globalAlpha = s.alpha * twinkle;
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(sx, sy, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    if (!this.system) return;

    const sys = this.system;
    const planets = sys.planets || [];
    const maxPlanetAu = planets.reduce((m, p) => Math.max(m, p.semiMajorAu * (1 + p.eccentricity)), 1);
    const maxAu = Math.max(maxPlanetAu * 1.08, sys.hzOuterAu * 1.15);
    const baseRadius = Math.min(w, h - 70) * 0.42;

    // 2. Subtle ambient spectral nebula bloom
    const nebulaGrad = ctx.createRadialGradient(cx, cy, 8, cx, cy, baseRadius * 1.15 * this.zoom);
    nebulaGrad.addColorStop(0, `${sys.starGlow}22`);
    nebulaGrad.addColorStop(0.5, `${sys.starColor}09`);
    nebulaGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = nebulaGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, baseRadius * 1.15 * this.zoom, 0, Math.PI * 2);
    ctx.fill();

    // 3. Polar astrometric compass reticle
    const compassR = baseRadius * 1.04 * this.zoom;
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.07)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, compassR, 0, Math.PI * 2);
    ctx.stroke();
    for (let deg = 0; deg < 360; deg += 30) {
      const rad = (deg * Math.PI) / 180;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(rad) * (compassR - 5), cy + Math.sin(rad) * (compassR - 5));
      ctx.lineTo(cx + Math.cos(rad) * (compassR + 5), cy + Math.sin(rad) * (compassR + 5));
      ctx.stroke();
    }

    // 4. Circumstellar Habitable Zone (Goldilocks Band)
    if (this.showHz) {
      const rIn = this.auToPx(sys.hzInnerAu, maxAu, baseRadius);
      const rOut = this.auToPx(sys.hzOuterAu, maxAu, baseRadius);
      if (rOut > rIn + 2) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, rOut, 0, Math.PI * 2);
        ctx.arc(cx, cy, rIn, 0, Math.PI * 2, true);
        const hzGrad = ctx.createRadialGradient(cx, cy, rIn, cx, cy, rOut);
        hzGrad.addColorStop(0, 'rgba(16, 185, 129, 0.05)');
        hzGrad.addColorStop(0.5, 'rgba(16, 185, 129, 0.13)');
        hzGrad.addColorStop(1, 'rgba(56, 189, 248, 0.04)');
        ctx.fillStyle = hzGrad;
        ctx.fill();

        ctx.setLineDash([4, 5]);
        ctx.strokeStyle = 'rgba(16, 185, 129, 0.32)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx, cy, rIn, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx, cy, rOut, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }

    // 5. Pulsar relativistic lighthouse beams (for PSR stars)
    if (sys.spectralClass === 'PSR') {
      const beamAngle = timeSec * 2.6;
      for (let k = 0; k < 2; k++) {
        const a = beamAngle + k * Math.PI;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(a);
        const beamLen = baseRadius * 1.25 * this.zoom;
        const beamGrad = ctx.createLinearGradient(0, 0, beamLen, 0);
        beamGrad.addColorStop(0, 'rgba(192, 132, 252, 0.55)');
        beamGrad.addColorStop(0.4, 'rgba(56, 189, 248, 0.16)');
        beamGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = beamGrad;
        ctx.beginPath();
        ctx.moveTo(0, -2);
        ctx.lineTo(beamLen, -24 * this.zoom);
        ctx.lineTo(beamLen, 24 * this.zoom);
        ctx.lineTo(0, 2);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }

    // 6. Central Star & Corona
    const starPx = Math.max(10, Math.min(24, (11 + Math.log10(Math.max(0.1, sys.starRadiusSolar) + 1) * 9) * Math.sqrt(this.zoom)));
    const coronaR = starPx * 3.4;
    const corona = ctx.createRadialGradient(cx, cy, starPx * 0.4, cx, cy, coronaR);
    corona.addColorStop(0, '#ffffff');
    corona.addColorStop(0.28, sys.starColor);
    corona.addColorStop(0.62, `${sys.starGlow}66`);
    corona.addColorStop(1, 'transparent');
    ctx.fillStyle = corona;
    ctx.beginPath();
    ctx.arc(cx, cy, coronaR, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(cx, cy, starPx * 0.72, 0, Math.PI * 2);
    ctx.fill();

    // 7. Exoplanet Orbits & Bodies
    this.planetScreenPositions = [];

    for (const p of planets) {
      const isSelected = p.id === this.selectedPlanetId;
      const isHovered = p.id === this.hoveredPlanetId;

      // Sample true Keplerian elliptical path mapped cleanly via auToPx
      ctx.beginPath();
      const steps = 84;
      for (let s = 0; s <= steps; s++) {
        const E = (s / steps) * Math.PI * 2;
        const cosE = Math.cos(E);
        const sinE = Math.sin(E);
        const rAu = p.semiMajorAu * (1 - p.eccentricity * cosE);
        const nu = Math.atan2(Math.sqrt(1 - p.eccentricity ** 2) * sinE, cosE - p.eccentricity);
        const rPx = this.auToPx(rAu, maxAu, baseRadius);
        const ox = cx + Math.cos(nu) * rPx;
        const oy = cy + Math.sin(nu) * rPx;
        if (s === 0) ctx.moveTo(ox, oy);
        else ctx.lineTo(ox, oy);
      }
      ctx.closePath();
      ctx.strokeStyle = isSelected
        ? 'rgba(56, 189, 248, 0.55)'
        : isHovered
          ? 'rgba(226, 232, 240, 0.38)'
          : 'rgba(148, 163, 184, 0.15)';
      ctx.lineWidth = isSelected ? 1.5 : 1;
      ctx.stroke();

      // Current planet position via Kepler's equation
      const meanMotion = (Math.PI * 2) / p.orbitalPeriodDays;
      const currentM = p.initialPhaseRad + meanMotion * this.simDays;
      const { rNorm, trueAnomaly } = solveKeplerClient(currentM % (Math.PI * 2), p.eccentricity);
      const currAu = p.semiMajorAu * rNorm;
      const currRPx = this.auToPx(currAu, maxAu, baseRadius);
      const px = cx + Math.cos(trueAnomaly) * currRPx;
      const py = cy + Math.sin(trueAnomaly) * currRPx;

      // Glowing orbital wake trail
      ctx.beginPath();
      const trailSegments = 18;
      for (let t = 0; t <= trailSegments; t++) {
        const backM = currentM - (t / trailSegments) * 0.55;
        const st = solveKeplerClient(((backM % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2), p.eccentricity);
        const trPx = this.auToPx(p.semiMajorAu * st.rNorm, maxAu, baseRadius);
        const tx = cx + Math.cos(st.trueAnomaly) * trPx;
        const ty = cy + Math.sin(st.trueAnomaly) * trPx;
        if (t === 0) ctx.moveTo(tx, ty);
        else ctx.lineTo(tx, ty);
      }
      ctx.strokeStyle = isSelected ? `${p.palette.atmo}bb` : `${p.palette.primary}66`;
      ctx.lineWidth = isSelected ? 2.4 : 1.5;
      ctx.stroke();

      // Planet screen radius
      const pRadius = Math.max(4.2, Math.min(15, (3.6 + Math.pow(p.radiusEarth, 0.52) * 2.4) * Math.sqrt(this.zoom)));

      // Planetary rings on orrery
      if (p.hasRings) {
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(-0.4);
        ctx.strokeStyle = `${p.palette.cloud}99`;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.ellipse(0, 0, pRadius * 2.1, pRadius * 0.65, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Planet atmospheric halo
      const halo = ctx.createRadialGradient(px, py, pRadius * 0.5, px, py, pRadius * 2.2);
      halo.addColorStop(0, `${p.palette.atmo}55`);
      halo.addColorStop(1, 'transparent');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(px, py, pRadius * 2.2, 0, Math.PI * 2);
      ctx.fill();

      // Planet lit body + nightside shadow away from central star
      ctx.save();
      ctx.beginPath();
      ctx.arc(px, py, pRadius, 0, Math.PI * 2);
      ctx.fillStyle = p.palette.primary;
      ctx.fill();

      // Night hemisphere shadow
      ctx.clip();
      ctx.translate(px, py);
      ctx.rotate(trueAnomaly);
      const nightGrad = ctx.createLinearGradient(-pRadius, 0, pRadius, 0);
      nightGrad.addColorStop(0, 'rgba(255,255,255,0.25)');
      nightGrad.addColorStop(0.48, 'rgba(0,0,0,0)');
      nightGrad.addColorStop(0.85, 'rgba(2,6,23,0.78)');
      nightGrad.addColorStop(1, 'rgba(2,6,23,0.92)');
      ctx.fillStyle = nightGrad;
      ctx.fillRect(-pRadius, -pRadius, pRadius * 2, pRadius * 2);
      ctx.restore();

      // Mini orbiting moons (up to 3 visual dots)
      const visibleMoons = Math.min(3, p.moons);
      for (let m = 0; m < visibleMoons; m++) {
        const mOrbit = pRadius + 5 + m * 3.5;
        const mAngle = timeSec * (2.2 - m * 0.45) + m * 2.1;
        const mx = px + Math.cos(mAngle) * mOrbit;
        const my = py + Math.sin(mAngle) * mOrbit;
        ctx.fillStyle = '#cbd5e1';
        ctx.beginPath();
        ctx.arc(mx, my, 1.3, 0, Math.PI * 2);
        ctx.fill();
      }

      // Target lock-on reticle if selected
      if (isSelected) {
        const retR = pRadius + 7 + Math.sin(timeSec * 4) * 1.4;
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.4;
        for (let q = 0; q < 4; q++) {
          const a0 = q * (Math.PI / 2) + 0.25;
          ctx.beginPath();
          ctx.arc(px, py, retR, a0, a0 + 0.65);
          ctx.stroke();
        }
      }

      // Orbit planet label
      if (this.showLabels) {
        ctx.font = `${isSelected ? '600 ' : ''}10.5px Inter, sans-serif`;
        ctx.fillStyle = isSelected ? '#ffffff' : p.esi >= 0.65 ? '#6ee7b7' : 'rgba(203, 213, 225, 0.78)';
        ctx.fillText(p.name, px + pRadius + 6, py + 3.5);
      }

      this.planetScreenPositions.push({
        planet: p,
        x: px,
        y: py,
        pxRadius: pRadius
      });
    }
  }
}
