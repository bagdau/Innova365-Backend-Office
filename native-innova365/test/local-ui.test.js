'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { startLocalUi } = require('../src/local-ui');

test('packaged UI serves local routes and proxies authenticated API without exposing the device token', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'innova-pos-ui-'));
  fs.mkdirSync(path.join(dir, 'assets'));
  fs.writeFileSync(path.join(dir, 'index.html'), '<h1>Innova POS</h1>');
  fs.writeFileSync(path.join(dir, 'assets', 'app.js'), 'window.ready=true');
  const requests = [];
  const upstream = http.createServer((req, res) => {
    requests.push({ path: req.url, token: req.headers['x-innova-device'], cookie: req.headers.cookie });
    res.writeHead(200, { 'Content-Type': 'application/json', 'Set-Cookie': 'refreshToken=abc; Path=/; HttpOnly; Secure; SameSite=Lax' });
    res.end('{"ok":true}');
  });
  await new Promise((resolve) => upstream.listen(0, '127.0.0.1', resolve));
  const remoteUrl = `http://127.0.0.1:${upstream.address().port}`;
  const app = await startLocalUi({ uiDir: dir, remoteUrl, token: () => 'secret' });
  try {
    assert.match(await (await fetch(app.url + '/login')).text(), /Innova POS/);
    assert.match(await (await fetch(app.url + '/assets/app.js')).text(), /window.ready/);
    const response = await fetch(app.url + '/api/auth/refresh', { method: 'POST', headers: { origin: app.url, cookie: 'refreshToken=old' } });
    assert.equal(response.status, 200);
    assert.doesNotMatch(response.headers.get('set-cookie'), /; Secure/i);
    assert.deepEqual(requests, [{ path: '/api/auth/refresh', token: 'secret', cookie: 'refreshToken=old' }]);
    assert.equal((await fetch(app.url + '/api/auth/refresh', { method: 'POST', headers: { origin: 'https://evil.example' } })).status, 403);
    assert.equal((await fetch(app.url + '/..%2fconfig.json')).status, 403);
  } finally {
    await app.close();
    await new Promise((resolve) => upstream.close(resolve));
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
