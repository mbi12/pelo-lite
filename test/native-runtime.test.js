import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { apiFetch, isNativeApp, resolveApiUrl, DEFAULT_API_ORIGIN, initializeNativeApp } from '../public/js/nativeRuntime.js';
import { enableClosedAppNotifications, disableClosedAppNotifications } from '../public/js/notifications.js';

test('native API routing changes only backend paths, never bundled assets or upload URLs', () => {
  assert.equal(resolveApiUrl('/api/sync?uid=student', true), `${DEFAULT_API_ORIGIN}/api/sync?uid=student`);
  assert.equal(resolveApiUrl('/api/media/file.pdf', true), `${DEFAULT_API_ORIGIN}/api/media/file.pdf`);
  for (const value of ['/samples/worksheet.pdf', '/vendor/pdfjs/pdf.min.js', '/assets/icon-192.png',
    'https://storage.example.com/signed-upload', 'data:application/pdf;base64,abc', 'blob:example', '//example.com/file']) {
    assert.equal(resolveApiUrl(value, true), value);
  }
  assert.equal(resolveApiUrl('/api/sync', false), '/api/sync');
});

test('native fetch reaches the live HTTPS API and preserves bodies and abort signals', async (t) => {
  const previous = globalThis.Capacitor;
  globalThis.Capacitor = { isNativePlatform: () => true };
  t.after(() => { globalThis.Capacitor = previous; });
  const options = { method: 'POST', body: new Blob(['file']), signal: new AbortController().signal };
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    assert.equal(url, `${DEFAULT_API_ORIGIN}/api/upload?name=file.pdf`);
    assert.equal(init, options);
    return new Response('{}');
  });
  assert.equal(isNativeApp(), true);
  await apiFetch('/api/upload?name=file.pdf', options);
});

test('browser remains unchanged and does not load native plugins', async (t) => {
  const previous = globalThis.Capacitor;
  delete globalThis.Capacitor;
  t.after(() => { globalThis.Capacitor = previous; });
  assert.equal(isNativeApp(), false);
  t.mock.method(globalThis, 'fetch', async (url) => {
    assert.equal(url, '/api/sync');
    return new Response('{}');
  });
  await apiFetch('/api/sync');
  await initializeNativeApp();
});

test('native notification controls never pretend browser Web Push works inside the APK', async (t) => {
  const previous = globalThis.Capacitor;
  globalThis.Capacitor = { isNativePlatform: () => true };
  t.after(() => { globalThis.Capacitor = previous; });
  await assert.rejects(enableClosedAppNotifications({ id: 'student' }), /Firebase/);
  await disableClosedAppNotifications();
});

test('Android package bundles web assets instead of remotely loading the website', () => {
  const config = JSON.parse(readFileSync(new URL('../capacitor.config.json', import.meta.url), 'utf8'));
  assert.equal(config.appId, 'app.itutor.academy');
  assert.equal(config.webDir, 'mobile-www');
  assert.equal(config.server.url, undefined);
  assert.equal(config.android.allowMixedContent, false);
  const manifest = readFileSync(new URL('../android/app/src/main/AndroidManifest.xml', import.meta.url), 'utf8');
  assert.match(manifest, /android:allowBackup="false"/);
  assert.match(manifest, /android:usesCleartextTraffic="false"/);
  assert.match(manifest, /android.permission.INTERNET/);
  assert.doesNotMatch(manifest, /MANAGE_EXTERNAL_STORAGE|READ_CONTACTS|ACCESS_FINE_LOCATION/);
});
