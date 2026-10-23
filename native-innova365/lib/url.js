'use strict';
/** Работа с адресами: разбор адреса сервера, проверки «свой / локальный / частная сеть». Без зависимостей от Electron. */

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

const isLoopbackHost = (h) => /^(localhost|127(\.\d{1,3}){3}|\[::1\]|::1)$/i.test(String(h || ''));

/** Адрес из частных диапазонов (10/8, 172.16/12, 192.168/16) или loopback. */
function isPrivateIPv4(h) {
  if (!IPV4.test(h)) return false;
  const [a, b] = h.split('.').map(Number);
  if ([a, b, ...h.split('.').slice(2).map(Number)].some((x) => x > 255)) return false;
  return a === 127 || a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

/**
 * Приводит введённый пользователем адрес сервера к виду «схема://хост[:порт][/путь]».
 * Без схемы: для localhost и IP-адресов берётся http://, для доменов — https://.
 * Возвращает null, если адрес непригоден (не http/https, пустой, без хоста).
 */
function normalizeServerUrl(input) {
  let s = String(input ?? '').trim();
  if (!s || s.length > 300) return null;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) {
    const host = s.split(/[/:?#]/)[0];
    s = ((isLoopbackHost(host) || IPV4.test(host)) ? 'http://' : 'https://') + s;
  }
  let u;
  try { u = new URL(s); } catch { return null; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  if (!u.hostname || u.username || u.password) return null;
  return (u.origin + u.pathname).replace(/\/+$/, '');
}

/** Источник (схема + хост + порт) адреса, либо null. */
function originOf(url) {
  try { const u = new URL(url); return u.protocol === 'http:' || u.protocol === 'https:' ? u.origin : null; } catch { return null; }
}

const sameOrigin = (a, b) => { const x = originOf(a), y = originOf(b); return !!x && x === y; };

/** Страница с этого источника может печатать через встроенный агент: localhost всегда + перечисленные источники. */
function isAllowedOrigin(origin, allowed) {
  if (!origin) return false;
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return true;
  return (allowed || []).includes(origin);
}

/** Валидный адрес принтера для ретрансляции: только частные сети. */
const isRelayHost = (h) => isPrivateIPv4(String(h || ''));

module.exports = { normalizeServerUrl, originOf, sameOrigin, isAllowedOrigin, isLoopbackHost, isPrivateIPv4, isRelayHost };
