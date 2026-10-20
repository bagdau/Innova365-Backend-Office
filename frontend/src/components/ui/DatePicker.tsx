import { useCallback, useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { cn } from '../../utils/cn';
import { t, locale } from '../../i18n';
import { Floating, useIsMobile } from './Floating';

interface Props {
  /** 'YYYY-MM-DD' или '' */
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  clearable?: boolean;
  /** быстрые кнопки: Сегодня / Завтра / Через 3 дня / Через неделю */
  quick?: boolean;
  className?: string;
  title?: string;
}

const pad = (n: number) => String(n).padStart(2, '0');
const toIso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (s: string): Date | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
};
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Календарь в стиле приложения: месяц/год, быстрые даты, клавиатура, нижняя панель на телефоне. Заменяет <input type="date">. */
export function DatePicker({ value, onChange, min, max, placeholder, disabled, invalid, clearable = true, quick = true, className, title }: Props) {
  const btn = useRef<HTMLButtonElement>(null);
  const mobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const sel = parse(value);
  const today = useMemo(() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); }, [open]);
  const [view, setView] = useState<Date>(() => sel ?? today);       // первый день показанного месяца
  const [cursor, setCursor] = useState<Date>(() => sel ?? today);   // выбранная клавиатурой ячейка
  const [mode, setMode] = useState<'days' | 'months'>('days');
  const minD = min ? parse(min) : null;
  const maxD = max ? parse(max) : null;

  const close = useCallback(() => { setOpen(false); setMode('days'); }, []);
  const openCal = () => {
    if (disabled) return;
    const base = parse(value) ?? today;
    setView(new Date(base.getFullYear(), base.getMonth(), 1)); setCursor(base); setMode('days'); setOpen(true);
  };
  const off = (d: Date) => (minD && d < minD) || (maxD && d > maxD) || false;
  const pick = (d: Date) => { if (off(d)) return; onChange(toIso(d)); close(); btn.current?.focus(); };

  const fmt = useMemo(() => new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' }), []);
  const monthName = useMemo(() => new Intl.DateTimeFormat(locale, { month: 'long' }), []);
  const monthShort = useMemo(() => new Intl.DateTimeFormat(locale, { month: 'short' }), []);
  const weekdays = useMemo(() => {
    const f = new Intl.DateTimeFormat(locale, { weekday: 'short' });
    return Array.from({ length: 7 }, (_, i) => cap(f.format(new Date(2024, 0, 1 + i)))); // 1 янв 2024 — понедельник
  }, []);

  // 6 недель, неделя начинается с понедельника
  const cells = useMemo(() => {
    const first = new Date(view.getFullYear(), view.getMonth(), 1);
    const lead = (first.getDay() + 6) % 7;
    return Array.from({ length: 42 }, (_, i) => addDays(first, i - lead));
  }, [view]);

  const goMonth = (n: number) => setView((v) => new Date(v.getFullYear(), v.getMonth() + n, 1));
  const moveCursor = (n: number) => {
    const c = addDays(cursor, n);
    setCursor(c);
    if (c.getMonth() !== view.getMonth() || c.getFullYear() !== view.getFullYear()) setView(new Date(c.getFullYear(), c.getMonth(), 1));
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (!open) {
      if (['ArrowDown', 'Enter', ' '].includes(e.key)) { e.preventDefault(); openCal(); }
      return;
    }
    if (mode !== 'days') return;
    const map: Record<string, () => void> = {
      ArrowLeft: () => moveCursor(-1), ArrowRight: () => moveCursor(1), ArrowUp: () => moveCursor(-7), ArrowDown: () => moveCursor(7),
      PageUp: () => goMonth(-1), PageDown: () => goMonth(1), Enter: () => pick(cursor),
    };
    if (map[e.key]) { e.preventDefault(); map[e.key](); }
  };

  const quicks = [
    { label: t('Hoy'), d: today },
    { label: t('Mañana'), d: addDays(today, 1) },
    { label: t('En 3 días'), d: addDays(today, 3) },
    { label: t('En una semana'), d: addDays(today, 7) },
  ];

  const cell = mobile ? 'h-11 text-base' : 'h-9 text-sm';

  return (
    <div className={cn('relative', className)} onKeyDown={onKey}>
      <button
        ref={btn}
        type="button"
        disabled={disabled}
        title={title}
        aria-haspopup="dialog"
        aria-expanded={open}
        data-sound="none"
        onClick={() => (open ? close() : openCal())}
        className={cn(
          'w-full flex items-center gap-2 bg-muted border rounded-m px-3 py-2 min-h-[40px] text-sm text-left transition-colors',
          'focus:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30 hover:border-muted-foreground/50',
          invalid ? 'border-error ring-2 ring-error/30' : open ? 'border-primary' : 'border-border',
          disabled && 'opacity-60 cursor-not-allowed',
        )}
      >
        <CalendarDays size={16} className="flex-shrink-0 text-muted-foreground" />
        <span className={cn('flex-1 truncate', sel ? 'text-foreground' : 'text-muted-foreground')}>{sel ? fmt.format(sel) : (placeholder ?? t('Elegir fecha'))}</span>
        {clearable && sel && !disabled && (
          <span
            role="button" tabIndex={-1} aria-label={t('Limpiar')}
            onClick={(e) => { e.stopPropagation(); onChange(''); }}
            className="p-1 -mr-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-card"
          ><X size={14} /></span>
        )}
      </button>

      <Floating open={open} onClose={close} anchorRef={btn} width={320} estHeight={400} title={t('Elegir fecha')}>
        <div className="p-3 sm:p-3.5 select-none">
          {/* заголовок: ‹ месяц год › */}
          <div className="flex items-center justify-between mb-2">
            <button type="button" aria-label="‹" data-sound="none" onClick={() => (mode === 'days' ? goMonth(-1) : setView(new Date(view.getFullYear() - 1, view.getMonth(), 1)))}
              className="p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted"><ChevronLeft size={18} /></button>
            <button type="button" data-sound="none" onClick={() => setMode(mode === 'days' ? 'months' : 'days')}
              className="px-3 py-1.5 rounded-m font-semibold text-foreground hover:bg-muted">
              {mode === 'days' ? `${cap(monthName.format(view))} ${view.getFullYear()}` : view.getFullYear()}
            </button>
            <button type="button" aria-label="›" data-sound="none" onClick={() => (mode === 'days' ? goMonth(1) : setView(new Date(view.getFullYear() + 1, view.getMonth(), 1)))}
              className="p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted"><ChevronRight size={18} /></button>
          </div>

          {mode === 'months' ? (
            <div className="grid grid-cols-3 gap-1.5 py-1">
              {Array.from({ length: 12 }, (_, i) => {
                const isCur = sel && sel.getFullYear() === view.getFullYear() && sel.getMonth() === i;
                return (
                  <button key={i} type="button" data-sound="none"
                    onClick={() => { setView(new Date(view.getFullYear(), i, 1)); setMode('days'); }}
                    className={cn('py-3 rounded-m text-sm font-medium', isCur ? 'bg-primary text-white' : 'text-foreground hover:bg-muted')}>
                    {cap(monthShort.format(new Date(2024, i, 1)).replace('.', ''))}
                  </button>
                );
              })}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-7 mb-1">
                {weekdays.map((w, i) => <span key={w} className={cn('text-center text-[11px] font-semibold uppercase tracking-wide py-1', i >= 5 ? 'text-error/80' : 'text-muted-foreground')}>{w}</span>)}
              </div>
              <div className="grid grid-cols-7 gap-y-0.5" role="grid">
                {cells.map((d) => {
                  const inMonth = d.getMonth() === view.getMonth();
                  const isSel = !!sel && toIso(d) === toIso(sel);
                  const isToday = toIso(d) === toIso(today);
                  const isCursor = toIso(d) === toIso(cursor);
                  const dis = off(d);
                  return (
                    <button
                      key={toIso(d)} type="button" role="gridcell" aria-selected={isSel} disabled={dis} data-sound="none"
                      onClick={() => pick(d)}
                      onMouseEnter={() => setCursor(d)}
                      className={cn(
                        'relative rounded-full font-medium transition-colors flex items-center justify-center', cell,
                        isSel ? 'bg-primary text-white shadow-md shadow-primary/30'
                          : dis ? 'text-muted-foreground/40 cursor-not-allowed'
                          : inMonth ? 'text-foreground hover:bg-muted' : 'text-muted-foreground/60 hover:bg-muted',
                        isToday && !isSel && 'ring-1 ring-primary text-primary',
                        isCursor && !isSel && !dis && 'bg-muted',
                      )}
                    >{d.getDate()}</button>
                  );
                })}
              </div>
            </>
          )}

          {/* быстрые даты и очистка */}
          <div className="mt-3 pt-3 border-t border-border flex flex-wrap gap-1.5">
            {quick && quicks.map((q) => (
              <button key={q.label} type="button" data-sound="none" disabled={off(q.d)} onClick={() => pick(q.d)}
                className="px-3 py-1.5 rounded-pill text-xs font-medium bg-muted text-foreground hover:bg-primary hover:text-white disabled:opacity-40 disabled:hover:bg-muted disabled:hover:text-foreground">
                {q.label}
              </button>
            ))}
            {clearable && sel && (
              <button type="button" data-sound="none" onClick={() => { onChange(''); close(); }} className="ml-auto px-3 py-1.5 rounded-pill text-xs font-medium text-error hover:bg-error-bg">{t('Limpiar')}</button>
            )}
          </div>
        </div>
      </Floating>
    </div>
  );
}
