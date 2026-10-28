import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowBigUp, ArrowLeftToLine, ArrowRightToLine, ChevronDown, CornerDownLeft, Delete, Globe } from 'lucide-react';
import { useKeyboardStore } from '../../store/keyboardStore';
import { lang as appLang, t } from '../../i18n';
import { cn } from '../../utils/cn';
import './VirtualKeyboard.css';

/**
 * Экранная (сенсорная) клавиатура для кассового моноблока.
 * Появляется при фокусе на поле ввода, вводит текст прямо в активное поле (работает с React-формами),
 * не даёт открыться системной клавиатуре, сдвигает страницу, чтобы поле не пряталось под клавиатурой.
 * Раскладки: RU, ҚАЗ, EN, символы; для числовых полей — цифровой блок.
 */

type Kb = 'ru' | 'kk' | 'en';
type TextEl = HTMLInputElement | HTMLTextAreaElement;
type Mode = 'text' | 'num' | 'tel' | 'email' | 'pin';
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
  if (im === 'pin') return 'pin';
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
  else if (s > 0) {
    const chars = Array.from(el.value.slice(0, s));
    const previous = chars[chars.length - 1]?.length ?? 1;
    setValue(el, el.value.slice(0, s - previous) + el.value.slice(s), s - previous);
  }
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
const FN = 'vkb-key--action';

interface KeyProps { children: React.ReactNode; onDown: () => void; className?: string; wide?: number; active?: boolean; title?: string; hold?: boolean; pressed?: boolean }
function KeyBtn({ children, onDown, className, wide = 1, active, title, hold, pressed }: KeyProps) {
  const rep = useContext(RepCtx);
  const heldPointer = useRef<number | null>(null);
  const stop = (id: number) => { if (heldPointer.current === id) { rep.stop(); heldPointer.current = null; } };
  return (
    <button
      type="button" title={title} aria-label={title ?? (typeof children === 'string' ? children : undefined)} aria-pressed={pressed}
      data-sound="none" data-vkb="off"
      style={{ flex: wide }}
      onPointerDown={(e) => {
        guard(e);
        if (hold) {
          if (heldPointer.current !== null) return;
          heldPointer.current = e.pointerId;
          e.currentTarget.setPointerCapture(e.pointerId);
          rep.start(onDown);
        } else onDown();
      }}
      onPointerUp={hold ? (e) => stop(e.pointerId) : undefined}
      onPointerCancel={hold ? (e) => stop(e.pointerId) : undefined}
      onMouseDown={guard} onClick={(e) => { e.preventDefault(); if (e.detail === 0) onDown(); }}
      className={cn(
        'vkb-key', active && 'vkb-key--active',
        className,
      )}
    >
      {children}
    </button>
  );
}
const Row = ({ children }: { children: React.ReactNode }) => <div className="vkb-row">{children}</div>;

/* ───────── Компонент ───────── */
export function VirtualKeyboard() {
  const enabled = useKeyboardStore((s) => s.enabled);
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<TextEl | null>(null);
  const [mode, setMode] = useState<Mode>('text');
  const [kb, setKb] = useState<Kb>(storedKb);
  const [layer, setLayer] = useState<'alpha' | 'sym'>('alpha');
  const [shift, setShift] = useState<Shift>('off');
  const [nativeOpen, setNativeOpen] = useState(false);
  const [label, setLabel] = useState('');
  const targetRef = useRef<TextEl | null>(null);
  const restoreRef = useRef<(() => void) | null>(null);
  const origNumber = useRef(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>();
  const repeat = useRef<{ t?: ReturnType<typeof setTimeout>; i?: ReturnType<typeof setInterval> }>({});
  const enabledRef = useRef(enabled);
  const shiftRef = useRef(shift);
  const kbRef = useRef(kb);
  enabledRef.current = enabled;
  shiftRef.current = shift;
  kbRef.current = kb;

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
    shiftRef.current = 'off';
    setTarget(el); setMode(m); setLabel(labelOf(el)); setLayer('alpha'); setShift('off');
    if (m === 'email') { kbRef.current = 'en'; setKb('en'); }    // email/пароль/ссылка — латиница
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

  // Если ОС всё-таки открыла собственную клавиатуру, не накладываем поверх вторую.
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const update = () => setNativeOpen(window.innerHeight - viewport.height > 150);
    viewport.addEventListener('resize', update);
    update();
    return () => viewport.removeEventListener('resize', update);
  }, []);

  /* высота клавиатуры → CSS-переменная: страница и окна сдвигаются */
  const visible = enabled && open && !!target && !nativeOpen;
  useEffect(() => {
    const root = document.documentElement;
    if (!visible) { root.classList.remove('vkb-open'); root.style.removeProperty('--vkb-h'); return; }
    const el = panelRef.current;
    if (!el) return;
    root.classList.add('vkb-open');
    const upd = () => root.style.setProperty('--vkb-h', `${el.offsetHeight}px`);
    upd();
    const ro = new ResizeObserver(upd); ro.observe(el);
    const frame = requestAnimationFrame(() => targetRef.current?.scrollIntoView({ block: 'nearest' }));
    return () => { ro.disconnect(); cancelAnimationFrame(frame); root.classList.remove('vkb-open'); root.style.removeProperty('--vkb-h'); };
  }, [visible, target]);

  /* ───── нажатия ───── */
  const ch = (c: string) => {
    const el = targetRef.current; if (!el) return;
    const up = shiftRef.current !== 'off' && layer === 'alpha';
    insertText(el, up ? c.toUpperCase() : c, origNumber.current);
    if (shiftRef.current === 'once') { shiftRef.current = 'off'; setShift('off'); }
  };
  const doBack = () => { const el = targetRef.current; if (el) backspace(el); };
  const stopRepeat = useCallback(() => { clearTimeout(repeat.current.t); clearInterval(repeat.current.i); }, []);
  const startRepeat = useCallback((fn: () => void) => {
    stopRepeat(); fn();
    repeat.current.t = setTimeout(() => { repeat.current.i = setInterval(fn, 60); }, 390);
  }, [stopRepeat]);
  useEffect(() => stopRepeat, [stopRepeat]);
  const repValue = useMemo(() => ({ start: startRepeat, stop: stopRepeat }), [startRepeat, stopRepeat]);

  const setLang = () => {
    const next = KB_ORDER[(KB_ORDER.indexOf(kbRef.current) + 1) % KB_ORDER.length];
    kbRef.current = next;
    setKb(next); try { localStorage.setItem(LS_LANG, next); } catch { /* ignore */ }
  };
  const hide = () => { setOpen(false); (document.activeElement as HTMLElement | null)?.blur?.(); detach(); };

  if (!visible) return null;

  /* ───── кнопки ───── */
  const fn = FN;
  const press = guard;

  const rows = mode === 'num' || mode === 'tel' || mode === 'pin' ? 4 : 5 + (kb === 'kk' && layer === 'alpha' ? 1 : 0);
  // клавиатура занимает не больше ~46% высоты экрана: на низком мониторе клавиши ниже, на высоком — до 56 px
  const kh = `clamp(34px, calc((50dvh - ${70 + 6 * (rows - 1)}px) / ${rows}), ${mode === 'num' || mode === 'tel' || mode === 'pin' ? 70 : 66}px)`;
  const letters = LAYOUTS[kb];
  const cap = (c: string) => (shift !== 'off' && layer === 'alpha' ? c.toUpperCase() : c);

  const onShift = () => {
    const next = shiftRef.current === 'off' ? 'once' : shiftRef.current === 'once' ? 'caps' : 'off';
    shiftRef.current = next;
    setShift(next);
  };
  const bottom = (
    <Row>
      <KeyBtn wide={1.5} className={fn} title={layer === 'alpha' ? 'Символы и цифры' : 'Буквы'} onDown={() => setLayer(layer === 'alpha' ? 'sym' : 'alpha')}>{layer === 'alpha' ? '?123' : (kb === 'en' ? 'ABC' : 'АБВ')}</KeyBtn>
      <KeyBtn wide={1.7} className={cn(fn, 'gap-1.5 px-1 !text-[length:clamp(12px,calc(var(--kh)*0.32),16px)]')} onDown={setLang} title={t('Idioma')}><Globe size={15} className="shrink-0" />{KB_LABEL[kb]}</KeyBtn>
      {mode === 'email' && <KeyBtn wide={1} onDown={() => ch('@')}>@</KeyBtn>}
      <KeyBtn wide={mode === 'email' ? 4 : 6} onDown={() => ch(' ')} title={kb === 'kk' ? 'Бос орын' : kb === 'en' ? 'Space' : 'Пробел'}><span className="vkb-space-label">{kb === 'kk' ? 'Бос орын' : kb === 'en' ? 'Space' : 'Пробел'}</span></KeyBtn>
      {mode === 'email' && <KeyBtn wide={1.3} className="text-[16px]" onDown={() => { const el = targetRef.current; if (el) insertText(el, '.kz', false); }}>.kz</KeyBtn>}
      <KeyBtn wide={1} onDown={() => ch('.')}>.</KeyBtn>
      <KeyBtn wide={1.8} className="vkb-key--enter" title="Enter" onDown={() => { const el = targetRef.current; if (el) pressEnter(el); }}>
        <CornerDownLeft size={20} />
      </KeyBtn>
    </Row>
  );

  return createPortal(
    <RepCtx.Provider value={repValue}>
    <div
      ref={panelRef} role="group" aria-label={t('Teclado en pantalla')} data-vkb="panel"
      className="vkb-shell fixed inset-x-0 bottom-0 z-[200]"
      style={{ ['--kh' as string]: kh, ['--kf' as string]: 'clamp(15px, calc(var(--kh) * 0.38), 22px)' }}
    >
      <div className={cn('vkb-inner mx-auto', mode === 'num' || mode === 'tel' || mode === 'pin' ? 'max-w-[460px]' : 'max-w-[1600px]')}>
        {/* верхняя полоска: поле, навигация, скрыть */}
        <div className="vkb-toolbar">
          <button type="button" data-vkb="off" data-sound="none" onPointerDown={(e) => { press(e); target && moveFocus(target, -1); }} onMouseDown={press} onClick={(e) => { if (e.detail === 0 && target) moveFocus(target, -1); }}
            className="vkb-tool" aria-label={t('Campo anterior')}><ArrowLeftToLine size={17} /></button>
          <button type="button" data-vkb="off" data-sound="none" onPointerDown={(e) => { press(e); target && moveFocus(target, 1); }} onMouseDown={press} onClick={(e) => { if (e.detail === 0 && target) moveFocus(target, 1); }}
            className="vkb-tool" aria-label={t('Siguiente campo')}><ArrowRightToLine size={17} /></button>
          <div className="vkb-target-label" aria-live="polite">{label}</div>
          <button type="button" data-vkb="off" data-sound="none" onPointerDown={(e) => { press(e); hide(); }} onMouseDown={press} onClick={(e) => { if (e.detail === 0) hide(); }}
            className="vkb-tool vkb-tool--hide"><ChevronDown size={17} />{t('Ocultar teclado')}</button>
        </div>

        {mode === 'num' || mode === 'tel' || mode === 'pin' ? (
          <NumPad tel={mode === 'tel'} pin={mode === 'pin'} onChar={ch} onBack={doBack}
            onClear={() => { const el = targetRef.current; if (el) clearAll(el); }} onEnter={() => { const el = targetRef.current; if (el) pressEnter(el); }} />
        ) : layer === 'alpha' ? (
          <>
            <Row>{DIGITS.map((d) => <KeyBtn key={d} onDown={() => ch(d)}>{d}</KeyBtn>)}</Row>
            {kb === 'kk' && <Row>{KK_EXTRA.map((c) => <KeyBtn key={c} className="text-primary" onDown={() => ch(c)}>{cap(c)}</KeyBtn>)}</Row>}
            <Row>{letters[0].map((c) => <KeyBtn key={c} onDown={() => ch(c)}>{cap(c)}</KeyBtn>)}</Row>
            <Row>{letters[1].map((c) => <KeyBtn key={c} onDown={() => ch(c)}>{cap(c)}</KeyBtn>)}</Row>
            <Row>
              <KeyBtn wide={1.5} className={shift === 'caps' ? 'vkb-key--caps' : fn} active={shift === 'once'} pressed={shift !== 'off'} onDown={onShift} title="Shift"><ArrowBigUp size={22} fill={shift !== 'off' ? 'currentColor' : 'none'} /></KeyBtn>
              {letters[2].map((c) => <KeyBtn key={c} onDown={() => ch(c)}>{cap(c)}</KeyBtn>)}
              <KeyBtn wide={1.5} className={fn} hold onDown={doBack} title="Backspace"><Delete size={22} /></KeyBtn>
            </Row>
            {bottom}
          </>
        ) : (
          <>
            <Row>{DIGITS.map((d) => <KeyBtn key={d} onDown={() => ch(d)}>{d}</KeyBtn>)}</Row>
            <Row>{SYM1.map((c) => <KeyBtn key={c} onDown={() => ch(c)}>{c}</KeyBtn>)}</Row>
            <Row>{SYM2.map((c) => <KeyBtn key={c} onDown={() => ch(c)}>{c}</KeyBtn>)}<KeyBtn wide={1.5} className={fn} hold onDown={doBack} title="Backspace"><Delete size={22} /></KeyBtn></Row>
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
function NumPad({ tel, pin, onChar, onBack, onClear, onEnter }: {
  tel: boolean; pin: boolean; onChar: (c: string) => void; onBack: () => void; onClear: () => void; onEnter: () => void;
}) {
  const big = 'vkb-key--numeric';
  const R = Row;
  const num = (d: string) => <KeyBtn key={d} className={big} onDown={() => onChar(d)}>{d}</KeyBtn>;
  if (pin) return (
    <div className="vkb-numpad" aria-label="PIN">
      <R>{['1', '2', '3'].map(num)}</R>
      <R>{['4', '5', '6'].map(num)}</R>
      <R>{['7', '8', '9'].map(num)}</R>
      <R><KeyBtn className={FN} onDown={onBack} hold title="Backspace"><Delete size={24} /></KeyBtn>{num('0')}<KeyBtn className="vkb-key--enter" onDown={onEnter} title="Enter"><CornerDownLeft size={24} /></KeyBtn></R>
    </div>
  );
  return (
    <div className="vkb-numpad">
      <R>{['7', '8', '9'].map(num)}<KeyBtn className={cn(big, FN)} onDown={onBack} hold title="Backspace"><Delete size={26} /></KeyBtn></R>
      <R>{['4', '5', '6'].map(num)}<KeyBtn className={cn(big, FN, 'text-lg')} onDown={onClear}>C</KeyBtn></R>
      <R>{['1', '2', '3'].map(num)}<KeyBtn className={cn(big, 'vkb-key--enter')} onDown={onEnter} title="Enter"><CornerDownLeft size={26} /></KeyBtn></R>
      <R>
        <KeyBtn wide={tel ? 1 : 2} className={big} onDown={() => onChar('0')}>0</KeyBtn>
        {!tel && <KeyBtn className={big} onDown={() => onChar('00')}>00</KeyBtn>}
        <KeyBtn className={big} onDown={() => onChar(tel ? '+' : '.')}>{tel ? '+' : '.'}</KeyBtn>
        <KeyBtn className={cn(big, FN)} onDown={() => onChar('-')}>−</KeyBtn>
      </R>
    </div>
  );
}
