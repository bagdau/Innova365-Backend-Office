import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { onLiveChange } from './live';
import { buildXlsx, downloadBlob } from './xlsx';
import { AlertTriangle, ArrowDown, ArrowUp, CheckCircle2, ChevronsUpDown, Download, FileSpreadsheet, Info, Printer, Loader2, X, XCircle } from 'lucide-react';

/* ───────── Уведомления и подтверждения ───────── */
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
      <div className="no-print pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[min(92vw,380px)] flex-col gap-2">
        {toasts.map((t) => (
          <div key={t.id} className={clsx('pointer-events-auto flex items-start gap-2.5 rounded-xl border bg-surface px-3.5 py-3 text-sm shadow-xl animate-pop', t.kind === 'ok' ? 'border-good/40' : t.kind === 'err' ? 'border-bad/50' : 'border-info/40')}>
            {t.kind === 'ok' ? <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-good" /> : t.kind === 'err' ? <XCircle size={18} className="mt-0.5 shrink-0 text-bad" /> : <Info size={18} className="mt-0.5 shrink-0 text-info" />}
            <span className="min-w-0 whitespace-pre-wrap break-words">{t.text}</span>
          </div>
        ))}
      </div>
      {conf && (
        <Modal open onClose={() => close(false)} title={conf.title} width={460}
          footer={<><button className="btn btn-soft" onClick={() => close(false)}>Отмена</button>
            <button className={clsx('btn', conf.danger ? 'btn-danger' : 'btn-primary')} disabled={!!conf.typeToConfirm && typed !== conf.typeToConfirm} onClick={() => close(true)}>{conf.danger && <AlertTriangle size={15} />} {conf.confirmLabel || 'Подтвердить'}</button></>}>
          <div className="space-y-3">
            {conf.text && <div className="text-sm leading-relaxed text-muted">{conf.text}</div>}
            {conf.typeToConfirm && (<div><label className="label">Для подтверждения введите <b className="font-mono text-ink">{conf.typeToConfirm}</b></label><input className="input font-mono" value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus /></div>)}
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
    <div className="no-print fixed inset-0 z-[90] flex items-end justify-center bg-slate-950/50 backdrop-blur-[2px] animate-fade sm:items-center sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="flex max-h-[94dvh] w-full flex-col rounded-t-2xl border border-line bg-surface shadow-2xl animate-pop sm:rounded-2xl" style={{ maxWidth: width }}>
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
          <h3 className="min-w-0 truncate text-[15px] font-semibold">{title}</h3>
          <button className="btn btn-ghost btn-sm !px-2" onClick={onClose} aria-label="Закрыть"><X size={17} /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-line px-5 py-3.5">{footer}</div>}
      </div>
    </div>
  );
}

/* ───────── Мелкие элементы ───────── */
export const Spinner = ({ size = 18 }: { size?: number }) => <Loader2 size={size} className="animate-spin text-brand" />;
export const Loading = ({ text = 'Загрузка…' }: { text?: string }) => <div className="flex items-center justify-center gap-2.5 py-16 text-sm text-muted"><Spinner /> {text}</div>;

export function ErrorBox({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div className="m-4 flex items-start gap-3 rounded-xl border border-bad/40 bg-bad/10 p-4 text-sm">
      <XCircle size={18} className="mt-0.5 shrink-0 text-bad" />
      <div className="min-w-0"><div className="font-medium text-bad">{(error as Error)?.message || 'Ошибка'}</div>{onRetry && <button className="btn btn-soft btn-sm mt-3" onClick={onRetry}>Повторить</button>}</div>
    </div>
  );
}

export function Empty({ icon, title, text, action }: { icon?: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      {icon && <div className="text-muted/50">{icon}</div>}
      <div className="font-medium">{title}</div>
      {text && <div className="max-w-sm text-sm text-muted">{text}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Badge({ tone = 'muted', children }: { tone?: 'muted' | 'good' | 'bad' | 'warn' | 'info' | 'brand'; children: ReactNode }) {
  const t = { muted: 'bg-surface2 text-muted', good: 'bg-good/12 text-good', bad: 'bg-bad/12 text-bad', warn: 'bg-warn/15 text-warn', info: 'bg-info/12 text-info', brand: 'bg-brand/12 text-brand' }[tone];
  return <span className={clsx('chip', t)}>{children}</span>;
}

export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label?: ReactNode; disabled?: boolean }) {
  return (
    <label className={clsx('inline-flex cursor-pointer select-none items-center gap-2.5', disabled && 'pointer-events-none opacity-50')}>
      <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className={clsx('relative h-5 w-9 shrink-0 rounded-full border transition', checked ? 'border-brand bg-brand' : 'border-line bg-surface2')}>
        <span className={clsx('absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white shadow transition-all', checked ? 'left-[19px]' : 'left-0.5')} />
      </button>
      {label && <span className="text-sm">{label}</span>}
    </label>
  );
}

export function Field({ label, children, hint, className }: { label: string; children: ReactNode; hint?: string; className?: string }) {
  return <div className={className}><label className="label">{label}</label>{children}{hint && <p className="mt-1 text-[11px] text-muted">{hint}</p>}</div>;
}

export function PageHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="no-print mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0"><h1 className="truncate text-[22px] font-semibold tracking-tight">{title}</h1>{subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}</div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({ label, value, sub, tone, icon }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'good' | 'bad' | 'warn'; icon?: ReactNode }) {
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between gap-2 text-xs font-medium text-muted"><span className="truncate">{label}</span>{icon && <span className="text-muted/60">{icon}</span>}</div>
      <div className={clsx('tnum mt-1.5 truncate text-[22px] font-semibold tracking-tight', tone === 'good' && 'text-good', tone === 'bad' && 'text-bad', tone === 'warn' && 'text-warn')}>{value}</div>
      {sub && <div className="mt-0.5 truncate text-xs text-muted">{sub}</div>}
    </div>
  );
}

export function Delta({ now, prev }: { now: number; prev: number }) {
  if (!prev) return <span className="text-muted">нет данных за прошлый период</span>;
  const d = ((now - prev) / prev) * 100;
  return <span className={d >= 0 ? 'text-good' : 'text-bad'}>{d >= 0 ? '▲' : '▼'} {Math.abs(d).toFixed(1)}% к прошлому периоду</span>;
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: ReactNode; badge?: ReactNode }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="no-print mb-4 flex gap-1 overflow-x-auto border-b border-line">
      {tabs.map((t) => (
        <button key={t.id} onClick={() => onChange(t.id)} className={clsx('relative flex shrink-0 items-center gap-1.5 px-3.5 py-2.5 text-sm font-medium transition', value === t.id ? 'text-brand' : 'text-muted hover:text-ink')}>
          {t.label}{t.badge}{value === t.id && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand" />}
        </button>
      ))}
    </div>
  );
}

/* ───────── Загрузка данных ───────── */
export function useFetch<T>(loader: () => Promise<T>, deps: unknown[], opts: { live?: boolean } = {}) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const seq = useRef(0);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;
  const load = useCallback(async (silent = false) => {
    const id = ++seq.current;
    if (!silent) setLoading(true);
    try { const r = await loaderRef.current(); if (id === seq.current) { setData(r); setError(null); } }
    catch (e) { if (id === seq.current && !silent) setError(e); }   // тихое обновление не затирает уже показанные данные ошибкой
    finally { if (id === seq.current && !silent) setLoading(false); }
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { void load(); }, [load]);
  // живое обновление: сервер сообщил об изменении в БД — тихо перечитываем
  const live = opts.live !== false;
  useEffect(() => (live ? onLiveChange(() => { void load(true); }) : undefined), [live, load]);
  return { data, error, loading, reload: () => load(), setData };
}

/* ───────── Таблица ───────── */
export interface Col<T> {
  key: string; header: ReactNode; render: (row: T) => ReactNode; align?: 'left' | 'right' | 'center';
  sort?: (row: T) => number | string | null; width?: number | string; csv?: (row: T) => string | number | null; hideOnMobile?: boolean; className?: string;
}

export function exportCsv<T>(name: string, cols: Col<T>[], rows: T[]) {
  const esc = (v: unknown) => { const s = v === null || v === undefined ? '' : String(v); return /[";\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const use = cols.filter((c) => c.csv);
  const lines = [use.map((c) => esc(typeof c.header === 'string' ? c.header : c.key)).join(';'), ...rows.map((r) => use.map((c) => esc(c.csv!(r))).join(';'))];
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name.endsWith('.csv') ? name : name + '.csv'; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/** Выгрузка таблицы в Excel (.xlsx): те же столбцы, что и в CSV; даты и числа сохраняются как даты и числа. */
export function exportXlsx<T>(name: string, cols: Col<T>[], rows: T[]) {
  const use = cols.filter((c) => c.csv);
  const blob = buildXlsx(name.replace(/[_-]+/g, ' '), use.map((c) => (typeof c.header === 'string' ? c.header : c.key)), rows.map((r) => use.map((c) => c.csv!(r))));
  downloadBlob(blob, name.endsWith('.xlsx') ? name : name + '.xlsx');
}

export function DataTable<T>({ cols, rows, rowKey, onRowClick, footer, empty, csvName, maxHeight, dense, initialSort }: {
  cols: Col<T>[]; rows: T[]; rowKey: (r: T) => string; onRowClick?: (r: T) => void; footer?: ReactNode; empty?: ReactNode; csvName?: string; maxHeight?: string; dense?: boolean;
  initialSort?: { key: string; dir: 'asc' | 'desc' };
}) {
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(initialSort ?? null);
  const sorted = useMemo(() => {
    const c = cols.find((x) => x.key === sort?.key);
    if (!sort || !c?.sort) return rows;
    const f = c.sort;
    return [...rows].sort((a, b) => {
      const x = f(a), y = f(b);
      if (x === y) return 0;
      if (x === null) return 1; if (y === null) return -1;
      const r = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'ru');
      return sort.dir === 'asc' ? r : -r;
    });
  }, [rows, sort, cols]);
  return (
    <div className="card overflow-hidden">
      {csvName && rows.length > 0 && (
        <div className="no-print flex justify-end gap-1 border-b border-line px-3 py-1.5">
          <button className="btn btn-ghost btn-sm" onClick={() => window.print()} title="Печать или сохранение в PDF"><Printer size={14} /> Печать / PDF</button>
          <button className="btn btn-ghost btn-sm" onClick={() => exportXlsx(csvName, cols, sorted)} title="Таблица в формате Excel"><FileSpreadsheet size={14} /> Excel</button>
          <button className="btn btn-ghost btn-sm" onClick={() => exportCsv(csvName, cols, sorted)}><Download size={14} /> CSV</button></div>
      )}
      <div className="overflow-auto" style={{ maxHeight }}>
        <table className="w-full text-[13.5px]">
          <thead className="sticky top-0 z-[1]">
            <tr>
              {cols.map((c) => (
                <th key={c.key} className={clsx('th', c.align === 'right' && '!text-right', c.align === 'center' && '!text-center', c.hideOnMobile && 'hidden md:table-cell', c.sort && 'cursor-pointer select-none hover:text-ink')} style={{ width: c.width }}
                  onClick={() => c.sort && setSort((s) => (s?.key !== c.key ? { key: c.key, dir: 'asc' } : s.dir === 'asc' ? { key: c.key, dir: 'desc' } : null))}>
                  <span className="inline-flex items-center gap-1">{c.header}{c.sort && (sort?.key === c.key ? (sort.dir === 'asc' ? <ArrowUp size={12} className="text-brand" /> : <ArrowDown size={12} className="text-brand" />) : <ChevronsUpDown size={11} className="opacity-40" />)}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={rowKey(r)} className={clsx('transition hover:bg-surface2/60', onRowClick && 'cursor-pointer')} onClick={() => onRowClick?.(r)}>
                {cols.map((c) => <td key={c.key} className={clsx('td', dense && '!py-1.5', c.align === 'right' && 'tnum text-right', c.align === 'center' && 'text-center', c.hideOnMobile && 'hidden md:table-cell', c.className)}>{c.render(r)}</td>)}
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={cols.length}>{empty ?? <Empty title="Нет данных" />}</td></tr>}
          </tbody>
          {footer && <tfoot className="bg-surface2/50 font-semibold">{footer}</tfoot>}
        </table>
      </div>
    </div>
  );
}

/* ───────── Выбор периода ───────── */
import { addDays, todayIn } from './format';
import { useAuth } from './auth';

export type Period = { from: string; to: string };
const monthStart = (iso: string) => iso.slice(0, 8) + '01';

export function usePeriod(initial: 'today' | 'month' | 'week' = 'month'): [Period, (p: Period) => void] {
  const { me } = useAuth();
  const tz = me?.settings.timezone ?? 'Asia/Almaty';
  const [p, setP] = useState<Period>(() => {
    const t = todayIn(tz);
    return initial === 'today' ? { from: t, to: t } : initial === 'week' ? { from: addDays(t, -6), to: t } : { from: monthStart(t), to: t };
  });
  return [p, setP];
}

export function PeriodPicker({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  const { me } = useAuth();
  const t = todayIn(me?.settings.timezone ?? 'Asia/Almaty');
  const presets: { label: string; p: Period }[] = useMemo(() => {
    const ms = monthStart(t);
    const prevEnd = addDays(ms, -1);
    const qm = Math.floor((Number(t.slice(5, 7)) - 1) / 3) * 3 + 1;
    return [
      { label: 'Сегодня', p: { from: t, to: t } }, { label: 'Вчера', p: { from: addDays(t, -1), to: addDays(t, -1) } },
      { label: '7 дней', p: { from: addDays(t, -6), to: t } }, { label: 'Месяц', p: { from: ms, to: t } },
      { label: 'Прошлый месяц', p: { from: monthStart(prevEnd), to: prevEnd } }, { label: 'Квартал', p: { from: `${t.slice(0, 4)}-${String(qm).padStart(2, '0')}-01`, to: t } },
      { label: 'Год', p: { from: `${t.slice(0, 4)}-01-01`, to: t } },
    ];
  }, [t]);
  const active = presets.find((x) => x.p.from === value.from && x.p.to === value.to)?.label;
  return (
    <div className="no-print flex flex-wrap items-center gap-2">
      <div className="flex flex-wrap gap-1 rounded-lg border border-line bg-surface p-0.5">
        {presets.map((x) => (
          <button key={x.label} onClick={() => onChange(x.p)} className={clsx('rounded-md px-2.5 py-1 text-[12.5px] font-medium transition', active === x.label ? 'bg-brand text-brandfg' : 'text-muted hover:text-ink')}>{x.label}</button>
        ))}
      </div>
      <div className="flex items-center gap-1.5">
        <input type="date" className="input !h-8 !w-[140px] !px-2 text-[13px]" value={value.from} max={value.to} onChange={(e) => e.target.value && onChange({ ...value, from: e.target.value })} />
        <span className="text-muted">—</span>
        <input type="date" className="input !h-8 !w-[140px] !px-2 text-[13px]" value={value.to} min={value.from} onChange={(e) => e.target.value && onChange({ ...value, to: e.target.value })} />
      </div>
    </div>
  );
}
