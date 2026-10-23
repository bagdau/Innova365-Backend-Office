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
const { app, Menu } = electron;

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
    agent: null, requestQuit: null, onSettingsChanged: null,
  });

  ctx.agent = createAgent({
    version: app.getVersion(),
    printer, log,
    getSettings: () => {
      const c = config.get();
      const origins = [originOf(c.serverUrl), originOf(c.officeUrl), ...c.agent.extraOrigins, ...ctx.redirectOrigins].filter(Boolean);
      return { port: c.agent.port, lan: c.agent.lan, token: c.agent.token, origins };
    },
  });

  app.whenReady().then(async () => {
    if (process.platform !== 'darwin') Menu.setApplicationMenu(null);
    else Menu.setApplicationMenu(Menu.buildFromTemplate([{ role: 'appMenu' }, { role: 'editMenu' }, { role: 'windowMenu' }]));

    const win = createWindows(ctx);
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

    if (config.get().agent.enabled) await ctx.agent.start();
    tray.refresh();
    try { app.setLoginItemSettings({ openAtLogin: config.get().autoStart }); } catch { /* не везде поддерживается */ }

    win.createMain();
    if (process.argv.includes('--settings')) win.openSettings({});

    app.on('second-instance', () => { if (config.get().serverUrl) win.showMain(); else win.openSettings({ first: true }); });
    app.on('activate', () => { if (config.get().serverUrl) win.showMain(); });
    app.on('window-all-closed', () => { if (!config.get().closeToTray || ctx.quitting) app.quit(); });
    app.on('before-quit', () => { ctx.quitting = true; });
    app.on('will-quit', () => { void ctx.agent.stop(); printer.close(); tray?.destroy(); log('[app] выход'); });
  }).catch((e) => { log(`[app] ошибка запуска: ${e && e.stack || e}`); app.quit(); });

  process.on('uncaughtException', (e) => log(`[uncaught] ${e && e.stack || e}`));
  process.on('unhandledRejection', (e) => log(`[unhandled] ${e}`));
}
