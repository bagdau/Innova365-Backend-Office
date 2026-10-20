/**
 * Поисковый движок Innova365.
 *
 * Работает целиком в памяти браузера: индекс строится один раз при изменении данных,
 * сам поиск — доли миллисекунды даже на тысячах позиций (сеть не участвует).
 *
 * Возможности:
 *  - нормализация: регистр, ё/е, диакритика (á → a), знаки препинания;
 *  - поиск по началу слова, по части слова и по нескольким словам сразу ("курица комбо");
 *  - исправление опечаток (расстояние Дамерау–Левенштейна 1–2);
 *  - неверная раскладка клавиатуры ("rehbwf" → "курица", "реде" ↔ "ktu");
 *  - ранжирование по релевантности: точное > начало слова > часть слова > опечатка,
 *    название весит больше, чем категория и описание;
 *  - подсветка найденных фрагментов.
 */

export interface SearchField<T> {
  /** Возвращает текст поля для индексации */
  get: (item: T) => string | null | undefined;
  /** Вес поля: чем выше, тем сильнее поднимается результат */
  weight: number;
}

export interface SearchHit<T> {
  item: T;
  score: number;
  /** Диапазоны [start, end) в исходном названии (первое поле) для подсветки */
  ranges: Array<[number, number]>;
}

/** Синонимы: слово из запроса → слова, по которым тоже искать (всё в нормализованном виде). */
export type Synonyms = Record<string, string[]>;

export interface SearchOptions {
  limit?: number;
  /** Разрешить исправление опечаток (по умолчанию да) */
  fuzzy?: boolean;
}

// ───────────────────────── Нормализация ─────────────────────────

/** Нормализует строку, сохраняя длину (индексы совпадают с оригиналом — нужно для подсветки). */
const CHAR_CACHE = new Map<string, string>();
const LETTER_OR_DIGIT = /[\p{L}\p{N}]/u;

function normChar(ch: string): string {
  let r = CHAR_CACHE.get(ch);
  if (r !== undefined) return r;
  let c = ch.toLowerCase();
  if (c === 'ё') c = 'е';
  else if (c.charCodeAt(0) > 127) {
    const base = c.normalize('NFD')[0];
    if (base) c = base;
  }
  // всё, кроме букв и цифр, считаем разделителем
  r = LETTER_OR_DIGIT.test(c) ? c : ' ';
  CHAR_CACHE.set(ch, r);
  return r;
}

export function normalize(input: string): string {
  let out = '';
  for (const ch of input) out += normChar(ch);
  return out;
}

function tokenize(norm: string): Array<{ text: string; start: number }> {
  const tokens: Array<{ text: string; start: number }> = [];
  const re = /\S+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(norm))) tokens.push({ text: m[0], start: m.index });
  return tokens;
}

// ───────────────────────── Раскладка ─────────────────────────

const EN = "`qwertyuiop[]asdfghjkl;'zxcvbnm,.";
const RU = 'ёйцукенгшщзхъфывапролджэячсмитьбю';
const EN_TO_RU = new Map<string, string>();
const RU_TO_EN = new Map<string, string>();
for (let i = 0; i < EN.length; i++) { EN_TO_RU.set(EN[i], RU[i]); RU_TO_EN.set(RU[i], EN[i]); }

function swapLayout(s: string, map: Map<string, string>): string {
  let out = '';
  for (const ch of s) out += map.get(ch) ?? ch;
  return out;
}

const hasLatin = (s: string) => /[a-z]/.test(s);
const hasCyr = (s: string) => /[а-я]/.test(s);

// ───────────────────────── Опечатки ─────────────────────────

/** Расстояние Дамерау–Левенштейна с ранним выходом, если оно больше max. */
function editDistance(a: string, b: string, max: number): number {
  const la = a.length, lb = b.length;
  if (Math.abs(la - lb) > max) return max + 1;
  let prev2: number[] = [];
  let prev: number[] = Array.from({ length: lb + 1 }, (_, j) => j);
  for (let i = 1; i <= la; i++) {
    const cur: number[] = [i];
    let rowMin = i;
    for (let j = 1; j <= lb; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
      cur[j] = v;
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    prev2 = prev;
    prev = cur;
  }
  return prev[lb];
}

function maxTypos(len: number): number {
  if (len <= 3) return 0;
  if (len <= 6) return 1;
  return 2;
}

// ───────────────────────── Индекс ─────────────────────────

interface DocToken { text: string; start: number; field: number }
interface Doc<T> { item: T; tokens: DocToken[]; nameNorm: string }

const MATCH = { exact: 100, prefix: 80, substring: 45, fuzzy: 35 } as const;

export class SearchIndex<T> {
  private docs: Doc<T>[] = [];
  /** Словарь: токен → индексы документов (для быстрых точных/префиксных совпадений) */
  private vocab = new Map<string, number[]>();
  private vocabKeys: string[] = [];

  constructor(items: T[], private fields: SearchField<T>[], private synonyms: Synonyms = {}) {
    items.forEach((item, idx) => {
      const tokens: DocToken[] = [];
      fields.forEach((f, fi) => {
        const raw = f.get(item);
        if (!raw) return;
        for (const tk of tokenize(normalize(raw))) tokens.push({ ...tk, field: fi });
      });
      const nameNorm = normalize(fields[0].get(item) ?? '');
      this.docs.push({ item, tokens, nameNorm });
      for (const tk of tokens) {
        const list = this.vocab.get(tk.text);
        if (list) { if (list[list.length - 1] !== idx) list.push(idx); }
        else this.vocab.set(tk.text, [idx]);
      }
    });
    this.vocabKeys = [...this.vocab.keys()];
  }

  get size(): number { return this.docs.length; }

  search(query: string, opts: SearchOptions = {}): SearchHit<T>[] {
    const { limit = 50, fuzzy = true } = opts;
    const q = normalize(query).trim();
    if (!q) return [];

    let hits = this.run(q, fuzzy);

    // Если ничего — пробуем ту же строку, набранную в другой раскладке
    if (hits.length === 0) {
      let alt: string | null = null;
      if (hasLatin(q) && !hasCyr(q)) alt = swapLayout(q, EN_TO_RU);
      else if (hasCyr(q) && !hasLatin(q)) alt = swapLayout(q, RU_TO_EN);
      if (alt && alt !== q) hits = this.run(alt, fuzzy);
    }

    hits.sort((a, b) => b.score - a.score || a.item_name.localeCompare(b.item_name));
    return hits.slice(0, limit).map(({ item, score, ranges }) => ({ item, score, ranges }));
  }

  private run(q: string, fuzzy: boolean) {
    const qTokens = tokenize(q).map((t) => t.text);
    return this.score(qTokens, fuzzy, true) .length ? this.score(qTokens, fuzzy, true)
      : qTokens.length > 1 ? this.score(qTokens, fuzzy, false) : [];
  }

  /** all=true: должны найтись все слова запроса; all=false: достаточно любого (результаты ниже по рангу). */
  private score(qTokens: string[], fuzzy: boolean, all: boolean) {
    const n = this.docs.length;
    const scores = new Float64Array(n);
    const matchedCount = new Uint16Array(n);
    const ranges: Array<Array<[number, number]> | undefined> = new Array(n);

    // кандидаты по каждому токену запроса
    const perToken: Array<Map<number, number>> = qTokens.map((qt) => {
      const main = this.candidates(qt, fuzzy);
      for (const alt of this.synonyms[qt] ?? []) {
        for (const [di, sc] of this.candidates(alt, fuzzy)) if ((main.get(di) ?? 0) < sc * 0.9) main.set(di, sc * 0.9);
      }
      return main;
    });

    for (let ti = 0; ti < perToken.length; ti++) {
      for (const [di, sc] of perToken[ti]) {
        scores[di] += sc;
        matchedCount[di]++;
      }
    }

    const out: Array<{ item: T; score: number; ranges: Array<[number, number]>; item_name: string }> = [];
    const need = qTokens.length;
    for (let di = 0; di < n; di++) {
      if (all ? matchedCount[di] < need : matchedCount[di] === 0) continue;
      const doc = this.docs[di];
      let score = all ? scores[di] : scores[di] * 0.4;
      // бонусы за название целиком
      const full = qTokens.join(' ');
      if (doc.nameNorm.trim() === full) score += 120;
      else if (doc.nameNorm.trimStart().startsWith(full)) score += 60;
      const rs = this.highlight(doc, qTokens);
      ranges[di] = rs;
      out.push({ item: doc.item, score, ranges: rs, item_name: doc.nameNorm });
    }
    return out as Array<{ item: T; score: number; ranges: Array<[number, number]>; item_name: string }>;
  }

  /** Документы, соответствующие одному слову запроса, с оценкой (лучшее совпадение по документу). */
  private candidates(qt: string, fuzzy: boolean): Map<number, number> {
    const best = new Map<number, number>();
    const bump = (di: number, s: number) => { if ((best.get(di) ?? 0) < s) best.set(di, s); };
    const wFieldFor = (di: number, token: string) => {
      // вес поля: берём максимальный вес поля, где встречается токен
      let w = 0;
      for (const t of this.docs[di].tokens) if (t.text === token && this.fields[t.field].weight > w) w = this.fields[t.field].weight;
      return w || 1;
    };
    const tol = fuzzy ? maxTypos(qt.length) : 0;

    for (const key of this.vocabKeys) {
      let base = 0;
      if (key === qt) base = MATCH.exact;
      else if (key.startsWith(qt)) base = MATCH.prefix * (0.7 + 0.3 * (qt.length / key.length));
      else if (qt.length >= 3 && key.includes(qt)) base = MATCH.substring;
      else if (tol > 0) {
        // опечатка: сравниваем со словом целиком и с началом слова такой же длины
        const d = Math.min(editDistance(qt, key, tol), key.length > qt.length ? editDistance(qt, key.slice(0, qt.length), tol) + 0.5 : 99);
        if (d <= tol) base = MATCH.fuzzy - d * 6;
      }
      if (!base) continue;
      for (const di of this.vocab.get(key)!) bump(di, base * wFieldFor(di, key));
    }
    return best;
  }

  private highlight(doc: Doc<T>, qTokens: string[]): Array<[number, number]> {
    const out: Array<[number, number]> = [];
    for (const tk of doc.tokens) {
      if (tk.field !== 0) continue; // подсвечиваем только название
      for (const qt of qTokens) {
        if (tk.text.startsWith(qt)) { out.push([tk.start, tk.start + qt.length]); break; }
        const i = tk.text.indexOf(qt);
        if (qt.length >= 3 && i > 0) { out.push([tk.start + i, tk.start + i + qt.length]); break; }
        if (maxTypos(qt.length) > 0 && editDistance(qt, tk.text, maxTypos(qt.length)) <= maxTypos(qt.length)) {
          out.push([tk.start, tk.start + tk.text.length]); break;
        }
      }
    }
    return out;
  }
}

/** Разбивает строку на части для подсветки: [{text, hit}] */
export function splitHighlight(text: string, ranges: Array<[number, number]>): Array<{ text: string; hit: boolean }> {
  if (!ranges.length) return [{ text, hit: false }];
  const sorted = [...ranges].sort((a, b) => a[0] - b[0]);
  const parts: Array<{ text: string; hit: boolean }> = [];
  let pos = 0;
  for (const [s, e] of sorted) {
    if (s < pos) continue;
    if (s > pos) parts.push({ text: text.slice(pos, s), hit: false });
    parts.push({ text: text.slice(s, e), hit: true });
    pos = e;
  }
  if (pos < text.length) parts.push({ text: text.slice(pos), hit: false });
  return parts;
}
