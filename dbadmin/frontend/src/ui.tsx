import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { AlertTriangle, CheckCircle2, Info, Loader2, X, XCircle } from 'lucide-react';

/* ───────── Тосты и подтверждения ───────── */
type Toast = { id: number; kind: 'ok' | 'err' | 'info'; text: string };
interface ConfirmOpts { title: string; text?: ReactNode; confirmLabel?: string; danger?: boolean; typeToConfirm?: string }
interface UiCtx { toast: (kind: Toast['kind'], text: string) => void; confirm: (o: ConfirmOpts) => Promise<boolean> }
const Ctx = createContext<UiCtx>(null as unknown as UiCtx);
export const useUi = () => useContext(Ctx);

export function UiProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [conf, setConf] = useState<(ConfirmOpts & { resolve: (v: boolean) => void }) | null>(null);
  const [typed, setTyped] = useState('');
  const seq = useRef(0);

  const toast = useCallback((kind: Toast['kind'], text: string) => {
    const id = ++seq.current;
    setToasts((t) => [...t.slice(-3), { id, kind, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'err' ? 7000 : 3500);
  }, []);
  const confirm = useCallback((o: ConfirmOpts) => new Promise<boolean>((resolve) => { setTyped(''); setConf({ ...o, resolve }); }), []);
  const value = useMemo(() => ({ toast, confirm }), [toast, confirm]);
  const close = (v: boolean) => { conf?.resolve(v); setConf(null); };

  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[min(92vw,380px)] flex-col gap-2">
        {toasts.map((t) => (
          <div key={t.id} className={clsx('pointer-events-auto flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5 text-sm shadow-2xl animate-pop backdrop-blur',
            t.kind === 'ok' && 'border-ok/40 bg-surface/95', t.kind === 'err' && 'border-danger/50 bg-surface/95', t.kind === 'info' && 'border-info/40 bg-surface/95')}>
            {t.kind === 'ok' ? <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-ok" /> : t.kind === 'err' ? <XCircle size={18} className="mt-0.5 shrink-0 text-danger" /> : <Info size={18} className="mt-0.5 shrink-0 text-info" />}
            <span className="min-w-0 whitespace-pre-wrap break-words">{t.text}</span>
          </div>
        ))}
      </div>
      {conf && (
        <Modal open onClose={() => close(false)} title={conf.title} width={460}>
          <div className="space-y-4">
            {conf.text && <div className="text-sm leading-relaxed text-muted">{conf.text}</div>}
            {conf.typeToConfirm && (
              <div>
                <label className="label">Для подтверждения введите <b className="font-mono text-ink">{conf.typeToConfirm}</b></label>
                <input className="input font-mono" value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus />
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button className="btn btn-soft" onClick={() => close(false)}>Отмена</button>
              <button className={clsx('btn', conf.danger ? 'btn-danger' : 'btn-primary')} disabled={!!conf.typeToConfirm && typed !== conf.typeToConfirm} onClick={() => close(true)}>
                {conf.danger && <AlertTriangle size={15} />} {conf.confirmLabel || 'Подтвердить'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </Ctx.Provider>
  );
}

/* ───────── Модальное окно ───────── */
export function Modal({ open, onClose, title, children, width = 560, footer }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; width?: number; footer?: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm animate-fade sm:items-center sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="flex max-h-[92dvh] w-full flex-col rounded-t-2xl border border-line bg-surface shadow-2xl animate-pop sm:rounded-2xl" style={{ maxWidth: width }}>
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
          <h3 className="min-w-0 truncate text-[15px] font-semibold">{title}</h3>
          <button className="btn btn-ghost btn-sm !px-2" onClick={onClose} aria-label="Закрыть"><X size={17} /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-line px-5 py-3.5 safe-b">{footer}</div>}
      </div>
    </div>
  );
}

/* ───────── Мелкие элементы ───────── */
export const Spinner = ({ size = 18 }: { size?: number }) => <Loader2 size={size} className="spin text-accent" />;

export function Loading({ text = 'Загрузка…' }: { text?: string }) {
  return <div className="flex items-center justify-center gap-2.5 py-16 text-sm text-muted"><Spinner /> {text}</div>;
}

export function ErrorBox({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const e = error as { message?: string; pg?: { detail?: string; hint?: string } };
  return (
    <div className="m-4 rounded-xl border border-danger/40 bg-danger/10 p-4 text-sm">
      <div className="flex items-start gap-2.5"><XCircle size={18} className="mt-0.5 shrink-0 text-danger" />
        <div className="min-w-0"><div className="font-medium text-danger">{e?.message || 'Ошибка'}</div>
          {e?.pg?.detail && <div className="mt-1 text-muted">{e.pg.detail}</div>}
          {e?.pg?.hint && <div className="mt-1 text-muted">Подсказка: {e.pg.hint}</div>}
          {onRetry && <button className="btn btn-soft btn-sm mt-3" onClick={onRetry}>Повторить</button>}</div></div>
    </div>
  );
}

export function Empty({ icon, title, text }: { icon?: ReactNode; title: string; text?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      {icon && <div className="text-muted/60">{icon}</div>}
      <div className="font-medium">{title}</div>
      {text && <div className="max-w-sm text-sm text-muted">{text}</div>}
    </div>
  );
}

export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label?: ReactNode; disabled?: boolean }) {
  return (
    <label className={clsx('inline-flex cursor-pointer select-none items-center gap-2.5', disabled && 'pointer-events-none opacity-50')}>
      <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
        className={clsx('relative h-5 w-9 shrink-0 rounded-full border transition', checked ? 'border-accent bg-accent' : 'border-line bg-surface2')}>
        <span className={clsx('absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white shadow transition-all', checked ? 'left-[19px]' : 'left-0.5')} />
      </button>
      {label && <span className="text-sm">{label}</span>}
    </label>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: ReactNode; icon?: ReactNode; badge?: ReactNode }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-line px-3 sm:px-5">
      {tabs.map((t) => (
        <button key={t.id} onClick={() => onChange(t.id)}
          className={clsx('relative flex shrink-0 items-center gap-1.5 px-3 py-2.5 text-sm font-medium transition', value === t.id ? 'text-accent' : 'text-muted hover:text-ink')}>
          {t.icon}{t.label}{t.badge}
          {value === t.id && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-accent" />}
        </button>
      ))}
    </div>
  );
}

export function Stat({ label, value, sub, icon, tone }: { label: string; value: ReactNode; sub?: ReactNode; icon?: ReactNode; tone?: 'ok' | 'warn' | 'danger' }) {
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between text-xs font-medium text-muted"><span>{label}</span>{icon && <span className="text-muted/70">{icon}</span>}</div>
      <div className={clsx('mt-1.5 truncate text-2xl font-semibold tracking-tight', tone === 'ok' && 'text-ok', tone === 'warn' && 'text-warn', tone === 'danger' && 'text-danger')}>{value}</div>
      {sub && <div className="mt-0.5 truncate text-xs text-muted">{sub}</div>}
    </div>
  );
}

/* ───────── Форматирование ───────── */
export const fmtBytes = (n: number | null | undefined): string => {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '—';
  let v = Number(n); const u = ['Б', 'КБ', 'МБ', 'ГБ', 'ТБ']; let i = 0;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v >= 100 || i === 0 ? Math.round(v) : v.toFixed(1)} ${u[i]}`;
};
export const fmtNum = (n: number | string | null | undefined): string => (n === null || n === undefined ? '—' : Number(n).toLocaleString('ru-RU'));
export const fmtDate = (s: string | null | undefined): string => (s ? new Date(s).toLocaleString('ru-RU') : '—');
export const fmtDuration = (sec: number): string => {
  if (sec < 60) return `${Math.floor(sec)} с`;
  if (sec < 3600) return `${Math.floor(sec / 60)} мин ${Math.floor(sec % 60)} с`;
  if (sec < 86400) return `${Math.floor(sec / 3600)} ч ${Math.floor((sec % 3600) / 60)} мин`;
  return `${Math.floor(sec / 86400)} дн ${Math.floor((sec % 86400) / 3600)} ч`;
};

export const NUMERIC_TYPES = /^(int|integer|bigint|smallint|numeric|decimal|real|double|float|money|serial|bigserial|oid)/i;
export const isNumericType = (t: string) => NUMERIC_TYPES.test(t);
