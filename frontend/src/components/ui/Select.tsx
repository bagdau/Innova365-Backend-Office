import { ReactNode, RefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';
import { cn } from '../../utils/cn';
import { t } from '../../i18n';
import { Floating, useIsMobile } from './Floating';

export interface SelectOption {
  value: string;
  label: ReactNode;
  /** текст для поиска и для подписи в поле (если label — не строка) */
  text?: string;
  disabled?: boolean;
  hint?: ReactNode;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  /** строка поиска: по умолчанию включается при > 7 вариантов */
  searchable?: boolean;
  size?: 'md' | 'sm';
  className?: string;
  title?: string;
  ariaLabel?: string;
  triggerRef?: RefObject<HTMLButtonElement>;
  id?: string;
}

const textOf = (o: SelectOption) => o.text ?? (typeof o.label === 'string' ? o.label : String(o.value));

/** Выпадающий список в стиле приложения: поиск, клавиатура, нижняя панель на телефоне. Заменяет нативный <select>. */
export function Select({ value, onChange, options, placeholder, disabled, invalid, searchable, size = 'md', className, title, ariaLabel, triggerRef, id }: Props) {
  const own = useRef<HTMLButtonElement>(null);
  const ref = (triggerRef ?? own) as RefObject<HTMLButtonElement>;
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const mobile = useIsMobile();
  const listRef = useRef<HTMLDivElement>(null);
  const typed = useRef({ s: '', at: 0 });

  const showSearch = searchable ?? options.length > 7;
  const shown = useMemo(() => {
    const n = q.trim().toLowerCase();
    return n ? options.filter((o) => textOf(o).toLowerCase().includes(n)) : options;
  }, [options, q]);
  const selected = options.find((o) => o.value === value);

  const close = useCallback(() => { setOpen(false); setQ(''); }, []);
  const openList = () => {
    if (disabled) return;
    const i = shown.findIndex((o) => o.value === value);
    setActive(i >= 0 ? i : Math.max(0, shown.findIndex((o) => !o.disabled)));
    setOpen(true);
  };
  const pick = (o: SelectOption) => { if (o.disabled) return; onChange(o.value); close(); ref.current?.focus(); };

  useEffect(() => { setActive((a) => Math.min(a, Math.max(0, shown.length - 1))); }, [shown.length]);
  useEffect(() => { // держим активный пункт в поле зрения
    if (open) listRef.current?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  const move = (dir: 1 | -1) => {
    if (shown.length === 0) return;
    let i = active;
    for (let k = 0; k < shown.length; k++) { i = (i + dir + shown.length) % shown.length; if (!shown[i].disabled) break; }
    setActive(i);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); openList(); }
      return;
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
    else if (e.key === 'Home') { e.preventDefault(); setActive(0); }
    else if (e.key === 'End') { e.preventDefault(); setActive(shown.length - 1); }
    else if (e.key === 'Enter') { e.preventDefault(); if (shown[active]) pick(shown[active]); }
    else if (e.key === 'Tab') close();
    else if (!showSearch && e.key.length === 1) { // быстрый набор буквы
      const now = Date.now();
      typed.current = { s: now - typed.current.at > 700 ? e.key : typed.current.s + e.key, at: now };
      const i = shown.findIndex((o) => textOf(o).toLowerCase().startsWith(typed.current.s.toLowerCase()));
      if (i >= 0) setActive(i);
    }
  };

  const empty = !selected || selected.value === '';
  const label = selected ? selected.label : placeholder;

  return (
    <div className={cn('relative', className)} onKeyDown={onKey}>
      <button
        ref={ref}
        id={id}
        type="button"
        disabled={disabled}
        title={title}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        data-sound="none"
        onClick={() => (open ? close() : openList())}
        className={cn(
          'w-full flex items-center justify-between gap-2 bg-muted border rounded-m text-left text-foreground transition-colors',
          'focus:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30 hover:border-muted-foreground/50',
          size === 'sm' ? 'px-2.5 py-1.5 text-xs' : 'px-3 py-2 text-sm min-h-[40px]',
          invalid ? 'border-error ring-2 ring-error/30' : open ? 'border-primary' : 'border-border',
          disabled && 'opacity-60 cursor-not-allowed hover:border-border',
        )}
      >
        <span className={cn('truncate', empty && 'text-muted-foreground')}>{label ?? ' '}</span>
        <ChevronDown size={size === 'sm' ? 14 : 16} className={cn('flex-shrink-0 text-muted-foreground transition-transform duration-200', open && 'rotate-180')} />
      </button>

      <Floating open={open} onClose={close} anchorRef={ref} estHeight={Math.min(shown.length, 7) * 40 + (showSearch ? 52 : 12)} title={placeholder ?? title}>
        {showSearch && (
          <div className="p-2 border-b border-border bg-card sticky top-0">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                autoFocus={!mobile}
                value={q}
                onChange={(e) => { setQ(e.target.value); setActive(0); }}
                placeholder={t('Buscar')}
                className="w-full bg-muted border border-border rounded-m pl-8 pr-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary"
              />
            </div>
          </div>
        )}
        <div ref={listRef} role="listbox" className="overflow-y-auto overscroll-contain p-1.5 flex-1">
          {shown.length === 0 && <p className="px-3 py-6 text-center text-sm text-muted-foreground">{t('No se encontró nada')}</p>}
          {shown.map((o, i) => {
            const sel = o.value === value;
            return (
              <div
                key={o.value + i}
                data-i={i}
                role="option"
                aria-selected={sel}
                aria-disabled={o.disabled}
                onMouseEnter={() => !o.disabled && setActive(i)}
                onClick={() => pick(o)}
                className={cn(
                  'flex items-center justify-between gap-3 rounded-m px-3 cursor-pointer select-none',
                  mobile ? 'min-h-[48px] text-base' : 'min-h-[38px] text-sm',
                  sel ? 'text-primary font-semibold' : 'text-foreground',
                  i === active && !o.disabled && (sel ? 'bg-primary/15' : 'bg-muted'),
                  sel && i !== active && 'bg-primary/10',
                  o.disabled && 'opacity-45 cursor-not-allowed',
                  o.value === '' && !sel && 'text-muted-foreground',
                )}
              >
                <span className="truncate">{o.label}{o.hint && <span className="ml-2 text-xs text-muted-foreground font-normal">{o.hint}</span>}</span>
                {sel && <Check size={16} className="flex-shrink-0" />}
              </div>
            );
          })}
        </div>
      </Floating>
    </div>
  );
}
