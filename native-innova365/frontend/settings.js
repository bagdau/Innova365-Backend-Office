'use strict';
/** Окно настроек. Всё, что пришло от системы (имена принтеров и т. п.), выводится через textContent — без разметки. */
(function () {
  const api = window.innova;
  const q = new URLSearchParams(location.search);
  const $ = (id) => document.getElementById(id);
  const show = (id, on) => $(id).classList.toggle('hide', !on);
  let st = null;

  function msg(id, kind, text) {
    const el = $(id); if (!el) return;
    el.className = 'msg' + (kind ? ' ' + kind + ' show' : '');
    el.textContent = text || '';
  }
  const el = (tag, props, ...kids) => {
    const n = document.createElement(tag);
    if (props) for (const [k, v] of Object.entries(props)) { if (k === 'class') n.className = v; else n.setAttribute(k, v); }
    for (const k of kids) n.append(k instanceof Node ? k : document.createTextNode(String(k)));
    return n;
  };
  const badge = (text, tone) => el('span', { class: 'badge ' + tone }, text);

  /* ───────── запуск ───────── */
  async function init() {
    st = await api.state();
    $('ver').textContent = 'v' + st.version;
    if (st.first) { show('first', true); show('lock', false); show('app', false); $('subtitle').textContent = 'Первый запуск'; $('f_server').focus(); return; }
    if (st.locked) {
      show('lock', true); show('first', false); show('app', false); $('pin').focus();
      if (q.get('hint') === 'quit') $('lockHint').textContent = 'Чтобы закрыть приложение, введите PIN-код.';
      return;
    }
    show('lock', false); show('first', false); show('app', true);
    fill();
    tab(q.get('tab') || 'connection');
    if (q.get('hint') === 'quit') show('quitHint', true);
    if (q.get('hint') === 'office') msg('m_connection', 'warn', 'Укажите адрес Office, чтобы открывать его из приложения.');
    void loadPrinters(); void loadLogs();
  }

  /* ───────── PIN ───────── */
  async function unlock() {
    const r = await api.unlock($('pin').value);
    if (r.ok) { $('pin').value = ''; await init(); return; }
    msg('lockMsg', 'err', r.error || 'Неверный PIN-код'); $('pin').select();
  }
  $('unlock').addEventListener('click', () => void unlock());
  $('pin').addEventListener('keydown', (e) => { if (e.key === 'Enter') void unlock(); });

  /* ───────── первый запуск ───────── */
  const checkUrlInto = async (url, msgId) => {
    msg(msgId, '', ''); if (!url.trim()) { msg(msgId, 'err', 'Введите адрес'); return null; }
    msg(msgId, 'warn', 'Проверяю…');
    const r = await api.checkUrl(url);
    if (r.ok) msg(msgId, 'ok', `Сервер отвечает (${r.ms} мс): ${r.url}`);
    else msg(msgId, 'err', r.error ? `Не удалось подключиться: ${r.error}` : `Сервер ответил ошибкой ${r.status}`);
    return r;
  };
  $('f_check').addEventListener('click', () => void checkUrlInto($('f_server').value, 'f_msg'));
  $('f_go').addEventListener('click', async () => {
    const r = await api.save({ serverUrl: $('f_server').value });
    if (!r.ok) { msg('f_msg', 'err', r.error || 'Не удалось сохранить'); return; }
    window.close();
  });
  $('f_server').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('f_go').click(); });

  /* ───────── вкладки ───────── */
  function tab(name) {
    document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === name));
    document.querySelectorAll('.pane').forEach((p) => p.classList.toggle('on', p.id === 'pane-' + name));
  }
  $('tabs').addEventListener('click', (e) => { const b = e.target.closest('button[data-tab]'); if (b) tab(b.dataset.tab); });

  /* ───────── заполнение и сохранение ───────── */
  function fill() {
    const c = st.config, a = st.agent;
    $('serverUrl').value = c.serverUrl; $('officeUrl').value = c.officeUrl;
    for (const k of ['fullscreen', 'kiosk', 'closeToTray', 'autoStart']) $(k).checked = !!c[k];
    $('zoom').value = c.zoom; $('zoomVal').textContent = Math.round(c.zoom * 100) + '%';
    $('agent.enabled').checked = c.agent.enabled; $('agent.port').value = c.agent.port; $('agent.lan').checked = c.agent.lan;
    $('agent.extraOrigins').value = c.agent.extraOrigins.join('\n'); $('token').value = c.agent.token;
    $('print.silent').checked = c.print.silent;
    renderAgent(a); renderPin(c.pinSet); renderAbout();
  }

  function renderAgent(a) {
    const map = { running: ['работает :' + a.port + (a.lan ? ' (сеть)' : ''), 'good'], stopped: ['выключен', 'muted'], busy: ['порт занят', 'warn'], error: ['ошибка', 'bad'] };
    const [text, tone] = map[a.state] || map.stopped;
    const b = $('agentBadge'); b.className = 'badge ' + tone; b.textContent = text; b.title = a.error || '';
    if (a.error) msg('m_agent', 'warn', a.error);
  }
  function renderPin(set) { const b = $('pinBadge'); b.className = 'badge ' + (set ? 'good' : 'muted'); b.textContent = set ? 'задан' : 'не задан'; show('clearPin', set); }

  function renderAbout() {
    const rows = [['Версия', st.version], ['Платформа', st.platform], ['Electron', st.versions.electron], ['Chromium', st.versions.chrome], ['Node.js', st.versions.node], ['Папка данных', st.userData], ['Касса', st.config.serverUrl || '—']];
    const tb = $('aboutTable'); tb.replaceChildren(...rows.map(([k, v]) => el('tr', null, el('td', { class: 'muted' }, k), el('td', { class: 'mono' }, v))));
  }

  async function save(group) {
    const patch = {};
    const msgId = { connection: 'm_connection', agent: 'm_agent', silent: 'm_silent', window: 'm_window' }[group];
    if (group === 'connection') Object.assign(patch, { serverUrl: $('serverUrl').value, officeUrl: $('officeUrl').value });
    if (group === 'agent') patch.agent = { enabled: $('agent.enabled').checked, port: Number($('agent.port').value), lan: $('agent.lan').checked, extraOrigins: $('agent.extraOrigins').value };
    if (group === 'silent') patch.print = { silent: $('print.silent').checked, deviceName: $('print.deviceName').value };
    if (group === 'window') Object.assign(patch, { fullscreen: $('fullscreen').checked, kiosk: $('kiosk').checked, closeToTray: $('closeToTray').checked, autoStart: $('autoStart').checked, zoom: Number($('zoom').value) });
    const r = await api.save(patch);
    if (!r.ok) { msg(msgId, 'err', r.error || 'Не удалось сохранить'); return; }
    st.config = r.config; st.agent = r.agent; fill();
    const kioskNoPin = group === 'window' && r.config.kiosk && !r.config.pinSet;
    msg(msgId, kioskNoPin ? 'warn' : 'ok', kioskNoPin ? 'Сохранено. В режиме киоска задайте PIN-код на вкладке «Безопасность», иначе выйти сможет любой.' : 'Сохранено');
  }
  document.querySelectorAll('[data-save]').forEach((b) => b.addEventListener('click', () => void save(b.dataset.save)));
  document.querySelectorAll('[data-check]').forEach((b) => b.addEventListener('click', () => void checkUrlInto($(b.dataset.check).value, 'm_' + b.dataset.check)));
  $('zoom').addEventListener('input', () => { $('zoomVal').textContent = Math.round(Number($('zoom').value) * 100) + '%'; });

  /* ───────── агент ───────── */
  $('testAgent').addEventListener('click', async () => {
    msg('m_agent', 'warn', 'Проверяю…');
    const r = await api.testAgent();
    if (r.ok) msg('m_agent', 'ok', `Агент отвечает за ${r.ms} мс (${r.health.agent}, версия ${r.health.version}).`);
    else msg('m_agent', 'err', r.error || 'Агент не отвечает');
  });
  $('restartAgent').addEventListener('click', async () => { const r = await api.restartAgent(); if (r.ok) { st.agent = r.agent; renderAgent(r.agent); msg('m_agent', r.agent.state === 'running' ? 'ok' : 'warn', r.agent.state === 'running' ? 'Агент перезапущен' : (r.agent.error || 'Агент не запущен')); } });
  $('newToken').addEventListener('click', async () => {
    if (!window.confirm('Выпустить новый токен? Сервер и другие устройства, которые печатают на этот агент по токену, придётся перенастроить.')) return;
    const r = await api.newToken(); if (r.ok) { st.config = r.config; $('token').value = r.config.agent.token; msg('m_agent', 'ok', 'Новый токен выпущен'); }
  });

  /* ───────── принтеры ───────── */
  async function loadPrinters() {
    const tb = $('printers');
    const r = await api.printers();
    if (!r.ok) { tb.replaceChildren(el('tr', null, el('td', { colspan: '3', class: 'muted' }, 'Не удалось получить список: ' + (r.error || '')))); return; }
    const list = r.printers;
    const best = [...list].sort((a, b) => b.score - a.score)[0];
    const bestName = best && best.score > -5 ? best.name : null;
    const receipt = (p) => p.thermal || /(generic|text only)/i.test(p.name);
    const warn = bestName && !receipt(best);
    $('autoWarn').classList.toggle('hide', !warn);
    if (warn) $('autoWarn').textContent = `Среди принтеров нет кассового: «Авто» выберет «${bestName}», а он не похож на чековый (нет POS / XP / Receipt / Thermal в названии). Чек ESC/POS на обычный принтер выйдет «мусором» — подключите чековый принтер или выберите его вручную.`;
    tb.replaceChildren(...(list.length ? list.map((p) => el('tr', p.name === bestName ? { class: 'best' } : null,
      el('td', null, p.name, p.isDefault ? ' ' : '', p.isDefault ? badge('по умолчанию', 'muted') : ''),
      el('td', { class: 'mono' }, p.port || '—'),
      el('td', null, p.thermal ? badge('чековый', 'good') : '', ' ', p.usb ? badge('USB', 'muted') : '', ' ', p.offline ? badge('не в сети', 'bad') : '', p.name === bestName ? ' ' : '', p.name === bestName ? badge('выберется «Авто»', 'warn') : '')))
      : [el('tr', null, el('td', { colspan: '3', class: 'muted' }, 'Принтеры не найдены. Подключите принтер и установите драйвер Windows.'))]));
    const tp = $('tp_printer'); const cur = tp.value;
    tp.replaceChildren(el('option', { value: 'auto' }, 'Авто (кассовый принтер)'), ...list.map((p) => el('option', { value: p.name }, p.name)), el('option', { value: '__ip' }, 'Сетевой принтер по IP…'));
    if ([...tp.options].some((o) => o.value === cur)) tp.value = cur;
    onTpChange();
    const sp = await api.systemPrinters();
    const dev = $('print.deviceName');
    dev.replaceChildren(el('option', { value: '' }, 'Принтер Windows по умолчанию'), ...(sp.ok ? sp.printers : []).map((p) => el('option', { value: p.name }, p.displayName || p.name)));
    dev.value = st.config.print.deviceName;
    if (dev.value !== st.config.print.deviceName) dev.append(el('option', { value: st.config.print.deviceName }, st.config.print.deviceName + ' (не найден)')), dev.value = st.config.print.deviceName;
  }
  const onTpChange = () => show('tp_ip_row', $('tp_printer').value === '__ip');
  $('tp_printer').addEventListener('change', onTpChange);
  $('refreshPrinters').addEventListener('click', () => void loadPrinters());
  $('testPrint').addEventListener('click', async () => {
    const sel = $('tp_printer').value;
    const printer = sel === '__ip' ? $('tp_ip').value.trim() : sel;
    if (sel === '__ip' && !printer) { msg('m_testPrint', 'err', 'Введите адрес принтера'); return; }
    msg('m_testPrint', 'warn', 'Отправляю на печать…'); $('testPrint').disabled = true;
    try {
      const r = await api.testPrint({ printer, width: Number($('tp_width').value), codepage: $('tp_cp').value });
      if (r.ok) msg('m_testPrint', 'ok', `Отправлено на «${r.printer}» за ${r.ms} мс. Если чек не вышел — проверьте бумагу, крышку и кабель.`);
      else msg('m_testPrint', 'err', r.error || 'Не удалось напечатать');
    } finally { $('testPrint').disabled = false; }
  });

  /* ───────── PIN ───────── */
  $('setPin').addEventListener('click', async () => {
    const a = $('newPin').value, b = $('newPin2').value;
    if (a !== b) { msg('m_pin', 'err', 'PIN-коды не совпадают'); return; }
    const r = await api.setPin(a);
    if (!r.ok) { msg('m_pin', 'err', r.error || 'Не удалось сохранить PIN'); return; }
    st.config = r.config; $('newPin').value = ''; $('newPin2').value = ''; renderPin(true); msg('m_pin', 'ok', 'PIN-код сохранён');
  });
  $('clearPin').addEventListener('click', async () => {
    if (!window.confirm('Снять PIN-код с настроек?')) return;
    const r = await api.clearPin(); if (r.ok) { st.config = r.config; renderPin(false); msg('m_pin', 'ok', 'PIN-код снят'); }
  });

  /* ───────── о программе ───────── */
  async function loadLogs() { const r = await api.logs(); $('logBox').textContent = r.ok ? (r.lines.join('\n') || 'Журнал пуст') : 'Не удалось получить журнал'; $('logBox').scrollTop = 1e9; }
  $('refreshLog').addEventListener('click', () => void loadLogs());
  $('openApp').addEventListener('click', () => void api.openApp());
  $('quit').addEventListener('click', () => { if (window.confirm('Закрыть Innova365? Печать чеков на этом компьютере остановится.')) void api.quit(); });

  void init();
})();
