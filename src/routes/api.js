const express = require('express');
const { getStore } = require('../store');
const { processCommand, HUAWEI_P40_APPS } = require('../brain');
const { buildHuaweiP40BridgeProfile } = require('../macrodroid');
const { generateHuaweiP40AgentScript } = require('../p40AgentScript');

const router = express.Router();
const bootTime = Date.now();

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// GET /api — Self-documenting API Manifest
router.get('/', wrap(async (req, res) => {
  const store = getStore();
  res.json({
    service: 'PELO Unrestricted Personal AI — Huawei P40 OS API',
    version: '3.0.0',
    targetDevice: 'Huawei P40 (EMUI / HarmonyOS · GMS-Free Ready)',
    storageEngine: store.mode,
    uptimeSeconds: Math.round((Date.now() - bootTime) / 1000),
    capabilities: [
      'Natural-language multi-intent AI command execution',
      'Huawei P40 File Manager (Delete, Clean Junk, Restore Trash, Create, Organize)',
      'Direct Zero-Tap SIM SMS & Inbox Sync + WhatsApp/Telegram/Email Dispatch',
      'Direct Browser Hardware (LED Torch, Haptics, WakeLock, Camera, Alarms)',
      '1-Line Termux Super-Agent (/agent.sh) + MacroDroid Bridge (/api/bridge/*)'
    ]
  });
}));

// GET /api/health
router.get('/health', wrap(async (req, res) => {
  const store = getStore();
  const device = await store.getDeviceState();
  res.json({
    status: 'ok',
    version: '3.0.0',
    storage: store.mode,
    uptimeSeconds: Math.round((Date.now() - bootTime) / 1000),
    deviceModel: device.deviceModel,
    bridgeOnline: device.bridgeOnline,
    godMode: device.godMode
  });
}));

// GET /api/bootstrap
router.get('/bootstrap', wrap(async (req, res) => {
  const store = getStore();
  const data = await store.getBootstrap();
  res.json({ ...data, appsCatalog: HUAWEI_P40_APPS });
}));

// POST /api/command
router.post('/command', wrap(async (req, res) => {
  const { text, telemetry, llmConfig } = req.body || {};
  if (!text || !String(text).trim()) {
    return res.status(400).json({ error: 'Command "text" is required.' });
  }
  const store = getStore();
  const result = await processCommand({
    text: String(text).slice(0, 1000),
    store,
    telemetry: telemetry || {},
    llmConfig: llmConfig || null
  });
  res.json(result);
}));

// PATCH /api/device
router.patch('/device', wrap(async (req, res) => {
  const store = getStore();
  const patch = req.body || {};
  const updated = await store.updateDeviceState(patch);

  const bridgeSettings = ['wifi', 'bluetooth', 'dnd', 'flashlight', 'powerSaver', 'brightness', 'volume'];
  for (const key of bridgeSettings) {
    if (patch[key] !== undefined) {
      await store.enqueueBridgeCommand({
        commandType: `set_${key}`,
        label: `${key.toUpperCase()} → ${typeof patch[key] === 'boolean' ? (patch[key] ? 'ON' : 'OFF') : `${patch[key]}%`}`,
        payload: { setting: key, value: patch[key] }
      });
    }
  }

  const bootstrap = await store.getBootstrap();
  res.json({ device: updated, bridgeQueue: bootstrap.bridgeQueue });
}));

// ============================================================================
// HUAWEI P40 FILE MANAGER ENDPOINTS
// ============================================================================
router.get('/files', wrap(async (req, res) => {
  const store = getStore();
  res.json({ files: await store.listFiles() });
}));

router.post('/files/create', wrap(async (req, res) => {
  const { name, folder = 'Documents', content = '' } = req.body || {};
  if (!name || !String(name).trim()) {
    return res.status(400).json({ error: 'File name is required' });
  }
  const cleanName = String(name).trim().replace(/[\\/]/g, '_');
  const fpath = `/storage/emulated/0/${folder}/${cleanName}`;
  const store = getStore();
  const file = await store.createFileEntry({
    name: cleanName,
    folder,
    sizeBytes: Buffer.byteLength(String(content), 'utf8') || 64,
    path: fpath
  });
  await store.enqueueBridgeCommand({
    commandType: 'file_create',
    label: `Create ${cleanName}`,
    payload: { path: fpath, name: cleanName, content: String(content) }
  });
  res.status(201).json({ file, files: await store.listFiles() });
}));

router.post('/files/delete', wrap(async (req, res) => {
  const { id, query, extension, folder, permanent = false } = req.body || {};
  const store = getStore();
  const delRes = await store.deleteFiles({ id, query, extension, folder, permanent: Boolean(permanent) });

  for (const aff of delRes.affected) {
    await store.enqueueBridgeCommand({
      commandType: 'file_delete',
      label: `${permanent ? 'Shred' : 'Trash'} ${aff.name}`,
      payload: { path: aff.originalPath || aff.path, name: aff.name, permanent: Boolean(permanent) }
    });
  }

  const boot = await store.getBootstrap();
  res.json({ ...delRes, files: boot.files, bridgeQueue: boot.bridgeQueue });
}));

router.post('/files/restore', wrap(async (req, res) => {
  const { id, query } = req.body || {};
  const store = getStore();
  const restRes = await store.restoreFiles({ id, query });
  for (const r of restRes.restored) {
    await store.enqueueBridgeCommand({
      commandType: 'file_restore',
      label: `Restore ${r.name}`,
      payload: { name: r.name }
    });
  }
  const boot = await store.getBootstrap();
  res.json({ ...restRes, files: boot.files, bridgeQueue: boot.bridgeQueue });
}));

router.post('/files/empty-trash', wrap(async (req, res) => {
  const store = getStore();
  const out = await store.emptyTrash();
  await store.enqueueBridgeCommand({ commandType: 'file_empty_trash', label: 'Empty .pelo-trash', payload: {} });
  res.json({ ...out, files: await store.listFiles() });
}));

router.post('/files/organize', wrap(async (req, res) => {
  const store = getStore();
  const out = await store.organizeDownloads();
  await store.enqueueBridgeCommand({ commandType: 'file_organize', label: 'Organize P40 Downloads', payload: {} });
  res.json({ ...out, files: await store.listFiles() });
}));

// ============================================================================
// UNRESTRICTED MESSAGING & COMMS ENDPOINTS
// ============================================================================
router.post('/comms/send', wrap(async (req, res) => {
  const { channel = 'sms', name = '', address = '', body = '' } = req.body || {};
  if (!body || !String(body).trim()) {
    return res.status(400).json({ error: 'Message body is required' });
  }
  const store = getStore();
  const boot = await store.getBootstrap();

  // Resolve contact if name matches saved contacts and address wasn't passed
  let resolvedPhone = String(address || '').trim();
  let resolvedName = String(name || '').trim();
  if (!resolvedPhone && resolvedName) {
    const match = boot.contacts.find((c) => c.name.toLowerCase() === resolvedName.toLowerCase());
    if (match) resolvedPhone = channel === 'whatsapp' ? (match.whatsapp || match.phone) : match.phone;
  }

  const comm = await store.logComm({
    channel,
    direction: 'outbound',
    contactName: resolvedName || resolvedPhone || 'Recipient',
    address: resolvedPhone,
    body: String(body).trim(),
    status: boot.device.bridgeOnline ? 'sent_via_p40_agent' : 'queued_and_ready'
  });

  const cleanDigits = resolvedPhone.replace(/[^\d]/g, '');
  const encBody = encodeURIComponent(String(body).trim());
  let deepLinkUri = `sms:${resolvedPhone}?body=${encBody}`;

  if (channel === 'whatsapp') {
    deepLinkUri = cleanDigits ? `whatsapp://send?phone=${cleanDigits}&text=${encBody}` : `whatsapp://send?text=${encBody}`;
    await store.enqueueBridgeCommand({
      commandType: 'send_whatsapp',
      label: `WhatsApp → ${comm.contactName}`,
      payload: { name: comm.contactName, phone: cleanDigits, message: comm.body }
    });
  } else if (channel === 'telegram') {
    deepLinkUri = `tg://msg?text=${encBody}`;
  } else {
    await store.enqueueBridgeCommand({
      commandType: 'send_sms_direct',
      label: `Direct SIM SMS → ${comm.contactName}`,
      payload: { name: comm.contactName, phone: resolvedPhone, message: comm.body }
    });
  }

  const updated = await store.getBootstrap();
  res.status(201).json({ comm, deepLinkUri, comms: updated.comms, bridgeQueue: updated.bridgeQueue });
}));

// ============================================================================
// ROUTINES, CONTACTS, TASKS, ALARMS, MEMORIES
// ============================================================================
router.post('/routines/:id/run', wrap(async (req, res) => {
  const store = getStore();
  const boot = await store.getBootstrap();
  const routine = boot.routines.find((r) => r.id === Number(req.params.id));
  if (!routine) return res.status(404).json({ error: 'Routine not found' });
  const result = await processCommand({
    text: routine.triggerPhrase,
    store,
    telemetry: req.body?.telemetry || {}
  });
  res.json(result);
}));

router.post('/routines', wrap(async (req, res) => {
  const { name, triggerPhrase, icon, description, steps } = req.body || {};
  if (!name || !triggerPhrase) return res.status(400).json({ error: 'name and triggerPhrase are required' });
  const store = getStore();
  const created = await store.addRoutine({
    name: String(name).slice(0, 60),
    triggerPhrase: String(triggerPhrase).slice(0, 80),
    icon: icon || '⚡',
    description: description || 'Custom voice automation',
    steps: Array.isArray(steps) ? steps : []
  });
  res.status(201).json(created);
}));

router.delete('/routines/:id', wrap(async (req, res) => {
  const store = getStore();
  res.json(await store.deleteRoutine(req.params.id));
}));

router.post('/contacts', wrap(async (req, res) => {
  const { name, relationship, phone, whatsapp, email } = req.body || {};
  if (!name || !String(name).trim()) return res.status(400).json({ error: 'Contact name is required' });
  const store = getStore();
  const created = await store.addContact({
    name: String(name).trim().slice(0, 60),
    relationship: String(relationship || 'Contact').slice(0, 40),
    phone: String(phone || '').trim().slice(0, 32),
    whatsapp: String(whatsapp || phone || '').trim().slice(0, 32),
    email: String(email || '').trim().slice(0, 80)
  });
  res.status(201).json(created);
}));

router.delete('/contacts/:id', wrap(async (req, res) => {
  const store = getStore();
  res.json(await store.deleteContact(req.params.id));
}));

router.post('/tasks', wrap(async (req, res) => {
  const { title, dueText, priority } = req.body || {};
  if (!title || !String(title).trim()) return res.status(400).json({ error: 'Task title is required' });
  const store = getStore();
  const created = await store.addTask({
    title: String(title).trim().slice(0, 200),
    dueText: String(dueText || '').slice(0, 60),
    priority: priority || 'normal'
  });
  res.status(201).json(created);
}));

router.patch('/tasks/:id', wrap(async (req, res) => {
  const store = getStore();
  const updated = await store.updateTask(req.params.id, req.body || {});
  if (!updated) return res.status(404).json({ error: 'Task not found' });
  res.json(updated);
}));

router.delete('/tasks/:id', wrap(async (req, res) => {
  const store = getStore();
  res.json(await store.deleteTask(req.params.id));
}));

router.post('/alarms', wrap(async (req, res) => {
  const { label, timeHhmm, days, kind, durationSec } = req.body || {};
  const store = getStore();
  const isTimer = kind === 'timer';
  const secs = Number(durationSec || 0);
  const created = await store.addAlarm({
    label: String(label || (isTimer ? 'Timer' : 'Alarm')).slice(0, 60),
    timeHhmm: String(timeHhmm || '07:30').slice(0, 12),
    days: String(days || (isTimer ? 'Timer' : 'Daily')).slice(0, 30),
    enabled: true,
    kind: isTimer ? 'timer' : 'alarm',
    durationSec: secs,
    targetEpochMs: isTimer && secs > 0 ? Date.now() + secs * 1000 : null
  });
  res.status(201).json(created);
}));

router.patch('/alarms/:id', wrap(async (req, res) => {
  const store = getStore();
  const updated = await store.updateAlarm(req.params.id, req.body || {});
  if (!updated) return res.status(404).json({ error: 'Alarm not found' });
  res.json(updated);
}));

router.delete('/alarms/:id', wrap(async (req, res) => {
  const store = getStore();
  res.json(await store.deleteAlarm(req.params.id));
}));

router.post('/memories', wrap(async (req, res) => {
  const { category, fact } = req.body || {};
  if (!fact || !String(fact).trim()) return res.status(400).json({ error: 'Memory fact is required' });
  const store = getStore();
  const created = await store.addMemory({
    category: String(category || 'personal').slice(0, 30),
    fact: String(fact).trim().slice(0, 400)
  });
  res.status(201).json(created);
}));

router.delete('/memories/:id', wrap(async (req, res) => {
  const store = getStore();
  res.json(await store.deleteMemory(req.params.id));
}));

router.delete('/messages', wrap(async (req, res) => {
  const store = getStore();
  const welcome = await store.clearMessages();
  res.json({ cleared: true, welcome });
}));

// ============================================================================
// HUAWEI P40 SUPER-AGENT & MACRODROID BRIDGE
// ============================================================================
router.get('/bridge/poll', wrap(async (req, res) => {
  const store = getStore();
  const result = await store.pollBridgeCommands(req.query.token);
  if (!result.authorized) return res.status(401).json({ error: 'Invalid Huawei P40 bridge token' });
  res.json({ status: 'ok', count: result.commands.length, commands: result.commands });
}));

router.post('/bridge/ack', wrap(async (req, res) => {
  const { token, ids, status, result } = req.body || {};
  const store = getStore();
  const dev = await store.getDeviceState();
  if (token && token !== dev.bridgeToken) return res.status(401).json({ error: 'Invalid bridge token' });
  const ackRes = await store.ackBridgeCommands(Array.isArray(ids) ? ids : [], status || 'executed', result || {});
  res.json({ status: 'ok', ...ackRes });
}));

router.post('/bridge/sync', wrap(async (req, res) => {
  const { token, batteryLevel, charging, storageUsedGb, files, inboxSms } = req.body || {};
  const store = getStore();
  const dev = await store.getDeviceState();
  if (token !== dev.bridgeToken) return res.status(401).json({ error: 'Invalid bridge token' });

  const patch = { lastBridgePing: new Date().toISOString() };
  if (typeof batteryLevel === 'number') patch.batteryLevel = batteryLevel;
  if (typeof charging === 'boolean') patch.charging = charging;
  if (typeof storageUsedGb === 'number') patch.storageUsedGb = storageUsedGb;
  await store.updateDeviceState(patch);

  if (Array.isArray(files) && files.length) await store.syncAgentFiles(files);
  if (Array.isArray(inboxSms) && inboxSms.length) await store.syncInboxSms(inboxSms);

  res.json({ status: 'synced' });
}));

router.post('/bridge/test', wrap(async (req, res) => {
  const store = getStore();
  const queued = await store.enqueueBridgeCommand({
    commandType: 'find_my_phone',
    label: 'Huawei P40 Super-Agent Beacon Test',
    payload: { vibrate: true }
  });
  res.status(201).json(queued);
}));

router.get('/bridge/macrodroid', wrap(async (req, res) => {
  const store = getStore();
  const dev = await store.getDeviceState();
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'pelo-lite-five.vercel.app';
  const baseUrl = `${proto}://${host}`;

  const profile = buildHuaweiP40BridgeProfile({ baseUrl, bridgeToken: dev.bridgeToken });
  res.setHeader('Content-Disposition', 'attachment; filename="Pelo-Huawei-P40-Bridge.json"');
  res.json(profile);
}));

router.get('/bridge/agent.sh', wrap(async (req, res) => {
  const store = getStore();
  const dev = await store.getDeviceState();
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'pelo-lite-five.vercel.app';
  const baseUrl = `${proto}://${host}`;

  const script = generateHuaweiP40AgentScript({ baseUrl, bridgeToken: dev.bridgeToken });
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.send(script);
}));

module.exports = router;
