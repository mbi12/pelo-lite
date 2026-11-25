(function () {
  class HuaweiP40Hardware {
    constructor() {
      this.torchStream = null;
      this.torchTrack = null;
      this.torchSupported = false;
      this.wakeLockSentinel = null;
      this.cameraStream = null;
      this.audioCtx = null;
      this.ringInterval = null;
      this.recognition = null;
      this.isListening = false;
      this.mountedDirHandle = null;
      this.mountedFiles = [];

      this.telemetry = {
        batteryLevel: 88,
        charging: false,
        networkType: '4G / Wi-Fi',
        downlinkMbps: null,
        isHuaweiUa: /HUAWEI|ANA-NX9|ANA-AN00|ANA-LX4|HarmonyOS|EMUI/i.test(navigator.userAgent),
        speechRecognitionAvailable: Boolean(window.SpeechRecognition || window.webkitSpeechRecognition),
        speechSynthesisAvailable: Boolean(window.speechSynthesis),
        vibrateAvailable: Boolean(navigator.vibrate),
        wakeLockAvailable: Boolean('wakeLock' in navigator),
        mediaDevicesAvailable: Boolean(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
        fsAccessAvailable: Boolean(window.showDirectoryPicker)
      };
    }

    async init(onTelemetryChange) {
      this.onTelemetryChange = onTelemetryChange;

      if (navigator.getBattery) {
        try {
          const batt = await navigator.getBattery();
          const syncBatt = () => {
            this.telemetry.batteryLevel = Math.round(batt.level * 100);
            this.telemetry.charging = Boolean(batt.charging);
            if (this.onTelemetryChange) this.onTelemetryChange(this.telemetry);
          };
          syncBatt();
          batt.addEventListener('levelchange', syncBatt);
          batt.addEventListener('chargingchange', syncBatt);
        } catch { /* ignore */ }
      }

      const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      if (conn) {
        const syncConn = () => {
          const eff = (conn.effectiveType || '4g').toUpperCase();
          const dl = conn.downlink ? `${conn.downlink} Mbps` : '';
          this.telemetry.networkType = dl ? `${eff} · ${dl}` : eff;
          this.telemetry.downlinkMbps = conn.downlink || null;
          if (this.onTelemetryChange) this.onTelemetryChange(this.telemetry);
        };
        syncConn();
        if (conn.addEventListener) conn.addEventListener('change', syncConn);
      }

      document.addEventListener('visibilitychange', async () => {
        if (this.wakeLockWanted && document.visibilityState === 'visible') {
          await this.setWakeLock(true);
        }
      });
    }

    // Direct Browser Real Folder Mount (Physically lists, creates & deletes real files!)
    async mountRealDirectory() {
      if (!window.showDirectoryPicker) {
        throw new Error('Direct folder picker requires Chromium/Chrome — or use the 1-line P40 Termux Agent in P40 Bridge!');
      }
      this.mountedDirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
      return this.refreshMountedDirectory();
    }

    async refreshMountedDirectory() {
      if (!this.mountedDirHandle) return [];
      const list = [];
      for await (const [name, entry] of this.mountedDirHandle.entries()) {
        if (entry.kind === 'file') {
          let size = 0;
          try {
            const fileObj = await entry.getFile();
            size = fileObj.size;
          } catch { /* ignore */ }
          list.push({
            name,
            folder: this.mountedDirHandle.name || 'Mounted',
            sizeBytes: size,
            isLocalReal: true
          });
        }
      }
      this.mountedFiles = list;
      return list;
    }

    async deleteMountedRealFile(nameOrExt) {
      if (!this.mountedDirHandle) return 0;
      let deleted = 0;
      await this.refreshMountedDirectory();
      const target = String(nameOrExt || '').toLowerCase();
      for (const f of this.mountedFiles) {
        const low = f.name.toLowerCase();
        if (low === target || low.includes(target) || (target && low.endsWith(`.${target.replace(/^\./, '')}`))) {
          try {
            await this.mountedDirHandle.removeEntry(f.name);
            deleted++;
          } catch { /* ignore */ }
        }
      }
      await this.refreshMountedDirectory();
      return deleted;
    }

    async createMountedRealFile(name, content = '') {
      if (!this.mountedDirHandle) return false;
      const fh = await this.mountedDirHandle.getFileHandle(name, { create: true });
      const writable = await fh.createWritable();
      await writable.write(content);
      await writable.close();
      await this.refreshMountedDirectory();
      return true;
    }

    ensureAudio() {
      if (!this.audioCtx) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (Ctx) this.audioCtx = new Ctx();
      }
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        this.audioCtx.resume().catch(() => {});
      }
      return this.audioCtx;
    }

    playChime(kind = 'tap') {
      const ctx = this.ensureAudio();
      if (!ctx) return;
      const now = ctx.currentTime;
      const notes =
        kind === 'listen' ? [523.25, 659.25] :
        kind === 'done' ? [587.33, 880.0] :
        kind === 'alert' ? [783.99, 987.77, 1174.66] :
        [440];

      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.07);
        gain.gain.setValueAtTime(0.0001, now + idx * 0.07);
        gain.gain.exponentialRampToValueAtTime(0.09, now + idx * 0.07 + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.07 + 0.18);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.07);
        osc.stop(now + idx * 0.07 + 0.2);
      });
    }

    startAlarmRing() {
      this.stopAlarmRing();
      const pulse = () => {
        this.playChime('alert');
        this.vibrate('pulse');
      };
      pulse();
      this.ringInterval = setInterval(pulse, 1300);
    }

    stopAlarmRing() {
      if (this.ringInterval) {
        clearInterval(this.ringInterval);
        this.ringInterval = null;
      }
    }

    async setTorch(enable) {
      if (!enable) {
        if (this.torchTrack) {
          try { await this.torchTrack.applyConstraints({ advanced: [{ torch: false }] }); } catch { /* ignore */ }
          this.torchTrack.stop();
          this.torchTrack = null;
        }
        if (this.torchStream) {
          this.torchStream.getTracks().forEach((t) => t.stop());
          this.torchStream = null;
        }
        return { mode: 'off' };
      }

      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: 'environment' } }
          });
          const track = stream.getVideoTracks()[0];
          const caps = track.getCapabilities ? track.getCapabilities() : {};
          if (caps.torch) {
            await track.applyConstraints({ advanced: [{ torch: true }] });
            this.torchStream = stream;
            this.torchTrack = track;
            this.torchSupported = true;
            return { mode: 'hardware_led' };
          }
          stream.getTracks().forEach((t) => t.stop());
        } catch { /* ignore */ }
      }
      return { mode: 'bridge_and_soft' };
    }

    vibrate(pattern = 'pulse') {
      if (!navigator.vibrate) return false;
      if (pattern === 'sos') {
        return navigator.vibrate([110, 70, 110, 70, 110, 200, 300, 90, 300, 90, 300, 200, 110, 70, 110, 70, 110]);
      }
      if (pattern === 'tap') return navigator.vibrate(22);
      return navigator.vibrate([50, 40, 90]);
    }

    async setWakeLock(enable) {
      this.wakeLockWanted = Boolean(enable);
      if (!('wakeLock' in navigator)) return false;
      try {
        if (enable && !this.wakeLockSentinel) {
          this.wakeLockSentinel = await navigator.wakeLock.request('screen');
          this.wakeLockSentinel.addEventListener('release', () => { this.wakeLockSentinel = null; });
          return true;
        }
        if (!enable && this.wakeLockSentinel) {
          await this.wakeLockSentinel.release();
          this.wakeLockSentinel = null;
          return true;
        }
      } catch {
        return false;
      }
      return Boolean(this.wakeLockSentinel);
    }

    applySoftwareBrightness(percent) {
      const overlay = document.getElementById('brightness-dimmer');
      if (!overlay) return;
      const clamped = Math.max(5, Math.min(100, Number(percent)));
      const alpha = clamped >= 75 ? 0 : ((75 - clamped) / 75) * 0.62;
      overlay.style.opacity = alpha.toFixed(3);
    }

    speak(text, { enabled = true, onStart, onEnd } = {}) {
      if (!enabled || !window.speechSynthesis) {
        if (onEnd) onEnd();
        return;
      }
      try {
        window.speechSynthesis.cancel();
        const clean = String(text || '')
          .replace(/\*\*/g, '')
          .replace(/\*/g, '')
          .replace(/`/g, '')
          .replace(/•/g, '')
          .replace(/[\u{1F300}-\u{1FAFF}]/gu, '')
          .trim();
        if (!clean) {
          if (onEnd) onEnd();
          return;
        }
        const utter = new SpeechSynthesisUtterance(clean);
        utter.rate = 1.04;
        utter.onstart = () => { if (onStart) onStart(); };
        utter.onend = () => { if (onEnd) onEnd(); };
        utter.onerror = () => { if (onEnd) onEnd(); };
        window.speechSynthesis.speak(utter);
      } catch {
        if (onEnd) onEnd();
      }
    }

    startVoiceCapture({ onInterim, onFinal, onFallbackHint, onStop }) {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SR) {
        if (onFallbackHint) {
          onFallbackHint('Tap the microphone icon on your Huawei keyboard (Celia / SwiftKey) to dictate offline!');
        }
        if (onStop) onStop();
        return;
      }
      if (this.isListening && this.recognition) {
        this.recognition.stop();
        return;
      }
      try {
        const rec = new SR();
        this.recognition = rec;
        rec.lang = navigator.language || 'en-US';
        rec.interimResults = true;
        rec.maxAlternatives = 1;
        let finalTranscript = '';
        this.isListening = true;
        this.playChime('listen');

        rec.onresult = (ev) => {
          let interim = '';
          for (let i = ev.resultIndex; i < ev.results.length; i++) {
            const txt = ev.results[i][0].transcript;
            if (ev.results[i].isFinal) finalTranscript += txt;
            else interim += txt;
          }
          if (interim && onInterim) onInterim(interim);
          if (finalTranscript && onFinal) {
            const out = finalTranscript.trim();
            finalTranscript = '';
            onFinal(out);
          }
        };

        rec.onerror = (err) => {
          this.isListening = false;
          if (err.error === 'service-not-allowed' || err.error === 'network') {
            if (onFallbackHint) onFallbackHint('HMS Mode: Tap the mic icon on your Huawei keyboard to dictate directly into Pelo!');
          } else if (err.error === 'not-allowed') {
            if (onFallbackHint) onFallbackHint('Allow microphone access in site settings.');
          }
          if (onStop) onStop();
        };

        rec.onend = () => {
          this.isListening = false;
          if (onStop) onStop();
        };
        rec.start();
      } catch {
        this.isListening = false;
        if (onStop) onStop();
      }
    }

    async openCameraPreview(videoEl) {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera API requires HTTPS and camera permissions.');
      }
      this.cameraStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      });
      videoEl.srcObject = this.cameraStream;
      await videoEl.play();
      return true;
    }

    closeCameraPreview(videoEl) {
      if (this.cameraStream) {
        this.cameraStream.getTracks().forEach((t) => t.stop());
        this.cameraStream = null;
      }
      if (videoEl) videoEl.srcObject = null;
    }

    async fetchLiveWeather() {
      let lat = 52.3676;
      let lon = 4.9041;
      let label = 'Current Area';
      if (navigator.geolocation) {
        try {
          const pos = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 3500, maximumAge: 300000 });
          });
          lat = pos.coords.latitude;
          lon = pos.coords.longitude;
          label = `${lat.toFixed(2)}°N, ${lon.toFixed(2)}°E`;
        } catch {
          label = 'Amsterdam (Default)';
        }
      }
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m&timezone=auto`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Weather service unreachable');
      const data = await res.json();
      const c = data.current;
      const codeMap = {
        0: '☀️ Clear Sky', 1: '🌤️ Mainly Clear', 2: '⛅ Partly Cloudy', 3: '☁️ Overcast',
        45: '🌫️ Foggy', 51: '🌦️ Light Drizzle', 61: '🌧️ Rain', 63: '🌧️ Moderate Rain',
        71: '❄️ Snow', 80: '🌦️ Rain Showers', 95: '⛈️ Thunderstorm'
      };
      return {
        location: label,
        tempC: Math.round(c.temperature_2m),
        feelsC: Math.round(c.apparent_temperature),
        windKmh: Math.round(c.wind_speed_10m),
        condition: codeMap[c.weather_code] || '🌤️ Fair Conditions'
      };
    }
  }

  window.HuaweiP40Hardware = HuaweiP40Hardware;
})();
