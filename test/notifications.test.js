import test from 'node:test';
import assert from 'node:assert/strict';
import { createMessageTracker, getAlertSettings, saveAlertSettings } from '../public/js/notifications.js';

const msg = (id, sender_id = 'teacher', room_id = 'allowed') => ({ id, sender_id, room_id, body: id });
const rooms = new Set(['allowed']);

test('initial history is silent, only new incoming messages in visible rooms alert', () => {
  const track = createMessageTracker();
  const history = [msg('old')];
  assert.deepEqual(track('student', history, rooms), []);
  const incoming = msg('new');
  const snapshot = [...history, incoming, msg('own', 'student'), msg('private', 'teacher', 'other')];
  assert.deepEqual(track('student', snapshot, rooms), [incoming]);
  assert.deepEqual(track('student', snapshot, rooms), []);
  assert.deepEqual(track('student', snapshot.map((m) => ({ ...m, body: 'edited' })), rooms), []);
  assert.deepEqual(track('student', [incoming], rooms), []);
});

test('switching accounts and signing out resets alert history without replay', () => {
  const track = createMessageTracker();
  track('student', [], rooms);
  assert.deepEqual(track('parent', [msg('old')], rooms), []);
  assert.deepEqual(track(null, [msg('old'), msg('signed-out')], rooms), []);
  assert.deepEqual(track('student', [msg('old'), msg('signed-out')], rooms), []);
  assert.deepEqual(track('student', [msg('brand-new')], rooms), [msg('brand-new')]);
});

test('notification preferences persist separately per account and tolerate blocked storage', (t) => {
  const previous = globalThis.localStorage;
  const values = new Map();
  globalThis.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value)
  };
  t.after(() => { globalThis.localStorage = previous; });
  assert.deepEqual(getAlertSettings('a'), { enabled: true, sound: true, browser: false });
  saveAlertSettings('a', { enabled: false, sound: false, browser: true });
  assert.equal(getAlertSettings('a').sound, false);
  assert.equal(getAlertSettings('b').sound, true);
  globalThis.localStorage = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  assert.equal(getAlertSettings('a').enabled, true);
  assert.doesNotThrow(() => saveAlertSettings('a', { sound: false }));
});
