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

const STARTER_FILES = [
  { path: '/storage/emulated/0/Download/macrodroid-old-installer.apk', name: 'macrodroid-old-installer.apk', folder: 'Download', size_bytes: 48234496, mime_kind: 'apk' },
  { path: '/storage/emulated/0/Download/petal-maps-offline-cache.tmp', name: 'petal-maps-offline-cache.tmp', folder: 'Download', size_bytes: 194510848, mime_kind: 'temp' },
  { path: '/storage/emulated/0/Download/boarding-pass-amsterdam.pdf', name: 'boarding-pass-amsterdam.pdf', folder: 'Download', size_bytes: 842110, mime_kind: 'pdf' },
  { path: '/storage/emulated/0/Download/invoice-november.pdf', name: 'invoice-november.pdf', folder: 'Download', size_bytes: 412800, mime_kind: 'pdf' },
  { path: '/storage/emulated/0/DCIM/Screenshots/Screenshot_20261124_EMUI.jpg', name: 'Screenshot_20261124_EMUI.jpg', folder: 'Screenshots', size_bytes: 2841200, mime_kind: 'image' },
  { path: '/storage/emulated/0/DCIM/Screenshots/Screenshot_20261120_duplicate.jpg', name: 'Screenshot_20261120_duplicate.jpg', folder: 'Screenshots', size_bytes: 2519040, mime_kind: 'image' },
  { path: '/storage/emulated/0/Documents/wifi-backup-codes.txt', name: 'wifi-backup-codes.txt', folder: 'Documents', size_bytes: 2048, mime_kind: 'text' }
];

const STARTER_COMMS = [
  { channel: 'sms', direction: 'inbound', contact_name: 'Mom', address: '+31600000001', body: 'Let me know when you are heading back!', status: 'received' },
  { channel: 'whatsapp', direction: 'inbound', contact_name: 'Alex', address: '+31600000002', body: 'Yo are we still meeting at 7?', status: 'received' }
];

const WELCOME_MSG =
  "Hey! I'm **Pelo**, your unrestricted personal AI OS for your **Huawei P40**.\n" +
  "I can control **files, messages, calls, apps, hardware & shell commands**:\n" +
  "• *\"Delete all .apk files in Downloads\"* or *\"Delete Screenshot_20261120_duplicate.jpg\"*\n" +
  "• *\"Send SMS to Mom saying I'm on my way home\"*\n" +
  "• *\"WhatsApp Alex yeah see u at 7\"* or *\"Reply to last message saying Be right there\"*\n" +
  "• *\"Organize my Downloads folder\"* or *\"Turn on flashlight nd set a 3m timer\"*";

function guessMimeKind(name) {
  const ext = (String(name).split('.').pop() || '').toLowerCase();
  if (['apk', 'xapk'].includes(ext)) return 'apk';
  if (['tmp', 'log', 'bak', 'cache'].includes(ext)) return 'temp';
  if (['pdf', 'doc', 'docx', 'txt', 'md'].includes(ext)) return 'pdf';
  if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic'].includes(ext)) return 'image';
  if (['mp4', 'mkv', 'mov', 'mp3', 'wav', 'm4a'].includes(ext)) return 'media';
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return 'archive';
  return 'file';
}

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
    godMode: r.god_mode === undefined ? true : Boolean(r.god_mode),
    confirmDestructive: Boolean(r.confirm_destructive),
    storageTotalGb: Number(r.storage_total_gb ?? 128),
    storageUsedGb: Number(r.storage_used_gb ?? 58.4),
    clipboardText: r.clipboard_text || '',
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
    result: typeof r.result_json === 'string' ? JSON.parse(r.result_json || '{}') : (r.result_json || {}),
    status: r.status,
    createdAt: r.created_at,
    executedAt: r.executed_at || null
  };
}

function mapFileRow(r) {
  return {
    id: Number(r.id),
    path: r.path,
    name: r.name,
    folder: r.folder || 'Download',
    sizeBytes: Number(r.size_bytes || 0),
    mimeKind: r.mime_kind || guessMimeKind(r.name),
    trashed: Boolean(r.trashed),
    originalPath: r.original_path || null,
    source: r.source || 'p40-storage',
    updatedAt: r.updated_at
  };
}

function mapCommRow(r) {
  return {
    id: Number(r.id),
    channel: r.channel || 'sms',
    direction: r.direction || 'outbound',
    contactName: r.contact_name || '',
    address: r.address || '',
    body: r.body,
    status: r.status || 'sent',
    createdAt: r.created_at
  };
}

function matchFileQuery(file, { id, query, extension, folder, includeTrashed = false }) {
  if (!includeTrashed && file.trashed) return false;
  if (id && Number(file.id) === Number(id)) return true;
  if (extension) {
    const cleanExt = extension.replace(/^\./, '').toLowerCase();
    if (cleanExt === 'junk') {
      return file.mimeKind === 'apk' || file.mimeKind === 'temp' || /\.(apk|tmp|log|bak|cache)$/i.test(file.name);
    }
    return file.name.toLowerCase().endsWith(`.${cleanExt}`);
  }
  if (folder && !query) {
    return file.folder.toLowerCase().includes(folder.toLowerCase());
  }
  if (query) {
    const q = query.toLowerCase();
    return file.name.toLowerCase().includes(q) || file.path.toLowerCase().includes(q);
  }
  return false;
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
      await this.req('pelo_device_state', { method: 'POST', body: { id: 1, bridge_token: token } });
      await this.req('pelo_messages', { method: 'POST', body: { role: 'assistant', content: WELCOME_MSG, actions_json: [], source: 'system' } });
      await this.req('pelo_routines', {
        method: 'POST',
        body: DEFAULT_ROUTINES.map((rt) => ({
          name: rt.name, trigger_phrase: rt.triggerPhrase, icon: rt.icon, description: rt.description, steps_json: rt.steps
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
        body: [{ title: 'Run 1-line Huawei P40 Super-Agent in Termux for full storage & background SIM SMS control', due_text: 'P40 Bridge tab', priority: 'high' }]
      });
      await this.req('pelo_memories', {
        method: 'POST',
        body: [{ category: 'device', fact: 'Primary phone is a Huawei P40 running EMUI / HMS (prefers Petal Maps & AppGallery).' }]
      });
    }

    // Seed starter file index & starter comms if empty (e.g. upgraded from v1 schema)
    const [existingFiles, existingComms] = await Promise.all([
      this.req('pelo_files_index?select=id&limit=1'),
      this.req('pelo_comms_log?select=id&limit=1')
    ]);
    if (!existingFiles || existingFiles.length === 0) {
      await this.req('pelo_files_index', { method: 'POST', body: STARTER_FILES });
    }
    if (!existingComms || existingComms.length === 0) {
      await this.req('pelo_comms_log', { method: 'POST', body: STARTER_COMMS });
    }

    this.seeded = true;
  }

  async getBootstrap() {
    await this.ensureSeeded();
    const [devRows, msgs, contacts, tasks, alarms, memories, routines, queue, files, comms] = await Promise.all([
      this.req('pelo_device_state?id=eq.1&select=*'),
      this.req('pelo_messages?select=*&order=id.desc&limit=40'),
      this.req('pelo_contacts?select=*&order=id.asc'),
      this.req('pelo_tasks?select=*&order=completed.asc,id.desc'),
      this.req('pelo_alarms?select=*&order=id.desc'),
      this.req('pelo_memories?select=*&order=id.desc'),
      this.req('pelo_routines?select=*&order=id.asc'),
      this.req('pelo_bridge_queue?select=*&order=id.desc&limit=25'),
      this.req('pelo_files_index?select=*&order=trashed.asc,size_bytes.desc&limit=80'),
      this.req('pelo_comms_log?select=*&order=id.desc&limit=30')
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
      bridgeQueue: (queue || []).map(mapBridgeRow),
      files: (files || []).map(mapFileRow),
      comms: (comms || []).map(mapCommRow)
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
      godMode: 'god_mode',
      confirmDestructive: 'confirm_destructive',
      storageTotalGb: 'storage_total_gb',
      storageUsedGb: 'storage_used_gb',
      clipboardText: 'clipboard_text',
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
    const rows = await this.req(`pelo_alarms?id=eq.${Number(id)}`, { method: 'PATCH', body: dbPatch });
    return rows?.[0] ? mapAlarmRow(rows[0]) : null;
  }

  async deleteAlarm(id) {
    await this.req(`pelo_alarms?id=eq.${Number(id)}`, { method: 'DELETE', prefer: 'return=minimal' });
    return { deleted: true, id: Number(id) };
  }

  async addMemory({ category = 'personal', fact }) {
    await this.ensureSeeded();
    const rows = await this.req('pelo_memories', { method: 'POST', body: { category, fact } });
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
    const updated = await this.req(`pelo_routines?id=eq.${Number(id)}`, { method: 'PATCH', body: { run_count: nextCount } });
    return mapRoutineRow(updated[0]);
  }

  async deleteRoutine(id) {
    await this.req(`pelo_routines?id=eq.${Number(id)}`, { method: 'DELETE', prefer: 'return=minimal' });
    return { deleted: true, id: Number(id) };
  }

  // FILE MANAGEMENT (Huawei P40 Storage Index + Trash + Create + Organize)
  async listFiles() {
    await this.ensureSeeded();
    const rows = await this.req('pelo_files_index?select=*&order=trashed.asc,size_bytes.desc&limit=80');
    return (rows || []).map(mapFileRow);
  }

  async createFileEntry({ name, folder = 'Documents', sizeBytes = 512, path: customPath }) {
    await this.ensureSeeded();
    const fpath = customPath || `/storage/emulated/0/${folder}/${name}`;
    const rows = await this.req('pelo_files_index?on_conflict=path', {
      method: 'POST',
      prefer: 'resolution=merge-duplicates,return=representation',
      body: {
        path: fpath,
        name,
        folder,
        size_bytes: sizeBytes,
        mime_kind: guessMimeKind(name),
        trashed: false
      }
    });
    return mapFileRow(rows[0]);
  }

  async deleteFiles({ id, query, extension, folder, permanent = false }) {
    const all = await this.listFiles();
    const targets = all.filter((f) => matchFileQuery(f, { id, query, extension, folder, includeTrashed: permanent }));
    if (!targets.length) return { count: 0, freedBytes: 0, affected: [] };

    const ids = targets.map((t) => t.id).join(',');
    const freedBytes = targets.reduce((sum, t) => sum + t.sizeBytes, 0);

    if (permanent) {
      await this.req(`pelo_files_index?id=in.(${ids})`, { method: 'DELETE', prefer: 'return=minimal' });
    } else {
      for (const t of targets) {
        await this.req(`pelo_files_index?id=eq.${t.id}`, {
          method: 'PATCH',
          prefer: 'return=minimal',
          body: {
            trashed: true,
            original_path: t.path,
            folder: '.pelo-trash',
            updated_at: new Date().toISOString()
          }
        });
      }
    }
    return { count: targets.length, freedBytes, affected: targets };
  }

  async restoreFiles({ id, query } = {}) {
    const all = await this.listFiles();
    const trashed = all.filter((f) => f.trashed && (!id && !query ? true : (id ? f.id === Number(id) : f.name.toLowerCase().includes(query.toLowerCase()))));
    for (const t of trashed) {
      const origFolder = t.originalPath ? path.basename(path.dirname(t.originalPath)) : 'Download';
      await this.req(`pelo_files_index?id=eq.${t.id}`, {
        method: 'PATCH',
        prefer: 'return=minimal',
        body: { trashed: false, folder: origFolder, updated_at: new Date().toISOString() }
      });
    }
    return { count: trashed.length, restored: trashed };
  }

  async emptyTrash() {
    const all = await this.listFiles();
    const trashed = all.filter((f) => f.trashed);
    if (trashed.length) {
      await this.req('pelo_files_index?trashed=eq.true', { method: 'DELETE', prefer: 'return=minimal' });
    }
    return { count: trashed.length };
  }

  async organizeDownloads() {
    const all = await this.listFiles();
    const dl = all.filter((f) => !f.trashed && f.folder === 'Download');
    const bucketMap = { pdf: 'Download/Documents', image: 'Download/Images', apk: 'Download/APKs', archive: 'Download/Archives', temp: 'Download/Temp' };
    for (const f of dl) {
      const targetFolder = bucketMap[f.mimeKind] || 'Download/Other';
      await this.req(`pelo_files_index?id=eq.${f.id}`, {
        method: 'PATCH',
        prefer: 'return=minimal',
        body: { folder: targetFolder, updated_at: new Date().toISOString() }
      });
    }
    return { movedCount: dl.length };
  }

  async syncAgentFiles(files = []) {
    if (!Array.isArray(files) || !files.length) return;
    await this.req('pelo_files_index?trashed=eq.false', { method: 'DELETE', prefer: 'return=minimal' });
    const rows = files.slice(0, 80).map((f) => ({
      path: f.path,
      name: f.name,
      folder: f.folder || 'Download',
      size_bytes: Number(f.sizeBytes || 0),
      mime_kind: guessMimeKind(f.name),
      trashed: false,
      source: 'p40-live-agent'
    }));
    await this.req('pelo_files_index?on_conflict=path', {
      method: 'POST',
      prefer: 'resolution=merge-duplicates,return=minimal',
      body: rows
    });
  }

  // COMMS LOG (SMS / WhatsApp / Telegram / Email)
  async logComm({ channel = 'sms', direction = 'outbound', contactName = '', address = '', body, status = 'sent_direct' }) {
    await this.ensureSeeded();
    const rows = await this.req('pelo_comms_log', {
      method: 'POST',
      body: { channel, direction, contact_name: contactName, address, body, status }
    });
    return mapCommRow(rows[0]);
  }

  async syncInboxSms(smsArray = []) {
    if (!Array.isArray(smsArray) || !smsArray.length) return;
    for (const item of smsArray.slice(0, 8)) {
      if (!item.body) continue;
      await this.logComm({
        channel: 'sms',
        direction: item.type === 'sent' ? 'outbound' : 'inbound',
        contactName: item.sender || item.number || 'SMS',
        address: item.number || '',
        body: String(item.body).slice(0, 500),
        status: 'synced_p40'
      });
    }
  }

  // BRIDGE QUEUE
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
    if (token && token !== dev.bridgeToken) return { authorized: false };
    await this.updateDeviceState({ lastBridgePing: new Date().toISOString() });
    const rows = await this.req('pelo_bridge_queue?status=eq.pending&select=*&order=id.asc&limit=15');
    return { authorized: true, commands: (rows || []).map(mapBridgeRow) };
  }

  async ackBridgeCommands(ids = [], status = 'executed', result = {}) {
    const cleanIds = ids.map((x) => Number(x)).filter(Boolean);
    if (!cleanIds.length) return { updated: 0 };
    await this.req(`pelo_bridge_queue?id=in.(${cleanIds.join(',')})`, {
      method: 'PATCH',
      body: { status, result_json: result || {}, executed_at: new Date().toISOString() },
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
        device: null, messages: [], contacts: [], tasks: [], alarms: [],
        memories: [], routines: [], queue: [], files: [], comms: [], seq: 1
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
        god_mode INTEGER NOT NULL DEFAULT 1,
        confirm_destructive INTEGER NOT NULL DEFAULT 0,
        storage_total_gb REAL NOT NULL DEFAULT 128,
        storage_used_gb REAL NOT NULL DEFAULT 58.4,
        clipboard_text TEXT NOT NULL DEFAULT '',
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
        result_json TEXT NOT NULL DEFAULT '{}',
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TEXT NOT NULL,
        executed_at TEXT
      );
      CREATE TABLE IF NOT EXISTS pelo_files_index (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        path TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        folder TEXT NOT NULL DEFAULT 'Download',
        size_bytes INTEGER NOT NULL DEFAULT 0,
        mime_kind TEXT NOT NULL DEFAULT 'file',
        trashed INTEGER NOT NULL DEFAULT 0,
        original_path TEXT,
        source TEXT NOT NULL DEFAULT 'p40-storage',
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS pelo_comms_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        channel TEXT NOT NULL DEFAULT 'sms',
        direction TEXT NOT NULL DEFAULT 'outbound',
        contact_name TEXT NOT NULL DEFAULT '',
        address TEXT NOT NULL DEFAULT '',
        body TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'queued_agent',
        created_at TEXT NOT NULL
      );
    `);

    // Ensure columns exist if upgrading an older local SQLite DB
    const safeAlter = [
      'ALTER TABLE pelo_device_state ADD COLUMN god_mode INTEGER NOT NULL DEFAULT 1',
      'ALTER TABLE pelo_device_state ADD COLUMN confirm_destructive INTEGER NOT NULL DEFAULT 0',
      'ALTER TABLE pelo_device_state ADD COLUMN storage_total_gb REAL NOT NULL DEFAULT 128',
      'ALTER TABLE pelo_device_state ADD COLUMN storage_used_gb REAL NOT NULL DEFAULT 58.4',
      "ALTER TABLE pelo_device_state ADD COLUMN clipboard_text TEXT NOT NULL DEFAULT ''",
      "ALTER TABLE pelo_bridge_queue ADD COLUMN result_json TEXT NOT NULL DEFAULT '{}'"
    ];
    for (const sql of safeAlter) {
      try { this.db.exec(sql); } catch { /* column already exists */ }
    }
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
        voice_reply: 1, auto_execute: 1, god_mode: 1, confirm_destructive: 0,
        storage_total_gb: 128, storage_used_gb: 58.4, clipboard_text: '',
        bridge_token: token, last_bridge_ping: null, updated_at: now
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
      for (const f of STARTER_FILES) {
        this.mem.files.push({ id: this.mem.seq++, ...f, trashed: 0, original_path: null, source: 'p40-storage', updated_at: now });
      }
      for (const c of STARTER_COMMS) {
        this.mem.comms.push({ id: this.mem.seq++, ...c, created_at: now });
      }
      return;
    }

    const row = this.db.prepare('SELECT id FROM pelo_device_state WHERE id = 1').get();
    if (!row) {
      this.db.prepare('INSERT INTO pelo_device_state (id, bridge_token, updated_at) VALUES (1, ?, ?)').run(token, now);
      this.db.prepare('INSERT INTO pelo_messages (role, content, actions_json, source, created_at) VALUES (?, ?, ?, ?, ?)').run('assistant', WELCOME_MSG, '[]', 'system', now);

      const insRoutine = this.db.prepare('INSERT INTO pelo_routines (name, trigger_phrase, icon, description, steps_json, created_at) VALUES (?, ?, ?, ?, ?, ?)');
      for (const rt of DEFAULT_ROUTINES) {
        insRoutine.run(rt.name, rt.triggerPhrase, rt.icon, rt.description, JSON.stringify(rt.steps), now);
      }

      const insContact = this.db.prepare('INSERT INTO pelo_contacts (name, relationship, phone, whatsapp, email, favorite, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)');
      insContact.run('Mom', 'Family', '+31600000001', '+31600000001', '', now);
      insContact.run('Alex', 'Best Friend', '+31600000002', '+31600000002', '', now);

      this.db.prepare("INSERT INTO pelo_alarms (label, time_hhmm, days, enabled, kind, created_at) VALUES ('Morning Wake Up', '07:30', 'Weekdays', 0, 'alarm', ?)").run(now);
      this.db.prepare("INSERT INTO pelo_tasks (title, due_text, priority, created_at) VALUES ('Run 1-line Huawei P40 Super-Agent in Termux for full storage & background SIM SMS control', 'P40 Bridge tab', 'high', ?)").run(now);
      this.db.prepare("INSERT INTO pelo_memories (category, fact, created_at) VALUES ('device', 'Primary phone is a Huawei P40 running EMUI / HMS (prefers Petal Maps & AppGallery).', ?)").run(now);
    }

    const fCount = this.db.prepare('SELECT COUNT(*) as c FROM pelo_files_index').get().c;
    if (fCount === 0) {
      const insF = this.db.prepare('INSERT INTO pelo_files_index (path, name, folder, size_bytes, mime_kind, trashed, updated_at) VALUES (?, ?, ?, ?, ?, 0, ?)');
      for (const f of STARTER_FILES) insF.run(f.path, f.name, f.folder, f.size_bytes, f.mime_kind, now);
    }

    const cCount = this.db.prepare('SELECT COUNT(*) as c FROM pelo_comms_log').get().c;
    if (cCount === 0) {
      const insC = this.db.prepare('INSERT INTO pelo_comms_log (channel, direction, contact_name, address, body, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
      for (const c of STARTER_COMMS) insC.run(c.channel, c.direction, c.contact_name, c.address, c.body, c.status, now);
    }
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
        bridgeQueue: this.mem.queue.slice(-25).reverse().map(mapBridgeRow),
        files: this.mem.files.map(mapFileRow),
        comms: this.mem.comms.slice(-30).reverse().map(mapCommRow)
      };
    }

    return {
      storageMode: this.mode,
      device: mapDeviceRow(this.db.prepare('SELECT * FROM pelo_device_state WHERE id = 1').get()),
      messages: this.db.prepare('SELECT * FROM pelo_messages ORDER BY id DESC LIMIT 40').all().reverse().map(mapMessageRow),
      contacts: this.db.prepare('SELECT * FROM pelo_contacts ORDER BY id ASC').all().map(mapContactRow),
      tasks: this.db.prepare('SELECT * FROM pelo_tasks ORDER BY completed ASC, id DESC').all().map(mapTaskRow),
      alarms: this.db.prepare('SELECT * FROM pelo_alarms ORDER BY id DESC').all().map(mapAlarmRow),
      memories: this.db.prepare('SELECT * FROM pelo_memories ORDER BY id DESC').all().map(mapMemoryRow),
      routines: this.db.prepare('SELECT * FROM pelo_routines ORDER BY id ASC').all().map(mapRoutineRow),
      bridgeQueue: this.db.prepare('SELECT * FROM pelo_bridge_queue ORDER BY id DESC LIMIT 25').all().map(mapBridgeRow),
      files: this.db.prepare('SELECT * FROM pelo_files_index ORDER BY trashed ASC, size_bytes DESC LIMIT 80').all().map(mapFileRow),
      comms: this.db.prepare('SELECT * FROM pelo_comms_log ORDER BY id DESC LIMIT 30').all().map(mapCommRow)
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
      godMode: ['god_mode', (v) => (v ? 1 : 0)],
      confirmDestructive: ['confirm_destructive', (v) => (v ? 1 : 0)],
      storageTotalGb: ['storage_total_gb', Number],
      storageUsedGb: ['storage_used_gb', Number],
      clipboardText: ['clipboard_text', String],
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
    const res = this.db.prepare('INSERT INTO pelo_messages (role, content, actions_json, source, created_at) VALUES (?, ?, ?, ?, ?)').run(role, content, JSON.stringify(actions), source, now);
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
    const res = this.db.prepare('INSERT INTO pelo_contacts (name, relationship, phone, whatsapp, email, favorite, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)').run(name, relationship, phone, whatsapp || phone, email, now);
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
    const res = this.db.prepare('INSERT INTO pelo_tasks (title, due_text, completed, priority, created_at) VALUES (?, ?, 0, ?, ?)').run(title, dueText, priority, now);
    return mapTaskRow(this.db.prepare('SELECT * FROM pelo_tasks WHERE id = ?').get(Number(res.lastInsertRowid)));
  }

  async updateTask(id, patch) {
    if (!this.db) {
      const row = this.mem.tasks.find((x) => x.id === Number(id));
      if (!row) return null;
      if (patch.completed !== undefined) row.completed = patch.completed ? 1 : 0;
      return mapTaskRow(row);
    }
    const existing = this.db.prepare('SELECT * FROM pelo_tasks WHERE id = ?').get(Number(id));
    if (!existing) return null;
    const completed = patch.completed !== undefined ? (patch.completed ? 1 : 0) : existing.completed;
    this.db.prepare('UPDATE pelo_tasks SET completed = ? WHERE id = ?').run(completed, Number(id));
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
    const res = this.db.prepare('INSERT INTO pelo_alarms (label, time_hhmm, days, enabled, kind, duration_sec, target_epoch_ms, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(label, timeHhmm, days, enabled ? 1 : 0, kind, durationSec, targetEpochMs, now);
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
    const res = this.db.prepare('INSERT INTO pelo_memories (category, fact, created_at) VALUES (?, ?, ?)').run(category, fact, now);
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
    const res = this.db.prepare('INSERT INTO pelo_routines (name, trigger_phrase, icon, description, steps_json, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(name, triggerPhrase.toLowerCase(), icon, description, JSON.stringify(steps), now);
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

  // FILE MANAGEMENT
  async listFiles() {
    if (!this.db) return this.mem.files.map(mapFileRow);
    return this.db.prepare('SELECT * FROM pelo_files_index ORDER BY trashed ASC, size_bytes DESC LIMIT 80').all().map(mapFileRow);
  }

  async createFileEntry({ name, folder = 'Documents', sizeBytes = 512, path: customPath }) {
    const now = new Date().toISOString();
    const fpath = customPath || `/storage/emulated/0/${folder}/${name}`;
    if (!this.db) {
      const row = { id: this.mem.seq++, path: fpath, name, folder, size_bytes: sizeBytes, mime_kind: guessMimeKind(name), trashed: 0, original_path: null, source: 'p40-storage', updated_at: now };
      this.mem.files.unshift(row);
      return mapFileRow(row);
    }
    this.db.prepare(`
      INSERT INTO pelo_files_index (path, name, folder, size_bytes, mime_kind, trashed, updated_at)
      VALUES (?, ?, ?, ?, ?, 0, ?)
      ON CONFLICT(path) DO UPDATE SET size_bytes = excluded.size_bytes, trashed = 0, updated_at = excluded.updated_at
    `).run(fpath, name, folder, sizeBytes, guessMimeKind(name), now);
    return mapFileRow(this.db.prepare('SELECT * FROM pelo_files_index WHERE path = ?').get(fpath));
  }

  async deleteFiles({ id, query, extension, folder, permanent = false }) {
    const all = await this.listFiles();
    const targets = all.filter((f) => matchFileQuery(f, { id, query, extension, folder, includeTrashed: permanent }));
    if (!targets.length) return { count: 0, freedBytes: 0, affected: [] };

    const freedBytes = targets.reduce((sum, t) => sum + t.sizeBytes, 0);
    const now = new Date().toISOString();

    if (!this.db) {
      const targetIds = targets.map((t) => t.id);
      if (permanent) {
        this.mem.files = this.mem.files.filter((f) => !targetIds.includes(f.id));
      } else {
        for (const f of this.mem.files) {
          if (targetIds.includes(f.id)) {
            f.trashed = 1;
            f.original_path = f.path;
            f.folder = '.pelo-trash';
            f.updated_at = now;
          }
        }
      }
      return { count: targets.length, freedBytes, affected: targets };
    }

    if (permanent) {
      const stmt = this.db.prepare('DELETE FROM pelo_files_index WHERE id = ?');
      for (const t of targets) stmt.run(t.id);
    } else {
      const stmt = this.db.prepare("UPDATE pelo_files_index SET trashed = 1, original_path = path, folder = '.pelo-trash', updated_at = ? WHERE id = ?");
      for (const t of targets) stmt.run(now, t.id);
    }
    return { count: targets.length, freedBytes, affected: targets };
  }

  async restoreFiles({ id, query } = {}) {
    const all = await this.listFiles();
    const trashed = all.filter((f) => f.trashed && (!id && !query ? true : (id ? f.id === Number(id) : f.name.toLowerCase().includes(query.toLowerCase()))));
    const now = new Date().toISOString();

    if (!this.db) {
      const ids = trashed.map((t) => t.id);
      for (const f of this.mem.files) {
        if (ids.includes(f.id)) {
          f.trashed = 0;
          f.folder = f.original_path ? path.basename(path.dirname(f.original_path)) : 'Download';
          f.updated_at = now;
        }
      }
      return { count: trashed.length, restored: trashed };
    }

    const stmt = this.db.prepare('UPDATE pelo_files_index SET trashed = 0, folder = ?, updated_at = ? WHERE id = ?');
    for (const t of trashed) {
      const origFolder = t.originalPath ? path.basename(path.dirname(t.originalPath)) : 'Download';
      stmt.run(origFolder, now, t.id);
    }
    return { count: trashed.length, restored: trashed };
  }

  async emptyTrash() {
    const all = await this.listFiles();
    const trashed = all.filter((f) => f.trashed);
    if (!this.db) {
      this.mem.files = this.mem.files.filter((f) => !f.trashed);
      return { count: trashed.length };
    }
    this.db.prepare('DELETE FROM pelo_files_index WHERE trashed = 1').run();
    return { count: trashed.length };
  }

  async organizeDownloads() {
    const all = await this.listFiles();
    const dl = all.filter((f) => !f.trashed && f.folder === 'Download');
    const bucketMap = { pdf: 'Download/Documents', image: 'Download/Images', apk: 'Download/APKs', archive: 'Download/Archives', temp: 'Download/Temp' };
    const now = new Date().toISOString();

    if (!this.db) {
      for (const f of this.mem.files) {
        if (!f.trashed && f.folder === 'Download') {
          f.folder = bucketMap[f.mime_kind] || 'Download/Other';
          f.updated_at = now;
        }
      }
      return { movedCount: dl.length };
    }

    const stmt = this.db.prepare('UPDATE pelo_files_index SET folder = ?, updated_at = ? WHERE id = ?');
    for (const f of dl) {
      stmt.run(bucketMap[f.mimeKind] || 'Download/Other', now, f.id);
    }
    return { movedCount: dl.length };
  }

  async syncAgentFiles(files = []) {
    if (!Array.isArray(files) || !files.length) return;
    const now = new Date().toISOString();
    if (!this.db) {
      this.mem.files = this.mem.files.filter((f) => f.trashed);
      for (const f of files.slice(0, 80)) {
        this.mem.files.push({
          id: this.mem.seq++, path: f.path, name: f.name, folder: f.folder || 'Download',
          size_bytes: Number(f.sizeBytes || 0), mime_kind: guessMimeKind(f.name), trashed: 0,
          original_path: null, source: 'p40-live-agent', updated_at: now
        });
      }
      return;
    }
    this.db.prepare('DELETE FROM pelo_files_index WHERE trashed = 0').run();
    const ins = this.db.prepare(`
      INSERT INTO pelo_files_index (path, name, folder, size_bytes, mime_kind, trashed, source, updated_at)
      VALUES (?, ?, ?, ?, ?, 0, 'p40-live-agent', ?)
      ON CONFLICT(path) DO UPDATE SET size_bytes = excluded.size_bytes, trashed = 0, updated_at = excluded.updated_at
    `);
    for (const f of files.slice(0, 80)) {
      ins.run(f.path, f.name, f.folder || 'Download', Number(f.sizeBytes || 0), guessMimeKind(f.name), now);
    }
  }

  // COMMS LOG
  async logComm({ channel = 'sms', direction = 'outbound', contactName = '', address = '', body, status = 'sent_direct' }) {
    const now = new Date().toISOString();
    if (!this.db) {
      const row = { id: this.mem.seq++, channel, direction, contact_name: contactName, address, body, status, created_at: now };
      this.mem.comms.push(row);
      return mapCommRow(row);
    }
    const res = this.db.prepare('INSERT INTO pelo_comms_log (channel, direction, contact_name, address, body, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(channel, direction, contactName, address, body, status, now);
    return mapCommRow(this.db.prepare('SELECT * FROM pelo_comms_log WHERE id = ?').get(Number(res.lastInsertRowid)));
  }

  async syncInboxSms(smsArray = []) {
    if (!Array.isArray(smsArray) || !smsArray.length) return;
    for (const item of smsArray.slice(0, 8)) {
      if (!item.body) continue;
      await this.logComm({
        channel: 'sms',
        direction: item.type === 'sent' ? 'outbound' : 'inbound',
        contactName: item.sender || item.number || 'SMS',
        address: item.number || '',
        body: String(item.body).slice(0, 500),
        status: 'synced_p40'
      });
    }
  }

  // BRIDGE QUEUE
  async enqueueBridgeCommand({ commandType, label, payload = {} }) {
    const now = new Date().toISOString();
    if (!this.db) {
      const row = { id: this.mem.seq++, command_type: commandType, label, payload_json: JSON.stringify(payload), result_json: '{}', status: 'pending', created_at: now, executed_at: null };
      this.mem.queue.push(row);
      return mapBridgeRow(row);
    }
    const res = this.db.prepare("INSERT INTO pelo_bridge_queue (command_type, label, payload_json, result_json, status, created_at) VALUES (?, ?, ?, '{}', 'pending', ?)").run(commandType, label, JSON.stringify(payload), now);
    return mapBridgeRow(this.db.prepare('SELECT * FROM pelo_bridge_queue WHERE id = ?').get(Number(res.lastInsertRowid)));
  }

  async pollBridgeCommands(token) {
    const dev = await this.getDeviceState();
    if (token && token !== dev.bridgeToken) return { authorized: false };
    await this.updateDeviceState({ lastBridgePing: new Date().toISOString() });
    if (!this.db) {
      return { authorized: true, commands: this.mem.queue.filter((x) => x.status === 'pending').slice(0, 15).map(mapBridgeRow) };
    }
    const rows = this.db.prepare("SELECT * FROM pelo_bridge_queue WHERE status = 'pending' ORDER BY id ASC LIMIT 15").all();
    return { authorized: true, commands: rows.map(mapBridgeRow) };
  }

  async ackBridgeCommands(ids = [], status = 'executed', result = {}) {
    const cleanIds = ids.map((x) => Number(x)).filter(Boolean);
    if (!cleanIds.length) return { updated: 0 };
    const now = new Date().toISOString();
    if (!this.db) {
      for (const item of this.mem.queue) {
        if (cleanIds.includes(item.id)) {
          item.status = status;
          item.result_json = JSON.stringify(result || {});
          item.executed_at = now;
        }
      }
      return { updated: cleanIds.length };
    }
    const placeholders = cleanIds.map(() => '?').join(',');
    this.db.prepare(`UPDATE pelo_bridge_queue SET status = ?, result_json = ?, executed_at = ? WHERE id IN (${placeholders})`).run(status, JSON.stringify(result || {}), now, ...cleanIds);
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
