const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');

const dev = process.env.NODE_ENV !== 'production';
const PORT = parseInt(process.env.PORT || '3000', 10);

const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:81',
  'http://localhost',
  'https://localhost',
  'capacitor://localhost',
  'file://',
  'null',
  'https://512-1-production.up.railway.app',
  'http://512-1-production.up.railway.app',
  /^https?:\/\/([a-z0-9-]+\.)*railway\.app$/i,
  /^https?:\/\/([a-z0-9-]+\.)*up\.railway\.app$/i,
];

const envOrigins = (process.env.CORS_ORIGINS || '').split(',').map((o) => o.trim()).filter(Boolean);
const seen = new Set();
const ALLOWED_ORIGINS = [...DEFAULT_ALLOWED_ORIGINS.map(String), ...envOrigins].filter((o) => {
  const key = String(o);
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});
console.log(`[CORS] Allowed origins: ${ALLOWED_ORIGINS.length}`);

function isAllowedOrigin(origin) {
  if (!origin) return true;
  for (const allowed of ALLOWED_ORIGINS) {
    if (allowed instanceof RegExp) { if (allowed.test(origin)) return true; }
    else if (allowed === origin) return true;
  }
  return false;
}

function applyCors(req, res) {
  const origin = req.headers.origin;
  if (!isAllowedOrigin(origin)) return false;
  if (origin) { res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Vary', 'Origin'); }
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  return true;
}

const app = next({ dev, port: PORT });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const fs = require('fs');
  const pathMod = require('path');

  const httpServer = createServer(async (req, res) => {
    try {
      if (!applyCors(req, res)) { res.statusCode = 403; res.end('Forbidden origin'); return; }
      if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return; }

      if (req.url && req.url.startsWith('/uploads/') && req.method === 'GET') {
        const safe = req.url.split('?')[0].replace(/^\/+/, '');
        const filePath = pathMod.join(process.cwd(), 'public', safe);
        const publicDir = pathMod.join(process.cwd(), 'public');
        const resolved = pathMod.resolve(filePath);
        if (!resolved.startsWith(publicDir)) { res.statusCode = 403; res.end('Forbidden'); return; }
        if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
          const ext = pathMod.extname(resolved).toLowerCase();
          const mime = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.m4a': 'audio/mp4', '.pdf': 'application/pdf', '.txt': 'text/plain', '.json': 'application/json' }[ext] || 'application/octet-stream';
          res.setHeader('Content-Type', mime);
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          res.setHeader('Access-Control-Allow-Origin', '*');
          fs.createReadStream(resolved).pipe(res);
          return;
        }
        res.statusCode = 404; res.end('Not Found'); return;
      }

      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error handling request:', err);
      res.statusCode = 500;
      res.end('Internal Server Error');
    }
  });

  httpServer.listen(PORT, () => {
    console.log(`> Ready on port ${PORT}`);
  });

  process.on('SIGTERM', () => { process.exit(0); });
  process.on('SIGINT', () => { process.exit(0); });
});
