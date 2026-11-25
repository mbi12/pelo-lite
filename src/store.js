const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

let SqliteDatabaseSync = null;
if (!process.env.FORCE_JSON_STORE) {
  try {
    SqliteDatabaseSync = require('node:sqlite').DatabaseSync;
  } catch {
    SqliteDatabaseSync = null;
  }
}

const DEFAULT_ROUTINES = [
  {
    name: 'Morning Rise',
    triggerPhrase: 'good morning',
    icon: '☀️',
    description: 'Disable DND, set brightness 75%, volume 60%, and brief weather + tasks',
    steps: [
      { type: 'set_setting', setting: 'dnd', value: false, label: 'Do Not Disturb OFF' },
      { type: 'set_slider', setting: 'brightness', value: 75, label: 'Screen Brightness → 75%' },
      { type: 'set_slider', setting: 'volume', value: 60, label: 'Media Volume → 60%' },
      { type: 'check_weather', label: 'Live Weather Briefing' }
    ]
  },
  {
    name: 'Heading Out',
    triggerPhrase: 'going out',
    icon: '🚶',
    description: 'Wi-Fi OFF, Bluetooth ON, Brightness 85%, Flashlight OFF',
    steps: [
      { type: 'set_setting', setting: 'wifi', value: false, label: 'Wi-Fi OFF (switch to 4G/5G)' },
      { type: 'set_setting', setting: 'bluetooth', value: true, label: 'Bluetooth ON (earbuds ready)' },
      { type: 'set_setting', setting: 'flashlight', value: false, label: 'Flashlight OFF' },
      { type: 'set_slider', setting: 'brightness', value: 85, label: 'Outdoor Brightness → 85%' }
    ]
  },
  {
    name: 'Driving HUD',
    triggerPhrase: 'driving mode',
    icon: '🚗',
    description: 'Keep P40 screen awake, Bluetooth ON, Volume 85%, launch Petal Maps',
    steps: [
      { type: 'set_setting', setting: 'wakeLock', value: true, label: 'Keep Screen Awake ON' },
      { type: 'set_setting', setting: 'bluetooth', value: true, label: 'Car Bluetooth ON' },
      { type: 'set_slider', setting: 'volume', value: 85, label: 'Navigation Volume → 85%' },
      { type: 'open_app', app: 'petal_maps', label: 'Launch Huawei Petal Maps' }
    ]
  },
  {
    name: 'Deep Focus',
    triggerPhrase: 'focus mode',
    icon: '🎯',
    description: 'Enable DND, mute volume, dim screen to 45%, start 25m focus timer',
    steps: [
      { type: 'set_setting', setting: 'dnd', value: true, label: 'Do Not Disturb ON' },
      { type: 'set_slider', setting: 'volume', value: 0, label: 'Mute Volume → 0%' },
      { type: 'set_slider', setting: 'brightness', value: 45, label: 'Eye-Comfort Brightness → 45%' },
      { type: 'start_timer', seconds: 1500, label: '25-Min Focus Timer' }
    ]
  },
  {
    name: 'Sleep Mode',
    triggerPhrase: 'goodnight',
    icon: '🌙',
    description: 'DND ON, Torch OFF, OLED dim 10%, mute volume, arm 07:30 wake alarm',
    steps: [
      { type: 'set_setting', setting: 'dnd', value: true, label: 'Do Not Disturb ON' },
      { type: 'set_setting', setting: 'flashlight', value: false, label: 'Flashlight OFF' },
      { type: 'set_setting', setting: 'wakeLock', value: false, label: 'Screen Wake Lock OFF' },
      { type: 'set_slider', setting: 'brightness', value: 10, label: 'Night OLED Brightness → 10%' },
      { type: 'set_slider', setting: 'volume', value: 0, label: 'Silent Night Volume → 0%' }
    ]
  }
];

const WELCOME_MSG =
  "Hey! I'm **Pelo**, your personal AI controller built for your **Huawei P40**. " +
  "Try telling me things like:\n" +
  "• *\"Turn on flashlight nd set a 3 min timer\"*\n" +
  "• *\"Navigate to Dam Square on Petal Maps\"*\n" +
  "• *\"Run Heading Out routine\"*\n" +
  "• *\"Remember my gate number is B14\"*\n" +
  "• *\"WhatsApp Mom I'm on my way home\"*";

function mapDeviceRow(r) {
  if (!r) return null;
  const lastPing = r.last_bridge_ping || null;
  const bridgeOnline = lastPing ? (Date.now() - new Date(lastPing).getTime() < 120000) : false;
  return {
    ownerName: r.owner_name,
    assistantName: r.assistant_name,
    deviceModel: r.device_model,
    wifi: Boolean(r.wifi),
    bluetooth: Boolean(r.bluetooth),
    dnd: Boolean(r.dnd),
    flashlight: Boolean(r.flashlight),
    powerSaver: Boolean(r.power_saver),
    wakeLock: Boolean(r.wake_lock),
    brightness: Number(r.brightness),
    volume: Number(r.volume),
    batteryLevel: Number(r.battery_level),
    charging: Boolean(r.charging),
    networkType: r.network_type,
    voiceReply: Boolean(r.voice_reply),
    autoExecute: Boolean(r.auto_execute),
    bridgeToken: r.bridge_token,
    lastBridgePing: lastPing,
    bridgeOnline,
    updatedAt: r.updated_at
  };
}

function mapMessageRow(r) {
  return {
    id: Number(r.id),
    role: r.role,
    content: r.content,
    actions: typeof r.actions_json === 'string' ? JSON.parse(r.actions_json || '[]') : (r.actions_json || []),
    source: r.source || 'chat',
    createdAt: r.created_at
  };
}

function mapContactRow(r) {
  return {
    id: Number(r.id),
    name: r.name,
    relationship: r.relationship || 'Contact',
    phone: r.phone || '',
    whatsapp: r.whatsapp || r.phone || '',
    email: r.email || '',
    favorite: Boolean(r.favorite),
    createdAt: r.created_at
  };
}

function mapTaskRow(r) {
  return {
    id: Number(r.id),
    title: r.title,
    dueText: r.due_text || '',
    completed: Boolean(r.completed),
    priority: r.priority || 'normal',
    createdAt: r.created_at
  };
}

function mapAlarmRow(r) {
  return {
    id: Number(r.id),
    label: r.label,
    timeHhmm: r.time_hhmm,
    days: r.days || 'Once',
    enabled: Boolean(r.enabled),
    kind: r.kind || 'alarm',
    durationSec: Number(r.duration_sec || 0),
    targetEpochMs: r.target_epoch_ms ? Number(r.target_epoch_ms) : null,
    createdAt: r.created_at
  };
}

function mapMemoryRow(r) {
  return {
    id: Number(r.id),
    category: r.category || 'personal',
    fact: r.fact,
    createdAt: r.created_at
  };
}

function mapRoutineRow(r) {
  return {
    id: Number(r.id),
    name: r.name,
    triggerPhrase: r.trigger_phrase,
    icon: r.icon || '⚡',
    description: r.description || '',
    steps: typeof r.steps_json === 'string' ? JSON.parse(r.steps_json || '[]') : (r.steps_json || []),
    runCount: Number(r.run_count || 0),
    createdAt: r.created_at
  };
}

function mapBridgeRow(r) {
  return {
    id: Number(r.id),
    commandType: r.command_type,
    label: r.label,
    payload: typeof r.payload_json === 'string' ? JSON.parse(r.payload_json || '{}') : (r.payload_json || {}),
    status: r.status,
    createdAt: r.created_at,
    executedAt: r.executed_at || null
  };
}

// ============================================================================
// SUPABASE REST STORE (Production Cloud Persistence)
// ============================================================================
class SupabaseStore {
  constructor(url, serviceKey) {
    this.baseUrl = `${url.replace(/\/$/, '')}/rest/v1`;
    this.serviceKey = serviceKey;
    this.mode = 'supabase';
    this.seeded = false;
  }

  async req(endpoint, { method = 'GET', body, prefer = 'return=representation' } = {}) {
    const headers = {
      apikey: this.serviceKey,
      Authorization: `Bearer ${this.serviceKey}`,
      'Content-Type': 'application/json',
      Prefer: prefer
    };
    const res = await fetch(`${this.baseUrl}/${endpoint}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Supabase ${method} ${endpoint} failed (${res.status}): ${txt}`);
    }
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  }

  async ensureSeeded() {
    if (this.seeded) return;
    const rows = await this.req('pelo_device_state?id=eq.1&select=*');
    if (!rows || rows.length === 0) {
      const token = `p40-${crypto.randomBytes(4).toString('hex')}`;
      await this.req('pelo_device_state', {
        method: 'POST',
        body: { id: 1, bridge_token: token }
      });

      await this.req('pelo_messages', {
        method: 'POST',
        body: { role: 'assistant', content: WELCOME_MSG, actions_json: [], source: 'system' }
      });

      await this.req('pelo_routines', {
        method: 'POST',
        body: DEFAULT_ROUTINES.map((rt) => ({
          name: rt.name,
          trigger_phrase: rt.triggerPhrase,
          icon: rt.icon,
          description: rt.description,
          steps_json: rt.steps
        }))
      });

      await this.req('pelo_contacts', {
        method: 'POST',
        body: [
          { name: 'Mom', relationship: 'Family', phone: '+31600000001', whatsapp: '+31600000001', favorite: true },
          { name: 'Alex', relationship: 'Best Friend', phone: '+31600000002', whatsapp: '+31600000002', favorite: true }
        ]
      });

      await this.req('pelo_alarms', {
        method: 'POST',
        body: [{ label: 'Morning Wake Up', time_hhmm: '07:30', days: 'Weekdays', enabled: false, kind: 'alarm' }]
      });

      await this.req('pelo_tasks', {
        method: 'POST',
        body: [{ title: 'Tap P40 Bridge tab to pair MacroDroid for deep system toggles', due_text: 'Optional upgrade', priority: 'high' }]
      });

      await this.req('pelo_memories', {
        method: 'POST',
        body: [{ category: 'device', fact: 'Primary phone is a Huawei P40 running EMUI / HMS (prefers Petal Maps & AppGallery).' }]
      });
    }
    this.seeded = true;
  }

  async getBootstrap() {
    await this.ensureSeeded();
    const [devRows, msgs, contacts, tasks, alarms, memories, routines, queue] = await Promise.all([
      this.req('pelo_device_state?id=eq.1&select=*'),
      this.req('pelo_messages?select=*&order=id.desc&limit=40'),
      this.req('pelo_contacts?select=*&order=id.asc'),
      this.req('pelo_tasks?select=*&order=completed.asc,id.desc'),
      this.req('pelo_alarms?select=*&order=id.desc'),
      this.req('pelo_memories?select=*&order=id.desc'),
      this.req('pelo_routines?select=*&order=id.asc'),
      this.req('pelo_bridge_queue?select=*&order=id.desc&limit=25')
    ]);

    return {
      storageMode: this.mode,
      device: mapDeviceRow(devRows[0]),
      messages: (msgs || []).reverse().map(mapMessageRow),
      contacts: (contacts || []).map(mapContactRow),
      tasks: (tasks || []).map(mapTaskRow),
      alarms: (alarms || []).map(mapAlarmRow),
      memories: (memories || []).map(mapMemoryRow),
      routines: (routines || []).map(mapRoutineRow),
      bridgeQueue: (queue || []).map(mapBridgeRow)
    };
  }

  async getDeviceState() {
    await this.ensureSeeded();
    const rows = await this.req('pelo_device_state?id=eq.1&select=*');
    return mapDeviceRow(rows[0]);
  }

  async updateDeviceState(patch) {
    await this.ensureSeeded();
    const dbPatch = { updated_at: new Date().toISOString() };
    const map = {
      ownerName: 'owner_name',
      assistantName: 'assistant_name',
      deviceModel: 'device_model',
      wifi: 'wifi',
      bluetooth: 'bluetooth',
      dnd: 'dnd',
      flashlight: 'flashlight',
      powerSaver: 'power_saver',
      wakeLock: 'wake_lock',
      brightness: 'brightness',
      volume: 'volume',
      batteryLevel: 'battery_level',
      charging: 'charging',
      networkType: 'network_type',
      voiceReply: 'voice_reply',
      autoExecute: 'auto_execute',
      lastBridgePing: 'last_bridge_ping'
    };
    for (const [k, col] of Object.entries(map)) {
      if (patch[k] !== undefined) dbPatch[col] = patch[k];
    }
    const rows = await this.req('pelo_device_state?id=eq.1', { method: 'PATCH', body: dbPatch });
    return mapDeviceRow(rows[0]);
  }

  async addMessage({ role, content, actions = [], source = 'chat' }) {
    await this.ensureSeeded();
    const rows = await this.req('pelo_messages', {
      method: 'POST',
      body: { role, content, actions_json: actions, source }
    });
    return mapMessageRow(rows[0]);
  }

  async clearMessages() {
    await this.ensureSeeded();
    await this.req('pelo_messages?id=gt.0', { method: 'DELETE', prefer: 'return=minimal' });
    return this.addMessage({ role: 'assistant', content: WELCOME_MSG, actions: [], source: 'system' });
  }

  async addContact({ name, relationship = 'Contact', phone = '', whatsapp = '', email = '' }) {
    await this.ensureSeeded();
    const rows = await this.req('pelo_contacts', {
      method: 'POST',
      body: { name, relationship, phone, whatsapp: whatsapp || phone, email, favorite: true }
    });
    return mapContactRow(rows[0]);
  }

  async deleteContact(id) {
    await this.req(`pelo_contacts?id=eq.${Number(id)}`, { method: 'DELETE', prefer: 'return=minimal' });
    return { deleted: true, id: Number(id) };
  }

  async addTask({ title, dueText = '', priority = 'normal' }) {
    await this.ensureSeeded();
    const rows = await this.req('pelo_tasks', {
      method: 'POST',
      body: { title, due_text: dueText, priority, completed: false }
    });
    return mapTaskRow(rows[0]);
  }

  async updateTask(id, patch) {
    const dbPatch = {};
    if (patch.completed !== undefined) dbPatch.completed = Boolean(patch.completed);
    if (patch.title !== undefined) dbPatch.title = String(patch.title);
    if (patch.dueText !== undefined) dbPatch.due_text = String(patch.dueText);
    const rows = await this.req(`pelo_tasks?id=eq.${Number(id)}`, { method: 'PATCH', body: dbPatch });
    return rows?.[0] ? mapTaskRow(rows[0]) : null;
  }

  async deleteTask(id) {
    await this.req(`pelo_tasks?id=eq.${Number(id)}`, { method: 'DELETE', prefer: 'return=minimal' });
    return { deleted: true, id: Number(id) };
  }

  async addAlarm({ label = 'Alarm', timeHhmm = '07:30', days = 'Once', enabled = true, kind = 'alarm', durationSec = 0, targetEpochMs = null }) {
    await this.ensureSeeded();
    const rows = await this.req('pelo_alarms', {
      method: 'POST',
      body: { label, time_hhmm: timeHhmm, days, enabled, kind, duration_sec: durationSec, target_epoch_ms: targetEpochMs }
    });
    return mapAlarmRow(rows[0]);
  }

  async updateAlarm(id, patch) {
    const dbPatch = {};
    if (patch.enabled !== undefined) dbPatch.enabled = Boolean(patch.enabled);
    if (patch.label !== undefined) dbPatch.label = String(patch.label);
    if (patch.timeHhmm !== undefined) dbPatch.time_hhmm = String(patch.timeHhmm);
    const rows = await this.req(`pelo_alarms?id=eq.${Number(id)}`, { method: 'PATCH', body: dbPatch });
    return rows?.[0] ? mapAlarmRow(rows[0]) : null;
  }

  async deleteAlarm(id) {
    await this.req(`pelo_alarms?id=eq.${Number(id)}`, { method: 'DELETE', prefer: 'return=minimal' });
    return { deleted: true, id: Number(id) };
  }

  async addMemory({ category = 'personal', fact }) {
    await this.ensureSeeded();
    const rows = await this.req('pelo_memories', {
      method: 'POST',
      body: { category, fact }
    });
    return mapMemoryRow(rows[0]);
  }

  async deleteMemory(id) {
    await this.req(`pelo_memories?id=eq.${Number(id)}`, { method: 'DELETE', prefer: 'return=minimal' });
    return { deleted: true, id: Number(id) };
  }

  async addRoutine({ name, triggerPhrase, icon = '⚡', description = '', steps = [] }) {
    await this.ensureSeeded();
    const rows = await this.req('pelo_routines', {
      method: 'POST',
      body: { name, trigger_phrase: triggerPhrase.toLowerCase(), icon, description, steps_json: steps }
    });
    return mapRoutineRow(rows[0]);
  }

  async incrementRoutineRun(id) {
    const rows = await this.req(`pelo_routines?id=eq.${Number(id)}&select=*`);
    if (!rows?.[0]) return null;
    const nextCount = Number(rows[0].run_count || 0) + 1;
    const updated = await this.req(`pelo_routines?id=eq.${Number(id)}`, {
      method: 'PATCH',
      body: { run_count: nextCount }
    });
    return mapRoutineRow(updated[0]);
  }

  async deleteRoutine(id) {
    await this.req(`pelo_routines?id=eq.${Number(id)}`, { method: 'DELETE', prefer: 'return=minimal' });
    return { deleted: true, id: Number(id) };
  }

  async enqueueBridgeCommand({ commandType, label, payload = {} }) {
    await this.ensureSeeded();
    const rows = await this.req('pelo_bridge_queue', {
      method: 'POST',
      body: { command_type: commandType, label, payload_json: payload, status: 'pending' }
    });
    return mapBridgeRow(rows[0]);
  }

  async pollBridgeCommands(token) {
    const dev = await this.getDeviceState();
    if (token && token !== dev.bridgeToken) {
      return { authorized: false };
    }
    await this.updateDeviceState({ lastBridgePing: new Date().toISOString() });
    const rows = await this.req('pelo_bridge_queue?status=eq.pending&select=*&order=id.asc&limit=15');
    return {
      authorized: true,
      commands: (rows || []).map(mapBridgeRow)
    };
  }

  async ackBridgeCommands(ids = [], status = 'executed') {
    if (!ids.length) return { updated: 0 };
    const cleanIds = ids.map((x) => Number(x)).filter(Boolean);
    if (!cleanIds.length) return { updated: 0 };
    await this.req(`pelo_bridge_queue?id=in.(${cleanIds.join(',')})`, {
      method: 'PATCH',
      body: { status, executed_at: new Date().toISOString() },
      prefer: 'return=minimal'
    });
    return { updated: cleanIds.length };
  }
}

// ============================================================================
// LOCAL SQLITE / PORTABLE STORE (Sandbox Preview & Automated Tests)
// ============================================================================
class LocalSqliteStore {
  constructor(dbPath) {
    this.mode = SqliteDatabaseSync ? 'sqlite' : 'memory';
    if (SqliteDatabaseSync) {
      this.db = new SqliteDatabaseSync(dbPath);
      if (dbPath !== ':memory:') {
        try { this.db.exec('PRAGMA journal_mode = WAL;'); } catch { /* ignore */ }
      }
      this.initSchema();
    } else {
      this.mem = {
        device: null,
        messages: [],
        contacts: [],
        tasks: [],
        alarms: [],
        memories: [],
        routines: [],
        queue: [],
        seq: 1
      };
    }
    this.seedSync();
  }

  initSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS pelo_device_state (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        owner_name TEXT NOT NULL DEFAULT 'Boss',
        assistant_name TEXT NOT NULL DEFAULT 'Pelo',
        device_model TEXT NOT NULL DEFAULT 'Huawei P40 (EMUI / HMS)',
        wifi INTEGER NOT NULL DEFAULT 1,
        bluetooth INTEGER NOT NULL DEFAULT 1,
        dnd INTEGER NOT NULL DEFAULT 0,
        flashlight INTEGER NOT NULL DEFAULT 0,
        power_saver INTEGER NOT NULL DEFAULT 0,
        wake_lock INTEGER NOT NULL DEFAULT 0,
        brightness INTEGER NOT NULL DEFAULT 75,
        volume INTEGER NOT NULL DEFAULT 65,
        battery_level INTEGER NOT NULL DEFAULT 88,
        charging INTEGER NOT NULL DEFAULT 0,
        network_type TEXT NOT NULL DEFAULT '4G/Wi-Fi',
        voice_reply INTEGER NOT NULL DEFAULT 1,
        auto_execute INTEGER NOT NULL DEFAULT 1,
        bridge_token TEXT NOT NULL,
        last_bridge_ping TEXT,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS pelo_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        actions_json TEXT NOT NULL DEFAULT '[]',
        source TEXT NOT NULL DEFAULT 'chat',
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS pelo_contacts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        relationship TEXT NOT NULL DEFAULT 'Contact',
        phone TEXT NOT NULL DEFAULT '',
        whatsapp TEXT NOT NULL DEFAULT '',
        email TEXT NOT NULL DEFAULT '',
        favorite INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS pelo_tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        due_text TEXT NOT NULL DEFAULT '',
        completed INTEGER NOT NULL DEFAULT 0,
        priority TEXT NOT NULL DEFAULT 'normal',
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS pelo_alarms (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        label TEXT NOT NULL DEFAULT 'Alarm',
        time_hhmm TEXT NOT NULL DEFAULT '07:30',
        days TEXT NOT NULL DEFAULT 'Once',
        enabled INTEGER NOT NULL DEFAULT 1,
        kind TEXT NOT NULL DEFAULT 'alarm',
        duration_sec INTEGER NOT NULL DEFAULT 0,
        target_epoch_ms INTEGER,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS pelo_memories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category TEXT NOT NULL DEFAULT 'personal',
        fact TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS pelo_routines (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        trigger_phrase TEXT NOT NULL,
        icon TEXT NOT NULL DEFAULT '⚡',
        description TEXT NOT NULL DEFAULT '',
        steps_json TEXT NOT NULL DEFAULT '[]',
        run_count INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS pelo_bridge_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        command_type TEXT NOT NULL,
        label TEXT NOT NULL,
        payload_json TEXT NOT NULL DEFAULT '{}',
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TEXT NOT NULL,
        executed_at TEXT
      );
    `);
  }

  seedSync() {
    const now = new Date().toISOString();
    const token = `p40-${crypto.randomBytes(4).toString('hex')}`;

    if (!this.db) {
      if (this.mem.device) return;
      this.mem.device = {
        id: 1, owner_name: 'Boss', assistant_name: 'Pelo', device_model: 'Huawei P40 (EMUI / HMS)',
        wifi: 1, bluetooth: 1, dnd: 0, flashlight: 0, power_saver: 0, wake_lock: 0,
        brightness: 75, volume: 65, battery_level: 88, charging: 0, network_type: '4G/Wi-Fi',
        voice_reply: 1, auto_execute: 1, bridge_token: token, last_bridge_ping: null, updated_at: now
      };
      this.mem.messages.push({ id: this.mem.seq++, role: 'assistant', content: WELCOME_MSG, actions_json: '[]', source: 'system', created_at: now });
      for (const rt of DEFAULT_ROUTINES) {
        this.mem.routines.push({
          id: this.mem.seq++, name: rt.name, trigger_phrase: rt.triggerPhrase, icon: rt.icon,
          description: rt.description, steps_json: JSON.stringify(rt.steps), run_count: 0, created_at: now
        });
      }
      this.mem.contacts.push(
        { id: this.mem.seq++, name: 'Mom', relationship: 'Family', phone: '+31600000001', whatsapp: '+31600000001', email: '', favorite: 1, created_at: now },
        { id: this.mem.seq++, name: 'Alex', relationship: 'Best Friend', phone: '+31600000002', whatsapp: '+31600000002', email: '', favorite: 1, created_at: now }
      );
      return;
    }

    const row = this.db.prepare('SELECT id FROM pelo_device_state WHERE id = 1').get();
    if (row) return;

    this.db.prepare(`
      INSERT INTO pelo_device_state (id, bridge_token, updated_at) VALUES (1, ?, ?)
    `).run(token, now);

    this.db.prepare(`
      INSERT INTO pelo_messages (role, content, actions_json, source, created_at) VALUES (?, ?, ?, ?, ?)
    `).run('assistant', WELCOME_MSG, '[]', 'system', now);

    const insRoutine = this.db.prepare(`
      INSERT INTO pelo_routines (name, trigger_phrase, icon, description, steps_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    for (const rt of DEFAULT_ROUTINES) {
      insRoutine.run(rt.name, rt.triggerPhrase, rt.icon, rt.description, JSON.stringify(rt.steps), now);
    }

    const insContact = this.db.prepare(`
      INSERT INTO pelo_contacts (name, relationship, phone, whatsapp, email, favorite, created_at)
      VALUES (?, ?, ?, ?, ?, 1, ?)
    `);
    insContact.run('Mom', 'Family', '+31600000001', '+31600000001', '', now);
    insContact.run('Alex', 'Best Friend', '+31600000002', '+31600000002', '', now);

    this.db.prepare(`
      INSERT INTO pelo_alarms (label, time_hhmm, days, enabled, kind, created_at)
      VALUES ('Morning Wake Up', '07:30', 'Weekdays', 0, 'alarm', ?)
    `).run(now);

    this.db.prepare(`
      INSERT INTO pelo_tasks (title, due_text, priority, created_at)
      VALUES ('Open P40 Bridge tab to download MacroDroid profile for deep OS control', 'Optional upgrade', 'high', ?)
    `).run(now);

    this.db.prepare(`
      INSERT INTO pelo_memories (category, fact, created_at)
      VALUES ('device', 'Primary phone is a Huawei P40 running EMUI / HMS (prefers Petal Maps & AppGallery).', ?)
    `).run(now);
  }

  async getBootstrap() {
    if (!this.db) {
      return {
        storageMode: this.mode,
        device: mapDeviceRow(this.mem.device),
        messages: this.mem.messages.slice(-40).map(mapMessageRow),
        contacts: this.mem.contacts.map(mapContactRow),
        tasks: this.mem.tasks.map(mapTaskRow),
        alarms: this.mem.alarms.map(mapAlarmRow),
        memories: this.mem.memories.map(mapMemoryRow),
        routines: this.mem.routines.map(mapRoutineRow),
        bridgeQueue: this.mem.queue.slice(-25).reverse().map(mapBridgeRow)
      };
    }

    const dev = this.db.prepare('SELECT * FROM pelo_device_state WHERE id = 1').get();
    const msgs = this.db.prepare('SELECT * FROM pelo_messages ORDER BY id DESC LIMIT 40').all().reverse();
    const contacts = this.db.prepare('SELECT * FROM pelo_contacts ORDER BY id ASC').all();
    const tasks = this.db.prepare('SELECT * FROM pelo_tasks ORDER BY completed ASC, id DESC').all();
    const alarms = this.db.prepare('SELECT * FROM pelo_alarms ORDER BY id DESC').all();
    const memories = this.db.prepare('SELECT * FROM pelo_memories ORDER BY id DESC').all();
    const routines = this.db.prepare('SELECT * FROM pelo_routines ORDER BY id ASC').all();
    const queue = this.db.prepare('SELECT * FROM pelo_bridge_queue ORDER BY id DESC LIMIT 25').all();

    return {
      storageMode: this.mode,
      device: mapDeviceRow(dev),
      messages: msgs.map(mapMessageRow),
      contacts: contacts.map(mapContactRow),
      tasks: tasks.map(mapTaskRow),
      alarms: alarms.map(mapAlarmRow),
      memories: memories.map(mapMemoryRow),
      routines: routines.map(mapRoutineRow),
      bridgeQueue: queue.map(mapBridgeRow)
    };
  }

  async getDeviceState() {
    if (!this.db) return mapDeviceRow(this.mem.device);
    return mapDeviceRow(this.db.prepare('SELECT * FROM pelo_device_state WHERE id = 1').get());
  }

  async updateDeviceState(patch) {
    const now = new Date().toISOString();
    const map = {
      ownerName: ['owner_name', String],
      assistantName: ['assistant_name', String],
      deviceModel: ['device_model', String],
      wifi: ['wifi', (v) => (v ? 1 : 0)],
      bluetooth: ['bluetooth', (v) => (v ? 1 : 0)],
      dnd: ['dnd', (v) => (v ? 1 : 0)],
      flashlight: ['flashlight', (v) => (v ? 1 : 0)],
      powerSaver: ['power_saver', (v) => (v ? 1 : 0)],
      wakeLock: ['wake_lock', (v) => (v ? 1 : 0)],
      brightness: ['brightness', (v) => Math.max(0, Math.min(100, Math.round(Number(v))))],
      volume: ['volume', (v) => Math.max(0, Math.min(100, Math.round(Number(v))))],
      batteryLevel: ['battery_level', (v) => Math.max(0, Math.min(100, Math.round(Number(v))))],
      charging: ['charging', (v) => (v ? 1 : 0)],
      networkType: ['network_type', String],
      voiceReply: ['voice_reply', (v) => (v ? 1 : 0)],
      autoExecute: ['auto_execute', (v) => (v ? 1 : 0)],
      lastBridgePing: ['last_bridge_ping', String]
    };

    if (!this.db) {
      for (const [k, [col, fn]] of Object.entries(map)) {
        if (patch[k] !== undefined) this.mem.device[col] = fn(patch[k]);
      }
      this.mem.device.updated_at = now;
      return mapDeviceRow(this.mem.device);
    }

    const sets = ['updated_at = ?'];
    const vals = [now];
    for (const [k, [col, fn]] of Object.entries(map)) {
      if (patch[k] !== undefined) {
        sets.push(`${col} = ?`);
        vals.push(fn(patch[k]));
      }
    }
    this.db.prepare(`UPDATE pelo_device_state SET ${sets.join(', ')} WHERE id = 1`).run(...vals);
    return this.getDeviceState();
  }

  async addMessage({ role, content, actions = [], source = 'chat' }) {
    const now = new Date().toISOString();
    if (!this.db) {
      const row = { id: this.mem.seq++, role, content, actions_json: JSON.stringify(actions), source, created_at: now };
      this.mem.messages.push(row);
      return mapMessageRow(row);
    }
    const res = this.db.prepare(`
      INSERT INTO pelo_messages (role, content, actions_json, source, created_at) VALUES (?, ?, ?, ?, ?)
    `).run(role, content, JSON.stringify(actions), source, now);
    return mapMessageRow(this.db.prepare('SELECT * FROM pelo_messages WHERE id = ?').get(Number(res.lastInsertRowid)));
  }

  async clearMessages() {
    if (!this.db) {
      this.mem.messages = [];
      return this.addMessage({ role: 'assistant', content: WELCOME_MSG, actions: [], source: 'system' });
    }
    this.db.prepare('DELETE FROM pelo_messages').run();
    return this.addMessage({ role: 'assistant', content: WELCOME_MSG, actions: [], source: 'system' });
  }

  async addContact({ name, relationship = 'Contact', phone = '', whatsapp = '', email = '' }) {
    const now = new Date().toISOString();
    if (!this.db) {
      const row = { id: this.mem.seq++, name, relationship, phone, whatsapp: whatsapp || phone, email, favorite: 1, created_at: now };
      this.mem.contacts.push(row);
      return mapContactRow(row);
    }
    const res = this.db.prepare(`
      INSERT INTO pelo_contacts (name, relationship, phone, whatsapp, email, favorite, created_at)
      VALUES (?, ?, ?, ?, ?, 1, ?)
    `).run(name, relationship, phone, whatsapp || phone, email, now);
    return mapContactRow(this.db.prepare('SELECT * FROM pelo_contacts WHERE id = ?').get(Number(res.lastInsertRowid)));
  }

  async deleteContact(id) {
    if (!this.db) {
      this.mem.contacts = this.mem.contacts.filter((x) => x.id !== Number(id));
      return { deleted: true, id: Number(id) };
    }
    this.db.prepare('DELETE FROM pelo_contacts WHERE id = ?').run(Number(id));
    return { deleted: true, id: Number(id) };
  }

  async addTask({ title, dueText = '', priority = 'normal' }) {
    const now = new Date().toISOString();
    if (!this.db) {
      const row = { id: this.mem.seq++, title, due_text: dueText, completed: 0, priority, created_at: now };
      this.mem.tasks.unshift(row);
      return mapTaskRow(row);
    }
    const res = this.db.prepare(`
      INSERT INTO pelo_tasks (title, due_text, completed, priority, created_at) VALUES (?, ?, 0, ?, ?)
    `).run(title, dueText, priority, now);
    return mapTaskRow(this.db.prepare('SELECT * FROM pelo_tasks WHERE id = ?').get(Number(res.lastInsertRowid)));
  }

  async updateTask(id, patch) {
    if (!this.db) {
      const row = this.mem.tasks.find((x) => x.id === Number(id));
      if (!row) return null;
      if (patch.completed !== undefined) row.completed = patch.completed ? 1 : 0;
      if (patch.title !== undefined) row.title = String(patch.title);
      return mapTaskRow(row);
    }
    const existing = this.db.prepare('SELECT * FROM pelo_tasks WHERE id = ?').get(Number(id));
    if (!existing) return null;
    const completed = patch.completed !== undefined ? (patch.completed ? 1 : 0) : existing.completed;
    const title = patch.title !== undefined ? String(patch.title) : existing.title;
    this.db.prepare('UPDATE pelo_tasks SET completed = ?, title = ? WHERE id = ?').run(completed, title, Number(id));
    return mapTaskRow(this.db.prepare('SELECT * FROM pelo_tasks WHERE id = ?').get(Number(id)));
  }

  async deleteTask(id) {
    if (!this.db) {
      this.mem.tasks = this.mem.tasks.filter((x) => x.id !== Number(id));
      return { deleted: true, id: Number(id) };
    }
    this.db.prepare('DELETE FROM pelo_tasks WHERE id = ?').run(Number(id));
    return { deleted: true, id: Number(id) };
  }

  async addAlarm({ label = 'Alarm', timeHhmm = '07:30', days = 'Once', enabled = true, kind = 'alarm', durationSec = 0, targetEpochMs = null }) {
    const now = new Date().toISOString();
    if (!this.db) {
      const row = { id: this.mem.seq++, label, time_hhmm: timeHhmm, days, enabled: enabled ? 1 : 0, kind, duration_sec: durationSec, target_epoch_ms: targetEpochMs, created_at: now };
      this.mem.alarms.unshift(row);
      return mapAlarmRow(row);
    }
    const res = this.db.prepare(`
      INSERT INTO pelo_alarms (label, time_hhmm, days, enabled, kind, duration_sec, target_epoch_ms, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(label, timeHhmm, days, enabled ? 1 : 0, kind, durationSec, targetEpochMs, now);
    return mapAlarmRow(this.db.prepare('SELECT * FROM pelo_alarms WHERE id = ?').get(Number(res.lastInsertRowid)));
  }

  async updateAlarm(id, patch) {
    if (!this.db) {
      const row = this.mem.alarms.find((x) => x.id === Number(id));
      if (!row) return null;
      if (patch.enabled !== undefined) row.enabled = patch.enabled ? 1 : 0;
      return mapAlarmRow(row);
    }
    const existing = this.db.prepare('SELECT * FROM pelo_alarms WHERE id = ?').get(Number(id));
    if (!existing) return null;
    const enabled = patch.enabled !== undefined ? (patch.enabled ? 1 : 0) : existing.enabled;
    this.db.prepare('UPDATE pelo_alarms SET enabled = ? WHERE id = ?').run(enabled, Number(id));
    return mapAlarmRow(this.db.prepare('SELECT * FROM pelo_alarms WHERE id = ?').get(Number(id)));
  }

  async deleteAlarm(id) {
    if (!this.db) {
      this.mem.alarms = this.mem.alarms.filter((x) => x.id !== Number(id));
      return { deleted: true, id: Number(id) };
    }
    this.db.prepare('DELETE FROM pelo_alarms WHERE id = ?').run(Number(id));
    return { deleted: true, id: Number(id) };
  }

  async addMemory({ category = 'personal', fact }) {
    const now = new Date().toISOString();
    if (!this.db) {
      const row = { id: this.mem.seq++, category, fact, created_at: now };
      this.mem.memories.unshift(row);
      return mapMemoryRow(row);
    }
    const res = this.db.prepare(`
      INSERT INTO pelo_memories (category, fact, created_at) VALUES (?, ?, ?)
    `).run(category, fact, now);
    return mapMemoryRow(this.db.prepare('SELECT * FROM pelo_memories WHERE id = ?').get(Number(res.lastInsertRowid)));
  }

  async deleteMemory(id) {
    if (!this.db) {
      this.mem.memories = this.mem.memories.filter((x) => x.id !== Number(id));
      return { deleted: true, id: Number(id) };
    }
    this.db.prepare('DELETE FROM pelo_memories WHERE id = ?').run(Number(id));
    return { deleted: true, id: Number(id) };
  }

  async addRoutine({ name, triggerPhrase, icon = '⚡', description = '', steps = [] }) {
    const now = new Date().toISOString();
    if (!this.db) {
      const row = { id: this.mem.seq++, name, trigger_phrase: triggerPhrase.toLowerCase(), icon, description, steps_json: JSON.stringify(steps), run_count: 0, created_at: now };
      this.mem.routines.push(row);
      return mapRoutineRow(row);
    }
    const res = this.db.prepare(`
      INSERT INTO pelo_routines (name, trigger_phrase, icon, description, steps_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(name, triggerPhrase.toLowerCase(), icon, description, JSON.stringify(steps), now);
    return mapRoutineRow(this.db.prepare('SELECT * FROM pelo_routines WHERE id = ?').get(Number(res.lastInsertRowid)));
  }

  async incrementRoutineRun(id) {
    if (!this.db) {
      const row = this.mem.routines.find((x) => x.id === Number(id));
      if (!row) return null;
      row.run_count += 1;
      return mapRoutineRow(row);
    }
    this.db.prepare('UPDATE pelo_routines SET run_count = run_count + 1 WHERE id = ?').run(Number(id));
    const row = this.db.prepare('SELECT * FROM pelo_routines WHERE id = ?').get(Number(id));
    return row ? mapRoutineRow(row) : null;
  }

  async deleteRoutine(id) {
    if (!this.db) {
      this.mem.routines = this.mem.routines.filter((x) => x.id !== Number(id));
      return { deleted: true, id: Number(id) };
    }
    this.db.prepare('DELETE FROM pelo_routines WHERE id = ?').run(Number(id));
    return { deleted: true, id: Number(id) };
  }

  async enqueueBridgeCommand({ commandType, label, payload = {} }) {
    const now = new Date().toISOString();
    if (!this.db) {
      const row = { id: this.mem.seq++, command_type: commandType, label, payload_json: JSON.stringify(payload), status: 'pending', created_at: now, executed_at: null };
      this.mem.queue.push(row);
      return mapBridgeRow(row);
    }
    const res = this.db.prepare(`
      INSERT INTO pelo_bridge_queue (command_type, label, payload_json, status, created_at)
      VALUES (?, ?, ?, 'pending', ?)
    `).run(commandType, label, JSON.stringify(payload), now);
    return mapBridgeRow(this.db.prepare('SELECT * FROM pelo_bridge_queue WHERE id = ?').get(Number(res.lastInsertRowid)));
  }

  async pollBridgeCommands(token) {
    const dev = await this.getDeviceState();
    if (token && token !== dev.bridgeToken) {
      return { authorized: false };
    }
    await this.updateDeviceState({ lastBridgePing: new Date().toISOString() });
    if (!this.db) {
      return {
        authorized: true,
        commands: this.mem.queue.filter((x) => x.status === 'pending').slice(0, 15).map(mapBridgeRow)
      };
    }
    const rows = this.db.prepare("SELECT * FROM pelo_bridge_queue WHERE status = 'pending' ORDER BY id ASC LIMIT 15").all();
    return {
      authorized: true,
      commands: rows.map(mapBridgeRow)
    };
  }

  async ackBridgeCommands(ids = [], status = 'executed') {
    const cleanIds = ids.map((x) => Number(x)).filter(Boolean);
    if (!cleanIds.length) return { updated: 0 };
    const now = new Date().toISOString();
    if (!this.db) {
      for (const item of this.mem.queue) {
        if (cleanIds.includes(item.id)) {
          item.status = status;
          item.executed_at = now;
        }
      }
      return { updated: cleanIds.length };
    }
    const placeholders = cleanIds.map(() => '?').join(',');
    this.db.prepare(`UPDATE pelo_bridge_queue SET status = ?, executed_at = ? WHERE id IN (${placeholders})`).run(status, now, ...cleanIds);
    return { updated: cleanIds.length };
  }
}

let singletonStore = null;

function resolveLocalDbPath() {
  if (process.env.DB_PATH) return process.env.DB_PATH;
  const dir = path.join(__dirname, '..', 'data');
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.accessSync(dir, fs.constants.W_OK);
    return path.join(dir, 'pelo.db');
  } catch {
    return path.join('/tmp', 'pelo.db');
  }
}

function getStore() {
  if (singletonStore) return singletonStore;
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.DB_PATH !== ':memory:') {
    singletonStore = new SupabaseStore(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  } else {
    singletonStore = new LocalSqliteStore(resolveLocalDbPath());
  }
  return singletonStore;
}

module.exports = {
  getStore,
  DEFAULT_ROUTINES
};
