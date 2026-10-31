// @ts-check
'use strict';
/** Права сайта и WebUSB: сайту кассы разрешено только необходимое. */
const electron = require('electron');

/** Всё остальное (камера, микрофон, геолокация, MIDI и т.д.) отклоняется. */
const ALLOWED = new Set(['notifications', 'fullscreen', 'clipboard-sanitized-write', 'window-management']);

/** @param {any} ctx @param {ReturnType<typeof import('./windows').createWindows>} win */
function setupSession(ctx, win) {
  const { session, dialog } = electron;
  const ses = session.fromPartition('persist:innova365');
  ses.webRequest.onBeforeSendHeaders({ urls: ['https://innova365.kz/api/*'] }, (details, callback) => {
    const token = ctx.config.get().activation.token;
    if (token) details.requestHeaders['X-Innova-Device'] = token;
    callback({ requestHeaders: details.requestHeaders });
  });
  // Неверный пароль тоже даёт 401. Проверяем устройство отдельно и показываем
  // повторную активацию только если сервер действительно отозвал его токен.
  ses.webRequest.onCompleted({ urls: ['<all_urls>'] }, (details) => {
    if (ctx.localEngine || details.statusCode !== 401 || !ctx.config.hasActivation()) return;
    try {
      const u = new URL(details.url);
      if ((u.pathname === '/api/auth/login' || u.pathname === '/api/auth/refresh') && trusted(details.url)) void ctx.checkActivation();
    } catch { /* ignore invalid URL */ }
  });
  const trusted = (/** @type {string} */ url) => !!url && (win.isTrusted(url) || (!!ctx.config.get().officeUrl && require('../lib/url').sameOrigin(url, ctx.config.get().officeUrl)));

  ses.setPermissionRequestHandler((_wc, permission, callback, details) => callback(ALLOWED.has(permission) && trusted(details.requestingUrl)));
  ses.setPermissionCheckHandler((_wc, permission, requestingOrigin) => ALLOWED.has(permission) && trusted(requestingOrigin));

  // WebUSB: прямая печать на USB-принтер из страницы кассы
  ses.setDevicePermissionHandler((d) => !ctx.localEngine && d.deviceType === 'usb' && trusted(d.origin));
  ses.on('select-usb-device', (event, details, callback) => {
    event.preventDefault();
    if (ctx.localEngine) { callback(); return; }
    const list = details.deviceList || [];
    const printers = list.filter((d) => d.deviceClass === 7);             // класс 7 = принтер
    const cand = printers.length ? printers : list;
    if (!cand.length) { callback(); return; }
    if (cand.length === 1) { callback(cand[0].deviceId); return; }
    const names = cand.map((d) => d.productName || d.manufacturerName || `USB ${d.vendorId.toString(16)}:${d.productId.toString(16)}`);
    void dialog.showMessageBox({ type: 'question', title: 'USB-принтер', message: 'Выберите USB-устройство', buttons: [...names, 'Отмена'], cancelId: names.length, defaultId: 0 })
      .then((r) => (r.response < cand.length ? callback(cand[r.response].deviceId) : callback()));
  });

  // страницы приложения (настройки) — без прав вообще
  const ui = session.fromPartition('innova-ui');
  ui.setPermissionRequestHandler((_wc, _p, callback) => callback(false));
  ui.setPermissionCheckHandler(() => false);
  const doc = session.fromPartition('innova-print');
  doc.setPermissionRequestHandler((_wc, _p, callback) => callback(false));
  doc.setPermissionCheckHandler(() => false);
}

module.exports = { setupSession, ALLOWED };
