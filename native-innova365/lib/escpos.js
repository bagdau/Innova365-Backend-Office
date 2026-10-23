'use strict';
/** Минимальный ESC/POS для пробной печати: инициализация, кодовая страница, текст, отрезка. Без зависимостей от Electron. */

const ESC = 0x1b, GS = 0x1d, LF = 0x0a;

const CP_TABLE = { cp866: 17, cp1251: 46 };   // ESC t n — как в серверном генераторе (backend/src/print/escpos.ts)

/** Один символ → байт выбранной кодировки (кириллица; прочее — «?»). */
function byteOf(ch, cp) {
  const c = ch.codePointAt(0);
  if (c < 0x80) return c;
  if (cp === 'ascii') return 0x3f;
  if (c === 0x401) return cp === 'cp866' ? 0xf0 : 0xa8;     // Ё
  if (c === 0x451) return cp === 'cp866' ? 0xf1 : 0xb8;     // ё
  if (c >= 0x410 && c <= 0x42f) return cp === 'cp866' ? 0x80 + (c - 0x410) : 0xc0 + (c - 0x410);          // А-Я
  if (c >= 0x430 && c <= 0x43f) return cp === 'cp866' ? 0xa0 + (c - 0x430) : 0xe0 + (c - 0x430);          // а-п
  if (c >= 0x440 && c <= 0x44f) return cp === 'cp866' ? 0xe0 + (c - 0x440) : 0xf0 + (c - 0x440);          // р-я
  if (c === 0x2116) return cp === 'cp866' ? 0xfc : 0xb9;    // №
  return 0x3f;
}

function encode(text, cp = 'cp866') {
  const out = [];
  for (const ch of String(text)) out.push(byteOf(ch, cp));
  return Buffer.from(out);
}

/** Текст в строки по ширине принтера (по словам). */
function wrap(text, cols) {
  const lines = [];
  for (const para of String(text).split('\n')) {
    let cur = '';
    for (const w of para.split(/\s+/).filter(Boolean)) {
      if (cur && (cur + ' ' + w).length > cols) { lines.push(cur); cur = w; } else cur = cur ? cur + ' ' + w : w;
      while (cur.length > cols) { lines.push(cur.slice(0, cols)); cur = cur.slice(cols); }
    }
    lines.push(cur);
  }
  return lines;
}

/**
 * Пробный чек для проверки принтера на месте (без обращения к серверу).
 * opts: { printer, width: 58|80, codepage: 'cp866'|'cp1251'|'ascii', cut: boolean, now: Date }
 */
function testReceipt({ printer = '', width = 80, codepage = 'cp866', cut = true, now = new Date() } = {}) {
  const cols = width <= 58 ? 32 : 48;
  const parts = [];
  const raw = (...b) => parts.push(Buffer.from(b));
  const line = (t = '') => { parts.push(encode(t, codepage)); raw(LF); };
  const center = (on) => raw(ESC, 0x61, on ? 1 : 0);
  const bold = (on) => raw(ESC, 0x45, on ? 1 : 0);

  raw(ESC, 0x40);                                           // сброс
  if (CP_TABLE[codepage] !== undefined) raw(ESC, 0x74, CP_TABLE[codepage]);
  center(true); bold(true); raw(GS, 0x21, 0x11); line('Innova365'); raw(GS, 0x21, 0x00); bold(false);
  line('Пробная печать');
  center(false);
  line('-'.repeat(cols));
  for (const l of wrap(`Принтер: ${printer || 'авто'}`, cols)) line(l);
  line(`Ширина: ${width} мм (${cols} символов)`);
  line(`Кодировка: ${codepage}`);
  line(`Время: ${now.toLocaleString('ru-RU')}`);
  line('-'.repeat(cols));
  line('Русский текст: АБВГДЕЁЖЗИЙКЛМНОП');
  line('рстуфхцчшщъыьэюя 0123456789 №');
  line('Latin: ABC abc 123 !?@#%');
  line('-'.repeat(cols));
  center(true); line('Если вы видите этот чек —'); line('печать работает'); center(false);
  raw(LF, LF, LF);
  if (cut) raw(GS, 0x56, 0x42, 0x00);                       // отрезка с прогоном
  return Buffer.concat(parts);
}

module.exports = { encode, wrap, testReceipt, CP_TABLE };
