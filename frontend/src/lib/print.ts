import { locale } from '../i18n';

/** 'A4' — лист; число — ширина рулонной ленты в мм (чековый принтер: 58, 80, 90…). */
export type Paper = 'A4' | number;
export type Fit = 'auto' | 'none' | 'width';
export type Orient = 'auto' | 'portrait' | 'landscape';

export const esc = (s: unknown): string =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

export { fmtMoney } from './currency';
export const fmtQty = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(3).replace(/0+$/, '').replace(/\.$/, ''));
export const fmtDateTime = (d: string | number | Date) =>
  new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(d));

const BASE_CSS = `
  *{box-sizing:border-box} html,body{margin:0;padding:0;background:#fff}
  body{font-family:'Inter','Segoe UI',Arial,sans-serif;color:#000;font-size:12px;line-height:1.35;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  h1{font-size:18px;margin:0 0 2px} h2{font-size:14px;margin:14px 0 6px;break-after:avoid}
  .muted{color:#555} .right{text-align:right} .center{text-align:center} .bold{font-weight:700}
  table{width:100%;border-collapse:collapse} th,td{padding:5px 6px;text-align:left;vertical-align:top}
  th{font-size:11px;text-transform:uppercase;letter-spacing:.04em;border-bottom:1.5px solid #000}
  td{border-bottom:1px solid #ccc} tr{break-inside:avoid;page-break-inside:avoid}
  thead{display:table-header-group} tfoot{display:table-footer-group}
  .sign{display:flex;gap:40px;margin-top:36px;break-inside:avoid} .sign div{flex:1;border-top:1px solid #000;padding-top:4px;font-size:11px}
  .box{display:inline-block;width:70px;height:18px;border-bottom:1px solid #000}
  td,th{overflow-wrap:anywhere}
`;

export const A4_MM = { w: 210, h: 297, margin: 14 };
const PX_PER_MM = 96 / 25.4;

export interface LayoutOpts { paper: Paper; fit?: Fit; orient?: Orient }
export interface LayoutResult {
  /** Готовый HTML-документ: он же показывается в предпросмотре и уходит в печать (что видите — то и получите) */
  srcdoc: string;
  widthMm: number;
  heightMm: number;
  /** итоговый масштаб содержимого, 1 = 100 % */
  scale: number;
  fontPx: number;
  orient: 'portrait' | 'landscape';
  roll: boolean;
}

const wrapDoc = (title: string, body: string, pageCss: string) =>
  `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>${BASE_CSS}</style><style id="page">${pageCss}</style></head><body>${body}</body></html>`;

/** Невидимый iframe нужной ширины — в нём измеряем реальную вёрстку. */
function measureFrame(widthMm: number): Promise<{ doc: Document; done: () => void }> {
  return new Promise((resolve) => {
    const iframe = document.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.cssText = `position:fixed;left:-99999px;top:0;border:0;visibility:hidden;width:${widthMm}mm;height:200px`;
    document.body.appendChild(iframe);
    resolve({ doc: iframe.contentDocument!, done: () => iframe.remove() });
  });
}

async function settle(doc: Document) {
  try { await (doc as Document & { fonts?: { ready: Promise<unknown> } }).fonts?.ready; } catch { /* ignore */ }
  await Promise.all([...doc.images].map((im) => (im.complete ? 0 : new Promise((r) => { im.onload = im.onerror = () => r(0); }))));
  await new Promise((r) => setTimeout(r, 40));
}

/**
 * «Умная» раскладка документа под бумагу.
 *  • Рулон (чек): ширина = ширине ленты; если строки не помещаются — шрифт уменьшается (до 8 px), затем масштаб;
 *    высота страницы вычисляется по содержимому (Chrome/Edge игнорируют `@page { size: 80mm auto }`).
 *  • A4: если таблица шире листа — масштаб «по ширине»; если нужен масштаб < 80 % — автоматически берём альбомную.
 */
export async function layoutDocument(bodyHtml: string, title: string, o: LayoutOpts): Promise<LayoutResult> {
  const fit = o.fit ?? 'auto';
  const roll = typeof o.paper === 'number';

  if (roll) {
    const w = o.paper as number;
    const padCss = 'padding:3mm 4mm 4mm';
    const { doc, done } = await measureFrame(w);
    try {
      let font = 12;
      const render = (px: number, zoom: number) => {
        doc.open();
        doc.write(wrapDoc(title, bodyHtml, `body{width:${w}mm;${padCss};font-size:${px}px;zoom:${zoom}}`));
        doc.close();
      };
      render(font, 1);
      await settle(doc);
      let scale = 1;
      if (fit !== 'none') {
        const over = () => doc.documentElement.scrollWidth > doc.documentElement.clientWidth + 1;
        while (over() && font > 8) { font -= 0.5; render(font, 1); await settle(doc); }
        if (over()) {
          scale = Math.max(0.6, doc.documentElement.clientWidth / doc.documentElement.scrollWidth);
          render(font, scale); await settle(doc);
        }
      }
      const px = Math.max(doc.body.scrollHeight, doc.documentElement.scrollHeight);
      const mm = Math.ceil(px / PX_PER_MM) + 2;
      const css = `@page{size:${w}mm ${mm}mm;margin:0} body{width:${w}mm;${padCss};font-size:${font}px;zoom:${scale}}`;
      return { srcdoc: wrapDoc(title, bodyHtml, css), widthMm: w, heightMm: mm, scale: (font / 12) * scale, fontPx: font, orient: 'portrait', roll: true };
    } finally { done(); }
  }

  // A4
  const tryOrient = async (landscape: boolean) => {
    const pw = (landscape ? A4_MM.h : A4_MM.w) - 2 * A4_MM.margin;
    const { doc, done } = await measureFrame(pw);
    try {
      doc.open();
      doc.write(wrapDoc(title, bodyHtml, `body{width:${pw}mm}`));
      doc.close();
      await settle(doc);
      const need = Math.max(doc.documentElement.scrollWidth, doc.body.scrollWidth);
      const have = pw * PX_PER_MM;
      return { pw, scale: need > have + 1 ? have / need : 1 };
    } finally { done(); }
  };

  let orient: 'portrait' | 'landscape' = o.orient === 'landscape' ? 'landscape' : 'portrait';
  let m = await tryOrient(orient === 'landscape');
  if (o.orient !== 'portrait' && o.orient !== 'landscape' && fit !== 'none' && m.scale < 0.8) {
    const alt = await tryOrient(true);
    if (alt.scale > m.scale) { m = alt; orient = 'landscape'; }
  }
  const scale = fit === 'none' ? 1 : m.scale;
  const [pw, ph] = orient === 'landscape' ? [A4_MM.h, A4_MM.w] : [A4_MM.w, A4_MM.h];
  const css = `@page{size:A4 ${orient};margin:${A4_MM.margin}mm} body{width:${(pw - 2 * A4_MM.margin) / scale}mm;zoom:${scale}}`;
  return { srcdoc: wrapDoc(title, bodyHtml, css), widthMm: pw, heightMm: ph, scale, fontPx: 12, orient, roll: false };
}

/** Печать готового документа через системное окно браузера (скрытый iframe). Для печати без окна — start-pos-browser.bat (--kiosk-printing). */
export function printSrcdoc(srcdoc: string): Promise<void> {
  return new Promise((resolve) => {
    const iframe = document.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;border:0;visibility:hidden;width:210mm;height:10px';
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument!;
    doc.open(); doc.write(srcdoc); doc.close();
    const cleanup = () => { setTimeout(() => { iframe.remove(); resolve(); }, 500); };
    const run = async () => {
      await settle(doc);
      const w = iframe.contentWindow!;
      w.addEventListener('afterprint', cleanup, { once: true });
      w.focus();
      w.print();
      setTimeout(() => { if (document.body.contains(iframe)) cleanup(); }, 60_000);
    };
    if (doc.readyState === 'complete') void run(); else iframe.onload = () => void run();
  });
}
