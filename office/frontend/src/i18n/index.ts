/**
 * Язык интерфейса: русский (исходный) и казахский.
 * Тексты в коде написаны по-русски; при выборе казахского языка переводчик заменяет их в готовой странице по словарю
 * (kk.ts): тексты, подсказки, placeholder, заголовки. Данные (названия блюд, имена, суммы) не трогаются.
 * Всё, чего нет в словаре, остаётся по-русски — страница никогда не ломается. Печатные документы (счета, акты) всегда на русском.
 */
import { KK } from './kk';

export type Lang = 'ru' | 'kk';
const KEY = 'office-lang';
const CYR = /[А-Яа-яЁё]/;

let lang: Lang = (() => { try { return localStorage.getItem(KEY) === 'kk' ? 'kk' : 'ru'; } catch { return 'ru'; } })();
export const getLang = (): Lang => lang;
export const locale = (): string => (lang === 'kk' ? 'kk-KZ' : 'ru-RU');

/* ───────── Словарь: точные совпадения, шаблоны с подстановками и подстроки ───────── */
const exact = new Map<string, string>();
const templates: { re: RegExp; to: string }[] = [];
let partsRe: RegExp | null = null;
let partsMap = new Map<string, string>();

function build(): void {
  if (exact.size) return;
  const parts: string[] = [];
  for (const [ru, kk] of Object.entries(KK)) {
    if (!kk) continue;
    if (/\{\d+\}/.test(ru)) {
      const re = new RegExp('^' + ru.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/\{\d+\}/g, '([\\s\\S]+?)') + '$');
      templates.push({ re, to: kk });
    } else {
      exact.set(ru, kk);
      if (ru.length >= 6) { parts.push(ru); partsMap.set(ru, kk); }
    }
  }
  templates.sort((a, b) => b.re.source.length - a.re.source.length);
  parts.sort((a, b) => b.length - a.length);
  partsRe = parts.length ? new RegExp(parts.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g') : null;
}

const cache = new Map<string, string>();
export const missing = new Set<string>();

/** Перевод одного текста. Пробелы по краям сохраняются; если перевода нет — возвращается исходный текст. */
export function tr(text: string): string {
  if (lang !== 'kk' || !CYR.test(text)) return text;
  const hit = cache.get(text);
  if (hit !== undefined) return hit;
  build();
  const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(text)!;
  const core = m[2];
  let out: string | undefined = exact.get(core);
  if (out === undefined) {
    for (const t of templates) {
      const r = t.re.exec(core);
      if (r) { out = t.to.replace(/\{(\d+)\}/g, (_, i) => tr(r[+i + 1] ?? '')); break; }
    }
  }
  if (out === undefined && partsRe) {
    partsRe.lastIndex = 0;
    const replaced = core.replace(partsRe, (x) => partsMap.get(x) ?? x);
    if (replaced !== core) out = replaced;
  }
  const res = out === undefined ? text : m[1] + out + m[3];
  if (out === undefined && CYR.test(core)) missing.add(core);
  if (cache.size > 20000) cache.clear();
  cache.set(text, res);
  return res;
}

/* ───────── Переводчик страницы ───────── */
const ATTRS = ['placeholder', 'title', 'aria-label', 'alt'];
const textState = new WeakMap<Node, { orig: string; last: string }>();
const attrState = new WeakMap<Element, Map<string, { orig: string; last: string }>>();
let observer: MutationObserver | null = null;
let queue = new Set<Node>();
let raf = 0;
const skip = (el: Element | null): boolean => { for (let e = el; e; e = e.parentElement) { const t = e.tagName; if (t === 'SCRIPT' || t === 'STYLE' || t === 'CODE' || t === 'PRE' || t === 'TEXTAREA' || e.hasAttribute('data-no-i18n')) return true; } return false; };
const enabledHere = () => !location.pathname.startsWith('/print/');

function doText(n: Text): void {
  if (skip(n.parentElement)) return;
  const st = textState.get(n);
  const cur = n.nodeValue ?? '';
  if (st && cur === st.last) return;                 // уже переведён нами
  const orig = cur;
  const out = tr(orig);
  textState.set(n, { orig, last: out });
  if (out !== cur) n.nodeValue = out;
}
function doAttrs(el: Element): void {
  if (skip(el)) return;
  for (const a of ATTRS) {
    const v = el.getAttribute(a);
    if (v === null) continue;
    let m = attrState.get(el); if (!m) { m = new Map(); attrState.set(el, m); }
    const st = m.get(a);
    if (st && v === st.last) continue;
    const out = tr(v);
    m.set(a, { orig: v, last: out });
    if (out !== v) el.setAttribute(a, out);
  }
}
function walk(root: Node): void {
  if (root.nodeType === 3) { doText(root as Text); return; }
  if (root.nodeType !== 1) return;
  const el = root as Element;
  doAttrs(el);
  const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  for (let n = w.nextNode(); n; n = w.nextNode()) { if (n.nodeType === 3) doText(n as Text); else doAttrs(n as Element); }
}
function flush(): void { raf = 0; const q = queue; queue = new Set(); if (lang !== 'kk' || !enabledHere()) return; for (const n of q) if (n.isConnected) walk(n); }

function restore(): void {
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    if (n.nodeType === 3) { const st = textState.get(n); if (st && (n as Text).nodeValue === st.last) (n as Text).nodeValue = st.orig; }
    else { const m = attrState.get(n as Element); if (m) for (const [a, st] of m) if ((n as Element).getAttribute(a) === st.last) (n as Element).setAttribute(a, st.orig); }
  }
}

function start(): void {
  if (observer) return;
  observer = new MutationObserver((muts) => {
    for (const m of muts) {
      if (m.type === 'childList') m.addedNodes.forEach((n) => queue.add(n));
      else if (m.type === 'characterData') queue.add(m.target);
      else if (m.type === 'attributes') queue.add(m.target);
    }
    if (!raf) raf = requestAnimationFrame(flush);
  });
  observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  if (enabledHere()) walk(document.body);
}
function stop(): void { observer?.disconnect(); observer = null; queue.clear(); }

const listeners = new Set<() => void>();
export const onLangChange = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };

export function setLang(l: Lang): void {
  if (l === lang) return;
  lang = l;
  try { localStorage.setItem(KEY, l); } catch { /* ignore */ }
  document.documentElement.lang = l === 'kk' ? 'kk' : 'ru';
  cache.clear();
  if (l === 'kk') start(); else { stop(); restore(); document.title = 'Innova Office'; }
  listeners.forEach((f) => f());
}

/** Запуск при старте приложения: если выбран казахский — переводчик включается сразу. */
export function initI18n(): void {
  document.documentElement.lang = lang === 'kk' ? 'kk' : 'ru';
  if (lang === 'kk') start();
  (window as unknown as { __i18nMissing: () => string[] }).__i18nMissing = () => [...missing];
}
