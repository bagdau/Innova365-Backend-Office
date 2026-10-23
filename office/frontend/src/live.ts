/**
 * Живые обновления Office. Сервер держит поток событий (SSE): любое изменение в БД — из кассы, из Office или из SQL —
 * приходит сюда за доли секунды, и открытые экраны тихо перечитывают данные. Если поток недоступен
 * (прокси буферизует, обрыв сети), включается частый опрос — экраны всё равно обновляются быстро.
 */
type Fn = () => void;
const subs = new Set<Fn>();
let live = false;
let flushTimer: ReturnType<typeof setTimeout> | undefined;

export const onLiveChange = (fn: Fn): (() => void) => { subs.add(fn); return () => { subs.delete(fn); }; };
export const isLive = () => live;

/** Склеиваем всплеск событий в одно обновление (не чаще раза в ~100 мс). */
function bump(): void {
  if (flushTimer) return;
  flushTimer = setTimeout(() => { flushTimer = undefined; subs.forEach((f) => { try { f(); } catch { /* ignore */ } }); }, 100);
}

export function startLive(): () => void {
  let es: EventSource | null = null;
  let reopen: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;
  let lastEvent = Date.now();

  const open = () => {
    if (stopped) return;
    es?.close();
    es = new EventSource('/api/events');
    es.addEventListener('ready', () => { live = true; lastEvent = Date.now(); bump(); });
    es.addEventListener('change', () => { lastEvent = Date.now(); bump(); });
    es.onmessage = () => { lastEvent = Date.now(); };
    es.onerror = () => {
      live = false;
      if (es?.readyState === EventSource.CLOSED) { clearTimeout(reopen); reopen = setTimeout(open, 3000); }   // сам EventSource переподключается, только пока не закрыт
    };
  };
  open();

  // без потока — опрос раз в 1,5 с; с потоком — страховочное обновление раз в 30 с
  const poll = setInterval(() => {
    if (document.hidden) return;
    if (!live || Date.now() - lastEvent > 30_000) bump();
  }, 1500);
  const wake = () => { if (!document.hidden) { bump(); if (!live) open(); } };
  document.addEventListener('visibilitychange', wake);
  window.addEventListener('online', wake);

  return () => {
    stopped = true; live = false;
    es?.close(); clearInterval(poll); clearTimeout(reopen);
    document.removeEventListener('visibilitychange', wake);
    window.removeEventListener('online', wake);
  };
}
