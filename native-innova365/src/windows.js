// @ts-check
'use strict';
/** Окна приложения: касса, настройки, Office; защита навигации, «нет связи», режимы окна. */
const path = require('path');
const { pathToFileURL, fileURLToPath } = require('url');
const electron = require('electron');
const { sameOrigin, originOf } = require('../lib/url');

/**
 * @param {any} ctx  { config, paths, log, quitting, redirectOrigins:Set<string>, unlocked:Set<number> }
 */
function createWindows(ctx) {
  const { BrowserWindow, shell, screen, app } = electron;
  const { config, paths, log } = ctx;
  /** @type {Electron.BrowserWindow | null} */ let main = null;
  /** @type {Electron.BrowserWindow | null} */ let settings = null;
  /** @type {Electron.BrowserWindow | null} */ let office = null;
  /** @type {NodeJS.Timeout | null} */ let boundsTimer = null;

  const fileUrl = (/** @type {string} */ name, /** @type {Record<string,string>=} */ query) => {
    const u = pathToFileURL(path.join(paths.frontend, name));
    if (query) u.search = new URLSearchParams(query).toString();
    return u.toString();
  };

  /** Файл из папки frontend приложения (а не любой file://). */
  const isLocalUi = (/** @type {string} */ url) => {
    try { const u = new URL(url); if (u.protocol !== 'file:') return false; return path.resolve(fileURLToPath(u)).startsWith(path.resolve(paths.frontend) + path.sep); } catch { return false; }
  };

  /** Адрес касcы (в том числе после редиректов сервера). */
  const isTrusted = (/** @type {string} */ url) => {
    const o = originOf(url);
    if (!o) return false;
    return sameOrigin(url, config.get().serverUrl) || ctx.redirectOrigins.has(o);
  };
  const isTrustedOffice = (/** @type {string} */ url) => !!config.get().officeUrl && sameOrigin(url, config.get().officeUrl);

  /** Показывает окно, когда оно готово; если событие не пришло (например, первая загрузка завершилась ошибкой) — через 3 секунды. */
  function showWhenReady(/** @type {Electron.BrowserWindow} */ win) {
    let shown = false;
    const go = () => { if (shown || win.isDestroyed()) return; shown = true; win.show(); };
    win.once('ready-to-show', go);
    setTimeout(go, 3000).unref?.();
  }

  const webPrefs = () => ({
    preload: paths.preload, contextIsolation: true, sandbox: true, nodeIntegration: false, nodeIntegrationInSubFrames: true,
    spellcheck: false, webSecurity: true, allowRunningInsecureContent: false,
    backgroundThrottling: false,                      // кассе нужны таймеры и звуки и в фоне
    autoplayPolicy: /** @type {const} */ ('no-user-gesture-required'),   // звуковые сигналы новых заказов без клика
  });

  /** Общая защита окна с сайтом: чужие адреса — только в браузере системы, всплывающие окна — только свои. */
  function guard(/** @type {Electron.BrowserWindow} */ win, /** @type {(u:string)=>boolean} */ trusted, /** @type {boolean} */ followRedirects) {
    const wc = win.webContents;
    const external = (/** @type {string} */ url) => { if (/^https?:\/\//i.test(url)) void shell.openExternal(url); };
    wc.on('will-navigate', (e) => {
      const url = e.url;
      if (trusted(url) || isLocalUi(url)) return;
      e.preventDefault(); external(url); log(`[nav] заблокирован переход: ${url}`);
    });
    // редирект делает сам сервер (например, http → https или IP → домен): доверяем его новому источнику на время работы
    wc.on('will-redirect', (e) => {
      const url = e.url;
      if (!e.isMainFrame || trusted(url) || isLocalUi(url)) return;
      if (followRedirects && /^https?:\/\//i.test(url)) { const o = originOf(url); if (o) { ctx.redirectOrigins.add(o); log(`[nav] редирект сервера на ${o}`); } return; }
      e.preventDefault();
    });
    wc.setWindowOpenHandler(({ url }) => {
      if (url === 'about:blank' || trusted(url)) {
        return { action: 'allow', overrideBrowserWindowOptions: { autoHideMenuBar: true, icon: paths.icon, webPreferences: webPrefs() } };
      }
      external(url);
      return { action: 'deny' };
    });
  }

  /** Сочетания клавиш, которые должны работать и без меню. */
  function hotkeys(/** @type {Electron.BrowserWindow} */ win) {
    win.webContents.on('before-input-event', (e, input) => {
      if (input.type !== 'keyDown') return;
      const ctrl = input.control || input.meta;
      const k = input.key;
      if (k === 'F11' && !config.get().kiosk) { win.setFullScreen(!win.isFullScreen()); e.preventDefault(); }
      else if (k === 'F5' || (ctrl && !input.shift && k.toLowerCase() === 'r')) { win.webContents.reload(); e.preventDefault(); }
      else if (ctrl && input.shift && k.toLowerCase() === 's') { openSettings({}); e.preventDefault(); }
      else if (ctrl && (k === '=' || k === '+')) { zoom(0.1); e.preventDefault(); }
      else if (ctrl && k === '-') { zoom(-0.1); e.preventDefault(); }
      else if (ctrl && k === '0') { setZoom(1); e.preventDefault(); }
      else if (input.alt && k === 'ArrowLeft' && win.webContents.canGoBack()) { win.webContents.goBack(); e.preventDefault(); }
    });
  }

  function setZoom(/** @type {number} */ z) {
    const v = Math.min(2, Math.max(0.5, Math.round(z * 100) / 100));
    config.update({ zoom: v });
    for (const w of [main, office]) if (w && !w.isDestroyed()) w.webContents.setZoomFactor(v);
  }
  const zoom = (/** @type {number} */ d) => setZoom(config.get().zoom + d);

  function visibleBounds(/** @type {{x:number|null,y:number|null,width:number,height:number}} */ w) {
    if (w.x === null || w.y === null) return {};
    const ok = screen.getAllDisplays().some((d) => { const a = d.workArea; return w.x < a.x + a.width - 50 && w.x + w.width > a.x + 50 && w.y < a.y + a.height - 50 && w.y + 50 > a.y; });
    return ok ? { x: w.x, y: w.y } : {};
  }

  function saveBounds() {
    if (boundsTimer) clearTimeout(boundsTimer);
    boundsTimer = setTimeout(() => {
      if (!main || main.isDestroyed() || main.isMinimized() || main.isFullScreen() || main.isMaximized() || config.get().kiosk) return;
      const b = main.getBounds();
      config.update({ window: { width: b.width, height: b.height, x: b.x, y: b.y, maximized: false } });
    }, 600);
  }

  /** Касса. Если адрес не задан — открывает мастер первого запуска. */
  function createMain() {
    if (main && !main.isDestroyed()) { showMain(); return main; }
    const cfg = config.get();
    if (!cfg.serverUrl) { openSettings({ first: true }); return null; }
    const w = cfg.window;
    main = new BrowserWindow({
      width: w.width, height: w.height, ...visibleBounds(w), minWidth: 800, minHeight: 500, show: false,
      backgroundColor: '#0f172a', title: 'Innova365', icon: paths.icon, autoHideMenuBar: true,
      fullscreen: cfg.fullscreen && !cfg.kiosk, kiosk: cfg.kiosk, webPreferences: { ...webPrefs(), partition: 'persist:innova365' },
    });
    if (w.maximized && !cfg.fullscreen && !cfg.kiosk) main.maximize();
    const win = main;
    showWhenReady(win);
    guard(win, isTrusted, true);
    hotkeys(win);
    win.on('resize', saveBounds); win.on('move', saveBounds);
    win.on('maximize', () => config.update({ window: { ...config.get().window, maximized: true } }));
    win.on('unmaximize', () => config.update({ window: { ...config.get().window, maximized: false } }));
    win.on('close', (e) => {
      if (ctx.quitting) return;
      const c = config.get();
      if (c.kiosk && config.hasPin()) { e.preventDefault(); openSettings({ tab: 'about', hint: 'quit' }); return; }
      if (c.closeToTray) { e.preventDefault(); win.hide(); }
    });
    win.on('closed', () => { main = null; });
    win.webContents.on('did-finish-load', () => { win.webContents.setZoomFactor(config.get().zoom); });
    win.webContents.on('did-fail-load', (_e, code, desc, url, isMainFrame) => {
      if (!isMainFrame || code === -3 || String(url).startsWith('file:')) return;   // -3: переход отменён (например, редирект)
      log(`[load] не удалось открыть ${url}: ${desc} (${code})`);
      void win.loadFile(path.join(paths.frontend, 'offline.html'), { query: { url: config.get().serverUrl, code: String(code), desc: String(desc) } });
    });
    win.webContents.on('render-process-gone', (_e, d) => { log(`[crash] ${d.reason}`); if (d.reason !== 'clean-exit') setTimeout(() => { if (!win.isDestroyed()) win.webContents.reload(); }, 1500); });
    loadServer();
    return win;
  }

  function loadServer() {
    if (!main || main.isDestroyed()) return;
    const u = config.get().serverUrl;
    if (!u) { openSettings({ first: true }); return; }
    main.loadURL(u).catch(() => undefined);      // ошибки обрабатывает did-fail-load
  }

  function showMain() {
    if (!main || main.isDestroyed()) { createMain(); return; }
    if (main.isMinimized()) main.restore();
    main.show(); main.focus();
  }

  /** Применяет режимы окна (экран/киоск) после смены настроек. */
  function applyMode() {
    if (!main || main.isDestroyed()) return;
    const c = config.get();
    main.setKiosk(c.kiosk);
    if (!c.kiosk) main.setFullScreen(c.fullscreen);
    main.setAutoHideMenuBar(true);
  }

  /** @param {{first?: boolean, tab?: string, hint?: string}} opts */
  function openSettings(opts = {}) {
    /** @type {Record<string,string>} */
    const query = {};
    if (opts.first) query.first = '1';
    if (opts.tab) query.tab = opts.tab;
    if (opts.hint) query.hint = opts.hint;
    if (settings && !settings.isDestroyed()) {
      if (settings.isMinimized()) settings.restore();
      settings.show(); settings.focus();
      if (opts.tab || opts.hint) void settings.loadURL(fileUrl('settings.html', query));
      return settings;
    }
    const parent = main && !main.isDestroyed() && main.isVisible() && !opts.first ? main : undefined;
    const win = new BrowserWindow({
      width: 940, height: 740, minWidth: 700, minHeight: 520, show: false, parent, backgroundColor: '#0f172a',
      title: 'Innova365 — Настройки', icon: paths.icon, autoHideMenuBar: true,
      webPreferences: { ...webPrefs(), nodeIntegrationInSubFrames: false, partition: 'innova-ui' },
    });
    settings = win;
    showWhenReady(win);
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    win.webContents.on('will-navigate', (e) => { if (!isLocalUi(e.url)) e.preventDefault(); });
    const wcId = win.webContents.id;
    win.on('closed', () => {
      ctx.unlocked.delete(wcId); settings = null;
      // закрыли мастер первого запуска, не указав адрес — приложению нечего показывать
      if (!config.get().serverUrl && !ctx.quitting) app.quit();
    });
    void win.loadURL(fileUrl('settings.html', query));
    return win;
  }

  /** Окно Office (если адрес указан в настройках). */
  function openOffice() {
    const u = config.get().officeUrl;
    if (!u) { openSettings({ tab: 'connection', hint: 'office' }); return null; }
    if (office && !office.isDestroyed()) { office.show(); office.focus(); return office; }
    const win = new BrowserWindow({
      width: 1280, height: 800, minWidth: 800, minHeight: 500, show: false, backgroundColor: '#0f172a', title: 'Innova Office',
      icon: paths.icon, autoHideMenuBar: true, webPreferences: { ...webPrefs(), partition: 'persist:innova365' },
    });
    office = win;
    showWhenReady(win);
    guard(win, isTrustedOffice, false);
    hotkeys(win);
    win.on('closed', () => { office = null; });
    win.webContents.on('did-finish-load', () => { win.webContents.setZoomFactor(config.get().zoom); });
    win.webContents.on('did-fail-load', (_e, code, desc, url, isMainFrame) => {
      if (!isMainFrame || code === -3 || String(url).startsWith('file:')) return;
      void win.loadFile(path.join(paths.frontend, 'offline.html'), { query: { url: u, code: String(code), desc: String(desc), target: 'office' } });
    });
    void win.loadURL(u);
    return win;
  }

  return {
    createMain, showMain, loadServer, applyMode, openSettings, openOffice, setZoom,
    isLocalUi, isTrusted,
    main: () => main, settings: () => settings, office: () => office,
    reloadMain: () => { if (main && !main.isDestroyed()) loadServer(); else createMain(); },
    hideMain: () => { if (main && !main.isDestroyed()) main.hide(); },
  };
}

module.exports = { createWindows };
