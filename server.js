import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getFullSnapshot, applyOutboxActions } from './src/syncBackend.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createApp() {
  const app = express();
  app.disable('x-powered-by');

  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });

  app.use(express.json({ limit: '2mb' }));

  app.get('/api/health', async (_req, res) => {
    const snap = await getFullSnapshot();
    res.json({ ok: true, backend: snap.backend, syncedAt: snap.syncedAt });
  });

  app.get('/api/sync', async (_req, res) => {
    try {
      const snapshot = await getFullSnapshot();
      res.json(snapshot);
    } catch (err) {
      res.status(500).json({ error: err.message || 'Sync fetch failed' });
    }
  });

  app.post('/api/sync', async (req, res) => {
    try {
      const actions = Array.isArray(req.body?.actions) ? req.body.actions : [];
      const snapshot = await applyOutboxActions(actions);
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
