const express = require('express');
const { getStore } = require('../store');
const { processCommand, HUAWEI_P40_APPS } = require('../brain');
const { buildHuaweiP40BridgeProfile } = require('../macrodroid');

const router = express.Router();
const bootTime = Date.now();

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// GET /api — Self-documenting API Manifest
router.get('/', wrap(async (req, res) => {
  const store = getStore();
  res.json({
    service: 'PELO Personal AI — Huawei P40 Phone Control API',
    version: '2.0.0',
    targetDevice: 'Huawei P40 (EMUI / HarmonyOS · GMS-Free Ready)',
    storageEngine: store.mode,
    uptimeSeconds: Math.round((Date.now() - bootTime) / 1000),
    supportedApps: Object.keys(HUAWEI_P40_APPS),
    endpoints: [
      { method: 'GET', path: '/api/health', description: 'Service & database health status' },
      { method: 'GET', path: '/api/bootstrap', description: 'Full device state, chat stream, contacts, tasks, alarms, memories, routines & bridge queue' },
      { method: 'POST', path: '/api/command', description: 'Execute natural-language AI command { text, telemetry, llmConfig }' },
      { method: 'PATCH', path: '/api/device', description: 'Toggle hardware states & sliders directly' },
      { method: 'POST', path: '/api/routines/:id/run', description: 'Run a multi-step Huawei P40 automation routine' },
      { method: 'POST', path: '/api/routines', description: 'Create a custom voice routine' },
      { method: 'DELETE', path: '/api/routines/:id', description: 'Delete a routine' },
      { method: 'POST', path: '/api/contacts', description: 'Save a speed-dial / WhatsApp contact' },
      { method: 'DELETE', path: '/api/contacts/:id', description: 'Remove a contact' },
      { method: 'POST', path: '/api/tasks', description: 'Create a reminder / task' },
      { method: 'PATCH', path: '/api/tasks/:id', description: 'Toggle task completion' },
      { method: 'DELETE', path: '/api/tasks/:id', description: 'Delete a task' },
      { method: 'POST', path: '/api/alarms', description: 'Create an alarm or countdown timer' },
      { method: 'PATCH', path: '/api/alarms/:id', description: 'Toggle alarm enabled state' },
      { method: 'DELETE', path: '/api/alarms/:id', description: 'Delete an alarm/timer' },
      { method: 'POST', path: '/api/memories', description: 'Store a personal AI memory fact' },
      { method: 'DELETE', path: '/api/memories/:id', description: 'Delete a memory fact' },
      { method: 'DELETE', path: '/api/messages', description: 'Clear chat history' },
      { method: 'GET', path: '/api/bridge/poll', description: 'Poll pending OS commands from MacroDroid/Tasker on Huawei P40' },
      { method: 'POST', path: '/api/bridge/ack', description: 'Acknowledge executed commands from Huawei P40' },
      { method: 'POST', path: '/api/bridge/test', description: 'Enqueue a live test pulse to verify P40 bridge connection' },
      { method: 'GET', path: '/api/bridge/macrodroid', description: 'Download pre-configured Huawei P40 MacroDroid bridge blueprint' }
    ]
  });
}));

// GET /api/health
router.get('/health', wrap(async (req, res) => {
  const store = getStore();
  const device = await store.getDeviceState();
  res.json({
    status: 'ok',
    storage: store.mode,
    uptimeSeconds: Math.round((Date.now() - bootTime) / 1000),
    deviceModel: device.deviceModel,
    bridgeOnline: device.bridgeOnline
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

  // Enqueue hardware/OS sync commands for toggled settings
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

// POST /api/routines/:id/run
router.post('/routines/:id/run', wrap(async (req, res) => {
  const store = getStore();
  const boot = await store.getBootstrap();
  const routine = boot.routines.find((r) => r.id === Number(req.params.id));
  if (!routine) {
    return res.status(404).json({ error: 'Routine not found' });
  }
  const result = await processCommand({
    text: routine.triggerPhrase,
    store,
    telemetry: req.body?.telemetry || {}
  });
  res.json(result);
}));

// POST /api/routines
router.post('/routines', wrap(async (req, res) => {
  const { name, triggerPhrase, icon, description, steps } = req.body || {};
  if (!name || !triggerPhrase) {
    return res.status(400).json({ error: 'name and triggerPhrase are required' });
  }
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

// DELETE /api/routines/:id
router.delete('/routines/:id', wrap(async (req, res) => {
  const store = getStore();
  res.json(await store.deleteRoutine(req.params.id));
}));

// Contacts CRUD
router.post('/contacts', wrap(async (req, res) => {
  const { name, relationship, phone, whatsapp, email } = req.body || {};
  if (!name || !String(name).trim()) {
    return res.status(400).json({ error: 'Contact name is required' });
  }
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

// Tasks CRUD
router.post('/tasks', wrap(async (req, res) => {
  const { title, dueText, priority } = req.body || {};
  if (!title || !String(title).trim()) {
    return res.status(400).json({ error: 'Task title is required' });
  }
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

// Alarms & Timers CRUD
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

// Personal AI Memories CRUD
router.post('/memories', wrap(async (req, res) => {
  const { category, fact } = req.body || {};
  if (!fact || !String(fact).trim()) {
    return res.status(400).json({ error: 'Memory fact is required' });
  }
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

// Clear Messages
router.delete('/messages', wrap(async (req, res) => {
  const store = getStore();
  const welcome = await store.clearMessages();
  res.json({ cleared: true, welcome });
}));

// Huawei P40 Native System Bridge Queue
router.get('/bridge/poll', wrap(async (req, res) => {
  const store = getStore();
  const result = await store.pollBridgeCommands(req.query.token);
  if (!result.authorized) {
    return res.status(401).json({ error: 'Invalid Huawei P40 bridge token' });
  }
  res.json({
    status: 'ok',
    count: result.commands.length,
    commands: result.commands
  });
}));

router.post('/bridge/ack', wrap(async (req, res) => {
  const { token, ids, status } = req.body || {};
  const store = getStore();
  const dev = await store.getDeviceState();
  if (token && token !== dev.bridgeToken) {
    return res.status(401).json({ error: 'Invalid bridge token' });
  }
  const ackRes = await store.ackBridgeCommands(Array.isArray(ids) ? ids : [], status || 'executed');
  res.json({ status: 'ok', ...ackRes });
}));

router.post('/bridge/test', wrap(async (req, res) => {
  const store = getStore();
  const queued = await store.enqueueBridgeCommand({
    commandType: 'test_ping',
    label: 'Huawei P40 Bridge Handshake Ping',
    payload: { vibrate: true, speak: 'Pelo bridge connected to your Huawei P40' }
  });
  res.status(201).json(queued);
}));

router.get('/bridge/macrodroid', wrap(async (req, res) => {
  const store = getStore();
  const dev = await store.getDeviceState();
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'pelo-lite-five.vercel.app';
  const baseUrl = `${proto}://${host}`;

  const profile = buildHuaweiP40BridgeProfile({
    baseUrl,
    bridgeToken: dev.bridgeToken
  });

  res.setHeader('Content-Disposition', 'attachment; filename="Pelo-Huawei-P40-Bridge.json"');
  res.json(profile);
}));

module.exports = router;
