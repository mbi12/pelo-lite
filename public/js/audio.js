// Procedural Web Audio Radio-Telescope Sonification Engine

const SPECTRAL_BASE_FREQ = {
  O: 146.83,  // D3
  B: 130.81,  // C3
  A: 123.47,  // B2
  F: 110.00,  // A2
  G: 98.00,   // G2
  K: 87.31,   // F2
  M: 73.42,   // D2
  PSR: 164.81,// E3
  WD: 196.00  // G3
};

export class SpaceAudioEngine {
  constructor() {
    this.ctx = null;
    this.enabled = false;
    this.masterGain = null;
    this.osc1 = null;
    this.osc2 = null;
    this.filter = null;
    this.pingTimer = null;
    this.currentSystem = null;
    this.currentPlanet = null;
  }

  init() {
    if (this.ctx) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    this.ctx = new AudioCtx();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.0;
    this.masterGain.connect(this.ctx.destination);

    this.filter = this.ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 340;
    this.filter.Q.value = 3.2;
    this.filter.connect(this.masterGain);

    this.osc1 = this.ctx.createOscillator();
    this.osc2 = this.ctx.createOscillator();
    this.osc1.type = 'sawtooth';
    this.osc2.type = 'triangle';
    this.osc1.frequency.value = 98;
    this.osc2.frequency.value = 147.2; // Perfect fifth detuned

    const droneGain = this.ctx.createGain();
    droneGain.gain.value = 0.16;
    this.osc1.connect(droneGain);
    this.osc2.connect(droneGain);
    droneGain.connect(this.filter);

    // Slow breathing LFO on lowpass cutoff
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    lfo.frequency.value = 0.14;
    lfoGain.gain.value = 140;
    lfo.connect(lfoGain);
    lfoGain.connect(this.filter.frequency);

    this.osc1.start();
    this.osc2.start();
    lfo.start();
  }

  toggle() {
    this.init();
    if (!this.ctx) return false;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    this.enabled = !this.enabled;
    const now = this.ctx.currentTime;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setTargetAtTime(this.enabled ? 0.35 : 0.0, now, 0.35);

    if (this.enabled) {
      this.updateTuning(this.currentSystem, this.currentPlanet);
      this.startTelemetryPings();
    } else if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }

    return this.enabled;
  }

  updateTuning(system, planet) {
    this.currentSystem = system;
    this.currentPlanet = planet;
    if (!this.ctx || !this.enabled || !system) return;

    const now = this.ctx.currentTime;
    const root = SPECTRAL_BASE_FREQ[system.spectralClass] || 98;
    const planetRatio = planet ? 1 + (planet.orbitIndex % 5) * 0.125 : 1.5;

    this.osc1.frequency.setTargetAtTime(root, now, 0.4);
    this.osc2.frequency.setTargetAtTime(root * planetRatio, now, 0.4);
    const cutoff = planet ? Math.min(900, Math.max(200, 220 + planet.esi * 480)) : 340;
    this.filter.frequency.setTargetAtTime(cutoff, now, 0.5);
  }

  startTelemetryPings() {
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.pingTimer = setInterval(() => {
      if (!this.enabled || !this.ctx) return;
      const isPulsar = this.currentSystem?.spectralClass === 'PSR';
      this.playPing(isPulsar);
    }, 2200);
  }

  playPing(isPulsar = false) {
    if (!this.ctx || !this.enabled) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();

    const esi = this.currentPlanet?.esi || 0.4;
    const scale = [1, 1.25, 1.5, 1.875, 2.0, 2.5];
    const mult = scale[Math.floor(Math.random() * scale.length)];
    const base = isPulsar ? 520 : 260 + esi * 220;

    osc.type = isPulsar ? 'square' : 'sine';
    osc.frequency.setValueAtTime(base * mult, now);
    if (isPulsar) {
      osc.frequency.exponentialRampToValueAtTime(140, now + 0.12);
    }

    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(isPulsar ? 0.04 : 0.07, now + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0005, now + (isPulsar ? 0.18 : 1.3));

    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 1.4);
  }

  playScanSweep() {
    if (!this.ctx || !this.enabled) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(1040, now + 0.35);
    g.gain.setValueAtTime(0.08, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.48);
  }
}
