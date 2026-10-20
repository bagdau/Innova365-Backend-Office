import { forwardRef, useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '../../utils/cn';
import { t } from '../../i18n';

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
  /** Горячая клавиша фокуса, например "/" */
  hotkey?: string;
  onEnter?: () => void;
}

/** Поле поиска: иконка, кнопка «очистить», фокус по горячей клавише, Esc очищает. */
export const SearchInput = forwardRef<HTMLInputElement, Props>(function SearchInput(
  { value, onChange, placeholder, className, autoFocus, hotkey, onEnter }, ref,
) {
  const inner = useRef<HTMLInputElement | null>(null);
  const setRef = (el: HTMLInputElement | null) => {
    inner.current = el;
    if (typeof ref === 'function') ref(el);
    else if (ref) (ref as React.MutableRefObject<HTMLInputElement | null>).current = el;
  };

  useEffect(() => {
    if (!hotkey) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== hotkey || e.ctrlKey || e.metaKey || e.altKey) return;
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      e.preventDefault();
      inner.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [hotkey]);

  return (
    <div className={cn('relative', className)}>
      <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
      <input
        ref={setRef}
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && value) { e.preventDefault(); onChange(''); }
          if (e.key === 'Enter') onEnter?.();
        }}
        placeholder={placeholder ?? t('Buscar producto...')}
        autoComplete="off"
        spellCheck={false}
        enterKeyHint="search"
        className="w-full bg-muted border border-border rounded-lg pl-9 pr-9 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
      />
      {value && (
        <button
          type="button"
          data-sound="none"
          onClick={() => { onChange(''); inner.current?.focus(); }}
          aria-label={t('Limpiar')}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-muted-foreground hover:text-foreground"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
});
