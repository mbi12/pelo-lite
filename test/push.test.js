import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { createPushService, canReceiveRoomPush, validateSubscription, hash } from '../src/pushService.js';

const env = {
  VAPID_PUBLIC_KEY: 'test-public', VAPID_PRIVATE_KEY: 'test-private', VAPID_SUBJECT: 'https://example.com',
  PUSH_APP_ORIGIN: 'https://example.com', SUPABASE_URL: 'https://database.invalid', SUPABASE_SERVICE_ROLE_KEY: 'test-only'
};
const subscription = {
  endpoint: 'https://fcm.googleapis.com/fcm/send/test-device',
  keys: { p256dh: Buffer.alloc(65, 4).toString('base64url'), auth: Buffer.alloc(16, 1).toString('base64url') }
};
const profile = (id, role = 'student', extra = {}) => ({ id, role, status: 'active', subjects: ['Mathematics'], ...extra });
const direct = { id: 'room', room_type: 'direct', participant_ids: ['sender', 'student', 'parent'] };
const action = { type: 'SEND_MESSAGE', payload: { id: 'message' } };

function harness(send = async () => {}) {
  const claims = new Set();
  const removed = [];
  let saved;
  const endpoints = ['sender', 'student', 'parent', 'outsider', 'suspended'].map((id) => ({
    endpoint_hash: hash(id), user_id: id, subscription, sound: id !== 'parent'
  }));
  const db = async (path, options = {}) => {
    if (path.startsWith('itutor_v2_profiles?')) return [{ id: 'student', pin: 'correct', status: 'active' }];
    if (path === 'itutor_push_subscriptions?on_conflict=endpoint_hash') { saved = options.body; return null; }
    if (path.startsWith('itutor_push_subscriptions?') && options.method === 'DELETE') { removed.push(path); return null; }
    if (path.startsWith('itutor_push_subscriptions?')) return endpoints;
    if (path.startsWith('itutor_v2_messages?')) return [{ id: 'message', sender_id: 'sender', room_id: 'room' }];
    if (path.startsWith('itutor_push_deliveries?on_conflict=')) {
      const key = `${options.body.message_id}:${options.body.endpoint_hash}`;
      if (claims.has(key)) return [];
      claims.add(key);
      return [options.body];
    }
    if (path.startsWith('itutor_push_deliveries?') && options.method === 'DELETE') {
      const params = new URLSearchParams(path.split('?')[1]);
      claims.delete(`${params.get('message_id').slice(3)}:${params.get('endpoint_hash').slice(3)}`);
      return null;
    }
    throw new Error(`Unexpected database query: ${path}`);
  };
  return {
    service: createPushService({ db, send, env }), removed,
    get saved() { return saved; },
    snapshot: { backend: 'supabase', rooms: [direct], profiles: [profile('sender'), profile('student'),
      profile('parent', 'parent'), profile('outsider'), profile('suspended', 'student', { status: 'suspended' })] }
  };
}

test('push subscription authorization rejects impersonation and invalid origins', async () => {
  const h = harness();
  const request = { userId: 'student', pin: 'correct', deviceToken: 'a'.repeat(64), subscription, requestOrigin: 'https://example.com' };
  await assert.rejects(h.service.subscribe({ ...request, pin: 'wrong' }), { status: 401 });
  await assert.rejects(h.service.subscribe({ ...request, requestOrigin: 'https://evil.invalid' }), { status: 403 });
  await assert.rejects(h.service.subscribe({ ...request, deviceToken: 'bad' }), { status: 400 });
  await h.service.subscribe(request);
  assert.equal(h.saved.user_id, 'student');
  assert.equal(h.saved.token_hash, hash(request.deviceToken));
  assert.equal(h.saved.endpoint_hash, hash(subscription.endpoint));
  assert.equal(h.saved.pin, undefined);
  assert.equal(h.service.publicConfig().privateKey, undefined);
  await h.service.unsubscribe({ endpoint: subscription.endpoint, deviceToken: request.deviceToken });
  assert.ok(h.removed[0].includes(`token_hash=eq.${hash(request.deviceToken)}`));
});

test('push endpoint validation blocks arbitrary servers, insecure URLs and invalid keys', () => {
  for (const endpoint of ['http://fcm.googleapis.com/x', 'https://127.0.0.1/x',
    'https://fcm.googleapis.com.evil.invalid/x', 'https://user:pass@fcm.googleapis.com/x',
    'https://fcm.googleapis.com:8443/x']) {
    assert.throws(() => validateSubscription({ ...subscription, endpoint }), { status: 400 });
  }
  assert.throws(() => validateSubscription({ ...subscription, keys: {} }), { status: 400 });
  assert.deepEqual(validateSubscription(subscription), subscription);
});

test('room recipient rules exclude unrelated and suspended accounts, parents from student groups', () => {
  const group = { room_type: 'group', subject: 'Mathematics', participant_ids: ['parent'] };
  assert.equal(canReceiveRoomPush(profile('student'), group), true);
  assert.equal(canReceiveRoomPush(profile('teacher', 'teacher'), group), true);
  assert.equal(canReceiveRoomPush(profile('all', 'student', { subjects: ['All Subjects'] }), group), true);
  assert.equal(canReceiveRoomPush(profile('other', 'student', { subjects: ['English'] }), group), false);
  assert.equal(canReceiveRoomPush(profile('parent', 'parent'), group), false);
  assert.equal(canReceiveRoomPush(profile('admin', 'admin'), direct), true);
  assert.equal(canReceiveRoomPush(profile('student', 'student', { status: 'suspended' }), direct), false);
});

test('saved incoming messages notify recipients once, without exposing private text', async () => {
  const sent = [];
  const h = harness(async (_subscription, payload, options) => sent.push({ payload: JSON.parse(payload), options }));
  await h.service.notifyMessages([action], h.snapshot);
  await h.service.notifyMessages([action], h.snapshot);
  assert.equal(sent.length, 2); // student + parent; not sender, outsider, suspended
  assert.ok(sent.every((item) => item.payload.id === 'message' && !item.payload.body && !item.payload.sender_name));
  assert.equal(sent[1].payload.sound, false);
  assert.equal(sent[0].options.TTL, 86400);
  await h.service.notifyMessages([{ type: 'UPSERT_MESSAGE', payload: { id: 'message' } }], h.snapshot);
  assert.equal(sent.length, 2);
  await h.service.notifyMessages([action], { ...h.snapshot, backend: 'local' });
  assert.equal(sent.length, 2);
});

test('expired devices are removed and temporary provider failures can retry on sync resend', async () => {
  let sent = 0;
  const expired = harness(async () => { throw Object.assign(new Error('Gone'), { statusCode: 410 }); });
  await expired.service.notifyMessages([action], expired.snapshot);
  assert.equal(expired.removed.length, 2);
  const temporary = harness(async () => { if (++sent <= 2) throw new Error('temporary'); });
  await temporary.service.notifyMessages([action], temporary.snapshot);
  await temporary.service.notifyMessages([action], temporary.snapshot);
  assert.equal(sent, 4);
});

test('unconfigured push is explicit and never interferes with saved messages', async () => {
  const service = createPushService({ db() { throw new Error('must not query'); }, env: {} });
  assert.deepEqual(service.publicConfig(), { enabled: false, publicKey: null });
  await assert.rejects(service.subscribe({}), { status: 503 });
  await service.notifyMessages([action], {});
});

test('service worker handles push with no app window, and notification tap opens Messages', async () => {
  const handlers = new Map();
  const displayed = [];
  const opened = [];
  const self = {
    addEventListener: (type, fn) => handlers.set(type, fn), location: { origin: 'https://example.com' },
    registration: { showNotification: async (...args) => displayed.push(args) },
    clients: { matchAll: async () => [], openWindow: async (url) => opened.push(url) }
  };
  vm.runInNewContext(readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8'), { self, URL });
  let done;
  handlers.get('push')({ data: { json: () => ({ sound: true }) }, waitUntil: (promise) => { done = promise; } });
  await done;
  assert.equal(displayed.length, 1);
  assert.equal(displayed[0][1].silent, false);
  handlers.get('notificationclick')({ notification: { close() {} }, waitUntil: (promise) => { done = promise; } });
  await done;
  assert.deepEqual(opened, ['/?view=messages']);
});
