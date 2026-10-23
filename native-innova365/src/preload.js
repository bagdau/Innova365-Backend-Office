// @ts-check
'use strict';
/**
 * Единый preload (в песочнице относительные require недоступны, поэтому всё здесь).
 *  • Страницы приложения (file://): настройки и экран «нет связи» получают мост `window.innova`.
 *    Главный процесс принимает эти вызовы ТОЛЬКО от файлов приложения — со страниц сайта они отклоняются.
 *  • Страницы сайта (http/https): только `window.innovaNative` (признак «десктоп», версия). Если в настройках включена
 *    «печать без диалога», window.print() во вложенных окнах отправляет документ на печать в главный процесс.
 */
const { contextBridge, ipcRenderer, webFrame } = require('electron');

if (location.protocol === 'file:') {
  const call = (/** @type {string} */ ch, /** @type {any[]} */ ...args) => ipcRenderer.invoke('ui:' + ch, ...args);
  contextBridge.exposeInMainWorld('innova', {
    state: () => call('state'),
    unlock: (/** @type {string} */ pin) => call('unlock', pin),
    save: (/** @type {any} */ patch) => call('save', patch),
    setPin: (/** @type {string} */ pin) => call('setPin', pin),
    clearPin: () => call('clearPin'),
    newToken: () => call('newToken'),
    checkUrl: (/** @type {string} */ url) => call('checkUrl', url),
    printers: () => call('printers'),
    systemPrinters: () => call('systemPrinters'),
    testPrint: (/** @type {any} */ opts) => call('testPrint', opts),
    testAgent: () => call('testAgent'),
    restartAgent: () => call('restartAgent'),
    logs: () => call('logs'),
    retry: (/** @type {string=} */ target) => call('retry', target),
    openSettings: () => call('openSettings'),
    openApp: () => call('openApp'),
    quit: () => call('quit'),
  });
} else {
  const info = { version: '' };
  ipcRenderer.invoke('web:info').then((v) => { if (v && typeof v.version === 'string') info.version = v.version; }).catch(() => undefined);
  contextBridge.exposeInMainWorld('innovaNative', {
    isDesktop: true,
    get version() { return info.version; },
    platform: process.platform,
  });
  // мост для печати документа: вызывается переопределённым window.print()
  contextBridge.exposeInMainWorld('__innovaPrintHtml', (/** @type {string} */ html, /** @type {{title?: string}} */ opts) => ipcRenderer.invoke('web:printHtml', String(html).slice(0, 4_000_000), opts || {}));

  // Документы касса печатает так: создаёт скрытый iframe (about:blank), пишет в него вёрстку и вызывает contentWindow.print().
  // Preload в такие iframe не запускается, поэтому из главного кадра перехватываем получение iframe.contentWindow и подменяем print там.
  // Само приложение (окно кассы) не затрагивается: печать «страницы» остаётся обычной.
  const PATCH = `(function () {
    if (window.__innovaPatchInstalled) return; window.__innovaPatchInstalled = true;
    function patchWindow(w) {
      try {
        if (!w || w.__innovaPrintPatched) return; w.__innovaPrintPatched = true;
        var orig = w.print.bind(w);
        w.print = function () {
          var bridge = window.__innovaPrintHtml;
          if (!bridge) { orig(); return; }
          var html = '<!doctype html>' + w.document.documentElement.outerHTML;
          bridge(html, { title: w.document.title }).then(function (r) { if (!r || !r.handled) orig(); }, function () { orig(); });
        };
      } catch (e) { /* чужой источник — не трогаем */ }
    }
    var desc = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'contentWindow');
    if (desc && desc.get) Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', { configurable: true, enumerable: desc.enumerable, get: function () { var w = desc.get.call(this); patchWindow(w); return w; } });
    window.__innovaPatchWindow = patchWindow;
  })();`;
  // окна, открытые страницей для печати (window.open), — документ, а не приложение: подменяем print в них самих
  webFrame.executeJavaScript(PATCH + (window.opener ? ';window.__innovaPatchWindow(window);' : '')).catch(() => undefined);
}
