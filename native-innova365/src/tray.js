// @ts-check
'use strict';
/** Значок в системном трее: быстрый доступ к кассе, Office, настройкам и состоянию печати. */
const electron = require('electron');

/** @param {any} ctx @param {ReturnType<typeof import('./windows').createWindows>} win @param {() => void} requestQuit */
function createTray(ctx, win, requestQuit) {
  const { Tray, Menu, nativeImage } = electron;
  const img = nativeImage.createFromPath(ctx.paths.icon);
  const tray = new Tray(img.isEmpty() ? img : img.resize({ width: 16, height: 16 }));
  tray.setToolTip('Innova365');

  function build() {
    const cfg = ctx.config.get();
    const a = ctx.agent.status();
    const agentLabel = !cfg.agent.enabled ? 'Агент печати: выключен' : a.state === 'running' ? `Агент печати: работает (порт ${a.port})` : a.state === 'busy' ? 'Агент печати: порт занят' : 'Агент печати: ошибка';
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: 'Открыть кассу', click: () => win.showMain() },
      { label: 'Открыть Office', enabled: !!cfg.officeUrl, click: () => win.openOffice() },
      { label: 'Перезагрузить страницу', click: () => win.reloadMain() },
      { type: 'separator' },
      { label: agentLabel, enabled: false },
      { label: 'Настройки…', click: () => win.openSettings({}) },
      { type: 'separator' },
      { label: 'Выход', click: () => requestQuit() },
    ]));
  }

  tray.on('click', () => win.showMain());
  build();
  return { tray, refresh: build, destroy: () => tray.destroy() };
}

module.exports = { createTray };
