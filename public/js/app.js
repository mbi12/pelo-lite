(function () {
  const hw = new window.HuaweiP40Hardware();
  let orb = null;
  let state = {
    storageMode: 'sqlite',
    device: null,
    messages: [],
    contacts: [],
    tasks: [],
    alarms: [],
    memories: [],
    routines: [],
    bridgeQueue: [],
    appsCatalog: {}
  };
  let deferredInstallPrompt = null;
  let lastFiredAlarmMinute = '';

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatMarkdown(str) {
    return escapeHtml(str)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br/>');
  }

  function toast(msg) {
    const el = $('#pelo-toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.remove('hidden');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.add('hidden'), 2800);
  }

  function getSavedLlmConfig() {
    try {
      const raw = localStorage.getItem('pelo_llm_config');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  async function api(path, options = {}) {
    const res = await fetch(path, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
      body: options.body ? JSON.stringify(options.body) : undefined
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
    return data;
  }

  // ==========================================================================
  // RENDER FUNCTIONS
  // ==========================================================================
  function renderAll() {
    renderHeader();
    renderChat();
    renderControls();
    renderHub();
    renderBridge();
    renderSettings();
    renderDesktopInspector();
  }

  function renderHeader() {
    const d = state.device;
    if (!d) return;
    $('#header-assistant-name').textContent = `${(d.assistantName || 'PELO').toUpperCase()} AI`;
    const uaTag = hw.telemetry.isHuaweiUa ? 'HUAWEI P40 DETECTED' : 'P40 · HMS READY';
    $('#header-device-sub').textContent = `${uaTag} · ${state.storageMode.toUpperCase()}`;

    const batt = hw.telemetry.batteryLevel ?? d.batteryLevel ?? 88;
    const chg = hw.telemetry.charging || d.charging;
    $('#live-battery').textContent = `${chg ? '⚡' : '🔋'} ${batt}%`;

    const voiceBtn = $('#btn-voice-toggle');
    voiceBtn.textContent = d.voiceReply ? '🔊' : '🔇';

    const dot = $('#bridge-dot');
    dot.classList.toggle('online', Boolean(d.bridgeOnline));
  }

  function buildActionElement(act) {
    if (act.type === 'deep_link') {
      const a = document.createElement('a');
      a.className = 'action-pill';
      a.href = act.uri || act.fallbackUrl || '#';
      a.textContent = `${act.icon || '🚀'} ${act.label}`;
      a.addEventListener('click', (e) => {
        hw.vibrate('tap');
        // On desktop browsers, custom schemes like whatsapp:// or geo: might not exist; fall back gracefully
        if (!hw.telemetry.isHuaweiUa && !/Android|iPhone/i.test(navigator.userAgent) && act.fallbackUrl && !act.uri.startsWith('http')) {
          e.preventDefault();
          window.open(act.fallbackUrl, '_blank', 'noopener');
        }
      });
      return a;
    }

    if (act.type === 'suggestion_bar') {
      const a = document.createElement('a');
      a.className = 'action-pill';
      a.href = act.searchUrl;
      a.target = '_blank';
      a.rel = 'noopener';
      a.textContent = act.label;
      return a;
    }

    const span = document.createElement('button');
    span.type = 'button';
    span.className = 'action-pill';
    span.textContent = act.label || act.type;
    span.addEventListener('click', () => {
      if (act.type === 'open_camera_lens') openCameraModal();
      else if (act.type === 'vibrate') hw.vibrate(act.pattern);
      else if (act.type === 'hardware_setting' && act.setting === 'flashlight') {
        toggleSetting('flashlight');
      } else {
        switchTab('controls');
      }
    });
    return span;
  }

  function renderChat() {
    const stream = $('#chat-stream');
    stream.innerHTML = '';
    for (const msg of state.messages) {
      const row = document.createElement('div');
      row.className = `msg-row ${msg.role === 'user' ? 'user' : 'assistant'}`;

      const bubble = document.createElement('div');
      bubble.className = 'msg-bubble';
      bubble.innerHTML = formatMarkdown(msg.content);
      row.appendChild(bubble);

      if (Array.isArray(msg.actions) && msg.actions.length > 0) {
        const cards = document.createElement('div');
        cards.className = 'action-cards';
        for (const act of msg.actions) {
          cards.appendChild(buildActionElement(act));
        }
        row.appendChild(cards);
      }

      stream.appendChild(row);
    }
    stream.scrollTop = stream.scrollHeight;
  }

  function renderControls() {
    const d = state.device;
    if (!d) return;

    const toggles = ['flashlight', 'wakeLock', 'wifi', 'bluetooth', 'dnd', 'powerSaver'];
    for (const key of toggles) {
      const tile = $(`#tile-${key}`);
      if (!tile) continue;
      const isOn = Boolean(d[key]);
      tile.classList.toggle('active', isOn);
      const st = tile.querySelector('.tile-state');
      if (st) st.textContent = isOn ? 'ON' : 'OFF';
    }

    $('#slider-brightness').value = d.brightness;
    $('#lbl-brightness').textContent = `${d.brightness}%`;
    hw.applySoftwareBrightness(d.brightness);

    $('#slider-volume').value = d.volume;
    $('#lbl-volume').textContent = `${d.volume}%`;

    // Render Routines
    const rtList = $('#routines-list');
    rtList.innerHTML = '';
    for (const rt of state.routines) {
      const div = document.createElement('div');
      div.className = 'routine-card';
      div.innerHTML = `
        <div class="routine-meta">
          <div class="routine-title">${escapeHtml(rt.icon)} ${escapeHtml(rt.name)}</div>
          <div class="routine-sub">Say "${escapeHtml(rt.triggerPhrase)}" · ${escapeHtml(rt.description || `${rt.steps.length} actions`)}</div>
        </div>
        <div class="item-actions">
          <button class="mini-btn accent" data-run-rt="${rt.id}">▶ Run</button>
          ${rt.id > 5 ? `<button class="mini-btn danger" data-del-rt="${rt.id}">✕</button>` : ''}
        </div>
      `;
      rtList.appendChild(div);
    }

    // Render Huawei P40 App Dock
    const dock = $('#app-dock-grid');
    dock.innerHTML = '';
    for (const [slug, app] of Object.entries(state.appsCatalog || {})) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'app-dock-btn';
      btn.innerHTML = `<span class="app-dock-ico">${escapeHtml(app.icon)}</span><span>${escapeHtml(app.name)}</span>`;
      btn.addEventListener('click', () => {
        hw.vibrate('tap');
        if (slug === 'camera') {
          openCameraModal();
          return;
        }
        launchAppDeepLink(app);
      });
      dock.appendChild(btn);
    }
  }

  function launchAppDeepLink(app) {
    toast(`Launching ${app.name}...`);
    const isMobile = hw.telemetry.isHuaweiUa || /Android|iPhone/i.test(navigator.userAgent);
    if (isMobile) {
      window.location.href = app.uri || app.intentUri;
    } else if (app.fallbackUrl) {
      window.open(app.fallbackUrl, '_blank', 'noopener');
    } else {
      sendCommand(`Open ${app.name}`);
    }
  }

  function renderHub() {
    // Alarms
    const aList = $('#alarms-list');
    aList.innerHTML = '';
    for (const a of state.alarms) {
      const div = document.createElement('div');
      div.className = 'list-item';
      div.innerHTML = `
        <div>
          <strong>${escapeHtml(a.timeHhmm)}</strong> · ${escapeHtml(a.label)}
          <div class="muted-small">${escapeHtml(a.days)}</div>
        </div>
        <div class="item-actions">
          <button class="mini-btn ${a.enabled ? 'accent' : ''}" data-toggle-alarm="${a.id}">${a.enabled ? 'ON' : 'OFF'}</button>
          <button class="mini-btn danger" data-del-alarm="${a.id}">✕</button>
        </div>
      `;
      aList.appendChild(div);
    }

    // Tasks
    const tList = $('#tasks-list');
    tList.innerHTML = '';
    for (const t of state.tasks) {
      const div = document.createElement('div');
      div.className = `list-item ${t.completed ? 'done' : ''}`;
      div.innerHTML = `
        <span>${escapeHtml(t.title)}</span>
        <div class="item-actions">
          <button class="mini-btn accent" data-toggle-task="${t.id}">${t.completed ? 'Undo' : '✓'}</button>
          <button class="mini-btn danger" data-del-task="${t.id}">✕</button>
        </div>
      `;
      tList.appendChild(div);
    }

    // Contacts
    const cList = $('#contacts-list');
    cList.innerHTML = '';
    for (const c of state.contacts) {
      const cleanWa = String(c.whatsapp || c.phone).replace(/[^\d]/g, '');
      const div = document.createElement('div');
      div.className = 'list-item';
      div.innerHTML = `
        <div>
          <strong>${escapeHtml(c.name)}</strong> <span class="muted-small">(${escapeHtml(c.relationship)})</span>
          <div class="muted-small">${escapeHtml(c.phone)}</div>
        </div>
        <div class="item-actions">
          <a class="mini-btn accent" href="tel:${escapeHtml(c.phone)}">📞</a>
          <a class="mini-btn accent" href="whatsapp://send?phone=${escapeHtml(cleanWa)}">💬</a>
          <button class="mini-btn danger" data-del-contact="${c.id}">✕</button>
        </div>
      `;
      cList.appendChild(div);
    }

    // Memories
    const mList = $('#memories-list');
    mList.innerHTML = '';
    for (const m of state.memories) {
      const div = document.createElement('div');
      div.className = 'list-item';
      div.innerHTML = `
        <span>🧠 ${escapeHtml(m.fact)}</span>
        <button class="mini-btn danger" data-del-mem="${m.id}">✕</button>
      `;
      mList.appendChild(div);
    }
  }

  function renderBridge() {
    const d = state.device;
    if (!d) return;

    $('#bridge-status-pill').textContent = d.bridgeOnline ? '🟢 P40 Bridge Connected' : '📲 Direct Web + Ready to Pair';
    $('#bridge-token-display').textContent = `Token: ${d.bridgeToken}`;

    const t = hw.telemetry;
    const checks = [
      ['Huawei P40 / Browser Shell', t.isHuaweiUa ? '✅ Native Huawei P40 Detected' : '✅ Ready (Open URL on Huawei P40)'],
      ['Camera & Rear LED Torch API', t.mediaDevicesAvailable ? '✅ Supported' : '⚠️ HTTPS Required'],
      ['Haptic Vibration Motor', t.vibrateAvailable ? '✅ Supported' : 'ℹ️ Mobile Only'],
      ['Screen Wake Lock (HUD Mode)', t.wakeLockAvailable ? '✅ Supported' : '⚠️ Unavailable'],
      ['Spoken AI Voice (TTS)', t.speechSynthesisAvailable ? '✅ Active' : '⚠️ Muted'],
      ['HMS Voice Input Pipeline', t.speechRecognitionAvailable ? '✅ Web Speech + Huawei Keyboard' : '✅ Huawei Celia Keyboard Ready'],
      ['Cloud Persistence Engine', state.storageMode === 'supabase' ? '✅ Supabase Postgres (Permanent)' : '✅ Local SQLite Store']
    ];

    $('#capability-matrix').innerHTML = checks
      .map(([k, v]) => `<div style="display:flex;justify-content:space-between;padding:5px 0;font-size:0.78rem;border-bottom:1px solid rgba(148,163,184,0.1);"><span>${escapeHtml(k)}</span><strong>${escapeHtml(v)}</strong></div>`)
      .join('');

    const qList = $('#bridge-queue-list');
    qList.innerHTML = '';
    if (!state.bridgeQueue.length) {
      qList.innerHTML = '<div class="muted-small">No queued OS bridge actions yet. Toggle Wi-Fi or Lock Screen to see live payloads!</div>';
      return;
    }
    for (const q of state.bridgeQueue.slice(0, 12)) {
      const div = document.createElement('div');
      div.className = 'list-item';
      div.innerHTML = `
        <div>
          <strong>${escapeHtml(q.label)}</strong>
          <div class="muted-small">${escapeHtml(q.commandType)} · ${new Date(q.createdAt).toLocaleTimeString()}</div>
        </div>
        <span class="badge-tag">${escapeHtml(q.status)}</span>
      `;
      qList.appendChild(div);
    }
  }

  function renderSettings() {
    const d = state.device;
    if (!d) return;
    $('#set-owner-name').value = d.ownerName || 'Boss';
    $('#set-assistant-name').value = d.assistantName || 'Pelo';
    $('#set-voice-reply').checked = Boolean(d.voiceReply);
    $('#set-auto-execute').checked = Boolean(d.autoExecute);

    const savedLlm = getSavedLlmConfig();
    if (savedLlm) {
      $('#llm-provider').value = savedLlm.provider || 'groq';
      $('#llm-api-key').value = savedLlm.apiKey || '';
    }
  }

  function renderDesktopInspector() {
    const d = state.device;
    if (!d) return;
    $('#share-live-url').textContent = window.location.origin;
    const cells = [
      ['Target Phone', 'Huawei P40 (OLED)'],
      ['Persistence', state.storageMode.toUpperCase()],
      ['Battery', `${hw.telemetry.batteryLevel ?? d.batteryLevel}%`],
      ['Network', hw.telemetry.networkType],
      ['Brightness / Vol', `${d.brightness}% / ${d.volume}%`],
      ['Bridge Queue', `${state.bridgeQueue.filter((q) => q.status === 'pending').length} pending`]
    ];
    $('#inspector-telemetry').innerHTML = cells
      .map(([lbl, val]) => `<div class="kv-cell"><span>${escapeHtml(lbl)}</span><strong>${escapeHtml(val)}</strong></div>`)
      .join('');
  }

  // ==========================================================================
  // EXECUTE CLIENT-SIDE HARDWARE ACTIONS RETURNED BY PELO BRAIN
  // ==========================================================================
  async function executeClientActions(actions = []) {
    if (!actions.length) return;
    orb.setMode('executing');

    for (const act of actions) {
      if (act.type === 'hardware_setting') {
        if (act.setting === 'flashlight') {
          await hw.setTorch(act.value);
        } else if (act.setting === 'wakeLock') {
          await hw.setWakeLock(act.value);
        }
      } else if (act.type === 'hardware_slider') {
        if (act.setting === 'brightness') {
          hw.applySoftwareBrightness(act.value);
        }
      } else if (act.type === 'vibrate') {
        hw.vibrate(act.pattern);
      } else if (act.type === 'open_camera_lens') {
        openCameraModal();
      } else if (act.type === 'fetch_live_weather') {
        try {
          const w = await hw.fetchLiveWeather();
          const weatherMsg = `🌤️ **${w.location}**: **${w.tempC}°C** (feels like ${w.feelsC}°C) · ${w.condition} · Wind ${w.windKmh} km/h.`;
          state.messages.push({
            id: Date.now(),
            role: 'assistant',
            content: weatherMsg,
            actions: []
          });
          renderChat();
          hw.speak(weatherMsg, { enabled: state.device?.voiceReply });
        } catch {
          toast('Weather lookup offline right now');
        }
      } else if (act.type === 'deep_link' && state.device?.autoExecute && hw.telemetry.isHuaweiUa) {
        // Automatically fire native URI intent on Huawei P40!
        setTimeout(() => { window.location.href = act.uri; }, 350);
      }
    }

    setTimeout(() => orb.setMode('idle'), 900);
  }

  // ==========================================================================
  // CORE INTERACTIONS
  // ==========================================================================
  async function sendCommand(text) {
    const clean = String(text || '').trim();
    if (!clean) return;

    $('#command-input').value = '';
    $('#orb-status-text').textContent = 'Pelo is executing on your P40...';
    orb.setMode('executing');
    hw.playChime('tap');

    // Optimistic user bubble
    state.messages.push({ id: Date.now(), role: 'user', content: clean, actions: [] });
    renderChat();

    try {
      const res = await api('/api/command', {
        method: 'POST',
        body: {
          text: clean,
          telemetry: {
            batteryLevel: hw.telemetry.batteryLevel,
            charging: hw.telemetry.charging,
            networkType: hw.telemetry.networkType
          },
          llmConfig: getSavedLlmConfig()
        }
      });

      state = { ...state, ...res.bootstrap, appsCatalog: state.appsCatalog };
      renderAll();
      await executeClientActions(res.actions || []);

      $('#orb-status-text').textContent = 'Tap orb to speak · Built for Huawei P40';

      // Speak response if enabled (unless weather is about to speak its own live readout)
      const hasWeatherAction = (res.actions || []).some((a) => a.type === 'fetch_live_weather');
      if (!hasWeatherAction) {
        hw.speak(res.reply, {
          enabled: Boolean(state.device?.voiceReply),
          onStart: () => orb.setMode('speaking'),
          onEnd: () => orb.setMode('idle')
        });
      }
    } catch (err) {
      orb.setMode('idle');
      toast(err.message || 'Command failed');
    }
  }

  async function toggleSetting(key) {
    if (!state.device) return;
    const nextVal = !state.device[key];
    state.device[key] = nextVal;
    hw.vibrate('tap');
    hw.playChime('tap');
    renderControls();

    if (key === 'flashlight') {
      const res = await hw.setTorch(nextVal);
      toast(nextVal ? (res.mode === 'hardware_led' ? '🔦 P40 Rear LED Torch ON' : '🔦 Torch ON (Synced to Bridge)') : '🔦 Flashlight OFF');
    } else if (key === 'wakeLock') {
      await hw.setWakeLock(nextVal);
      toast(nextVal ? '☀️ Keep Screen Awake ON' : 'Screen Wake Lock Released');
    } else {
      toast(`${key.toUpperCase()} → ${nextVal ? 'ON' : 'OFF'}`);
    }

    const updated = await api('/api/device', { method: 'PATCH', body: { [key]: nextVal } });
    state.device = updated.device;
    state.bridgeQueue = updated.bridgeQueue;
    renderAll();
  }

  function switchTab(tabName) {
    $$('.nav-tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === tabName));
    $$('.tab-view').forEach((v) => v.classList.toggle('active', v.id === `view-${tabName}`));
    hw.vibrate('tap');
  }

  async function openCameraModal() {
    const modal = $('#camera-modal');
    const video = $('#camera-video');
    modal.classList.remove('hidden');
    try {
      await hw.openCameraPreview(video);
      $('#camera-status').textContent = ' Huawei P40 Rear Camera Live';
    } catch (err) {
      $('#camera-status').textContent = err.message || 'Grant camera permission in Huawei Browser to stream rear lens.';
    }
  }

  function triggerVoiceInput() {
    const micBtn = $('#btn-bar-mic');
    orb.setMode('listening');
    micBtn.classList.add('listening');
    $('#orb-status-text').textContent = 'Listening... speak your command';

    hw.startVoiceCapture({
      onInterim: (txt) => {
        $('#command-input').value = txt;
        $('#orb-status-text').textContent = `"${txt}..."`;
      },
      onFinal: (txt) => {
        micBtn.classList.remove('listening');
        sendCommand(txt);
      },
      onFallbackHint: (hint) => {
        toast(hint);
        $('#orb-status-text').textContent = hint;
        $('#command-input').focus();
      },
      onStop: () => {
        micBtn.classList.remove('listening');
        if (orb.mode === 'listening') orb.setMode('idle');
      }
    });
  }

  // ==========================================================================
  // LIVE CLOCK, TIMERS & ALARM WATCHER
  // ==========================================================================
  function startRealtimeTicker() {
    setInterval(async () => {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      const hhmm = `${hh}:${mm}`;
      $('#live-clock').textContent = hhmm;

      // 1. Check active countdown timers
      const activeTimer = state.alarms.find((a) => a.kind === 'timer' && a.enabled && a.targetEpochMs);
      const banner = $('#live-timer-banner');
      if (activeTimer) {
        const remSec = Math.max(0, Math.ceil((activeTimer.targetEpochMs - Date.now()) / 1000));
        banner.classList.remove('hidden');
        $('#live-timer-label').textContent = `⏱️ ${activeTimer.label}`;
        const m = String(Math.floor(remSec / 60)).padStart(2, '0');
        const s = String(remSec % 60).padStart(2, '0');
        $('#live-timer-countdown').textContent = `${m}:${s}`;

        if (remSec <= 0) {
          activeTimer.enabled = false;
          banner.classList.add('hidden');
          api(`/api/alarms/${activeTimer.id}`, { method: 'DELETE' }).catch(() => {});
          state.alarms = state.alarms.filter((x) => x.id !== activeTimer.id);
          renderHub();
          showRingAlert(activeTimer.label, 'Countdown timer finished!');
        }
      } else {
        banner.classList.add('hidden');
      }

      // 2. Check scheduled HH:MM alarms once per minute
      if (now.getSeconds() === 0 && lastFiredAlarmMinute !== hhmm) {
        const due = state.alarms.find((a) => a.kind === 'alarm' && a.enabled && a.timeHhmm === hhmm);
        if (due) {
          lastFiredAlarmMinute = hhmm;
          showRingAlert(due.label, `Scheduled ${due.timeHhmm} alarm`);
        }
      }
    }, 1000);
  }

  function showRingAlert(title, subtitle) {
    $('#ring-title').textContent = title || 'Pelo Alert!';
    $('#ring-subtitle').textContent = subtitle || '';
    $('#ring-modal').classList.remove('hidden');
    hw.startAlarmRing();
  }

  // ==========================================================================
  // INITIALIZE EVENT LISTENERS & BOOTSTRAP
  // ==========================================================================
  async function init() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredInstallPrompt = e;
      $('#btn-pwa-install').classList.remove('hidden');
    });

    $('#btn-pwa-install').addEventListener('click', async () => {
      if (!deferredInstallPrompt) return;
      deferredInstallPrompt.prompt();
      deferredInstallPrompt = null;
      $('#btn-pwa-install').classList.add('hidden');
    });

    orb = new window.PeloOrb($('#pelo-orb-canvas'));
    await hw.init(() => {
      renderHeader();
      renderDesktopInspector();
    });

    // Load initial state from backend
    const boot = await api('/api/bootstrap');
    state = { ...state, ...boot };
    renderAll();

    // Support URL shortcut params (?tab=controls or ?voice=1)
    const params = new URLSearchParams(window.location.search);
    if (params.get('tab')) switchTab(params.get('tab'));

    // Bottom Navigation
    $$('.nav-tab').forEach((btn) => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // Command Bar & Voice Buttons
    $('#command-form').addEventListener('submit', (e) => {
      e.preventDefault();
      sendCommand($('#command-input').value);
    });
    $('#btn-orb-mic').addEventListener('click', triggerVoiceInput);
    $('#btn-bar-mic').addEventListener('click', triggerVoiceInput);

    // Quick Chips & Desktop Demo Prompts
    $$('.chip, .demo-prompt').forEach((chip) => {
      chip.addEventListener('click', () => {
        switchTab('assistant');
        sendCommand(chip.dataset.cmd);
      });
    });

    // Voice Reply Mute Toggle
    $('#btn-voice-toggle').addEventListener('click', async () => {
      if (!state.device) return;
      const next = !state.device.voiceReply;
      state.device.voiceReply = next;
      if (!next && window.speechSynthesis) window.speechSynthesis.cancel();
      renderHeader();
      await api('/api/device', { method: 'PATCH', body: { voiceReply: next } });
      toast(next ? '🔊 Voice replies enabled' : '🔇 Voice replies muted');
    });

    // Control Center Hardware Tiles
    $$('.hw-tile[data-toggle]').forEach((tile) => {
      tile.addEventListener('click', () => toggleSetting(tile.dataset.toggle));
    });
    $('#tile-vibrate').addEventListener('click', () => {
      hw.vibrate('sos');
      hw.playChime('done');
      toast('📳 Pulsing P40 Haptic SOS');
    });
    $('#tile-camera').addEventListener('click', openCameraModal);
    $('#btn-close-camera').addEventListener('click', () => {
      hw.closeCameraPreview($('#camera-video'));
      $('#camera-modal').classList.add('hidden');
    });

    // Sliders
    let sliderTimer = null;
    const bindSlider = (id, lblId, field) => {
      const el = $(id);
      el.addEventListener('input', () => {
        const val = Number(el.value);
        $(lblId).textContent = `${val}%`;
        if (field === 'brightness') hw.applySoftwareBrightness(val);
        clearTimeout(sliderTimer);
        sliderTimer = setTimeout(async () => {
          const res = await api('/api/device', { method: 'PATCH', body: { [field]: val } });
          state.device = res.device;
          state.bridgeQueue = res.bridgeQueue;
          renderBridge();
          renderDesktopInspector();
        }, 280);
      });
    };
    bindSlider('#slider-brightness', '#lbl-brightness', 'brightness');
    bindSlider('#slider-volume', '#lbl-volume', 'volume');

    // Routines actions & Custom Routine Form
    $('#btn-toggle-new-routine').addEventListener('click', () => {
      $('#form-new-routine').classList.toggle('hidden');
    });

    $('#form-new-routine').addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = $('#rt-name').value.trim();
      const triggerPhrase = $('#rt-phrase').value.trim();
      const preset = $('#rt-preset').value;
      const presetSteps = {
        music_dnd: [
          { type: 'set_setting', setting: 'dnd', value: true },
          { type: 'set_slider', setting: 'volume', value: 90 },
          { type: 'open_app', app: 'spotify' }
        ],
        night_save: [
          { type: 'set_setting', setting: 'powerSaver', value: true },
          { type: 'set_slider', setting: 'brightness', value: 20 },
          { type: 'set_setting', setting: 'wifi', value: false }
        ],
        nav_awake: [
          { type: 'set_setting', setting: 'wakeLock', value: true },
          { type: 'set_slider', setting: 'brightness', value: 95 },
          { type: 'open_app', app: 'petal_maps' }
        ]
      };
      const created = await api('/api/routines', {
        method: 'POST',
        body: { name, triggerPhrase, icon: '⚡', steps: presetSteps[preset] || [] }
      });
      state.routines.push(created);
      $('#rt-name').value = '';
      $('#rt-phrase').value = '';
      $('#form-new-routine').classList.add('hidden');
      renderControls();
      toast(`Saved routine "${name}"!`);
    });

    $('#routines-list').addEventListener('click', async (e) => {
      const runId = e.target.dataset.runRt;
      const delId = e.target.dataset.delRt;
      if (runId) {
        switchTab('assistant');
        const res = await api(`/api/routines/${runId}/run`, { method: 'POST' });
        state = { ...state, ...res.bootstrap, appsCatalog: state.appsCatalog };
        renderAll();
        await executeClientActions(res.actions || []);
        hw.speak(res.reply, { enabled: Boolean(state.device?.voiceReply) });
      } else if (delId) {
        await api(`/api/routines/${delId}`, { method: 'DELETE' });
        state.routines = state.routines.filter((r) => r.id !== Number(delId));
        renderControls();
      }
    });

    // Cancel Active Timer Banner
    $('#btn-cancel-timer').addEventListener('click', async () => {
      const activeTimer = state.alarms.find((a) => a.kind === 'timer' && a.enabled);
      if (!activeTimer) return;
      await api(`/api/alarms/${activeTimer.id}`, { method: 'DELETE' });
      state.alarms = state.alarms.filter((x) => x.id !== activeTimer.id);
      $('#live-timer-banner').classList.add('hidden');
      renderHub();
      toast('Timer stopped');
    });

    // Dismiss Ring Modal
    $('#btn-dismiss-ring').addEventListener('click', () => {
      hw.stopAlarmRing();
      $('#ring-modal').classList.add('hidden');
    });

    // Life Hub CRUD Forms & Delegated Clicks
    $('#form-alarm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const created = await api('/api/alarms', {
        method: 'POST',
        body: {
          timeHhmm: $('#alarm-time').value,
          label: $('#alarm-label').value.trim() || 'Wake Alarm',
          days: 'Daily'
        }
      });
      state.alarms.unshift(created);
      $('#alarm-label').value = '';
      renderHub();
      toast(`Alarm set for ${created.timeHhmm}`);
    });

    $('#alarms-list').addEventListener('click', async (e) => {
      const tog = e.target.dataset.toggleAlarm;
      const del = e.target.dataset.delAlarm;
      if (tog) {
        const item = state.alarms.find((a) => a.id === Number(tog));
        if (!item) return;
        const updated = await api(`/api/alarms/${tog}`, { method: 'PATCH', body: { enabled: !item.enabled } });
        Object.assign(item, updated);
        renderHub();
      } else if (del) {
        await api(`/api/alarms/${del}`, { method: 'DELETE' });
        state.alarms = state.alarms.filter((a) => a.id !== Number(del));
        renderHub();
      }
    });

    $('#form-task').addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = $('#task-title').value.trim();
      if (!title) return;
      const created = await api('/api/tasks', { method: 'POST', body: { title } });
      state.tasks.unshift(created);
      $('#task-title').value = '';
      renderHub();
      toast('Reminder saved');
    });

    $('#tasks-list').addEventListener('click', async (e) => {
      const tog = e.target.dataset.toggleTask;
      const del = e.target.dataset.delTask;
      if (tog) {
        const item = state.tasks.find((t) => t.id === Number(tog));
        if (!item) return;
        const updated = await api(`/api/tasks/${tog}`, { method: 'PATCH', body: { completed: !item.completed } });
        Object.assign(item, updated);
        renderHub();
      } else if (del) {
        await api(`/api/tasks/${del}`, { method: 'DELETE' });
        state.tasks = state.tasks.filter((t) => t.id !== Number(del));
        renderHub();
      }
    });

    $('#form-contact').addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = $('#contact-name').value.trim();
      const phone = $('#contact-phone').value.trim();
      if (!name || !phone) return;
      const created = await api('/api/contacts', {
        method: 'POST',
        body: { name, phone, whatsapp: phone }
      });
      state.contacts.push(created);
      $('#contact-name').value = '';
      $('#contact-phone').value = '';
      renderHub();
      toast(`Saved contact ${name}`);
    });

    $('#contacts-list').addEventListener('click', async (e) => {
      const del = e.target.dataset.delContact;
      if (del) {
        await api(`/api/contacts/${del}`, { method: 'DELETE' });
        state.contacts = state.contacts.filter((c) => c.id !== Number(del));
        renderHub();
      }
    });

    $('#form-memory').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fact = $('#memory-fact').value.trim();
      if (!fact) return;
      const created = await api('/api/memories', { method: 'POST', body: { fact } });
      state.memories.unshift(created);
      $('#memory-fact').value = '';
      renderHub();
      toast('Saved to Pelo Memory');
    });

    $('#memories-list').addEventListener('click', async (e) => {
      const del = e.target.dataset.delMem;
      if (del) {
        await api(`/api/memories/${del}`, { method: 'DELETE' });
        state.memories = state.memories.filter((m) => m.id !== Number(del));
        renderHub();
      }
    });

    // Bridge Test Ping
    $('#btn-test-bridge').addEventListener('click', async () => {
      const item = await api('/api/bridge/test', { method: 'POST' });
      state.bridgeQueue.unshift(item);
      renderBridge();
      hw.vibrate('pulse');
      toast('📡 Queued Test Ping for Huawei P40 MacroDroid Bridge');
    });

    // Settings Form
    $('#form-profile').addEventListener('submit', async (e) => {
      e.preventDefault();
      const res = await api('/api/device', {
        method: 'PATCH',
        body: {
          ownerName: $('#set-owner-name').value.trim() || 'Boss',
          assistantName: $('#set-assistant-name').value.trim() || 'Pelo',
          voiceReply: $('#set-voice-reply').checked,
          autoExecute: $('#set-auto-execute').checked
        }
      });
      state.device = res.device;
      renderAll();
      toast('Preferences saved!');
    });

    $('#btn-save-llm').addEventListener('click', () => {
      const provider = $('#llm-provider').value;
      const apiKey = $('#llm-api-key').value.trim();
      if (!apiKey) {
        localStorage.removeItem('pelo_llm_config');
        toast('Cleared device LLM key (using Pelo Neural Engine)');
        return;
      }
      localStorage.setItem('pelo_llm_config', JSON.stringify({ provider, apiKey }));
      toast(`Saved ${provider.toUpperCase()} cloud brain key on this device!`);
    });

    $('#btn-clear-chat').addEventListener('click', async () => {
      const res = await api('/api/messages', { method: 'DELETE' });
      state.messages = [res.welcome];
      renderChat();
      toast('Chat history cleared');
    });

    $('#btn-copy-url').addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(window.location.origin);
        toast('Copied live P40 app link!');
      } catch {
        toast(window.location.origin);
      }
    });

    startRealtimeTicker();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
