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

describe('PELO v3 Unrestricted Personal AI — Huawei P40 Suite', () => {
  let bridgeToken = '';

  it('serves v3 PWA shell, manifest, and /agent.sh Huawei P40 installer', async () => {
    const home = await req('/');
    assert.equal(home.status, 200);
    assert.match(home.data, /PELO v3 — Unrestricted Personal AI/);

    const boot = await req('/api/bootstrap');
    assert.equal(boot.status, 200);
    assert.ok(boot.data.files.length >= 5);
    assert.ok(boot.data.comms.length >= 2);
    bridgeToken = boot.data.device.bridgeToken;

    const agentSh = await req('/agent.sh');
    assert.equal(agentSh.status, 200);
    assert.match(agentSh.data, /PELO SUPER-AGENT FOR HUAWEI P40/);
    assert.match(agentSh.data, new RegExp(bridgeToken));
  });

  it('deletes files to .pelo-trash and restores them via natural language', async () => {
    const del = await req('/api/command', {
      method: 'POST',
      body: { text: 'Delete all .apk files' }
    });
    assert.equal(del.status, 200);
    assert.match(del.data.reply, /macrodroid-old-installer\.apk/);
    const trashedApk = del.data.bootstrap.files.find((f) => f.name === 'macrodroid-old-installer.apk');
    assert.equal(trashedApk.trashed, true);

    const rest = await req('/api/command', {
      method: 'POST',
      body: { text: 'Undo delete' }
    });
    assert.equal(rest.status, 200);
    const restoredApk = rest.data.bootstrap.files.find((f) => f.name === 'macrodroid-old-installer.apk');
    assert.equal(restoredApk.trashed, false);
  });

  it('dispatches direct SIM SMS, WhatsApp, and reply-to-last-message via voice/text', async () => {
    const sms = await req('/api/command', {
      method: 'POST',
      body: { text: "Send SMS to Mom saying I'm 10 minutes away" }
    });
    assert.equal(sms.status, 200);
    assert.ok(sms.data.bootstrap.comms.some((c) => c.body.includes('10 minutes away') && c.channel === 'sms'));
    assert.ok(sms.data.bootstrap.bridgeQueue.some((q) => q.commandType === 'send_sms_direct'));

    const reply = await req('/api/command', {
      method: 'POST',
      body: { text: 'Reply to last message saying Sounds good!' }
    });
    assert.equal(reply.status, 200);
    assert.ok(reply.data.bootstrap.comms.some((c) => c.body === 'Sounds good!'));
  });

  it('executes compound commands, Petal Maps, shell exec, and bridge ack with output', async () => {
    const shell = await req('/api/command', {
      method: 'POST',
      body: { text: 'Run command df -h' }
    });
    assert.equal(shell.status, 200);
    const poll = await req(`/api/bridge/poll?token=${bridgeToken}`);
    assert.equal(poll.status, 200);
    assert.ok(poll.data.commands.some((c) => c.commandType === 'shell_exec'));

    const ids = poll.data.commands.map((c) => c.id);
    const ack = await req('/api/bridge/ack', {
      method: 'POST',
      body: { token: bridgeToken, ids, result: { output: '/dev/block/sda 128G 58G 70G 46% /storage/emulated/0' } }
    });
    assert.equal(ack.status, 200);
    assert.equal(ack.data.updated, ids.length);
  });
});
