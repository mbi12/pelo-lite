const path = require('node:path');
const express = require('express');
const apiRouter = require('./src/routes/api');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';

app.disable('x-powered-by');
app.set('trust proxy', true);
app.use(express.json({ limit: '512kb' }));

// Allow live browser preview & cross-origin MacroDroid/Tasker requests from Huawei P40
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
});

app.use('/api', apiRouter);

const publicDir = path.join(__dirname, 'public');
app.use(express.static(publicDir, { maxAge: 0 }));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(publicDir, 'index.html'));
});

app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.originalUrl} not found.` });
});

app.use((err, req, res, _next) => {
  console.error('[PELO Server Error]', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

if (require.main === module) {
  app.listen(PORT, HOST, () => {
    console.log(`✦ PELO Personal AI (Huawei P40 Edition) listening on http://${HOST}:${PORT}`);
  });
}

module.exports = app;
