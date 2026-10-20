import { ReactNode, RefObject, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { t } from '../../i18n';

/** true на телефонах (<640px): выпадающие списки/календарь открываются как нижняя панель. */
export function useIsMobile(): boolean {
  const q = '(max-width: 639px)';
  const [m, setM] = useState(() => typeof window !== 'undefined' && window.matchMedia(q).matches);
  useEffect(() => {
    const mq = window.matchMedia(q);
    const on = () => setM(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return m;
}

interface Props {
  open: boolean;
  onClose: () => void;
  anchorRef: RefObject<HTMLElement>;
  /** ширина панели на десктопе; по умолчанию = ширине поля */
  width?: number;
  /** примерная высота содержимого — для выбора «вниз/вверх» */
  estHeight?: number;
  title?: string;
  children: ReactNode;
}

/**
 * Единая «плавающая» панель: на десктопе/планшете — поповер под полем (или над ним, если снизу нет места),
 * на телефоне — нижняя панель на всю ширину с затемнением. Закрывается по Esc, клику снаружи, прокрутке страницы.
 */
export function Floating({ open, onClose, anchorRef, width, estHeight = 320, title, children }: Props) {
  const mobile = useIsMobile();
  const panel = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top?: number; bottom?: number; width: number; maxH: number } | null>(null);

  useLayoutEffect(() => {
    if (!open || mobile) return;
    const place = () => {
      const a = anchorRef.current?.getBoundingClientRect();
      if (!a) return;
      const w = Math.min(Math.max(width ?? a.width, a.width), window.innerWidth - 16);
      const left = Math.min(Math.max(8, a.left), window.innerWidth - w - 8);
      const below = window.innerHeight - a.bottom - 12;
      const above = a.top - 12;
      const up = below < Math.min(estHeight, 260) && above > below;
      setPos(up
        ? { left, bottom: window.innerHeight - a.top + 6, width: w, maxH: Math.max(160, above) }
        : { left, top: a.bottom + 6, width: w, maxH: Math.max(160, below) });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); };
  }, [open, mobile, width, estHeight, anchorRef]);

  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); anchorRef.current?.focus(); } };
    const down = (e: MouseEvent) => {
      const el = e.target as Node;
      if (panel.current?.contains(el) || anchorRef.current?.contains(el)) return;
      onClose();
    };
    document.addEventListener('keydown', key, true);
    document.addEventListener('mousedown', down);
    return () => { document.removeEventListener('keydown', key, true); document.removeEventListener('mousedown', down); };
  }, [open, onClose, anchorRef]);

  useEffect(() => {
    if (!open || !mobile) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open, mobile]);

  if (!open) return null;

  if (mobile) {
    return createPortal(
      <div className="fixed inset-0 z-[70] flex items-end" role="presentation">
        <div className="absolute inset-0 bg-black/55 backdrop-blur-[2px] fade-in" onClick={onClose} />
        <div ref={panel} className="relative w-full bg-card border-t border-border rounded-t-2xl shadow-2xl sheet-up max-h-[85vh] flex flex-col" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
          <div className="flex justify-center pt-2"><span className="w-10 h-1 rounded-full bg-border" /></div>
          <div className="flex items-center justify-between px-4 pt-2 pb-2">
            <p className="text-base font-semibold text-foreground truncate">{title}</p>
            <button type="button" onClick={onClose} aria-label={t('Cerrar')} className="p-2 -mr-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted"><X size={20} /></button>
          </div>
          <div className="overflow-y-auto overscroll-contain px-2 pb-3">{children}</div>
        </div>
      </div>,
      document.body,
    );
  }

  if (!pos) return null;
  return createPortal(
    <div
      ref={panel}
      className="fixed z-[70] bg-card border border-border rounded-l shadow-2xl pop-in flex flex-col overflow-hidden"
      style={{ left: pos.left, top: pos.top, bottom: pos.bottom, width: pos.width, maxHeight: pos.maxH, transformOrigin: pos.bottom !== undefined ? 'bottom' : 'top' }}
    >
      {children}
    </div>,
    document.body,
  );
}
