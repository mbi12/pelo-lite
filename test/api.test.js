process.env.DB_PATH = ':memory:';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const app = require('../server');

let server;
let baseUrl;

before(async () => {
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}`;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
});

async function req(path, options = {}) {
  const res = await fetch(`${baseUrl}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const contentType = res.headers.get('content-type') || '';
  const data = contentType.includes('json') ? await res.json() : await res.text();
  return { status: res.status, data };
}

describe('PELO Personal AI — Huawei P40 Phone Controller Suite', () => {
  let bridgeToken = '';

  it('serves PWA shell, manifest, and service worker cleanly', async () => {
    const home = await req('/');
    assert.equal(home.status, 200);
    assert.match(home.data, /PELO — Personal AI OS · Huawei P40 Edition/);

    const manifest = await req('/manifest.webmanifest');
    assert.equal(manifest.status, 200);
    assert.equal(manifest.data.short_name, 'Pelo AI');
  });

  it('returns healthy status and seeded Huawei P40 bootstrap payload', async () => {
    const health = await req('/api/health');
    assert.equal(health.status, 200);
    assert.equal(health.data.status, 'ok');

    const boot = await req('/api/bootstrap');
    assert.equal(boot.status, 200);
    assert.equal(boot.data.routines.length, 5);
    assert.ok(boot.data.appsCatalog.petal_maps);
    assert.ok(boot.data.appsCatalog.appgallery);
    bridgeToken = boot.data.device.bridgeToken;
    assert.match(bridgeToken, /^p40-/);
  });

  it('executes compound natural-language commands joined with "nd"', async () => {
    const res = await req('/api/command', {
      method: 'POST',
      body: {
        text: 'Turn on flashlight nd set brightness to 35% nd set a 2 min timer',
        telemetry: { batteryLevel: 91, charging: true }
      }
    });
    assert.equal(res.status, 200);
    assert.equal(res.data.bootstrap.device.flashlight, true);
    assert.equal(res.data.bootstrap.device.brightness, 35);
    assert.equal(res.data.bootstrap.device.batteryLevel, 91);
    assert.ok(res.data.actions.some((a) => a.type === 'timer_started'));
  });

  it('resolves Petal Maps navigation and WhatsApp contact deep-links', async () => {
    const nav = await req('/api/command', {
      method: 'POST',
      body: { text: 'Navigate to Dam Square' }
    });
    assert.equal(nav.status, 200);
    const mapAct = nav.data.actions.find((a) => a.type === 'deep_link');
    assert.ok(mapAct);
    assert.match(mapAct.intentUri, /com\.petalmaps\.app/);

    const wa = await req('/api/command', {
      method: 'POST',
      body: { text: "WhatsApp Mom I'm 5 minutes away" }
    });
    assert.equal(wa.status, 200);
    const waAct = wa.data.actions.find((a) => a.type === 'deep_link');
    assert.ok(waAct);
    assert.match(waAct.uri, /whatsapp:\/\/send\?phone=31600000001/);
  });

  it('stores and recalls personal memories via voice/text', async () => {
    await req('/api/command', {
      method: 'POST',
      body: { text: 'Remember my bike lock code is 4920' }
    });

    const recall = await req('/api/command', {
      method: 'POST',
      body: { text: 'What is my bike lock code?' }
    });
    assert.equal(recall.status, 200);
    assert.match(recall.data.reply, /4920/);
  });

  it('polls, validates, and acknowledges Huawei P40 MacroDroid bridge commands', async () => {
    const unauth = await req('/api/bridge/poll?token=wrong-token');
    assert.equal(unauth.status, 401);

    const poll = await req(`/api/bridge/poll?token=${bridgeToken}`);
    assert.equal(poll.status, 200);
    assert.ok(poll.data.commands.length >= 2);

    const ids = poll.data.commands.map((c) => c.id);
    const ack = await req('/api/bridge/ack', {
      method: 'POST',
      body: { token: bridgeToken, ids }
    });
    assert.equal(ack.status, 200);
    assert.equal(ack.data.updated, ids.length);

    const pollAfter = await req(`/api/bridge/poll?token=${bridgeToken}`);
    assert.equal(pollAfter.data.commands.length, 0);

    const blueprint = await req('/api/bridge/macrodroid');
    assert.equal(blueprint.status, 200);
    assert.match(blueprint.data.endpoints.pollPendingCommands, new RegExp(bridgeToken));
  });
});
