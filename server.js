import express from 'express';
import { createPushService } from './src/pushService.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  sbFetch,
  getFullSnapshot,
  applyOutboxActions,
  touchUserPresence,
  createSignedUploadTarget,
  uploadBinaryMedia,
  readLocalUploadedMedia
} from './src/syncBackend.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createApp() {
  const app = express();
  const push = createPushService({ db: sbFetch });
  app.disable('x-powered-by');

  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-File-Name');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });

  app.post('/api/upload', express.raw({ type: '*/*', limit: '50mb' }), async (req, res) => {
    try {
      const fileName = String(req.query.name || req.headers['x-file-name'] || 'upload.bin');
      const contentType = String(req.headers['content-type'] || 'application/octet-stream');
      const buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || '');
      const result = await uploadBinaryMedia({ fileName, contentType, buffer });
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message || 'Media upload failed' });
    }
  });

  app.get('/api/media/:name', (req, res) => {
    const found = readLocalUploadedMedia(req.params.name);
    if (!found) return res.status(404).send('Media not found');
    res.setHeader('Content-Type', found.contentType);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    return res.send(found.buffer);
  });

  app.use(express.json({ limit: '6mb' }));

  app.get('/api/push/config', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json(push.publicConfig());
  });

  // Browser permission alone is not account authorization. Check existing
  // account credentials on the server before binding an endpoint to an account.
  app.post('/api/push/subscribe', async (req, res) => {
    try {
      await push.subscribe({ ...req.body, requestOrigin: req.headers.origin });
      res.json({ ok: true });
    } catch (err) {
      res.status(err.status || 503).json({ error: err.status ? err.message : 'Could not register this device. Please retry.' });
    }
  });

  app.post('/api/push/unsubscribe', async (req, res) => {
    try {
      await push.unsubscribe(req.body || {});
      res.json({ ok: true });
    } catch (err) {
      res.status(err.status || 503).json({ error: 'Could not remove server subscription.' });
    }
  });

  app.post('/api/upload-sign', async (req, res) => {
    try {
      const fileName = String(req.body?.fileName || 'upload.bin');
      const contentType = String(req.body?.contentType || 'application/octet-stream');
      const target = await createSignedUploadTarget({ fileName, contentType });
      res.json(target);
    } catch (err) {
      res.status(500).json({ error: err.message || 'Sign upload failed' });
    }
  });

  app.get('/api/health', async (_req, res) => {
    const snap = await getFullSnapshot();
    res.json({ ok: true, backend: snap.backend, syncedAt: snap.syncedAt });
  });

  app.post('/api/presence', async (req, res) => {
    try {
      const userId = String(req.body?.userId || '').trim();
      const offline = Boolean(req.body?.offline);
      if (userId) {
        await touchUserPresence(userId, { markOffline: offline, force: true });
      }
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message || 'Presence update failed' });
    }
  });

  app.get('/api/sync', async (req, res) => {
    try {
      const uid = String(req.query.uid || '').trim();
      if (uid) {
        await touchUserPresence(uid, { markOffline: req.query.offline === '1' });
      }
      const snapshot = await getFullSnapshot();
      res.json(snapshot);
    } catch (err) {
      res.status(500).json({ error: err.message || 'Sync fetch failed' });
    }
  });

  app.post('/api/sync', async (req, res) => {
    try {
      const actions = Array.isArray(req.body?.actions) ? req.body.actions : [];
      const presenceUid = String(req.body?.presenceUserId || '').trim();
      if (presenceUid) {
        await touchUserPresence(presenceUid, { force: true });
      }
      const snapshot = await applyOutboxActions(actions);
      try {
        await push.notifyMessages(actions, snapshot);
      } catch {
        // A push-provider outage must not turn a saved message into a failed send.
        console.warn('Push notification dispatch unavailable.');
      }
      res.json(snapshot);
    } catch (err) {
      res.status(500).json({ error: err.message || 'Sync push failed' });
    }
  });

  const publicDir = path.join(__dirname, 'public');
  app.use(express.static(publicDir, { extensions: ['html'] }));

  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(publicDir, 'index.html'));
  });

  return app;
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === __filename;
if (isDirectRun) {
  const port = Number(process.env.PORT) || 3000;
  const app = createApp();
  app.listen(port, '0.0.0.0', () => {
    console.log(`i-tutor offline-sync server listening on http://0.0.0.0:${port}`);
  });
}

export default createApp();
