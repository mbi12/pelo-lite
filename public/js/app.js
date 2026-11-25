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
    files: [],
    comms: [],
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

  function formatBytes(bytes) {
    const b = Number(bytes || 0);
    if (b >= 1073741824) return `${(b / 1073741824).toFixed(2)} GB`;
    if (b >= 1048576) return `${(b / 1048576).toFixed(1)} MB`;
    if (b >= 1024) return `${(b / 1024).toFixed(1)} KB`;
    return `${b} B`;
  }

  function formatMarkdown(str) {
    return escapeHtml(str)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<code>$1</code>')
      .replace(/\n/g, '<br/>');
  }

  function toast(msg) {
    const el = $('#pelo-toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.remove('hidden');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.add('hidden'), 2900);
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
  // RENDER ALL VIEWS
  // ==========================================================================
  function renderAll() {
    renderHeader();
    renderChat();
    renderFilesAndComms();
    renderControls();
    renderHub();
    renderBridge();
    renderSettings();
    renderDesktopInspector();
  }

  function renderHeader() {
    const d = state.device;
    if (!d) return;
    $('#header-assistant-name').textContent = `${(d.assistantName || 'PELO').toUpperCase()} AI v3`;
    const uaTag = hw.telemetry.isHuaweiUa ? 'HUAWEI P40' : 'P40 · FULL ACCESS';
    $('#header-device-sub').textContent = `${uaTag} · ${state.storageMode.toUpperCase()}`;

    const batt = hw.telemetry.batteryLevel ?? d.batteryLevel ?? 88;
    const chg = hw.telemetry.charging || d.charging;
    $('#live-battery').textContent = `${chg ? '⚡' : '🔋'} ${batt}%`;
    $('#btn-voice-toggle').textContent = d.voiceReply ? '🔊' : '🔇';
    $('#bridge-dot').classList.toggle('online', Boolean(d.bridgeOnline));
  }

  function buildActionElement(act) {
    if (act.type === 'deep_link') {
      const a = document.createElement('a');
      a.className = 'action-pill';
      a.href = act.uri || act.fallbackUrl || '#';
      a.textContent = `${act.icon || '🚀'} ${act.label}`;
      a.addEventListener('click', (e) => {
        hw.vibrate('tap');
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

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'action-pill';
    btn.textContent = act.label || act.type;
    btn.addEventListener('click', () => {
      if (act.type === 'open_camera_lens') openCameraModal();
      else if (act.type === 'open_files_tab' || act.type === 'browser_file_delete' || act.type === 'browser_file_create') {
        switchTab('files');
        if (act.subtab === 'comms') switchFilesSubpane('comms');
        else switchFilesSubpane('files');
      } else if (act.type === 'bridge_queued') {
        switchTab('bridge');
      } else if (act.type === 'vibrate' || act.type === 'find_my_phone') {
        hw.vibrate('sos');
      } else {
        switchTab('controls');
      }
    });
    return btn;
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
        for (const act of msg.actions) cards.appendChild(buildActionElement(act));
        row.appendChild(cards);
      }
      stream.appendChild(row);
    }
    stream.scrollTop = stream.scrollHeight;
  }

  function renderFilesAndComms() {
    const d = state.device;
    if (!d) return;

    const pct = Math.min(100, Math.round((d.storageUsedGb / Math.max(1, d.storageTotalGb)) * 100));
    $('#storage-summary-lbl').textContent = `${d.storageUsedGb} GB / ${d.storageTotalGb} GB (${pct}%)`;
    $('#storage-bar-fill').style.width = `${pct}%`;

    // Mounted Real Browser Folder
    const mWrap = $('#mounted-files-wrap');
    const mList = $('#mounted-files-list');
    if (hw.mountedDirHandle) {
      mWrap.classList.remove('hidden');
      $('#mounted-folder-name').textContent = hw.mountedDirHandle.name || 'Mounted';
      mList.innerHTML = '';
      for (const mf of hw.mountedFiles) {
        const div = document.createElement('div');
        div.className = 'list-item';
        div.innerHTML = `
          <div>
            <strong>📄 ${escapeHtml(mf.name)}</strong>
            <div class="muted-small">${formatBytes(mf.sizeBytes)} · Real Device Disk</div>
          </div>
          <button class="mini-btn danger" data-del-mounted="${escapeHtml(mf.name)}">🗑️ Delete</button>
        `;
        mList.appendChild(div);
      }
      if (!hw.mountedFiles.length) {
        mList.innerHTML = '<div class="muted-small">Mounted folder is empty.</div>';
      }
    } else {
      mWrap.classList.add('hidden');
    }

    // Huawei P40 Storage Index
    const activeCount = (state.files || []).filter((f) => !f.trashed).length;
    const trashedCount = (state.files || []).filter((f) => f.trashed).length;
    $('#files-count-lbl').textContent = `${activeCount} active · ${trashedCount} in trash`;

    const fList = $('#p40-files-list');
    fList.innerHTML = '';
    const iconByKind = { apk: '📦', temp: '🧹', pdf: '📄', image: '🖼️', media: '🎞️', archive: '🗜️', file: '📁' };

    for (const f of state.files || []) {
      const div = document.createElement('div');
      div.className = `list-item ${f.trashed ? 'done' : ''}`;
      const ico = f.trashed ? '🗑️' : (iconByKind[f.mimeKind] || '📄');
      div.innerHTML = `
        <div style="min-width:0;flex:1;">
          <strong style="word-break:break-all;">${ico} ${escapeHtml(f.name)}</strong>
          <div class="muted-small">${formatBytes(f.sizeBytes)} · ${escapeHtml(f.folder)}</div>
        </div>
        <div class="item-actions">
          ${f.trashed
            ? `<button class="mini-btn accent" data-restore-file="${f.id}">♻️ Restore</button>
               <button class="mini-btn danger" data-shred-file="${f.id}">✕</button>`
            : `<button class="mini-btn danger" data-trash-file="${f.id}">🗑️ Delete</button>`
          }
        </div>
      `;
      fList.appendChild(div);
    }

    // Direct Messages & SMS Log
    const cList = $('#comms-log-list');
    cList.innerHTML = '';
    for (const c of state.comms || []) {
      const badge = c.channel === 'whatsapp' ? '💬 WhatsApp' : c.channel === 'telegram' ? '✈️ Telegram' : '✉️ SIM SMS';
      const dirArrow = c.direction === 'inbound' ? '⬅ From' : '➡ To';
      const div = document.createElement('div');
      div.className = 'list-item';
      div.innerHTML = `
        <div style="flex:1;">
          <strong>${badge} · ${dirArrow} ${escapeHtml(c.contactName || c.address)}</strong>
          <div style="margin-top:3px;">"${escapeHtml(c.body)}"</div>
          <div class="muted-small">${escapeHtml(c.status)} · ${new Date(c.createdAt).toLocaleTimeString()}</div>
        </div>
        <button class="mini-btn accent" data-reply-to="${escapeHtml(c.contactName || c.address)}" data-reply-chan="${escapeHtml(c.channel)}">↩ Reply</button>
      `;
      cList.appendChild(div);
    }
  }

  function renderControls() {
    const d = state.device;
    if (!d) return;

    for (const key of ['flashlight', 'wakeLock', 'wifi', 'bluetooth', 'dnd', 'powerSaver']) {
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

    const dock = $('#app-dock-grid');
    dock.innerHTML = '';
    for (const [slug, app] of Object.entries(state.appsCatalog || {})) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'app-dock-btn';
      btn.innerHTML = `<span class="app-dock-ico">${escapeHtml(app.icon)}</span><span>${escapeHtml(app.name)}</span>`;
      btn.addEventListener('click', () => {
        hw.vibrate('tap');
        if (slug === 'camera') openCameraModal();
        else launchAppDeepLink(app);
      });
      dock.appendChild(btn);
    }
  }

  function launchAppDeepLink(app) {
    toast(`Launching ${app.name}...`);
    const isMobile = hw.telemetry.isHuaweiUa || /Android|iPhone/i.test(navigator.userAgent);
    if (isMobile) window.location.href = app.uri || app.intentUri;
    else if (app.fallbackUrl) window.open(app.fallbackUrl, '_blank', 'noopener');
    else sendCommand(`Open ${app.name}`);
  }

  function renderHub() {
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
          <a class="mini-btn accent" href="sms:${escapeHtml(c.phone)}">✉️</a>
          <a class="mini-btn accent" href="whatsapp://send?phone=${escapeHtml(cleanWa)}">💬</a>
          <button class="mini-btn danger" data-del-contact="${c.id}">✕</button>
        </div>
      `;
      cList.appendChild(div);
    }

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

    $('#bridge-status-pill').textContent = d.bridgeOnline ? '🟢 Super-Agent ONLINE' : '📲 Ready to Connect';
    $('#bridge-token-display').textContent = `Token: ${d.bridgeToken}`;
    $('#agent-oneliner').textContent = `curl -sL ${window.location.origin}/api/bridge/agent.sh | bash`;

    const t = hw.telemetry;
    const checks = [
      ['Huawei P40 Shell & Agent', d.bridgeOnline ? '🟢 Connected Live' : '⚡ Ready (`curl .../agent.sh | bash`)'],
      ['Direct Folder File Deletion', t.fsAccessAvailable ? '✅ Supported (Mount Folder)' : '✅ Via P40 Super-Agent'],
      ['Zero-Tap Background SIM SMS', '✅ Ready via Termux:API + `sms:` Intent'],
      ['Camera & Rear LED Torch', t.mediaDevicesAvailable ? '✅ Supported' : '⚠️ HTTPS Required'],
      ['Screen Wake Lock & Haptics', t.wakeLockAvailable ? '✅ Supported' : 'ℹ️ Mobile'],
      ['Cloud Persistence', state.storageMode === 'supabase' ? '✅ Supabase Postgres' : '✅ Local SQLite']
    ];

    $('#capability-matrix').innerHTML = checks
      .map(([k, v]) => `<div style="display:flex;justify-content:space-between;padding:5px 0;font-size:0.77rem;border-bottom:1px solid rgba(148,163,184,0.1);"><span>${escapeHtml(k)}</span><strong>${escapeHtml(v)}</strong></div>`)
      .join('');

    const qList = $('#bridge-queue-list');
    qList.innerHTML = '';
    if (!state.bridgeQueue.length) {
      qList.innerHTML = '<div class="muted-small">No queued actions yet. Delete a file, send an SMS, or run a shell command!</div>';
      return;
    }
    for (const q of state.bridgeQueue.slice(0, 14)) {
      const outStr = q.result && q.result.output ? `<div class="muted-small" style="color:#34d399;margin-top:3px;">↳ ${escapeHtml(q.result.output)}</div>` : '';
      const div = document.createElement('div');
      div.className = 'list-item';
      div.innerHTML = `
        <div style="flex:1;">
          <strong>${escapeHtml(q.label)}</strong>
          <div class="muted-small">${escapeHtml(q.commandType)} · ${new Date(q.createdAt).toLocaleTimeString()}</div>
          ${outStr}
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
    $('#set-god-mode').checked = Boolean(d.godMode);

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
    const activeFiles = (state.files || []).filter((f) => !f.trashed).length;
    const cells = [
      ['Edition', 'v3 Unrestricted'],
      ['Persistence', state.storageMode.toUpperCase()],
      ['Tracked Files', `${activeFiles} files`],
      ['Comms Log', `${(state.comms || []).length} messages`],
      ['Battery', `${hw.telemetry.batteryLevel ?? d.batteryLevel}%`],
      ['Agent Queue', `${state.bridgeQueue.filter((q) => q.status === 'pending').length} pending`]
    ];
    $('#inspector-telemetry').innerHTML = cells
      .map(([lbl, val]) => `<div class="kv-cell"><span>${escapeHtml(lbl)}</span><strong>${escapeHtml(val)}</strong></div>`)
      .join('');
  }

  // ==========================================================================
  // CLIENT-SIDE EXECUTION FOR AI ACTIONS
  // ==========================================================================
  async function executeClientActions(actions = []) {
    if (!actions.length) return;
    orb.setMode('executing');

    for (const act of actions) {
      if (act.type === 'browser_file_delete') {
        if (hw.mountedDirHandle) {
          const target = act.query || act.extension || '';
          if (target) await hw.deleteMountedRealFile(target);
          for (const nm of act.affectedNames || []) await hw.deleteMountedRealFile(nm);
          renderFilesAndComms();
        }
      } else if (act.type === 'browser_file_create') {
        if (hw.mountedDirHandle && act.name) {
          await hw.createMountedRealFile(act.name, act.content || '');
          renderFilesAndComms();
        }
      } else if (act.type === 'clipboard_copy') {
        if (navigator.clipboard && act.text) {
          navigator.clipboard.writeText(act.text).catch(() => {});
        }
      } else if (act.type === 'find_my_phone') {
        hw.playChime('alert');
        hw.vibrate('sos');
      } else if (act.type === 'hardware_setting') {
        if (act.setting === 'flashlight') await hw.setTorch(act.value);
        else if (act.setting === 'wakeLock') await hw.setWakeLock(act.value);
      } else if (act.type === 'hardware_slider') {
        if (act.setting === 'brightness') hw.applySoftwareBrightness(act.value);
      } else if (act.type === 'vibrate') {
        hw.vibrate(act.pattern);
      } else if (act.type === 'open_camera_lens') {
        openCameraModal();
      } else if (act.type === 'fetch_live_weather') {
        try {
          const w = await hw.fetchLiveWeather();
          const weatherMsg = `🌤️ **${w.location}**: **${w.tempC}°C** (feels like ${w.feelsC}°C) · ${w.condition} · Wind ${w.windKmh} km/h.`;
          state.messages.push({ id: Date.now(), role: 'assistant', content: weatherMsg, actions: [] });
          renderChat();
          hw.speak(weatherMsg, { enabled: state.device?.voiceReply });
        } catch {
          toast('Weather lookup offline right now');
        }
      } else if (act.type === 'deep_link' && state.device?.autoExecute && hw.telemetry.isHuaweiUa && !state.device?.bridgeOnline) {
        setTimeout(() => { window.location.href = act.uri; }, 350);
      }
    }

    setTimeout(() => orb.setMode('idle'), 900);
  }

  // ==========================================================================
  // CORE COMMAND & NAVIGATION HANDLERS
  // ==========================================================================
  async function sendCommand(text) {
    const clean = String(text || '').trim();
    if (!clean) return;

    $('#command-input').value = '';
    $('#orb-status-text').textContent = 'Pelo is executing on your Huawei P40...';
    orb.setMode('executing');
    hw.playChime('tap');

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

      $('#orb-status-text').textContent = 'Tap orb to speak · Files, SMS, Apps & Hardware';

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

  function switchTab(tabName) {
    $$('.nav-tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === tabName));
    $$('.tab-view').forEach((v) => v.classList.toggle('active', v.id === `view-${tabName}`));
    hw.vibrate('tap');
  }

  function switchFilesSubpane(which) {
    const isFiles = which === 'files';
    $('#seg-files-btn').classList.toggle('active', isFiles);
    $('#seg-comms-btn').classList.toggle('active', !isFiles);
    $('#subpane-files').classList.toggle('hidden', !isFiles);
    $('#subpane-comms').classList.toggle('hidden', isFiles);
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
      toast(nextVal ? (res.mode === 'hardware_led' ? '🔦 P40 Rear LED Torch ON' : '🔦 Torch ON (Synced to Agent)') : '🔦 Flashlight OFF');
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

  async function openCameraModal() {
    const modal = $('#camera-modal');
    const video = $('#camera-video');
    modal.classList.remove('hidden');
    try {
      await hw.openCameraPreview(video);
      $('#camera-status').textContent = 'Huawei P40 Rear Camera Live';
    } catch (err) {
      $('#camera-status').textContent = err.message || 'Grant camera permission in Huawei Browser.';
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

  function startRealtimeTicker() {
    setInterval(async () => {
      const now = new Date();
      const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      $('#live-clock').textContent = hhmm;

      const activeTimer = state.alarms.find((a) => a.kind === 'timer' && a.enabled && a.targetEpochMs);
      const banner = $('#live-timer-banner');
      if (activeTimer) {
        const remSec = Math.max(0, Math.ceil((activeTimer.targetEpochMs - Date.now()) / 1000));
        banner.classList.remove('hidden');
        $('#live-timer-label').textContent = `⏱️ ${activeTimer.label}`;
        $('#live-timer-countdown').textContent = `${String(Math.floor(remSec / 60)).padStart(2, '0')}:${String(remSec % 60).padStart(2, '0')}`;

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
  // BOOTSTRAP & WIRE EVENTS
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

    const boot = await api('/api/bootstrap');
    state = { ...state, ...boot };
    renderAll();

    const params = new URLSearchParams(window.location.search);
    if (params.get('tab')) switchTab(params.get('tab'));

    $$('.nav-tab').forEach((btn) => btn.addEventListener('click', () => switchTab(btn.dataset.tab)));

    // Files & Comms Sub-switch
    $('#seg-files-btn').addEventListener('click', () => switchFilesSubpane('files'));
    $('#seg-comms-btn').addEventListener('click', () => switchFilesSubpane('comms'));

    // Mount Real Device Folder
    $('#btn-mount-folder').addEventListener('click', async () => {
      try {
        const list = await hw.mountRealDirectory();
        renderFilesAndComms();
        toast(`📂 Mounted real folder (${list.length} files)!`);
      } catch (err) {
        toast(err.message);
      }
    });

    $('#mounted-files-list').addEventListener('click', async (e) => {
      const fname = e.target.dataset.delMounted;
      if (fname) {
        await hw.deleteMountedRealFile(fname);
        renderFilesAndComms();
        toast(`🗑️ Physically deleted ${fname} from device folder!`);
      }
    });

    // P40 File Manager Actions
    $('#btn-clean-junk').addEventListener('click', async () => {
      const res = await api('/api/files/delete', { method: 'POST', body: { extension: 'junk' } });
      state.files = res.files;
      state.bridgeQueue = res.bridgeQueue;
      renderAll();
      toast(`🧹 Moved ${res.count} junk file(s) to .pelo-trash`);
    });

    $('#btn-organize-dl').addEventListener('click', async () => {
      const res = await api('/api/files/organize', { method: 'POST' });
      state.files = res.files;
      renderFilesAndComms();
      toast(`✨ Organized ${res.movedCount} Download file(s)!`);
    });

    $('#btn-restore-all').addEventListener('click', async () => {
      const res = await api('/api/files/restore', { method: 'POST', body: {} });
      state.files = res.files;
      state.bridgeQueue = res.bridgeQueue;
      renderAll();
      toast(`♻️ Restored ${res.count} file(s)!`);
    });

    $('#btn-empty-trash').addEventListener('click', async () => {
      const res = await api('/api/files/empty-trash', { method: 'POST' });
      state.files = res.files;
      renderFilesAndComms();
      toast(`🔥 Permanently purged ${res.count} trashed file(s)`);
    });

    $('#form-create-file').addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = $('#new-file-name').value.trim();
      const content = $('#new-file-content').value;
      if (!name) return;
      if (hw.mountedDirHandle) await hw.createMountedRealFile(name, content);
      const res = await api('/api/files/create', { method: 'POST', body: { name, content } });
      state.files = res.files;
      $('#new-file-name').value = '';
      $('#new-file-content').value = '';
      renderFilesAndComms();
      toast(`📄 Created ${name}`);
    });

    $('#p40-files-list').addEventListener('click', async (e) => {
      const trashId = e.target.dataset.trashFile;
      const restId = e.target.dataset.restoreFile;
      const shredId = e.target.dataset.shredFile;
      if (trashId) {
        const res = await api('/api/files/delete', { method: 'POST', body: { id: Number(trashId), permanent: false } });
        state.files = res.files;
        state.bridgeQueue = res.bridgeQueue;
        renderAll();
        toast('🗑️ File moved to .pelo-trash');
      } else if (restId) {
        const res = await api('/api/files/restore', { method: 'POST', body: { id: Number(restId) } });
        state.files = res.files;
        state.bridgeQueue = res.bridgeQueue;
        renderAll();
        toast('♻️ File restored!');
      } else if (shredId) {
        const res = await api('/api/files/delete', { method: 'POST', body: { id: Number(shredId), permanent: true } });
        state.files = res.files;
        state.bridgeQueue = res.bridgeQueue;
        renderAll();
        toast('🔥 Permanently deleted file');
      }
    });

    // Direct Messages Composer
    $('#form-send-comm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const channel = $('#comm-channel').value;
      const target = $('#comm-recipient').value.trim();
      const body = $('#comm-body').value.trim();
      const alsoOpenApp = $('#comm-open-app').checked;
      if (!target || !body) return;

      const isPhone = target.startsWith('+') || /^\d{6,}$/.test(target);
      const res = await api('/api/comms/send', {
        method: 'POST',
        body: {
          channel,
          name: isPhone ? '' : target,
          address: isPhone ? target : '',
          body
        }
      });
      state.comms = res.comms;
      state.bridgeQueue = res.bridgeQueue;
      $('#comm-body').value = '';
      renderAll();
      toast(`🚀 Message dispatched via ${channel.toUpperCase()}!`);

      if (alsoOpenApp && !state.device?.bridgeOnline && (hw.telemetry.isHuaweiUa || /Android|iPhone/i.test(navigator.userAgent))) {
        window.location.href = res.deepLinkUri;
      }
    });

    $('#comms-log-list').addEventListener('click', (e) => {
      const to = e.target.dataset.replyTo;
      const chan = e.target.dataset.replyChan;
      if (to) {
        $('#comm-recipient').value = to;
        if (chan) $('#comm-channel').value = chan;
        $('#comm-body').focus();
      }
    });

    $('#btn-sync-sms').addEventListener('click', () => {
      sendCommand('Read my messages');
    });

    // Shell Executor in Bridge Tab
    $('#form-shell').addEventListener('submit', async (e) => {
      e.preventDefault();
      const cmd = $('#shell-cmd-input').value.trim();
      if (!cmd) return;
      $('#shell-cmd-input').value = '';
      await sendCommand(`run command ${cmd}`);
      switchTab('bridge');
    });

    $('#btn-copy-agent').addEventListener('click', async () => {
      const cmd = $('#agent-oneliner').textContent;
      try {
        await navigator.clipboard.writeText(cmd);
        toast('📋 Copied 1-line Huawei P40 Termux command!');
      } catch {
        toast(cmd);
      }
    });

    // Chat Command Form & Voice
    $('#command-form').addEventListener('submit', (e) => {
      e.preventDefault();
      sendCommand($('#command-input').value);
    });
    $('#btn-orb-mic').addEventListener('click', triggerVoiceInput);
    $('#btn-bar-mic').addEventListener('click', triggerVoiceInput);

    $$('.chip, .demo-prompt').forEach((chip) => {
      chip.addEventListener('click', () => {
        switchTab('assistant');
        sendCommand(chip.dataset.cmd);
      });
    });

    $('#btn-voice-toggle').addEventListener('click', async () => {
      if (!state.device) return;
      const next = !state.device.voiceReply;
      state.device.voiceReply = next;
      if (!next && window.speechSynthesis) window.speechSynthesis.cancel();
      renderHeader();
      await api('/api/device', { method: 'PATCH', body: { voiceReply: next } });
      toast(next ? '🔊 Voice replies enabled' : '🔇 Voice replies muted');
    });

    // Hardware Tiles & Sliders
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

    // Routines
    $('#btn-toggle-new-routine').addEventListener('click', () => $('#form-new-routine').classList.toggle('hidden'));
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

    $('#btn-cancel-timer').addEventListener('click', async () => {
      const activeTimer = state.alarms.find((a) => a.kind === 'timer' && a.enabled);
      if (!activeTimer) return;
      await api(`/api/alarms/${activeTimer.id}`, { method: 'DELETE' });
      state.alarms = state.alarms.filter((x) => x.id !== activeTimer.id);
      $('#live-timer-banner').classList.add('hidden');
      renderHub();
      toast('Timer stopped');
    });

    $('#btn-dismiss-ring').addEventListener('click', () => {
      hw.stopAlarmRing();
      $('#ring-modal').classList.add('hidden');
    });

    // Life Hub Forms
    $('#form-alarm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const created = await api('/api/alarms', {
        method: 'POST',
        body: { timeHhmm: $('#alarm-time').value, label: $('#alarm-label').value.trim() || 'Wake Alarm', days: 'Daily' }
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
      const created = await api('/api/contacts', { method: 'POST', body: { name, phone, whatsapp: phone } });
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

    $('#btn-test-bridge').addEventListener('click', async () => {
      const item = await api('/api/bridge/test', { method: 'POST' });
      state.bridgeQueue.unshift(item);
      renderBridge();
      hw.vibrate('sos');
      hw.playChime('alert');
      toast('🚨 Queued Find-My-P40 Beacon!');
    });

    $('#form-profile').addEventListener('submit', async (e) => {
      e.preventDefault();
      const res = await api('/api/device', {
        method: 'PATCH',
        body: {
          ownerName: $('#set-owner-name').value.trim() || 'Boss',
          assistantName: $('#set-assistant-name').value.trim() || 'Pelo',
          voiceReply: $('#set-voice-reply').checked,
          autoExecute: $('#set-auto-execute').checked,
          godMode: $('#set-god-mode').checked
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
        toast('Cleared device LLM key');
        return;
      }
      localStorage.setItem('pelo_llm_config', JSON.stringify({ provider, apiKey }));
      toast(`Saved ${provider.toUpperCase()} key on this device!`);
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
