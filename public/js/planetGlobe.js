// High-Resolution 3D-Shaded Procedural Planet Globe Renderer

function pseudoHash(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return x - Math.floor(x);
}

export class PlanetGlobeRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.planet = null;
    this.features = [];

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.size = 160;
    this.canvas.width = this.size * dpr;
    this.canvas.height = this.size * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    requestAnimationFrame((ts) => this.loop(ts));
  }

  setPlanet(planet) {
    this.planet = planet;
    if (!planet) return;

    // Precompute deterministic surface features for smooth 60fps scrolling across the sphere
    const seedNum = Array.from(planet.designation).reduce((acc, ch, i) => acc + ch.charCodeAt(0) * (i + 7), 0);
    const feats = [];
    for (let i = 0; i < 28; i++) {
      feats.push({
        lon: pseudoHash(seedNum + i * 3.1) * Math.PI * 2,
        lat: (pseudoHash(seedNum + i * 7.7) - 0.5) * 1.55,
        w: 0.22 + pseudoHash(seedNum + i * 11.3) * 0.55,
        h: 0.10 + pseudoHash(seedNum + i * 17.9) * 0.28,
        alt: pseudoHash(seedNum + i * 23.5)
      });
    }
    this.features = feats;
  }

  drawRingHalf(ctx, cx, cy, R, tiltRad, color, isFront) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(tiltRad);
    const startAngle = isFront ? 0 : Math.PI;
    const endAngle = isFront ? Math.PI : Math.PI * 2;

    const rings = [
      { rx: R * 1.92, ry: R * 0.50, width: 4.5, alpha: 0.52 },
      { rx: R * 1.66, ry: R * 0.43, width: 6.5, alpha: 0.72 },
      { rx: R * 1.44, ry: R * 0.37, width: 2.5, alpha: 0.36 }
    ];

    for (const r of rings) {
      ctx.beginPath();
      ctx.ellipse(0, 0, r.rx, r.ry, 0, startAngle, endAngle);
      ctx.strokeStyle = color;
      ctx.globalAlpha = r.alpha;
      ctx.lineWidth = r.width;
      ctx.stroke();
    }
    ctx.restore();
  }

  loop(ts) {
    this.render(ts / 1000);
    requestAnimationFrame((nextTs) => this.loop(nextTs));
  }

  render(timeSec) {
    const ctx = this.ctx;
    const S = this.size;
    ctx.clearRect(0, 0, S, S);

    if (!this.planet) return;
    const p = this.planet;
    const cx = S * 0.5;
    const cy = S * 0.5;
    const R = p.hasRings ? 44 : 54;
    const tiltRad = ((p.axialTiltDeg || 18) * Math.PI) / 180 * 0.45;
    const rotAngle = timeSec * 0.55;

    // 1. Back half of planetary rings
    if (p.hasRings) {
      this.drawRingHalf(ctx, cx, cy, R, -0.32, p.palette.cloud, false);
    }

    // 2. Outer Rayleigh atmospheric rim glow
    const outerGlow = ctx.createRadialGradient(cx, cy, R * 0.86, cx, cy, R * 1.26);
    outerGlow.addColorStop(0, `${p.palette.atmo}66`);
    outerGlow.addColorStop(0.55, `${p.palette.atmo}22`);
    outerGlow.addColorStop(1, 'transparent');
    ctx.fillStyle = outerGlow;
    ctx.beginPath();
    ctx.arc(cx, cy, R * 1.26, 0, Math.PI * 2);
    ctx.fill();

    // 3. Spherical Planet Body (clipped)
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.clip();

    ctx.translate(cx, cy);
    ctx.rotate(tiltRad);

    const isGiant = ['Gas Giant', 'Hot Gas Giant', 'Ringed Ice Giant', 'Sub-Neptune'].includes(p.type);
    const isOceanOrTerran = ['Temperate Terran', 'Archipelago Ocean World'].includes(p.type);
    const isLava = p.type === 'Lava World';

    // Base sphere fill
    ctx.fillStyle = isOceanOrTerran ? p.palette.ocean : p.palette.primary;
    ctx.fillRect(-R, -R, R * 2, R * 2);

    if (isGiant) {
      // Turbulent zonal atmospheric bands + Great Storm Oval
      const bands = 11;
      for (let b = 0; b < bands; b++) {
        const y0 = -R + (b / bands) * R * 2;
        const bh = (R * 2) / bands + 1;
        ctx.fillStyle = b % 2 === 0 ? p.palette.primary : p.palette.secondary;
        ctx.globalAlpha = 0.55 + (b % 3) * 0.14;
        ctx.fillRect(-R, y0, R * 2, bh);
      }
      ctx.globalAlpha = 1;

      // Rotating storm oval
      const stormLon = ((rotAngle * 1.2) % (Math.PI * 2));
      const sx = Math.sin(stormLon) * R * 0.65;
      if (Math.cos(stormLon) > -0.2) {
        ctx.fillStyle = p.palette.cloud;
        ctx.globalAlpha = 0.78 * Math.max(0, Math.cos(stormLon));
        ctx.beginPath();
        ctx.ellipse(sx, R * 0.22, R * 0.22 * Math.max(0.25, Math.cos(stormLon)), R * 0.12, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    } else {
      // Project 3D spherical surface patches (continents / craters / lava fissures)
      for (const f of this.features) {
        const lon = f.lon + rotAngle;
        const cosLon = Math.cos(lon);
        if (cosLon <= -0.15) continue; // On far side of sphere

        const sinLon = Math.sin(lon);
        const x = sinLon * Math.cos(f.lat) * R;
        const y = Math.sin(f.lat) * R;
        const foreshorten = Math.max(0.18, cosLon);

        if (isLava) {
          ctx.strokeStyle = f.alt > 0.45 ? '#fb923c' : '#ef4444';
          ctx.lineWidth = 1.8;
          ctx.globalAlpha = 0.85 * foreshorten;
          ctx.beginPath();
          ctx.moveTo(x - f.w * R * 0.35 * foreshorten, y - f.h * R * 0.2);
          ctx.quadraticCurveTo(x, y + f.h * R * 0.3, x + f.w * R * 0.35 * foreshorten, y - f.h * R * 0.1);
          ctx.stroke();
        } else {
          ctx.fillStyle = f.alt > 0.5 ? p.palette.primary : p.palette.secondary;
          ctx.globalAlpha = isOceanOrTerran ? 0.92 : 0.55;
          ctx.beginPath();
          ctx.ellipse(x, y, R * f.w * 0.45 * foreshorten, R * f.h * 0.42, f.alt * 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;

      // Polar ice caps for Terran / Ocean / Cryo worlds
      if (isOceanOrTerran || p.surfaceTempK < 275) {
        ctx.fillStyle = '#f8fafc';
        ctx.globalAlpha = 0.82;
        ctx.beginPath();
        ctx.ellipse(0, -R * 0.92, R * 0.62, R * 0.18, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(0, R * 0.92, R * 0.58, R * 0.16, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // Drifting cloud wisps for worlds with substantial atmospheres
      if (!isLava) {
        for (let c = 0; c < 9; c++) {
          const clon = c * 0.72 + rotAngle * 1.38;
          const cosC = Math.cos(clon);
          if (cosC <= 0) continue;
          const cxPos = Math.sin(clon) * R * 0.78;
          const cyPos = ((c % 5) - 2) * R * 0.32;
          ctx.fillStyle = p.palette.cloud || '#ffffff';
          ctx.globalAlpha = 0.32 * cosC;
          ctx.beginPath();
          ctx.ellipse(cxPos, cyPos, R * 0.34 * cosC, R * 0.08, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
    }

    ctx.rotate(-tiltRad);

    // Specular ocean/atmosphere glint on sunlit limb
    const spec = ctx.createRadialGradient(-R * 0.38, -R * 0.35, 2, -R * 0.38, -R * 0.35, R * 0.95);
    spec.addColorStop(0, 'rgba(255, 255, 255, 0.28)');
    spec.addColorStop(0.5, 'rgba(255, 255, 255, 0.04)');
    spec.addColorStop(1, 'transparent');
    ctx.fillStyle = spec;
    ctx.fillRect(-R, -R, R * 2, R * 2);

    // 3D Day/Night Terminator Shadow
    const shadow = ctx.createRadialGradient(-R * 0.42, -R * 0.28, R * 0.35, R * 0.22, R * 0.18, R * 1.32);
    shadow.addColorStop(0, 'rgba(0, 0, 0, 0)');
    shadow.addColorStop(0.58, 'rgba(2, 6, 23, 0.38)');
    shadow.addColorStop(0.84, 'rgba(2, 6, 23, 0.86)');
    shadow.addColorStop(1, 'rgba(2, 6, 23, 0.96)');
    ctx.fillStyle = shadow;
    ctx.fillRect(-R, -R, R * 2, R * 2);

    // Inner atmospheric limb glow
    ctx.strokeStyle = `${p.palette.atmo}88`;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, R - 1, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();

    // 4. Front half of planetary rings passing over the globe
    if (p.hasRings) {
      this.drawRingHalf(ctx, cx, cy, R, -0.32, p.palette.cloud, true);
    }
  }
}
