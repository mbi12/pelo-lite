(function () {
  class PeloOrb {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.mode = 'idle'; // 'idle' | 'listening' | 'speaking' | 'executing'
      this.phase = 0;
      this.energy = 0.22;
      this.targetEnergy = 0.22;
      this.resize();
      window.addEventListener('resize', () => this.resize());
      requestAnimationFrame(() => this.loop());
    }

    setMode(mode) {
      this.mode = mode;
      if (mode === 'listening') this.targetEnergy = 0.95;
      else if (mode === 'executing') this.targetEnergy = 0.85;
      else if (mode === 'speaking') this.targetEnergy = 0.65;
      else this.targetEnergy = 0.22;
    }

    resize() {
      if (!this.canvas) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const size = this.canvas.clientWidth || 124;
      this.size = size;
      this.canvas.width = Math.round(size * dpr);
      this.canvas.height = Math.round(size * dpr);
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    palette() {
      if (this.mode === 'listening') {
        return { c1: '#ec4899', c2: '#38bdf8', c3: '#a855f7', glow: 'rgba(236, 72, 153, 0.36)' };
      }
      if (this.mode === 'executing') {
        return { c1: '#34d399', c2: '#38bdf8', c3: '#fbbf24', glow: 'rgba(52, 211, 153, 0.36)' };
      }
      if (this.mode === 'speaking') {
        return { c1: '#38bdf8', c2: '#818cf8', c3: '#2dd4bf', glow: 'rgba(56, 189, 248, 0.36)' };
      }
      return { c1: '#38bdf8', c2: '#6366f1', c3: '#2dd4bf', glow: 'rgba(56, 189, 248, 0.22)' };
    }

    loop() {
      const ctx = this.ctx;
      const s = this.size || 124;
      const cx = s / 2;
      const cy = s / 2;
      const baseR = s * 0.31;

      this.energy += (this.targetEnergy - this.energy) * 0.08;
      this.phase += 0.028 + this.energy * 0.065;

      ctx.clearRect(0, 0, s, s);
      const pal = this.palette();

      // Outer ambient halo
      const halo = ctx.createRadialGradient(cx, cy, baseR * 0.2, cx, cy, baseR * 1.55);
      halo.addColorStop(0, pal.glow);
      halo.addColorStop(1, 'rgba(5, 7, 15, 0)');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(cx, cy, baseR * 1.55, 0, Math.PI * 2);
      ctx.fill();

      // 3 organic harmonic plasma rings
      const layers = [
        { color: pal.c1, freq: 3, speed: 1.0, amp: 5.5 * this.energy + 1.5, alpha: 0.72 },
        { color: pal.c2, freq: 4, speed: -1.35, amp: 6.5 * this.energy + 1.2, alpha: 0.65 },
        { color: pal.c3, freq: 5, speed: 0.8, amp: 4.5 * this.energy + 1.0, alpha: 0.52 }
      ];

      for (const layer of layers) {
        ctx.beginPath();
        for (let i = 0; i <= 72; i++) {
          const a = (i / 72) * Math.PI * 2;
          const wave =
            Math.sin(a * layer.freq + this.phase * layer.speed) * layer.amp +
            Math.cos(a * (layer.freq - 1) - this.phase * 0.7) * (layer.amp * 0.45);
          const r = baseR + wave;
          const x = cx + Math.cos(a) * r;
          const y = cy + Math.sin(a) * r;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.strokeStyle = layer.color;
        ctx.globalAlpha = layer.alpha;
        ctx.lineWidth = 2.1;
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // Inner luminous core sphere
      const pulse = 1 + Math.sin(this.phase * 1.6) * (0.04 + this.energy * 0.06);
      const coreR = baseR * 0.74 * pulse;
      const coreGrad = ctx.createRadialGradient(
        cx - coreR * 0.28,
        cy - coreR * 0.28,
        coreR * 0.08,
        cx,
        cy,
        coreR
      );
      coreGrad.addColorStop(0, '#ffffff');
      coreGrad.addColorStop(0.28, pal.c1);
      coreGrad.addColorStop(0.75, pal.c2);
      coreGrad.addColorStop(1, 'rgba(8, 12, 28, 0.92)');

      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, coreR, 0, Math.PI * 2);
      ctx.fill();

      requestAnimationFrame(() => this.loop());
    }
  }

  window.PeloOrb = PeloOrb;
})();
