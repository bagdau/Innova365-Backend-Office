import { cn } from '../../utils/cn';
import { X } from 'lucide-react';
import { ReactNode, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { playSound } from '../../sound';
import { t } from '../../i18n';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  className?: string;
  /** максимальная ширина окна на планшете/десктопе (Tailwind max-w-*) */
  width?: string;
  /** закреплённая нижняя панель с кнопками: остаётся на виду, даже если содержимое длинное и прокручивается */
  footer?: ReactNode;
}

/**
 * Адаптивное окно: на телефоне — нижняя панель на всю ширину, на планшете и десктопе — по центру.
 * Высота ограничена экраном (dvh — учитывает адресную строку мобильного браузера): шапка и кнопки всегда на экране,
 * длинное содержимое прокручивается внутри. Esc закрывает, фон страницы не прокручивается.
 */
export function Modal({ open, onClose, title, children, className, width = 'max-w-lg', footer }: Props) {
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open) playSound('open');
    else if (wasOpen.current) playSound('close');
    wasOpen.current = open;
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    document.addEventListener('keydown', key);
    return () => { document.body.style.overflow = prev; document.removeEventListener('keydown', key); };
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4" role="presentation">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm fade-in" onClick={onClose} />
      <div
        role="dialog" aria-modal="true" aria-label={title}
        className={cn(
          'relative bg-card border border-border shadow-2xl w-full flex flex-col overflow-hidden',
          'max-h-[94dvh] sm:max-h-[90dvh] rounded-t-2xl sm:rounded-l sheet-up sm:pop-in', width, className,
        )}
      >
        <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5 border-b border-border flex-shrink-0">
          <h2 className="text-base font-semibold text-foreground truncate">{title}</h2>
          <button onClick={onClose} data-sound="none" aria-label={t('Cerrar')} className="p-2 -mr-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex-shrink-0">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-5">{children}</div>
        {footer && (
          <div className="flex-shrink-0 border-t border-border bg-card px-4 sm:px-5 pt-3" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
