import iconv from 'iconv-lite';

/**
 * Минимальный конструктор ESC/POS-команд для кассовых (термо) принтеров Epson-совместимых.
 * Кириллица: большинство принтеров понимает CP866 (ESC t 17); часть — CP1251 (ESC t 46).
 */
export type Codepage = 'cp866' | 'cp1251' | 'ascii';

const ESC = 0x1b;
const GS = 0x1d;

/** Таблица замены символов, которых нет в кодовой странице принтера */
const REPLACE: Record<string, string> = {
  '«': '"', '»': '"', '“': '"', '”': '"', '„': '"', '’': "'", '‘': "'", '—': '-', '–': '-', '…': '...',
  '№': 'N', '×': 'x', '·': '-', '•': '*', '→': '->', '✓': 'v', '≥': '>=', '≤': '<=', ' ': ' ',
};

const TRANSLIT: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm',
  н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch',
  ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
};

export function sanitize(text: string, cp: Codepage): string {
  let out = '';
  for (const ch of text) {
    let c = REPLACE[ch] ?? ch;
    if (cp === 'ascii') {
      const lower = c.toLowerCase();
      if (TRANSLIT[lower] !== undefined) {
        const tr = TRANSLIT[lower];
        c = c === lower ? tr : tr.charAt(0).toUpperCase() + tr.slice(1);
      } else if (c.charCodeAt(0) > 126) c = c.normalize('NFD').replace(/[̀-ͯ]/g, '');
      if (c.charCodeAt(0) > 126) c = '?';
    } else if (c.charCodeAt(0) > 127 && !/[Ѐ-ӿ]/.test(c)) {
      // в CP866/CP1251 нет латинских букв с акцентами (í, ñ, é…) — убираем диакритику
      const base = c.normalize('NFD').replace(/[̀-ͯ]/g, '');
      c = base.charCodeAt(0) > 127 ? '?' : base;
    }
    out += c;
  }
  return out;
}

export class EscPos {
  private chunks: Buffer[] = [];

  /** @param cols символов в строке: 48 для 80 мм, 32 для 58 мм */
  constructor(public readonly cols: number, private cp: Codepage) {
    this.raw([ESC, 0x40]); // инициализация
    if (cp === 'cp866') this.raw([ESC, 0x74, 17]);
    else if (cp === 'cp1251') this.raw([ESC, 0x74, 46]);
    else this.raw([ESC, 0x74, 0]);
  }

  raw(bytes: number[] | Buffer): this {
    this.chunks.push(Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes));
    return this;
  }

  private encode(text: string): Buffer {
    const clean = sanitize(text, this.cp);
    return this.cp === 'ascii' ? Buffer.from(clean, 'latin1') : iconv.encode(clean, this.cp);
  }

  text(s: string): this { return this.raw(this.encode(s)); }
  line(s = ''): this { return this.text(s).raw([0x0a]); }
  feed(n = 1): this { return this.raw([ESC, 0x64, n]); }

  align(a: 'left' | 'center' | 'right'): this { return this.raw([ESC, 0x61, a === 'left' ? 0 : a === 'center' ? 1 : 2]); }
  bold(on: boolean): this { return this.raw([ESC, 0x45, on ? 1 : 0]); }
  /** Размер шрифта: 1 = обычный, 2 = двойной по ширине и высоте */
  size(w: 1 | 2 | 3, h: 1 | 2 | 3 = w): this { return this.raw([GS, 0x21, ((w - 1) << 4) | (h - 1)]); }

  rule(ch = '-'): this { return this.line(ch.repeat(this.cols)); }

  /** «Название .......... 12.00»: цена справа, длинное название переносится */
  pair(left: string, right: string): this {
    const space = this.cols - right.length - 1;
    const lines = wrap(left, Math.max(space, 8));
    lines.forEach((l, i) => {
      if (i < lines.length - 1) this.line(l);
      else this.line(l + ' '.repeat(Math.max(this.cols - l.length - right.length, 1)) + right);
    });
    return this;
  }

  /** Строка «слева ... справа» без переноса */
  between(left: string, right: string): this {
    return this.line(left + ' '.repeat(Math.max(this.cols - left.length - right.length, 1)) + right);
  }

  /** QR-код (модель 2). size 1–16 — размер модуля в точках; ec: уровень коррекции L/M/Q/H. */
  qr(data: string, size = 6, ec: 'L' | 'M' | 'Q' | 'H' = 'M'): this {
    const bytes = Buffer.from(sanitize(data, 'ascii'), 'latin1').subarray(0, 700);
    const len = bytes.length + 3;
    this.raw([GS, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00]);                     // модель 2
    this.raw([GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, Math.min(Math.max(size, 1), 16)]); // размер модуля
    this.raw([GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, 0x30 + 'LMQH'.indexOf(ec)]);       // коррекция ошибок
    this.raw([GS, 0x28, 0x6b, len & 0xff, (len >> 8) & 0xff, 0x31, 0x50, 0x30]);         // данные
    this.raw(bytes);
    this.raw([GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30]);                           // печать
    return this;
  }

  cut(): this { return this.feed(4).raw([GS, 0x56, 0x42, 0x00]); }
  /** Импульс на денежный ящик (пин 2) */
  drawer(): this { return this.raw([ESC, 0x70, 0x00, 0x19, 0xfa]); }

  build(): Buffer { return Buffer.concat(this.chunks); }
}

export function wrap(s: string, width: number): string[] {
  const words = s.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    if (w.length > width) {
      if (cur) { lines.push(cur); cur = ''; }
      for (let i = 0; i < w.length; i += width) lines.push(w.slice(i, i + width));
      continue;
    }
    if ((cur + ' ' + w).trim().length > width) { lines.push(cur); cur = w; }
    else cur = (cur + ' ' + w).trim();
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [''];
}
