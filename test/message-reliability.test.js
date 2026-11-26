import test from 'node:test';
import assert from 'node:assert/strict';
import {
  syncWithServer, dispatchOfflineAction, loadVault, loadOutbox
} from '../public/js/offlineStore.js';

function message(id) {
  return { type: 'SEND_MESSAGE', payload: {
    id, room_id: 'test-room', sender_id: 'test-user', sender_name: 'Test',
    body: id, created_at: new Date().toISOString(), attachments: []
  } };
}

function storage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value))
  };
}

function deferred() {
  let resolve;
  const promise = new Promise((r) => { resolve = r; });
  return { promise, resolve };
}

const response = (messages = []) => new Response(JSON.stringify({ messages }), {
  status: 200, headers: { 'Content-Type': 'application/json' }
});

test('messages stay queued on failure and retry successfully', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response('Save failed', { status: 500 }));
  const previous = globalThis.localStorage;
  globalThis.localStorage = storage();
  t.after(() => { globalThis.localStorage = previous; });
  dispatchOfflineAction(loadVault(), message('retry-me'));
  const failed = await syncWithServer();
  assert.equal(failed.status, 'offline');
  assert.equal(loadOutbox().length, 1);
  assert.ok(loadVault().messages.some((m) => m.id === 'retry-me'));

  globalThis.fetch.mock.mockImplementation(async () => response([message('retry-me').payload]));
  assert.equal((await syncWithServer()).status, 'synced');
  assert.equal(loadOutbox().length, 0);
});

test('concurrent sync calls share one request and flush messages added in flight', async (t) => {
  const previous = globalThis.localStorage;
  globalThis.localStorage = storage();
  t.after(() => { globalThis.localStorage = previous; });
  const started = deferred();
  const release = deferred();
  let calls = 0;
  let inFlight = 0;
  let maxInFlight = 0;
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    calls++;
    maxInFlight = Math.max(maxInFlight, ++inFlight);
    if (calls === 1) {
      started.resolve();
      await release.promise;
      inFlight--;
      return response();
    }
    const body = JSON.parse(options.body);
    assert.equal(body.actions[0].payload.id, 'during-request');
    inFlight--;
    return response([message('during-request').payload]);
  });
  const first = syncWithServer();
  await started.promise;
  const others = Array.from({ length: 10 }, () => syncWithServer());
  assert.ok(others.every((p) => p === first));
  dispatchOfflineAction(loadVault(), message('during-request'));
  release.resolve();
  const results = await Promise.all([first, ...others]);
  assert.ok(results.every((r) => r.status === 'synced'));
  assert.equal(calls, 2);
  assert.equal(maxInFlight, 1);
  assert.equal(loadOutbox().length, 0);
  assert.ok(loadVault().messages.some((m) => m.id === 'during-request'));
});

test('configured cloud outages and rejected writes must not acknowledge local delivery', async (t) => {
  const previousUrl = process.env.SUPABASE_URL;
  const previousKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.SUPABASE_URL = 'https://example.invalid';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-only';
  t.after(() => {
    if (previousUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = previousKey;
  });
  t.mock.method(globalThis, 'fetch', async () => new Response('Unavailable', { status: 503 }));
  const backend = await import(`../src/syncBackend.js?reliability=${Date.now()}`);
  await assert.rejects(backend.getFullSnapshot(), /503/);
  // Mode detection recovers, but a rejected message write still rejects the batch.
  globalThis.fetch.mock.mockImplementation(async (_url, options) => {
    if (options.method === 'POST') return new Response('Rejected', { status: 400 });
    return response();
  });
  await assert.rejects(backend.applyOutboxActions([message('rejected')]), /Cloud save failed/);
  globalThis.fetch.mock.mockImplementation(async () => new Response('Unavailable', { status: 503 }));
  await assert.rejects(backend.getFullSnapshot(), /503/);
});
