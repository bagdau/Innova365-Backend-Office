import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowBigUp, ArrowLeftToLine, ArrowRightToLine, ChevronDown, CornerDownLeft, Delete, Globe } from 'lucide-react';
import { useKeyboardStore } from '../../store/keyboardStore';
import { lang as appLang, t } from '../../i18n';
import { cn } from '../../utils/cn';

/**
 * Экранная (сенсорная) клавиатура для кассового моноблока.
 * Появляется при фокусе на поле ввода, вводит текст прямо в активное поле (работает с React-формами),
 * не даёт открыться системной клавиатуре, сдвигает страницу, чтобы поле не пряталось под клавиатурой.
 * Раскладки: RU, ҚАЗ, EN, символы; для числовых полей — цифровой блок.
 */

type Kb = 'ru' | 'kk' | 'en';
type TextEl = HTMLInputElement | HTMLTextAreaElement;
type Mode = 'text' | 'num' | 'tel' | 'email';
type Shift = 'off' | 'once' | 'caps';

const LAYOUTS: Record<Kb, string[][]> = {
  ru: [['й', 'ц', 'у', 'к', 'е', 'н', 'г', 'ш', 'щ', 'з', 'х', 'ъ'], ['ф', 'ы', 'в', 'а', 'п', 'р', 'о', 'л', 'д', 'ж', 'э'], ['я', 'ч', 'с', 'м', 'и', 'т', 'ь', 'б', 'ю']],
  kk: [['й', 'ц', 'у', 'к', 'е', 'н', 'г', 'ш', 'щ', 'з', 'х', 'ъ'], ['ф', 'ы', 'в', 'а', 'п', 'р', 'о', 'л', 'д', 'ж', 'э'], ['я', 'ч', 'с', 'м', 'и', 'т', 'ь', 'б', 'ю']],
  en: [['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'], ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'], ['z', 'x', 'c', 'v', 'b', 'n', 'm']],
};
const KK_EXTRA = ['ә', 'і', 'ң', 'ғ', 'ү', 'ұ', 'қ', 'ө', 'һ'];
const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
const SYM1 = ['@', '#', '₸', '%', '&', '*', '-', '+', '(', ')'];
const SYM2 = ['!', '"', "'", ':', ';', '/', '?', '_', '='];
const SYM3 = [',', '.', '<', '>', '[', ']', '{', '}', '$', '€'];
const KB_LABEL: Record<Kb, string> = { ru: 'RU', kk: 'ҚАЗ', en: 'EN' };
const KB_ORDER: Kb[] = ['ru', 'kk', 'en'];
const LS_LANG = 'innova365-vkb-lang';

const nativeValueSetter = (el: TextEl) => Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value')!.set!;
const TEXT_TYPES = new Set(['text', 'search', 'email', 'password', 'number', 'tel', 'url', '']);

function isTextEl(n: EventTarget | Element | null): n is TextEl {
  if (!(n instanceof HTMLElement)) return false;
  if (n.dataset.vkb === 'off') return false;
  if (n instanceof HTMLTextAreaElement) return !n.readOnly && !n.disabled;
  if (n instanceof HTMLInputElement) return TEXT_TYPES.has(n.type) && !n.readOnly && !n.disabled;
  return false;
}

const labelOf = (el: TextEl) =>
  el.getAttribute('aria-label') || el.labels?.[0]?.textContent?.replace('*', '').trim() || el.placeholder || el.name || '';

function modeOf(el: TextEl, origType: string): Mode {
  const im = (el.getAttribute('data-vkb-im') || '').toLowerCase();
  if (origType === 'number' || im === 'numeric' || im === 'decimal') return 'num';
  if (origType === 'tel' || im === 'tel') return 'tel';
  if (origType === 'email' || origType === 'url' || origType === 'password') return 'email';
  return 'text';
}

function storedKb(): Kb {
  try { const v = localStorage.getItem(LS_LANG); if (v === 'ru' || v === 'kk' || v === 'en') return v; } catch { /* ignore */ }
  return appLang === 'kk' ? 'kk' : appLang === 'en' ? 'en' : 'ru';
}

/* ───────── Ввод в активное поле ───────── */
function setValue(el: TextEl, v: string, caret: number) {
  nativeValueSetter(el).call(el, v);          // мимо «отслеживателя» React — иначе onChange не сработает
  el.dispatchEvent(new Event('input', { bubbles: true }));
  try { el.setSelectionRange(caret, caret); } catch { /* тип поля без выделения */ }
}
const selOf = (el: TextEl): [number, number] => {
  const len = el.value.length;
  try { return [el.selectionStart ?? len, el.selectionEnd ?? len]; } catch { return [len, len]; }
};

function insertText(el: TextEl, text: string, numeric: boolean) {
  const [s, e] = selOf(el);
  const before = el.value.slice(0, s), after = el.value.slice(e);
  if (numeric) {
    if (text === '.' && (before + after).includes('.')) return;
    if (text === '-' && (s > 0 || (before + after).includes('-'))) return;
  }
  if (el.maxLength > 0 && before.length + text.length + after.length > el.maxLength) return;
  setValue(el, before + text + after, s + text.length);
}
function backspace(el: TextEl) {
  const [s, e] = selOf(el);
  if (s !== e) setValue(el, el.value.slice(0, s) + el.value.slice(e), s);
  else if (s > 0) setValue(el, el.value.slice(0, s - 1) + el.value.slice(s), s - 1);
}
function clearAll(el: TextEl) { setValue(el, '', 0); }
function pressEnter(el: TextEl) {
  if (el instanceof HTMLTextAreaElement) { insertText(el, '\n', false); return; }
  const ev = new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true });
  const notPrevented = el.dispatchEvent(ev);
  el.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
  if (notPrevented && el.form) el.form.requestSubmit();   // как настоящий Enter: отправка формы
}
function moveFocus(el: TextEl, dir: 1 | -1) {
  const scope: ParentNode = el.closest('[role="dialog"], form') ?? document;
  const all = Array.from(scope.querySelectorAll<HTMLElement>('input, textarea')).filter((x) => isTextEl(x) && x.offsetParent !== null);
  const i = all.indexOf(el);
  const next = all[i + dir];
  if (next) next.focus();
}

/* ───────── Кнопки ───────── */
const RepCtx = createContext<{ start: (fn: () => void) => void; stop: () => void }>({ start: (f) => f(), stop: () => undefined });
const guard = (e: { preventDefault: () => void; stopPropagation: () => void }) => { e.preventDefault(); e.stopPropagation(); };
const FN = 'bg-secondary text-muted-foreground';

interface KeyProps { children: React.ReactNode; onDown: () => void; className?: string; wide?: number; active?: boolean; title?: string; hold?: boolean }
function KeyBtn({ children, onDown, className, wide = 1, active, title, hold }: KeyProps) {
  const rep = useContext(RepCtx);
  return (
    <button
      type="button" tabIndex={-1} title={title} data-sound="none" data-vkb="off"
      style={{ flex: wide }}
      onPointerDown={(e) => { guard(e); if (hold) rep.start(onDown); else onDown(); }}
      onPointerUp={hold ? rep.stop : undefined} onPointerLeave={hold ? rep.stop : undefined} onPointerCancel={hold ? rep.stop : undefined}
      onMouseDown={guard} onClick={(e) => e.preventDefault()}
      className={cn(
        'min-w-0 h-[var(--kh)] rounded-lg border text-[length:var(--kf)] font-medium select-none touch-manipulation',
        'flex items-center justify-center transition-[transform,background-color] duration-75 active:scale-[.94] active:bg-primary/35',
        active ? 'bg-primary/20 border-primary text-primary' : 'bg-muted border-border/60 text-foreground',
        className,
      )}
    >
      {children}
    </button>
  );
}
const Row = ({ children }: { children: React.ReactNode }) => <div className="flex gap-1.5 sm:gap-2 justify-center">{children}</div>;

/* ───────── Компонент ───────── */
export function VirtualKeyboard() {
  const enabled = useKeyboardStore((s) => s.enabled);
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<TextEl | null>(null);
  const [mode, setMode] = useState<Mode>('text');
  const [kb, setKb] = useState<Kb>(storedKb);
  const [layer, setLayer] = useState<'alpha' | 'sym'>('alpha');
  const [shift, setShift] = useState<Shift>('off');
  const [label, setLabel] = useState('');
  const targetRef = useRef<TextEl | null>(null);
  const restoreRef = useRef<(() => void) | null>(null);
  const origNumber = useRef(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>();
  const repeat = useRef<{ t?: ReturnType<typeof setTimeout>; i?: ReturnType<typeof setInterval> }>({});
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const detach = useCallback(() => { restoreRef.current?.(); restoreRef.current = null; targetRef.current = null; setTarget(null); }, []);

  const attach = useCallback((el: TextEl) => {
    if (targetRef.current === el) return;
    restoreRef.current?.();
    const origType = el instanceof HTMLInputElement ? el.type : 'text';
    const origIm = el.getAttribute('inputmode');
    const origNum = origType === 'number';
    origNumber.current = origNum;
    el.setAttribute('inputmode', 'none');                       // системная клавиатура не нужна
    if (origNum && el instanceof HTMLInputElement) {            // number не умеет «1.»: на время ввода делаем text
      el.setAttribute('data-vkb-im', 'decimal'); el.type = 'text';
    }
    restoreRef.current = () => {
      if (origIm === null) el.removeAttribute('inputmode'); else el.setAttribute('inputmode', origIm);
      if (origNum && el instanceof HTMLInputElement) {
        el.removeAttribute('data-vkb-im');
        if (el.value.endsWith('.')) setValue(el, el.value.slice(0, -1), el.value.length - 1);
        el.type = 'number';
      }
    };
    targetRef.current = el;
    const m = modeOf(el, origType);
    setTarget(el); setMode(m); setLabel(labelOf(el)); setLayer('alpha'); setShift('off');
    if (m === 'email') setKb('en');                             // email/пароль/ссылка — латиница
  }, []);

  /* фокус / потеря фокуса */
  useEffect(() => {
    const onIn = (e: FocusEvent) => {
      if (!enabledRef.current || !isTextEl(e.target)) return;
      clearTimeout(hideTimer.current);
      attach(e.target); setOpen(true);
    };
    const onOut = () => {
      clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => {
        const a = document.activeElement;
        if (a && (isTextEl(a) || panelRef.current?.contains(a))) return;
        setOpen(false); detach();
      }, 160);
    };
    // повторное касание уже выбранного поля снова открывает клавиатуру (после «Скрыть»)
    const onClick = (e: MouseEvent) => { if (enabledRef.current && isTextEl(e.target) && document.activeElement === e.target) { attach(e.target); setOpen(true); } };
    document.addEventListener('focusin', onIn, true);
    document.addEventListener('focusout', onOut, true);
    document.addEventListener('click', onClick, true);
    return () => {
      document.removeEventListener('focusin', onIn, true); document.removeEventListener('focusout', onOut, true); document.removeEventListener('click', onClick, true);
      clearTimeout(hideTimer.current);
    };
  }, [attach, detach]);

  /* выключили в настройках — убираем всё */
  useEffect(() => { if (!enabled) { setOpen(false); detach(); } }, [enabled, detach]);
  useEffect(() => () => { restoreRef.current?.(); }, []);
  /* автопоиск уже сфокусированного поля при включении */
  useEffect(() => { if (enabled && isTextEl(document.activeElement)) { attach(document.activeElement); setOpen(true); } }, [enabled, attach]);

  /* высота клавиатуры → CSS-переменная: страница и окна сдвигаются */
  const visible = enabled && open && !!target;
  useEffect(() => {
    const root = document.documentElement;
    if (!visible) { root.classList.remove('vkb-open'); root.style.removeProperty('--vkb-h'); return; }
    const el = panelRef.current;
    if (!el) return;
    root.classList.add('vkb-open');
    const upd = () => root.style.setProperty('--vkb-h', `${el.offsetHeight}px`);
    upd();
    const ro = new ResizeObserver(upd); ro.observe(el);
    const tm = setTimeout(() => targetRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 260);
    return () => { ro.disconnect(); clearTimeout(tm); root.classList.remove('vkb-open'); root.style.removeProperty('--vkb-h'); };
  }, [visible, target, mode, kb, layer]);

  /* ───── нажатия ───── */
  const ch = (c: string) => {
    const el = targetRef.current; if (!el) return;
    const up = shift !== 'off' && layer === 'alpha';
    insertText(el, up ? c.toUpperCase() : c, origNumber.current);
    if (shift === 'once') setShift('off');
  };
  const doBack = () => { const el = targetRef.current; if (el) backspace(el); };
  const startRepeat = (fn: () => void) => {
    fn(); stopRepeat();
    repeat.current.t = setTimeout(() => { repeat.current.i = setInterval(fn, 55); }, 380);
  };
  const stopRepeat = () => { clearTimeout(repeat.current.t); clearInterval(repeat.current.i); };
  useEffect(() => stopRepeat, []);

  const setLang = () => {
    const next = KB_ORDER[(KB_ORDER.indexOf(kb) + 1) % KB_ORDER.length];
    setKb(next); try { localStorage.setItem(LS_LANG, next); } catch { /* ignore */ }
  };
  const hide = () => { setOpen(false); (document.activeElement as HTMLElement | null)?.blur?.(); detach(); };

  if (!visible) return null;

  /* ───── кнопки ───── */
  const fn = FN;
  const press = guard;

  const rows = mode === 'num' || mode === 'tel' ? 4 : 5 + (kb === 'kk' && layer === 'alpha' ? 1 : 0);
  // клавиатура занимает не больше ~46% высоты экрана: на низком мониторе клавиши ниже, на высоком — до 56 px
  const kh = `clamp(28px, calc((46dvh - ${64 + 8 * (rows - 1)}px) / ${rows}), ${mode === 'num' || mode === 'tel' ? 54 : 56}px)`;
  const letters = LAYOUTS[kb];
  const cap = (c: string) => (shift !== 'off' && layer === 'alpha' ? c.toUpperCase() : c);

  const onShift = () => setShift((s) => (s === 'off' ? 'once' : s === 'once' ? 'caps' : 'off'));
  const bottom = (
    <Row>
      <KeyBtn wide={1.5} className={fn} onDown={() => setLayer(layer === 'alpha' ? 'sym' : 'alpha')}>{layer === 'alpha' ? '?123' : (kb === 'en' ? 'ABC' : 'АБВ')}</KeyBtn>
      <KeyBtn wide={1.7} className={cn(fn, 'gap-1.5 px-1 !text-[length:clamp(12px,calc(var(--kh)*0.32),16px)]')} onDown={setLang} title={t('Idioma')}><Globe size={15} className="shrink-0" />{KB_LABEL[kb]}</KeyBtn>
      {mode === 'email' && <KeyBtn wide={1} onDown={() => ch('@')}>@</KeyBtn>}
      <KeyBtn wide={mode === 'email' ? 4 : 6} onDown={() => ch(' ')} title="Space"><span className="text-muted-foreground text-sm">{mode === 'email' ? '' : '␣'}</span></KeyBtn>
      {mode === 'email' && <KeyBtn wide={1.3} className="text-[16px]" onDown={() => { const el = targetRef.current; if (el) insertText(el, '.kz', false); }}>.kz</KeyBtn>}
      <KeyBtn wide={1} onDown={() => ch('.')}>.</KeyBtn>
      <KeyBtn wide={1.8} className="bg-primary border-primary text-primary-foreground" onDown={() => { const el = targetRef.current; if (el) pressEnter(el); }}>
        <CornerDownLeft size={20} />
      </KeyBtn>
    </Row>
  );

  return createPortal(
    <RepCtx.Provider value={{ start: startRepeat, stop: stopRepeat }}>
    <div
      ref={panelRef} role="application" aria-label={t('Teclado en pantalla')} data-vkb="panel"
      onPointerDown={press} onMouseDown={press}
      className="fixed inset-x-0 bottom-0 z-[200] border-t border-border bg-card/95 backdrop-blur-md shadow-[0_-12px_40px_rgba(0,0,0,.45)] sheet-up"
      style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))', ['--kh' as string]: kh, ['--kf' as string]: 'clamp(13px, calc(var(--kh) * 0.38), 21px)' }}
    >
      <div className={cn('mx-auto px-2 sm:px-3 pt-2 space-y-1.5 sm:space-y-2', mode === 'num' || mode === 'tel' ? 'max-w-[460px]' : 'max-w-[1180px]')}>
        {/* верхняя полоска: поле, навигация, скрыть */}
        <div className="flex items-center gap-2 px-1">
          <button type="button" tabIndex={-1} data-vkb="off" data-sound="none" onPointerDown={(e) => { press(e); target && moveFocus(target, -1); }} onMouseDown={press}
            className="h-8 w-9 rounded-lg bg-secondary text-muted-foreground flex items-center justify-center" aria-label={t('Campo anterior')}><ArrowLeftToLine size={16} /></button>
          <button type="button" tabIndex={-1} data-vkb="off" data-sound="none" onPointerDown={(e) => { press(e); target && moveFocus(target, 1); }} onMouseDown={press}
            className="h-8 w-9 rounded-lg bg-secondary text-muted-foreground flex items-center justify-center" aria-label={t('Siguiente campo')}><ArrowRightToLine size={16} /></button>
          <div className="min-w-0 flex-1 truncate text-center text-xs text-muted-foreground">{label}</div>
          <button type="button" tabIndex={-1} data-vkb="off" data-sound="none" onPointerDown={(e) => { press(e); hide(); }} onMouseDown={press}
            className="h-8 px-3 rounded-lg bg-secondary text-muted-foreground flex items-center gap-1.5 text-xs font-medium"><ChevronDown size={16} />{t('Ocultar teclado')}</button>
        </div>

        {mode === 'num' || mode === 'tel' ? (
          <NumPad tel={mode === 'tel'} onChar={ch} onBack={doBack}
            onClear={() => { const el = targetRef.current; if (el) clearAll(el); }} onEnter={() => { const el = targetRef.current; if (el) pressEnter(el); }} />
        ) : layer === 'alpha' ? (
          <>
            <Row>{DIGITS.map((d) => <KeyBtn key={d} onDown={() => ch(d)}>{d}</KeyBtn>)}</Row>
            {kb === 'kk' && <Row>{KK_EXTRA.map((c) => <KeyBtn key={c} className="text-primary" onDown={() => ch(c)}>{cap(c)}</KeyBtn>)}</Row>}
            <Row>{letters[0].map((c) => <KeyBtn key={c} onDown={() => ch(c)}>{cap(c)}</KeyBtn>)}</Row>
            <Row>{letters[1].map((c) => <KeyBtn key={c} onDown={() => ch(c)}>{cap(c)}</KeyBtn>)}</Row>
            <Row>
              <KeyBtn wide={1.5} className={shift === 'caps' ? 'bg-primary border-primary text-primary-foreground' : fn} active={shift === 'once'} onDown={onShift} title="Shift"><ArrowBigUp size={22} fill={shift !== 'off' ? 'currentColor' : 'none'} /></KeyBtn>
              {letters[2].map((c) => <KeyBtn key={c} onDown={() => ch(c)}>{cap(c)}</KeyBtn>)}
              <KeyBtn wide={1.5} className={fn} hold onDown={doBack}><Delete size={22} /></KeyBtn>
            </Row>
            {bottom}
          </>
        ) : (
          <>
            <Row>{DIGITS.map((d) => <KeyBtn key={d} onDown={() => ch(d)}>{d}</KeyBtn>)}</Row>
            <Row>{SYM1.map((c) => <KeyBtn key={c} onDown={() => ch(c)}>{c}</KeyBtn>)}</Row>
            <Row>{SYM2.map((c) => <KeyBtn key={c} onDown={() => ch(c)}>{c}</KeyBtn>)}<KeyBtn wide={1.5} className={fn} hold onDown={doBack}><Delete size={22} /></KeyBtn></Row>
            <Row>{SYM3.map((c) => <KeyBtn key={c} onDown={() => ch(c)}>{c}</KeyBtn>)}</Row>
            {bottom}
          </>
        )}
      </div>
    </div>
    </RepCtx.Provider>,
    document.body,
  );
}

/* ───────── Цифровой блок (для чисел, количества, телефона) ───────── */
function NumPad({ tel, onChar, onBack, onClear, onEnter }: {
  tel: boolean; onChar: (c: string) => void; onBack: () => void; onClear: () => void; onEnter: () => void;
}) {
  const big = 'h-[calc(var(--kh)*1.18)] text-[length:calc(var(--kf)*1.3)]';
  const R = ({ children }: { children: React.ReactNode }) => <div className="flex gap-1.5 sm:gap-2">{children}</div>;
  const num = (d: string) => <KeyBtn key={d} className={big} onDown={() => onChar(d)}>{d}</KeyBtn>;
  return (
    <div className="space-y-1.5 sm:space-y-2 pb-1">
      <R>{['7', '8', '9'].map(num)}<KeyBtn className={cn(big, FN)} onDown={onBack} hold><Delete size={26} /></KeyBtn></R>
      <R>{['4', '5', '6'].map(num)}<KeyBtn className={cn(big, FN, 'text-lg')} onDown={onClear}>C</KeyBtn></R>
      <R>{['1', '2', '3'].map(num)}<KeyBtn className={cn(big, 'bg-primary border-primary text-primary-foreground')} onDown={onEnter}><CornerDownLeft size={26} /></KeyBtn></R>
      <R>
        <KeyBtn wide={tel ? 1 : 2} className={big} onDown={() => onChar('0')}>0</KeyBtn>
        {!tel && <KeyBtn className={big} onDown={() => onChar('00')}>00</KeyBtn>}
        <KeyBtn className={big} onDown={() => onChar(tel ? '+' : '.')}>{tel ? '+' : '.'}</KeyBtn>
        <KeyBtn className={cn(big, FN)} onDown={() => onChar('-')}>−</KeyBtn>
      </R>
    </div>
  );
}
