// @ts-check
'use strict';
/**
 * IPC главного процесса.
 *  ui:*  — только от файлов приложения (настройки, «нет связи»); большинство требует разблокировки PIN-кодом.
 *  web:* — от страницы кассы: только сведения о приложении и печать документа без диалога.
 */
const electron = require('electron');
const { normalizeServerUrl, isRelayHost, originOf } = require('../lib/url');
const { PinLimiter } = require('../lib/pin');
const { testReceipt } = require('../lib/escpos');
const { pickBest, looksLikeReceipt } = require('../lib/printers');
const { printHtmlSilent } = require('./print-silent');

const WIDTHS = [58, 80];
const CODEPAGES = ['cp866', 'cp1251', 'ascii'];

/** Из присланного интерфейсом объекта берём только то, что можно менять (окно, PIN и токен — отдельными вызовами). */
function pickPatch(/** @type {any} */ p) {
  const o = p && typeof p === 'object' ? p : {};
  const out = /** @type {any} */ ({});
  for (const k of ['serverUrl', 'officeUrl', 'fullscreen', 'kiosk', 'autoStart', 'closeToTray', 'zoom']) if (k in o) out[k] = o[k];
  if (o.agent && typeof o.agent === 'object') { out.agent = {}; for (const k of ['enabled', 'lan', 'port', 'extraOrigins']) if (k in o.agent) out.agent[k] = o.agent[k]; }
  if (o.print && typeof o.print === 'object') { out.print = {}; for (const k of ['silent', 'deviceName']) if (k in o.print) out.print[k] = o.print[k]; }
  return out;
}

/** Достижимость адреса: быстрый GET с тайм-аутом. */
async function probeUrl(/** @type {string} */ url, /** @type {number} */ ms = 6000) {
  const t0 = Date.now();
  try {
    const r = await electron.net.fetch(url, { method: 'GET', redirect: 'follow', signal: AbortSignal.timeout(ms) });
    return { ok: r.status < 500, status: r.status, ms: Date.now() - t0, finalUrl: r.url };
  } catch (e) { return { ok: false, error: /** @type {Error} */ (e).message.replace(/^net::/, ''), ms: Date.now() - t0 }; }
}

/**
 * @param {any} ctx  { config, agent, printer, log, paths, unlocked:Set<number>, quitting:boolean, onSettingsChanged?: () => void }
 * @param {ReturnType<typeof import('./windows').createWindows>} win
 */
function registerIpc(ctx, win) {
  const { ipcMain, app } = electron;
  const { config, log } = ctx;
  const limiter = new PinLimiter();

  const fromUi = (/** @type {Electron.IpcMainInvokeEvent} */ e) => !!e.senderFrame && e.senderFrame === e.sender.mainFrame && win.isLocalUi(e.senderFrame.url);
  const isUnlocked = (/** @type {Electron.IpcMainInvokeEvent} */ e) => !config.hasPin() || ctx.unlocked.has(e.sender.id);

  /** @param {string} channel @param {(e: Electron.IpcMainInvokeEvent, ...a: any[]) => any} fn @param {boolean} [needUnlock] */
  const ui = (channel, fn, needUnlock = true) => ipcMain.handle('ui:' + channel, async (e, ...args) => {
    if (!fromUi(e)) { log(`[ipc] отклонён вызов ui:${channel} со страницы ${e.senderFrame?.url}`); throw new Error('forbidden'); }
    if (needUnlock && !isUnlocked(e)) return { ok: false, locked: true, error: 'Введите PIN-код' };
    try { return await fn(e, ...args); } catch (err) { return { ok: false, error: /** @type {Error} */ (err).message }; }
  });

  const view = () => ({ config: config.view(), agent: ctx.agent.status() });

  ui('state', (e) => {
    const base = { version: app.getVersion(), platform: process.platform, first: !config.get().serverUrl, hasPin: config.hasPin() };
    if (!isUnlocked(e)) return { ok: true, locked: true, ...base };
    return {
      ok: true, locked: false, ...base, ...view(),
      versions: { electron: process.versions.electron, chrome: process.versions.chrome, node: process.versions.node },
      userData: app.getPath('userData'),
    };
  }, false);

  ui('unlock', (e, pin) => {
    const wait = limiter.wait();
    if (wait > 0) return { ok: false, wait, error: `Слишком много попыток. Подождите ${Math.ceil(wait / 1000)} с` };
    if (config.checkPin(String(pin ?? ''))) { limiter.ok(); ctx.unlocked.add(e.sender.id); return { ok: true }; }
    limiter.fail();
    return { ok: false, wait: limiter.wait(), error: 'Неверный PIN-код' };
  }, false);

  ui('save', (_e, patch) => {
    const before = config.get();
    const res = config.update(pickPatch(patch));
    if (!res.ok) return { ok: false, error: res.errors.join('. '), errors: res.errors };
    const after = config.get();

    if (before.autoStart !== after.autoStart) { try { app.setLoginItemSettings({ openAtLogin: after.autoStart }); } catch (e) { log(`[autostart] ${e}`); } }
    const agentChanged = before.agent.enabled !== after.agent.enabled || before.agent.port !== after.agent.port || before.agent.lan !== after.agent.lan;
    const done = [];
    if (agentChanged) done.push((after.agent.enabled ? ctx.agent.restart() : ctx.agent.stop()).catch((e) => log(`[agent] ${e}`)));
    if (before.serverUrl !== after.serverUrl) { ctx.redirectOrigins.clear(); if (win.main()) win.loadServer(); else win.createMain(); }
    if (before.kiosk !== after.kiosk || before.fullscreen !== after.fullscreen) win.applyMode();
    if (before.zoom !== after.zoom) win.setZoom(after.zoom);
    ctx.onSettingsChanged?.();
    return Promise.all(done).then(() => ({ ok: true, ...view() }));
  });

  ui('setPin', (e, pin) => { config.setPin(String(pin ?? '')); ctx.unlocked.add(e.sender.id); return { ok: true, ...view() }; });
  ui('clearPin', () => { config.clearPin(); return { ok: true, ...view() }; });
  ui('newToken', () => { config.newToken(); return { ok: true, ...view() }; });

  ui('checkUrl', async (_e, url) => {
    const n = normalizeServerUrl(String(url ?? ''));
    if (!n) return { ok: false, error: 'Адрес указан неверно (нужен http:// или https://)' };
    return { ...(await probeUrl(n)), url: n };
  });

  ui('printers', async () => ({ ok: true, printers: await ctx.printer.list() }));
  ui('systemPrinters', async (e) => {
    // принтеры ОС с признаком «по умолчанию»; если список от ОС получить не удалось — спрашиваем Chromium
    const own = await ctx.printer.list().catch(() => []);
    if (own.length) return { ok: true, printers: own.map((p) => ({ name: p.name, displayName: p.name, isDefault: p.isDefault })) };
    const list = await e.sender.getPrintersAsync();
    return { ok: true, printers: list.map((p) => ({ name: p.name, displayName: p.displayName, isDefault: false })) };
  });

  ui('testPrint', async (_e, o) => {
    const width = WIDTHS.includes(Number(o?.width)) ? Number(o.width) : 80;
    const codepage = CODEPAGES.includes(o?.codepage) ? o.codepage : 'cp866';
    let target = String(o?.printer ?? 'auto').trim() || 'auto';
    const t0 = Date.now();
    const m = /^(\d{1,3}(?:\.\d{1,3}){3})(?::(\d{1,5}))?$/.exec(target);
    if (m) {
      if (!isRelayHost(m[1])) return { ok: false, error: 'Сетевой принтер должен быть в локальной сети (10.x, 172.16–31.x, 192.168.x)' };
      const bytes = testReceipt({ printer: target, width, codepage });
      await ctx.printer.relay(m[1], Number(m[2] || 9100), bytes);
      return { ok: true, printer: target, ms: Date.now() - t0 };
    }
    if (target === 'auto') {
      const best = pickBest(await ctx.printer.list());
      if (!best) return { ok: false, error: 'Подходящий принтер не найден: подключите кассовый принтер и установите драйвер' };
      // пробный чек состоит из команд ESC/POS: на обычный (лазерный/струйный) принтер он выйдет страницей «мусора»
      if (!looksLikeReceipt(best)) return { ok: false, error: `Кассового принтера среди найденных нет: «Авто» выбрало бы «${best.name}», а он не похож на чековый. Выберите принтер вручную в списке, если уверены.` };
      target = best.name;
    }
    await ctx.printer.print(target, testReceipt({ printer: target, width, codepage }));
    log(`[test-print] "${target}" ${Date.now() - t0} мс`);
    return { ok: true, printer: target, ms: Date.now() - t0 };
  });

  ui('testAgent', async () => {
    const s = ctx.agent.status();
    if (s.state !== 'running') return { ok: false, error: s.error || 'Агент не запущен', state: s.state };
    const t0 = Date.now();
    try {
      const r = await electron.net.fetch(`http://127.0.0.1:${s.port}/health`, { signal: AbortSignal.timeout(3000) });
      return { ok: r.ok, ms: Date.now() - t0, health: await r.json() };
    } catch (e) { return { ok: false, error: /** @type {Error} */ (e).message }; }
  });

  ui('restartAgent', async () => { await (config.get().agent.enabled ? ctx.agent.restart() : ctx.agent.stop()); ctx.onSettingsChanged?.(); return { ok: true, ...view() }; });
  ui('logs', () => ({ ok: true, lines: ctx.log.lines(), file: ctx.log.file() }));

  // экран «нет связи»: проверяем доступность и только потом загружаем — без мигания
  ui('retry', async (e, target) => {
    const cfg = config.get();
    const url = target === 'office' ? cfg.officeUrl : cfg.serverUrl;
    if (!url) return { ok: false, error: 'Адрес не задан' };
    const r = await probeUrl(url, 5000);
    if (!r.ok) return { ok: false, error: r.error || `ответ ${r.status}` };
    void e.sender.loadURL(url);
    return { ok: true };
  }, false);

  ui('openSettings', () => { win.openSettings({}); return { ok: true }; }, false);
  ui('openApp', () => { win.createMain(); return { ok: true }; }, false);
  ui('quit', () => { ctx.requestQuit(true); return { ok: true }; });

  /* ───────── от страницы кассы ───────── */
  const fromSite = (/** @type {Electron.IpcMainInvokeEvent} */ e) => {
    const url = e.sender.getURL();
    return win.isTrusted(url) || (!!config.get().officeUrl && originOf(url) === originOf(config.get().officeUrl));
  };
  ipcMain.handle('web:info', (e) => (fromSite(e) ? { version: app.getVersion() } : {}));
  ipcMain.handle('web:printHtml', async (e, html, opts) => {
    if (!fromSite(e)) return { handled: false };
    const cfg = config.get();
    if (!cfg.print.silent || typeof html !== 'string' || !html) return { handled: false };
    const r = await printHtmlSilent(html, { deviceName: cfg.print.deviceName, log });
    return r.ok ? { handled: true } : { handled: false, error: r.error, title: opts?.title };
  });
}

module.exports = { registerIpc, pickPatch, probeUrl };
