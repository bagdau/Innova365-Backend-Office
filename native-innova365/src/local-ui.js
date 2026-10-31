// @ts-check
'use strict';
/** Packaged POS UI with a loopback API gateway. */
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const https = require('node:https');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg',
};

/** @param {{uiDir:string, remoteUrl:string, token:()=>string, log?:(line:string)=>void, requireToken?:boolean}} opts */
async function startLocalUi({ uiDir, remoteUrl, token, log = () => undefined, requireToken = true }) {
  if (!fs.existsSync(path.join(uiDir, 'index.html'))) throw new Error(`POS UI not built: ${uiDir}`);
  const remote = new URL(remoteUrl);
  if (remote.protocol !== 'https:' && remote.protocol !== 'http:') throw new Error('Invalid POS server URL');
  const root = path.resolve(uiDir);
  /** @type {string} */ let origin = '';
  const server = http.createServer((req, res) => {
    const host = req.headers.host || '';
    if (!/^127\.0\.0\.1:\d+$/.test(host)) { res.writeHead(403).end(); return; }
    const url = new URL(req.url || '/', `http://${host}`);
    const requestOrigin = req.headers.origin;
    if (requestOrigin && requestOrigin !== origin) { res.writeHead(403).end(); return; }
    if (url.pathname === '/api' || url.pathname.startsWith('/api/') || url.pathname.startsWith('/uploads/')) {
      if (requireToken && !token()) { res.writeHead(401, { 'Content-Type': 'application/json' }).end('{"error":"Активация требуется"}'); return; }
      const destination = new URL(url.pathname + url.search, remote);
      const headers = { ...req.headers, host: destination.host, origin: remote.origin };
      if (requireToken) headers['x-innova-device'] = token();
      else delete headers['x-innova-device'];
      const upstream = (destination.protocol === 'https:' ? https : http).request(destination, {
        method: req.method, headers,
      }, (response) => {
        const outHeaders = { ...response.headers };
        // A secure cookie from the HTTPS API must be usable by the loopback UI.
        if (outHeaders['set-cookie']) outHeaders['set-cookie'] = outHeaders['set-cookie'].map((cookie) => cookie.replace(/;\s*Secure(?=;|$)/gi, ''));
        delete outHeaders['access-control-allow-origin'];
        delete outHeaders['access-control-allow-credentials'];
        res.writeHead(response.statusCode || 502, outHeaders);
        response.pipe(res);
      });
      upstream.on('error', (err) => {
        log(`[local-ui] API unavailable: ${err.message}`);
        if (!res.headersSent) res.writeHead(502, { 'Content-Type': 'application/json' });
        if (!res.writableEnded) res.end('{"error":"Нет связи с сервером"}');
      });
      req.pipe(upstream);
      res.on('close', () => upstream.destroy());
      return;
    }
    let requested;
    try { requested = path.resolve(root, '.' + decodeURIComponent(url.pathname)); }
    catch { res.writeHead(400).end(); return; }
    if (requested !== root && !requested.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    const file = fs.existsSync(requested) && fs.statSync(requested).isFile() ? requested
      : path.extname(requested) ? null : path.join(root, 'index.html');
    if (!file) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': file.endsWith('index.html') || file.endsWith('version.json') ? 'no-store' : 'public, max-age=31536000, immutable' });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(undefined));
  });
  origin = `http://127.0.0.1:${/** @type {import('node:net').AddressInfo} */ (server.address()).port}`;
  return { url: origin, close: () => new Promise((resolve) => server.close(resolve)) };
}

module.exports = { startLocalUi };
