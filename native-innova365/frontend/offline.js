'use strict';
/** Экран «нет связи»: каждые 5 секунд проверяет сервер; как только он отвечает — открывает кассу. */
(function () {
  const q = new URLSearchParams(location.search);
  const target = q.get('target') === 'office' ? 'office' : '';
  const $ = (id) => document.getElementById(id);
  $('url').textContent = q.get('url') || '';
  const desc = (q.get('desc') || '').replace(/^ERR_/, '');
  $('why').textContent = desc ? `Причина: ${desc}` : '';

  const EVERY = 5;
  let left = EVERY, busy = false;

  async function attempt() {
    if (busy) return;
    busy = true;
    $('status').innerHTML = '<span class="spin"></span>Проверяю соединение…';
    try {
      const r = await window.innova.retry(target);
      if (r && r.ok) { $('status').textContent = 'Связь восстановлена, открываю…'; return; }
      $('why').textContent = r && r.error ? `Причина: ${r.error}` : $('why').textContent;
    } catch { /* повторим */ }
    busy = false; left = EVERY; tick();
  }

  function tick() { $('status').innerHTML = `<span class="spin"></span>Повторная попытка через <b id="sec">${left}</b> с…`; }

  setInterval(() => { if (busy) return; left -= 1; if (left <= 0) void attempt(); else tick(); }, 1000);
  $('retry').addEventListener('click', () => { left = 0; void attempt(); });
  $('settings').addEventListener('click', () => { void window.innova.openSettings(); });
})();
