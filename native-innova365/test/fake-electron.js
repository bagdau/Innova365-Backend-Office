'use strict';
/**
 * Подставной модуль 'electron' для проверки логики главного процесса без запуска Electron.
 * Реализует ровно то, что использует код приложения, и записывает вызовы для проверок.
 */
const { EventEmitter } = require('events');
const { pathToFileURL } = require('url');

function makeElectron({ userData }) {
  const rec = { openExternal: [], loginItems: [], switches: [], menus: [], messageBoxes: [], printed: [] };
  let seq = 0;
  const paths = { userData };

  class WC extends EventEmitter {
    constructor(win) { super(); this.id = ++seq; this.win = win; this.url = ''; this.mainFrame = { url: '' }; this.reloads = 0; this.openHandler = null; this.zoom = 1; }
    loadURL(u) { this.url = u; this.mainFrame.url = u; this.win.loaded.push(u); return Promise.resolve(); }
    loadFile(f, o = {}) { const u = pathToFileURL(f); if (o.query) u.search = new URLSearchParams(o.query).toString(); return this.loadURL(u.toString()); }
    getURL() { return this.url; }
    setWindowOpenHandler(fn) { this.openHandler = fn; }
    reload() { this.reloads += 1; }
    setZoomFactor(z) { this.zoom = z; }
    canGoBack() { return false; }
    goBack() { /* нет */ }
    getPrintersAsync() { return Promise.resolve([{ name: 'Fallback', displayName: 'Fallback' }]); }
    print(opts, cb) { rec.printed.push({ opts, url: this.url }); setImmediate(() => cb(true, '')); }
  }

  class BrowserWindow extends EventEmitter {
    static all = [];
    constructor(opts) {
      super(); this.opts = opts; this.loaded = []; this.visible = false; this.destroyed = false; this.kiosk = !!opts.kiosk; this.fullscreen = !!opts.fullscreen; this.maximized = false;
      this.webContents = new WC(this); BrowserWindow.all.push(this);
      setImmediate(() => this.emit('ready-to-show'));
    }
    loadURL(u) { return this.webContents.loadURL(u); }
    loadFile(f, o) { return this.webContents.loadFile(f, o); }
    show() { this.visible = true; } hide() { this.visible = false; } focus() { this.focused = true; }
    isVisible() { return this.visible; } isMinimized() { return false; } restore() { /* нет */ }
    maximize() { this.maximized = true; } isMaximized() { return this.maximized; } isFullScreen() { return this.fullscreen; }
    setFullScreen(v) { this.fullscreen = v; } setKiosk(v) { this.kiosk = v; } setAutoHideMenuBar() { /* нет */ }
    getBounds() { return { x: 10, y: 20, width: 1200, height: 700 }; }
    isDestroyed() { return this.destroyed; }
    destroy() { this.destroyed = true; this.emit('closed'); }
    close() {
      const e = { prevented: false, preventDefault() { this.prevented = true; } };
      this.emit('close', e);
      if (!e.prevented) { this.destroyed = true; this.emit('closed'); }
      return e;
    }
  }

  class Tray extends EventEmitter { constructor(img) { super(); this.img = img; this.menu = null; } setToolTip() { /* нет */ } setContextMenu(m) { this.menu = m; } destroy() { this.destroyed = true; } }

  const sessions = new Map();
  const session = {
    fromPartition(name) {
      if (!sessions.has(name)) {
        const s = new EventEmitter();
        s.name = name; s.permReq = null; s.permCheck = null; s.devPerm = null;
        s.setPermissionRequestHandler = (f) => { s.permReq = f; }; s.setPermissionCheckHandler = (f) => { s.permCheck = f; }; s.setDevicePermissionHandler = (f) => { s.devPerm = f; };
        s.webRequest = { onBeforeSendHeaders: (_filter, fn) => { s.beforeHeaders = fn; }, onCompleted: (_filter, fn) => { s.completed = fn; } };
        s.clearStorageData = async () => { s.cookiesCleared = true; };
        sessions.set(name, s);
      }
      return sessions.get(name);
    },
  };

  const handlers = new Map();
  const ipcMain = { handle: (ch, fn) => handlers.set(ch, fn) };

  const app = Object.assign(new EventEmitter(), {
    isPackaged: false, setName() { /* нет */ }, setAppUserModelId() { /* нет */ }, setPath(k, v) { paths[k] = v; }, getPath: (k) => paths[k] || userData,
    getVersion: () => '1.0.0-test', requestSingleInstanceLock: () => true, quit() { app.quitCalled = true; app.emit('will-quit'); },
    whenReady: () => Promise.resolve(), commandLine: { appendSwitch: (a, b) => rec.switches.push([a, b]) },
    setLoginItemSettings: (o) => rec.loginItems.push(o), quitCalled: false,
  });

  const electron = {
    app, BrowserWindow, Tray, ipcMain, session,
    Menu: { buildFromTemplate: (t) => { rec.menus.push(t); return t; }, setApplicationMenu() { /* нет */ } },
    nativeImage: { createFromPath: () => ({ isEmpty: () => false, resize: () => ({}) }) },
    screen: { getAllDisplays: () => [{ workArea: { x: 0, y: 0, width: 1920, height: 1080 } }] },
    shell: { openExternal: (u) => { rec.openExternal.push(u); return Promise.resolve(); } },
    dialog: { showMessageBox: async (o) => { rec.messageBoxes.push(o); return { response: electron.dialog.answer ?? 0 }; }, answer: 0 },
    net: { fetch: (u, o) => (/^http:\/\/127\.0\.0\.1:/.test(u) ? fetch(u, o) : electron.net.fake(u, o)), fake: async (u) => ({ ok: true, status: 200, url: u }) },
    contextBridge: {}, ipcRenderer: {},
  };

  /** Вызов обработчика IPC так, как это делает Electron: sender + senderFrame. */
  async function invoke(channel, { wc, frame, args = [] }) {
    const h = handlers.get(channel);
    if (!h) throw new Error('нет обработчика ' + channel);
    return h({ sender: wc, senderFrame: frame === undefined ? wc.mainFrame : frame }, ...args);
  }

  return { electron, rec, invoke, handlers, sessions, BrowserWindow, app };
}

module.exports = { makeElectron };
