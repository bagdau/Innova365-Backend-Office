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
    preload: path.join(__dirname, 'preload.js'),
    psDir: isPackaged ? path.join(resourcesPath, 'ps') : path.join(ROOT, 'lib', 'ps'),
    icon: path.join(ROOT, 'build', 'icon.png'),
  };
}

module.exports = { resolvePaths };
