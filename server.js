const path = require('node:path');
const express = require('express');
const apiRouter = require('./src/routes/api');
const { getDb } = require('./src/db');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// Permissive CORS & preview-friendly headers (no iframe or host blocking)
app.use((req, res, next) => {
  const startNs = process.hrtime.bigint();
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
  res.setHeader('Access-Control-Expose-Headers', 'X-Response-Time');

  const origWriteHead = res.writeHead;
  res.writeHead = function (...args) {
    const elapsedMs = Number(process.hrtime.bigint() - startNs) / 1e6;
    if (!res.headersSent) {
      res.setHeader('X-Response-Time', `${elapsedMs.toFixed(2)}ms`);
    }
    return origWriteHead.apply(this, args);
  };

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  next();
});

app.use(express.json({ limit: '256kb' }));

// Initialize SQLite catalog eagerly
getDb();

// REST API routes
app.use('/api', apiRouter);

// JSON 404 handler for unknown API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({
    error: `Unknown API route: ${req.method} ${req.originalUrl}`,
    hint: 'Visit GET /api for the complete endpoint manifest.'
  });
});

// Serve Mission Control frontend
const publicDir = path.join(__dirname, 'public');
app.use(express.static(publicDir));

app.get('*', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

// Error handler
app.use((err, req, res, _next) => {
  console.error('[PELO API Error]', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

if (require.main === module) {
  app.listen(PORT, HOST, () => {
    console.log(`✦ PELO Deep-Space Observatory & API listening on http://${HOST}:${PORT}`);
  });
}

module.exports = app;
