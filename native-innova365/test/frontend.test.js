'use strict';
/** Страницы приложения в jsdom с подставным мостом window.innova: проверяем логику экранов без запуска Electron. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const FRONT = path.join(__dirname, '..', 'frontend');
const tick = (ms = 20) => new Promise((r) => setTimeout(r, ms));
const opened = [];
test.after(() => { for (const close of opened) { try { close(); } catch { /* ignore */ } } });

const BASE_CONFIG = {
  version: 1, serverUrl: 'https://innova365.kz', activation: { active: true, restaurantName: 'Aisultan' }, officeUrl: '', fullscreen: false, kiosk: false, autoStart: false, closeToTray: false, zoom: 1,
  agent: { enabled: true, port: 9101, lan: false, token: 'a'.repeat(36), extraOrigins: ['https://x.kz'] },
  print: { silent: false, deviceName: '' }, window: {}, pinSet: false,
};

/** Подставной мост: журнал вызовов + настраиваемые ответы. */
function bridge(over = {}) {
  const calls = [];
  /** значения приходят из другого «мира» (jsdom) — приводим к обычным объектам, чтобы сравнивать deepEqual */
  const rec = (a) => calls.push(JSON.parse(JSON.stringify(a)));
  const state = { ok: true, locked: false, first: false, hasPin: false, version: '1.0.0', platform: 'win32', config: structuredClone(BASE_CONFIG), agent: { state: 'running', port: 9101, lan: false, error: '' }, versions: { electron: '45.0.0', chrome: '140', node: '24' }, userData: 'C:\\Users\\x\\AppData\\Roaming\\Innova365' };
  const api = {
    state: async () => { rec(['state']); return structuredClone(state); },
    unlock: async (pin) => { rec(['unlock', pin]); if (pin === '1234') { state.locked = false; return { ok: true }; } return { ok: false, error: 'Неверный PIN-код' }; },
    activate: async (code) => { rec(['activate', code]); return code === 'ABCD-EFGH-JKLM' ? { ok: true, restaurantName: 'Aisultan' } : { ok: false, error: 'Неверный код' }; },
    save: async (patch) => { rec(['save', patch]); if (patch.serverUrl === 'bad') return { ok: false, error: 'Адрес указан неверно' }; Object.assign(state.config, patch.agent ? { agent: { ...state.config.agent, ...patch.agent, extraOrigins: String(patch.agent.extraOrigins).split(/\s+/).filter(Boolean) } } : patch); return { ok: true, config: structuredClone(state.config), agent: state.agent }; },
    setPin: async (pin) => { rec(['setPin', pin]); if (pin.length < 4) return { ok: false, error: 'PIN: от 4 до 16 символов' }; state.config.pinSet = true; return { ok: true, config: structuredClone(state.config), agent: state.agent }; },
    clearPin: async () => { rec(['clearPin']); state.config.pinSet = false; return { ok: true, config: structuredClone(state.config), agent: state.agent }; },
    newToken: async () => { rec(['newToken']); state.config.agent.token = 'b'.repeat(36); return { ok: true, config: structuredClone(state.config), agent: state.agent }; },
    checkUrl: async (u) => { rec(['checkUrl', u]); return u.includes('down') ? { ok: false, error: 'ERR_CONNECTION_REFUSED', ms: 5 } : { ok: true, status: 200, ms: 42, url: 'https://' + u }; },
    printers: async () => ({ ok: true, printers: [
      { name: 'Microsoft Print to PDF', port: 'PORTPROMPT:', isDefault: true, offline: false, usb: false, thermal: false, score: -9 },
      { name: 'XP-80C', port: 'USB001', isDefault: false, offline: false, usb: true, thermal: true, score: 6 },
      { name: '<img src=x onerror="window.__xss=1">', port: 'USB002', isDefault: false, offline: true, usb: true, thermal: false, score: -18 },
    ] }),
    systemPrinters: async () => ({ ok: true, printers: [{ name: 'XP-80C', displayName: 'XP-80C', isDefault: false }] }),
    testPrint: async (o) => { rec(['testPrint', o]); return o.printer === 'BAD' ? { ok: false, error: 'OpenPrinter: BAD' } : { ok: true, printer: o.printer === 'auto' ? 'XP-80C' : o.printer, ms: 33 }; },
    testAgent: async () => { rec(['testAgent']); return { ok: true, ms: 4, health: { agent: 'innova365', version: '1.0.0-desktop' } }; },
    restartAgent: async () => { rec(['restartAgent']); return { ok: true, config: structuredClone(state.config), agent: state.agent }; },
    logs: async () => ({ ok: true, lines: ['2026 [app] запуск', '2026 [agent] запущен'] }),
    retry: async (t) => { rec(['retry', t]); return over.retry ? over.retry() : { ok: false, error: 'ERR_INTERNET_DISCONNECTED' }; },
    openSettings: async () => { rec(['openSettings']); return { ok: true }; },
    openApp: async () => { rec(['openApp']); return { ok: true }; },
    quit: async () => { rec(['quit']); return { ok: true }; },
  };
  Object.assign(state, over.state || {});
  return { api, calls, state };
}

async function open(page, query, over) {
  const b = bridge(over);
  const dom = new JSDOM(fs.readFileSync(path.join(FRONT, page), 'utf8'), {
    url: 'file:///app/frontend/' + page + (query || ''), runScripts: 'outside-only', pretendToBeVisual: true,
  });
  const w = dom.window;
  opened.push(w.close.bind(w));
  w.innova = b.api;
  w.confirm = () => true;
  const src = fs.readFileSync(path.join(FRONT, page.replace('.html', '.js')), 'utf8');
  w.eval(src);
  await tick(50);
  return { dom, w, doc: w.document, ...b, click: async (sel) => { w.document.querySelector(sel).click(); await tick(); }, byId: (id) => w.document.getElementById(id) };
}
const visible = (el) => !el.classList.contains('hide');

test('CSP: страницы не используют inline-скрипты и стили', () => {
  for (const f of ['settings.html', 'offline.html', 'activation.html']) {
    const h = fs.readFileSync(path.join(FRONT, f), 'utf8');
    assert.match(h, /Content-Security-Policy/); assert.match(h, /script-src 'self'/);
    assert.ok(!/<script(?![^>]*\bsrc=)[^>]*>/.test(h), f + ': inline script');
    assert.ok(!/\sstyle="[^"]*(?:expression|url\()/.test(h)); assert.ok(!/\son[a-z]+=/i.test(h), f + ': inline обработчики');
  }
});

test('activation: only code, format and server response', async () => {
  const s = await open('activation.html', '');
  assert.equal(s.byId('code').placeholder, 'XXXX-XXXX-XXXX');
  assert.equal(s.byId('f_server'), null);
  s.byId('code').value = 'abcd-efgh-jklm';
  s.byId('code').dispatchEvent(new s.w.Event('input'));
  assert.equal(s.byId('code').value, 'ABCD-EFGH-JKLM');
  let closed = false; s.w.close = () => { closed = true; };
  await s.click('#activate');
  assert.deepEqual(s.calls.find((c) => c[0] === 'activate'), ['activate', 'ABCD-EFGH-JKLM']);
  assert.ok(closed);
  const e = await open('activation.html', '');
  e.byId('code').value = 'AAAA-BBBB-CCCC'; await e.click('#activate');
  assert.match(e.byId('message').textContent, /Неверный код/);
});

test('settings: блокировка PIN — неверный и верный ввод', async () => {
  const s = await open('settings.html', '', { state: { locked: true, hasPin: true, config: undefined } });
  assert.ok(visible(s.byId('lock')) && !visible(s.byId('app')));
  s.byId('pin').value = '0000'; await s.click('#unlock'); assert.match(s.byId('lockMsg').textContent, /Неверный PIN/);
  assert.ok(visible(s.byId('lock')));
  s.byId('pin').value = '1234'; s.calls.length = 0;
  // после верного PIN мост отдаёт полное состояние
  s.state.config = structuredClone(BASE_CONFIG);
  await s.click('#unlock'); await tick(80);
  assert.ok(!visible(s.byId('lock')) && visible(s.byId('app')));
  assert.equal(s.byId('serverUrl'), null);
});

test('settings: подсказка выхода при ?hint=quit', async () => {
  const s = await open('settings.html', '?tab=about&hint=quit');
  assert.ok(visible(s.byId('quitHint'))); assert.ok(s.byId('pane-about').classList.contains('on'));
  await s.click('#quit'); assert.ok(s.calls.some((c) => c[0] === 'quit'));
});

test('settings: заполнение полей, вкладки, сохранение групп', async () => {
  const s = await open('settings.html', '');
  assert.equal(s.byId('serverUrl'), null);
  assert.equal(s.byId('agent.port').value, '9101'); assert.equal(s.byId('agent.lan').checked, false);
  assert.equal(s.byId('agent.extraOrigins').value, 'https://x.kz'); assert.equal(s.byId('token').value, 'a'.repeat(36));
  assert.match(s.byId('agentBadge').textContent, /работает :9101/); assert.ok(s.byId('agentBadge').classList.contains('good'));
  await s.click('[data-tab=print]'); assert.ok(s.byId('pane-print').classList.contains('on'));
  // агент
  s.byId('agent.port').value = '9200'; s.byId('agent.lan').checked = true; await s.click('[data-save=agent]');
  const p = s.calls.filter((c) => c[0] === 'save').pop()[1];
  assert.equal(p.agent.port, 9200); assert.equal(p.agent.lan, true); assert.equal(typeof p.agent.port, 'number');
  // окно: киоск без PIN → предупреждение
  s.byId('kiosk').checked = true; await s.click('[data-save=window]');
  assert.ok(s.byId('m_window').classList.contains('warn')); assert.match(s.byId('m_window').textContent, /PIN/);
  s.byId('zoom').value = '1.3'; s.byId('zoom').dispatchEvent(new s.w.Event('input')); assert.equal(s.byId('zoomVal').textContent, '130%');
});

test('settings: принтеры — подсветка «Авто», XSS через имя принтера невозможен', async () => {
  const s = await open('settings.html', ''); await tick(80);
  const rows = [...s.doc.querySelectorAll('#printers tr')];
  assert.equal(rows.length, 3);
  assert.ok(rows[1].classList.contains('best')); assert.ok(!rows[0].classList.contains('best'));
  assert.match(rows[1].textContent, /чековый/); assert.match(rows[2].textContent, /не в сети/);
  assert.equal(s.doc.querySelectorAll('#printers img').length, 0, 'разметка из имени принтера не исполняется');
  assert.ok(rows[2].textContent.includes('<img src=x'), 'имя показано как текст');
  assert.equal(s.w.__xss, undefined);
  const opts = [...s.byId('tp_printer').options].map((o) => o.value);
  assert.deepEqual(opts.slice(0, 2), ['auto', 'Microsoft Print to PDF']); assert.equal(opts.at(-1), '__ip');
});

test('settings: пробная печать — авто, IP, ошибка', async () => {
  const s = await open('settings.html', ''); await tick(80);
  await s.click('#testPrint');
  assert.deepEqual(s.calls.filter((c) => c[0] === 'testPrint').pop()[1], { printer: 'auto', width: 80, codepage: 'cp866' });
  assert.match(s.byId('m_testPrint').textContent, /«XP-80C» за 33 мс/);
  s.byId('tp_printer').value = '__ip'; s.byId('tp_printer').dispatchEvent(new s.w.Event('change')); assert.ok(visible(s.byId('tp_ip_row')));
  await s.click('#testPrint'); assert.match(s.byId('m_testPrint').textContent, /Введите адрес/);
  s.byId('tp_ip').value = '192.168.1.50'; s.byId('tp_width').value = '58'; s.byId('tp_cp').value = 'cp1251'; await s.click('#testPrint');
  assert.deepEqual(s.calls.filter((c) => c[0] === 'testPrint').pop()[1], { printer: '192.168.1.50', width: 58, codepage: 'cp1251' });
  s.byId('tp_printer').value = 'Microsoft Print to PDF'; s.byId('tp_printer').dispatchEvent(new s.w.Event('change'));
  s.byId('tp_printer').append(Object.assign(s.doc.createElement('option'), { value: 'BAD', textContent: 'BAD' })); s.byId('tp_printer').value = 'BAD';
  await s.click('#testPrint'); assert.ok(s.byId('m_testPrint').classList.contains('err')); assert.ok(!s.byId('testPrint').disabled, 'кнопка снова доступна после ошибки');
});

test('settings: агент (проверка, перезапуск, новый токен с подтверждением)', async () => {
  const s = await open('settings.html', '');
  await s.click('#testAgent'); assert.match(s.byId('m_agent').textContent, /Агент отвечает за 4 мс/);
  await s.click('#restartAgent'); assert.ok(s.calls.some((c) => c[0] === 'restartAgent'));
  s.w.confirm = () => false; await s.click('#newToken'); assert.ok(!s.calls.some((c) => c[0] === 'newToken'), 'отмена подтверждения не меняет токен');
  s.w.confirm = () => true; await s.click('#newToken'); assert.equal(s.byId('token').value, 'b'.repeat(36));
});

test('settings: PIN — несовпадение, короткий, успех, снятие', async () => {
  const s = await open('settings.html', '');
  s.byId('newPin').value = '1234'; s.byId('newPin2').value = '4321'; await s.click('#setPin'); assert.match(s.byId('m_pin').textContent, /не совпадают/);
  assert.ok(!s.calls.some((c) => c[0] === 'setPin'));
  s.byId('newPin').value = '12'; s.byId('newPin2').value = '12'; await s.click('#setPin'); assert.match(s.byId('m_pin').textContent, /от 4 до 16/);
  s.byId('newPin').value = '5678'; s.byId('newPin2').value = '5678'; await s.click('#setPin');
  assert.equal(s.byId('pinBadge').textContent, 'задан'); assert.ok(visible(s.byId('clearPin'))); assert.equal(s.byId('newPin').value, '');
  await s.click('#clearPin'); assert.equal(s.byId('pinBadge').textContent, 'не задан'); assert.ok(!visible(s.byId('clearPin')));
});

test('settings: о программе и журнал', async () => {
  const s = await open('settings.html', ''); await tick(80);
  assert.match(s.byId('aboutTable').textContent, /Electron.*45\.0\.0/s); assert.match(s.byId('logBox').textContent, /\[agent\] запущен/);
  await s.click('#openApp'); assert.ok(s.calls.some((c) => c[0] === 'openApp'));
});

test('offline: показывает адрес и причину, повторяет, открывает настройки', async () => {
  let ok = false;
  const o = await open('offline.html', '?url=' + encodeURIComponent('https://innova365.kz') + '&code=-106&desc=ERR_INTERNET_DISCONNECTED', { retry: () => (ok ? { ok: true } : { ok: false, error: 'ERR_CONNECTION_TIMED_OUT' }) });
  assert.equal(o.byId('url').textContent, 'https://innova365.kz'); assert.match(o.byId('why').textContent, /INTERNET_DISCONNECTED/); assert.ok(!/ERR_/.test(o.byId('why').textContent.replace('INTERNET_DISCONNECTED', '')));
  await o.click('#retry'); await tick(30);
  assert.equal(o.calls.filter((c) => c[0] === 'retry').length, 1); assert.match(o.byId('why').textContent, /TIMED_OUT/);
  ok = true; await o.click('#retry'); await tick(30);
  assert.match(o.byId('status').textContent, /Связь восстановлена/);
  await o.click('#settings'); assert.ok(o.calls.some((c) => c[0] === 'openSettings'));
  // XSS через параметры адреса невозможен
  const x = await open('offline.html', '?url=' + encodeURIComponent('<img src=x onerror=window.__x=1>') + '&desc=' + encodeURIComponent('<b>x</b>'));
  assert.equal(x.doc.querySelectorAll('#url img, #why b').length, 0); assert.equal(x.w.__x, undefined);
  // офис передаёт target
  const f = await open('offline.html', '?url=x&target=office'); await f.click('#retry'); await tick(30);
  assert.deepEqual(f.calls.find((c) => c[0] === 'retry'), ['retry', 'office']);
});
