// @ts-check
'use strict';
/** Пути к ресурсам: в разработке — из репозитория, в установленном приложении — из resources. */
const path = require('path');

const ROOT = path.join(__dirname, '..');

/** @param {boolean} isPackaged @param {string} resourcesPath */
function resolvePaths(isPackaged, resourcesPath) {
  return {
    root: ROOT,
    frontend: path.join(ROOT, 'frontend'),
    posUi: isPackaged ? path.join(resourcesPath, 'pos-ui') : path.join(ROOT, '..', 'frontend', 'dist'),
    backendDir: isPackaged ? path.join(resourcesPath, 'backend') : path.join(ROOT, '..', 'backend'),
    pgDir: isPackaged ? path.join(resourcesPath, 'postgresql') : path.join(ROOT, 'vendor', 'pgsql'),
    seedPath: isPackaged ? path.join(resourcesPath, 'seed.sql') : path.join(ROOT, 'vendor', 'seed.sql'),
    manifestPath: isPackaged ? path.join(resourcesPath, 'offline-manifest.json') : path.join(ROOT, 'vendor', 'offline-manifest.json'),
    preload: path.join(__dirname, 'preload.js'),
    psDir: isPackaged ? path.join(resourcesPath, 'ps') : path.join(ROOT, 'lib', 'ps'),
    icon: path.join(ROOT, 'build', 'icon.png'),
  };
}

module.exports = { resolvePaths };
