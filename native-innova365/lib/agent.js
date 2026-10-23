'use strict';
/**
 * Встроенный агент печати Innova365 — тот же протокол, что у print-agent (веб-касса работает без изменений):
 *   GET  /health                       — проверка (без токена): { ok, agent:'innova365', origin, ... }
 *   GET  /printers                     — принтеры ОС с оценкой пригодности
 *   GET  /best                         — лучший кассовый принтер
 *   GET  /discover?subnet=a.b.c        — поиск сетевых принтеров (порт 9100) в частной подсети
 *   POST /print?printer=auto|<имя>     — тело = байты ESC/POS;  либо /print?host=<IP>&port=9100 (ретрансляция в локальной сети)
 *
 * Доступ: страница из списка разрешённых источников (localhost + адрес кассы + дополнительные) ИЛИ верный токен (X-Token).
 * Без зависимостей от Electron.
 */
const http = require('http');
const os = require('os');
const crypto = require('crypto');
const { isAllowedOrigin, isRelayHost, isPrivateIPv4 } = require('./url');
const { pickBest } = require('./printers');

const MAX_BODY = 2 * 1024 * 1024;
const SUBNET = /^(10\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}|192\.168\.\d{1,3})$/;

const safeEqual = (a, b) => {
  const x = Buffer.from(String(a || '')), y = Buffer.from(String(b || ''));
  return x.length === y.length && x.length > 0 && crypto.timingSafeEqual(x, y);
};

/**
 * @param {{ getSettings: () => {port:number, lan:boolean, token:string, origins:string[]}, printer: any, log?: (msg:string)=>void, version?: string }} o
 */
function createAgent({ getSettings, printer, log = () => undefined, version = '1.0.0' }) {
  let server = null;
  let state = { state: 'stopped', port: 0, lan: false, error: '' };

  const json = (res, status, body, cors) => {
    const data = status === 204 ? '' : JSON.stringify(body);
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(data), 'Connection': 'close', ...cors });
    res.end(data);
  };

  async function readBody(req) {
    const chunks = []; let size = 0;
    for await (const c of req) { size += c.length; if (size > MAX_BODY) throw Object.assign(new Error('too large'), { status: 413 }); chunks.push(c); }
    return Buffer.concat(chunks);
  }

  async function handle(req, res) {
    const s = getSettings();
    const origin = req.headers.origin;
    const originOk = isAllowedOrigin(origin, s.origins);
    const cors = originOk ? {
      'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'X-Token, Content-Type', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Private-Network': 'true', 'Access-Control-Max-Age': '600', 'Vary': 'Origin',
    } : {};

    // защита от DNS-rebinding: на loopback принимаем только запросы с Host = 127.0.0.1 / localhost
    if (!s.lan && !/^(127\.0\.0\.1|localhost)(:\d+)?$/i.test(String(req.headers.host || ''))) return json(res, 400, { error: 'bad host' }, cors);

    const url = new URL(req.url, 'http://x');
    if (req.method === 'OPTIONS') return json(res, 204, null, cors);

    if (req.method === 'GET' && url.pathname === '/health') {
      return json(res, 200, { ok: true, agent: 'innova365', host: os.hostname(), platform: process.platform, version: `${version}-desktop`, origin: originOk, desktop: true }, cors);
    }
    if (!originOk && !safeEqual(req.headers['x-token'], s.token)) return json(res, 401, { error: 'bad token' }, cors);

    if (req.method === 'GET' && url.pathname === '/printers') return json(res, 200, await printer.list(), cors);

    if (req.method === 'GET' && url.pathname === '/best') {
      const best = pickBest(await printer.list());
      return best ? json(res, 200, best, cors) : json(res, 404, { error: 'no suitable printer' }, cors);
    }

    if (req.method === 'GET' && url.pathname === '/discover') {
      let subnet = url.searchParams.get('subnet');
      if (!subnet) {
        const mine = Object.values(os.networkInterfaces()).flat().find((i) => i && i.family === 'IPv4' && !i.internal && isPrivateIPv4(i.address));
        if (mine) subnet = mine.address.split('.').slice(0, 3).join('.');
      }
      if (!subnet || !SUBNET.test(subnet)) return json(res, 400, { error: 'private subnet required' }, cors);
      return json(res, 200, { subnet, printers: await printer.discover(subnet) }, cors);
    }

    if (req.method === 'POST' && url.pathname === '/print') {
      const t0 = Date.now();
      const body = await readBody(req);
      if (!body.length) return json(res, 400, { error: 'empty body' }, cors);
      const host = url.searchParams.get('host');
      let target;
      if (host) {
        const port = Number(url.searchParams.get('port') || 9100);
        if (!isRelayHost(host)) return json(res, 400, { error: 'private address required' }, cors);
        if (!Number.isInteger(port) || port < 1 || port > 65535) return json(res, 400, { error: 'bad port' }, cors);
        await printer.relay(host, port, body);
        target = `${host}:${port}`;
      } else {
        let name = url.searchParams.get('printer');
        if (name && (name.length > 200 || /[\u0000-\u001f]/.test(name))) return json(res, 400, { error: 'bad printer name' }, cors);
        if (!name || name === 'auto') {
          const best = pickBest(await printer.list());
          if (!best) return json(res, 404, { error: 'no suitable printer' }, cors);
          name = best.name;
        }
        await printer.print(name, body);
        target = name;
      }
      log(`[print] "${target}" ${body.length} bytes ${Date.now() - t0} ms`);
      return json(res, 200, { ok: true, ms: Date.now() - t0, printer: target }, cors);
    }
    return json(res, 404, { error: 'not found' }, cors);
  }

  return {
    status: () => ({ ...state }),

    /** Запускает сервер; если порт занят — состояние 'busy' (возможно, работает старый print-agent). */
    start() {
      return new Promise((resolve) => {
        if (server) return resolve(state);
        const s = getSettings();
        const srv = http.createServer((req, res) => {
          handle(req, res).catch((e) => {
            log(`[error] ${e.message}`);
            try { json(res, e.status || 500, { error: e.message }, {}); } catch { /* ignore */ }
          });
        });
        srv.on('error', (/** @type {any} */ e) => {
          server = null;
          state = { state: e.code === 'EADDRINUSE' ? 'busy' : 'error', port: s.port, lan: s.lan, error: e.code === 'EADDRINUSE' ? `порт ${s.port} уже занят (возможно, запущен старый print-agent)` : e.message };
          log(`[agent] ${state.error}`);
          resolve(state);
        });
        srv.listen(s.port, s.lan ? '0.0.0.0' : '127.0.0.1', () => {
          server = srv; state = { state: 'running', port: s.port, lan: s.lan, error: '' };
          log(`[agent] запущен на ${s.lan ? '0.0.0.0' : '127.0.0.1'}:${s.port}`);
          resolve(state);
        });
      });
    },

    stop() {
      return new Promise((resolve) => {
        const srv = server; server = null; state = { state: 'stopped', port: 0, lan: false, error: '' };
        if (!srv) return resolve(undefined);
        srv.close(() => resolve(undefined));
        srv.closeAllConnections?.();
      });
    },

    async restart() { await this.stop(); return this.start(); },
  };
}

module.exports = { createAgent };
