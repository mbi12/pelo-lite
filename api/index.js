const app = require('../server');

module.exports = (req, res) => {
  if (req.url === '/agent.sh' || req.url.startsWith('/agent.sh?')) {
    req.url = '/api/bridge/agent.sh';
  } else if (!req.url.startsWith('/api')) {
    req.url = req.url === '/' ? '/api' : `/api${req.url}`;
  }
  return app(req, res);
};
