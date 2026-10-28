// @ts-check
'use strict';
/**
 * Innova365 Desktop — главный процесс.
 *  • окно с кассой (сайт на сервере) + экран «нет связи» с автоповтором;
 *  • встроенный агент печати (127.0.0.1:9101): веб-касса печатает чеки ESC/POS на принтер этого компьютера без отдельной установки;
 *  • режим киоска, трей, автозапуск, PIN на настройки;
 *  • сайту доступно только нужное (права, WebUSB), чужие адреса открываются в браузере системы.
 */
const path = require('path');
const electron = require('electron');
const { app, Menu, session } = electron;
const { SERVICE_URL } = require('../lib/activation');

const { Config } = require('../lib/config');
const { RawPrinter } = require('../lib/rawprint');
const { createAgent } = require('../lib/agent');
const { createLogger } = require('../lib/log');
const { originOf } = require('../lib/url');
const { resolvePaths } = require('./paths');
const { createWindows } = require('./windows');
const { registerIpc } = require('./ipc');
const { setupSession } = require('./session-setup');
const { createTray } = require('./tray');
const { startLocalUi } = require('./local-ui');
const { startLocalRuntime } = require('../lib/local-runtime');
const fs = require('node:fs');

app.setName('Innova365');
if (process.platform === 'win32') app.setAppUserModelId('kz.innova365.desktop');
// для автотестов и портативной установки: свою папку данных можно задать переменной окружения
if (process.env.INNOVA_USER_DATA) app.setPath('userData', process.env.INNOVA_USER_DATA);

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  start();
}

function start() {
  const paths = resolvePaths(app.isPackaged, process.resourcesPath);
  const config = new Config(path.join(app.getPath('userData'), 'config.json'));
  const log = createLogger({ dir: path.join(app.getPath('userData'), 'logs') });
  log(`[app] запуск ${app.getVersion()} (electron ${process.versions.electron})`);

  // страница кассы по http:// (адрес в локальной сети) должна считаться «безопасной»: иначе WebUSB и часть API недоступны
  const so = originOf(config.get().serverUrl);
  if (so && so.startsWith('http://')) app.commandLine.appendSwitch('unsafely-treat-insecure-origin-as-secure', so);

  const printer = new RawPrinter({ psDir: paths.psDir });
  /** Контекст, который разделяют все модули. */
  const ctx = /** @type {any} */ ({
    config, paths, log, printer, quitting: false,
    redirectOrigins: new Set(),      // источники, на которые сам сервер перенаправил кассу (на время работы)
    unlocked: new Set(),             // окна настроек, где введён PIN
    agent: null, localUi: null, localEngine: null, requestQuit: null, onSettingsChanged: null,
  });

  ctx.agent = createAgent({
    version: app.getVersion(),
    printer, log,
    getSettings: () => {
      const c = config.get();
      const origins = [originOf(c.serverUrl), originOf(c.officeUrl), ctx.localUi?.url, ...c.agent.extraOrigins, ...ctx.redirectOrigins].filter(Boolean);
      return { port: c.agent.port, lan: c.agent.lan, token: c.agent.token, origins };
    },
  });

  app.whenReady().then(async () => {
    if (process.platform !== 'darwin') Menu.setApplicationMenu(null);
    else Menu.setApplicationMenu(Menu.buildFromTemplate([{ role: 'appMenu' }, { role: 'editMenu' }, { role: 'windowMenu' }]));

    const win = createWindows(ctx);
    let activationCheck = null;
    ctx.checkActivation = () => {
      if (ctx.localEngine) return Promise.resolve(true);
      if (!config.hasActivation()) return Promise.resolve(false);
      if (activationCheck) return activationCheck;
      const token = config.get().activation.token;
      activationCheck = (async () => {
        try {
          const response = await electron.net.fetch(`${SERVICE_URL}/api/desktop/verify`, {
            method: 'POST', headers: { 'X-Innova-Device': token }, signal: AbortSignal.timeout(5000),
          });
          if (response.status === 401 && config.get().activation.token === token) {
            config.clearActivation();
            try { await session.fromPartition('persist:innova365').clearStorageData?.({ storages: ['cookies'] }); } catch { /* сессию обновит вход */ }
            win.hideMain();
            win.openSettings({ first: true });
            return false;
          }
          return true;
        } catch { return true; } // отсутствие сети не отменяет действующую активацию
        finally { activationCheck = null; }
      })();
      return activationCheck;
    };
    let tray = null;
    ctx.onSettingsChanged = () => tray?.refresh();

    /** Выход: при заданном PIN — через окно настроек, где его можно ввести. */
    ctx.requestQuit = (/** @type {boolean=} */ force) => {
      if (!force && config.hasPin()) { win.openSettings({ tab: 'about', hint: 'quit' }); return; }
      ctx.quitting = true; app.quit();
    };

    registerIpc(ctx, win);
    setupSession(ctx, win);
    tray = createTray(ctx, win, () => ctx.requestQuit());

    const offlineMode = process.env.INNOVA_OFFLINE_POS === '1' || (app.isPackaged && fs.existsSync(paths.manifestPath));
    if (offlineMode) {
      const manifest = JSON.parse(fs.readFileSync(paths.manifestPath, 'utf8'));
      if (config.hasActivation() && config.get().activation.restaurantId !== manifest.restaurantId) throw new Error('Эта офлайн-сборка предназначена для другого заведения');
      ctx.localEngine = await startLocalRuntime({
        pgDir: paths.pgDir, backendDir: paths.backendDir, seedPath: paths.seedPath,
        manifestPath: paths.manifestPath, dataDir: path.join(app.getPath('userData'), 'offline'), execPath: process.execPath, log,
      });
      ctx.localUi = await startLocalUi({
        uiDir: paths.posUi, remoteUrl: ctx.localEngine.apiUrl,
        token: () => '', requireToken: false, log,
      });
      log(`[offline] касса запущена на ${ctx.localUi.url}`);
    } else if (process.env.INNOVA_LOCAL_UI === '1') {
      ctx.localUi = await startLocalUi({
        uiDir: paths.posUi, remoteUrl: SERVICE_URL,
        token: () => config.get().activation.token, log,
      });
      log(`[local-ui] касса запущена на ${ctx.localUi.url}`);
    }
    if (config.get().agent.enabled) await ctx.agent.start();
    tray.refresh();
    try { app.setLoginItemSettings({ openAtLogin: config.get().autoStart }); } catch { /* не везде поддерживается */ }

    if (!ctx.localEngine && config.hasActivation()) await ctx.checkActivation();
    win.createMain();
    if (process.argv.includes('--settings')) win.openSettings({});

    app.on('second-instance', () => { if (ctx.localEngine || config.hasActivation()) win.showMain(); else win.openSettings({ first: true }); });
    app.on('activate', () => { if (ctx.localEngine || config.hasActivation()) win.showMain(); else win.openSettings({ first: true }); });
    app.on('window-all-closed', () => { if (!config.get().closeToTray || ctx.quitting) app.quit(); });
    app.on('before-quit', () => { ctx.quitting = true; });
    app.on('will-quit', () => { void ctx.agent.stop(); void ctx.localUi?.close(); ctx.localEngine?.stop(); printer.close(); tray?.destroy(); log('[app] выход'); });
    if (process.argv.includes('--smoke-offline')) {
      try {
        if (!ctx.localEngine || !ctx.localUi) throw new Error('Офлайн-компоненты не запущены');
        const [health, page, api] = await Promise.all([
          fetch(`${ctx.localEngine.apiUrl}/health`),
          fetch(`${ctx.localUi.url}/login`),
          fetch(`${ctx.localUi.url}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'nobody@example.invalid', password: 'incorrect' }) }),
        ]);
        if (!health.ok || !page.ok || !page.headers.get('content-type')?.includes('text/html') || api.status !== 401) throw new Error(`health=${health.status} page=${page.status} api=${api.status}`);
        const report = { ok: true, version: app.getVersion(), localApi: true, localUi: true };
        if (process.env.INNOVA_SMOKE_REPORT) fs.writeFileSync(process.env.INNOVA_SMOKE_REPORT, JSON.stringify(report));
        log('[offline] проверка упакованного приложения пройдена');
      } catch (error) {
        if (process.env.INNOVA_SMOKE_REPORT) fs.writeFileSync(process.env.INNOVA_SMOKE_REPORT, JSON.stringify({ ok: false, error: String(error) }));
        process.exitCode = 1;
        log(`[offline] проверка упакованного приложения не пройдена: ${String(error)}`);
      }
      app.quit();
    }
  }).catch((e) => {
    log(`[app] ошибка запуска: ${e && e.stack || e}`);
    ctx.localEngine?.stop();
    if (process.argv.includes('--smoke-offline')) {
      if (process.env.INNOVA_SMOKE_REPORT) fs.writeFileSync(process.env.INNOVA_SMOKE_REPORT, JSON.stringify({ ok: false, error: String(e?.message || e) }));
      process.exitCode = 1;
    } else electron.dialog?.showErrorBox?.('Innova365: запуск офлайн-кассы', String(e?.message || e));
    app.quit();
  });

  process.on('uncaughtException', (e) => log(`[uncaught] ${e && e.stack || e}`));
  process.on('unhandledRejection', (e) => log(`[unhandled] ${e}`));
}
