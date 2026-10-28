'use strict';
/**
 * Настройки приложения: JSON-файл в папке данных пользователя. Запись атомарная (временный файл + переименование),
 * повреждённый файл переименовывается в .bak, а приложение запускается с настройками по умолчанию.
 * Без зависимостей от Electron: путь к файлу передаётся снаружи.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { normalizeServerUrl, originOf } = require('./url');
const pinlib = require('./pin');
const { SERVICE_URL } = require('./activation');

const DEFAULTS = Object.freeze({
  version: 1,
  serverUrl: '',            // адрес кассы (innova365.kz)
  activation: { installationId: '', token: '', restaurantId: '', restaurantName: '' },
  officeUrl: '',            // адрес Office (необязательно) — открывается из меню
  fullscreen: false,        // запускать на весь экран
  kiosk: false,             // режим киоска: без рамки, выход только через PIN/меню
  autoStart: false,         // запуск вместе с Windows
  closeToTray: false,       // крестик сворачивает в трей (агент печати продолжает работать)
  zoom: 1,
  agent: { enabled: true, port: 9101, lan: false, token: '', extraOrigins: [] },
  print: { silent: false, deviceName: '' },   // печать документов браузера без диалога
  pin: null,                // { salt, hash } — хранится только хеш
  window: { width: 1366, height: 820, x: null, y: null, maximized: false },
});

const clone = (o) => JSON.parse(JSON.stringify(o));
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const bool = (v, d) => (typeof v === 'boolean' ? v : d);
const int = (v, min, max, d) => { const n = Number(v); return Number.isInteger(n) && n >= min && n <= max ? n : d; };
const str = (v, max, d) => (typeof v === 'string' ? v.trim().slice(0, max) : d);

/** Приводит произвольный объект к допустимому виду; ошибки значимых полей собирает в errors. */
function sanitize(input, base = DEFAULTS) {
  const errors = [];
  const src = isObj(input) ? input : {};
  const out = clone(base);

  if ('serverUrl' in src) {
    const raw = String(src.serverUrl ?? '').trim();
    if (!raw) out.serverUrl = '';
    else { const n = normalizeServerUrl(raw); if (n) out.serverUrl = n; else errors.push('Адрес кассы указан неверно (нужен http:// или https://)'); }
  }
  if ('officeUrl' in src) {
    const raw = String(src.officeUrl ?? '').trim();
    if (!raw) out.officeUrl = '';
    else { const n = normalizeServerUrl(raw); if (n) out.officeUrl = n; else errors.push('Адрес Office указан неверно (нужен http:// или https://)'); }
  }
  for (const k of ['fullscreen', 'kiosk', 'autoStart', 'closeToTray']) if (k in src) out[k] = bool(src[k], out[k]);
  if ('zoom' in src) { const z = Number(src.zoom); out.zoom = Number.isFinite(z) ? Math.min(2, Math.max(0.5, Math.round(z * 100) / 100)) : out.zoom; }

  if (isObj(src.agent)) {
    const a = src.agent;
    if ('enabled' in a) out.agent.enabled = bool(a.enabled, out.agent.enabled);
    if ('lan' in a) out.agent.lan = bool(a.lan, out.agent.lan);
    if ('port' in a) { const p = int(a.port, 1024, 65535, null); if (p === null) errors.push('Порт агента: число от 1024 до 65535'); else out.agent.port = p; }
    if ('token' in a && typeof a.token === 'string' && /^[0-9a-f]{16,64}$/i.test(a.token.trim())) out.agent.token = a.token.trim();
    if ('extraOrigins' in a) {
      const list = (Array.isArray(a.extraOrigins) ? a.extraOrigins : String(a.extraOrigins ?? '').split(/[\s,;]+/)).filter((x) => /^https?:\/\//i.test(String(x)) || /[.:]/.test(String(x))).map((x) => originOf(normalizeServerUrl(x) || '')).filter(Boolean);
      out.agent.extraOrigins = [...new Set(list)].slice(0, 20);
    }
  }
  if (isObj(src.print)) {
    if ('silent' in src.print) out.print.silent = bool(src.print.silent, out.print.silent);
    if ('deviceName' in src.print) out.print.deviceName = str(src.print.deviceName, 200, out.print.deviceName);
  }
  if (isObj(src.window)) {
    const w = src.window;
    out.window.width = int(w.width, 600, 10000, out.window.width);
    out.window.height = int(w.height, 400, 10000, out.window.height);
    out.window.x = Number.isInteger(w.x) ? w.x : (w.x === null ? null : out.window.x);
    out.window.y = Number.isInteger(w.y) ? w.y : (w.y === null ? null : out.window.y);
    out.window.maximized = bool(w.maximized, out.window.maximized);
  }
  return { value: out, errors };
}

class Config {
  constructor(file) {
    this.file = file;
    this.data = clone(DEFAULTS);
    this.load();
  }

  load() {
    let raw = null;
    try { raw = fs.readFileSync(this.file, 'utf8'); } catch { /* первого запуска файла нет */ }
    if (raw !== null) {
      try {
        const parsed = JSON.parse(raw);
        const { value } = sanitize(parsed, DEFAULTS);
        // pin доверяем только как корректную пару hex-строк
        if (isObj(parsed.pin) && /^[0-9a-f]+$/i.test(parsed.pin.salt || '') && /^[0-9a-f]+$/i.test(parsed.pin.hash || '')) value.pin = { salt: parsed.pin.salt, hash: parsed.pin.hash };
        if (isObj(parsed.activation)) {
          const a = parsed.activation;
          value.activation = {
            installationId: /^[0-9a-f-]{36}$/i.test(a.installationId || '') ? a.installationId : '',
            token: /^[a-f0-9]{64}$/i.test(a.token || '') ? a.token : '',
            restaurantId: str(a.restaurantId, 100, ''),
            restaurantName: str(a.restaurantName, 150, ''),
          };
        }
        value.serverUrl = value.activation.token ? SERVICE_URL : '';
        this.data = value;
      } catch {
        try { fs.renameSync(this.file, this.file + '.bak'); } catch { /* ignore */ }
        this.data = clone(DEFAULTS);
      }
    }
    if (!this.data.agent.token) this.data.agent.token = crypto.randomBytes(18).toString('hex');
    if (!this.data.activation.installationId) this.data.activation.installationId = crypto.randomUUID();
    this.save();
  }

  save() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = this.file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2), { mode: 0o600 });
    fs.renameSync(tmp, this.file);
  }

  /** Полная копия настроек. */
  get() { return clone(this.data); }

  /** Копия для интерфейса настроек: хеш PIN наружу не отдаётся. */
  view() { const v = clone(this.data); v.pinSet = !!v.pin; delete v.pin; v.activation = { active: this.hasActivation(), restaurantName: v.activation.restaurantName }; return v; }

  /** Применяет частичное изменение; при ошибках в значимых полях ничего не сохраняет. */
  update(patch) {
    const { value, errors } = sanitize(patch, this.data);
    if (errors.length) return { ok: false, errors };
    value.pin = this.data.pin;                      // PIN меняется только через setPin/clearPin
    value.activation = this.data.activation;
    value.serverUrl = this.hasActivation() ? SERVICE_URL : '';
    if (!value.agent.token) value.agent.token = this.data.agent.token;
    this.data = value;
    this.save();
    return { ok: true, errors: [] };
  }

  setPin(pin) { this.data.pin = pinlib.hashPin(pin); this.save(); }
  clearPin() { this.data.pin = null; this.save(); }
  checkPin(pin) { return !this.data.pin || pinlib.verifyPin(pin, this.data.pin); }
  hasPin() { return !!this.data.pin; }
  newToken() { this.data.agent.token = crypto.randomBytes(18).toString('hex'); this.save(); return this.data.agent.token; }
  hasActivation() { return !!(this.data.activation.token && this.data.activation.restaurantId); }
  activate(token, restaurant) {
    if (!/^[a-f0-9]{64}$/i.test(token) || !restaurant || typeof restaurant.id !== 'string' || typeof restaurant.name !== 'string') throw new Error('Неверный ответ сервера');
    this.data.activation.token = token;
    this.data.activation.restaurantId = restaurant.id;
    this.data.activation.restaurantName = restaurant.name;
    this.data.serverUrl = SERVICE_URL;
    this.save();
  }
  clearActivation() {
    const installationId = this.data.activation.installationId;
    this.data.activation = { installationId, token: '', restaurantId: '', restaurantName: '' };
    this.data.serverUrl = '';
    this.save();
  }
}

module.exports = { Config, DEFAULTS, sanitize };
