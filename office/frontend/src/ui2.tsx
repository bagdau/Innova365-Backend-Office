import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { Search, X } from 'lucide-react';

/** Поле поиска с кнопкой очистки. */
export function SearchBox({ value, onChange, placeholder = 'Поиск…', className }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string }) {
  return (
    <div className={clsx('relative', className)}>
      <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
      <input className="input !h-8 !pl-8 !pr-7 text-[13px]" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      {value && <button type="button" className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted hover:text-ink" onClick={() => onChange('')}><X size={13} /></button>}
    </div>
  );
}

/** Переключатель-«чипы»: один из вариантов с счётчиками. */
export function Chips<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { id: T; label: ReactNode; count?: number }[] }) {
  return (
    <div className="no-print flex flex-wrap gap-1 rounded-lg border border-line bg-surface p-0.5">
      {options.map((o) => (
        <button key={o.id} onClick={() => onChange(o.id)} className={clsx('rounded-md px-2.5 py-1 text-[12.5px] font-medium transition', value === o.id ? 'bg-brand text-brandfg' : 'text-muted hover:text-ink')}>
          {o.label}{o.count !== undefined && <span className={clsx('ml-1.5 tnum text-[11px]', value === o.id ? 'opacity-80' : 'opacity-60')}>{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

/** Выбор из длинного списка с поиском (сырьё, блюда, поставщики). */
export function Picker<T extends { id: string }>({ items, value, onChange, label, placeholder = 'Выберите…', disabled }: { items: T[]; value: string; onChange: (id: string) => void; label: (i: T) => string; placeholder?: string; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  const cur = items.find((i) => i.id === value);
  const shown = useMemo(() => { const s = q.trim().toLowerCase(); return (s ? items.filter((i) => label(i).toLowerCase().includes(s)) : items).slice(0, 80); }, [items, q]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div ref={box} className="relative">
      <button type="button" disabled={disabled} className="input flex items-center justify-between text-left" onClick={() => { setOpen((o) => !o); setQ(''); }}>
        <span className={clsx('truncate', !cur && 'text-muted/70')}>{cur ? label(cur) : placeholder}</span>
      </button>
      {open && (
        <div className="absolute z-30 mt-1 w-full min-w-[220px] overflow-hidden rounded-lg border border-line bg-surface shadow-xl">
          <div className="border-b border-line p-1.5"><input autoFocus className="input !h-8 text-[13px]" placeholder="Поиск…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <ul className="max-h-60 overflow-y-auto py-1">
            {shown.map((i) => <li key={i.id}><button type="button" className={clsx('block w-full px-3 py-1.5 text-left text-[13px] hover:bg-surface2', i.id === value && 'bg-brand/10 text-brand')} onClick={() => { onChange(i.id); setOpen(false); }}>{label(i)}</button></li>)}
            {!shown.length && <li className="px-3 py-2 text-xs text-muted">Ничего не найдено</li>}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Мини-график цены: линия по точкам. */
export function Sparkline({ values, width = 120, height = 32, tone = 'brand' }: { values: number[]; width?: number; height?: number; tone?: 'brand' | 'bad' | 'good' }) {
  if (values.length < 2) return <span className="text-xs text-muted">—</span>;
  const min = Math.min(...values), max = Math.max(...values), span = max - min || 1;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * (width - 4) + 2},${height - 3 - ((v - min) / span) * (height - 6)}`).join(' ');
  const color = tone === 'bad' ? 'rgb(var(--bad))' : tone === 'good' ? 'rgb(var(--good))' : 'rgb(var(--brand))';
  return <svg width={width} height={height} className="overflow-visible"><polyline points={pts} fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" /><circle cx={pts.split(' ').pop()!.split(',')[0]} cy={pts.split(' ').pop()!.split(',')[1]} r="2.6" fill={color} /></svg>;
}

/** Строка прогресса. */
export function ProgressBar({ value, max, tone = 'brand' }: { value: number; max: number; tone?: 'brand' | 'good' | 'warn' }) {
  const pct = max ? Math.min(100, (value / max) * 100) : 0;
  return <div className="h-1.5 overflow-hidden rounded-full bg-surface2"><div className={clsx('h-full rounded-full transition-all', tone === 'good' ? 'bg-good' : tone === 'warn' ? 'bg-warn' : 'bg-brand')} style={{ width: `${pct}%` }} /></div>;
}

export const fmtQty = (v: number, d = 3): string => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: d }).format(v);
export const parseNum = (s: string): number => Number(String(s).replace(/\s/g, '').replace(',', '.'));

/** Парные столбцы по периодам: поступления и выплаты. */
export function PairBars({ data, height = 180 }: { data: { label: string; a: number; b: number }[]; height?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.flatMap((d) => [d.a, d.b]));
  const W = 800, H = height, pad = { t: 10, b: 24, l: 6, r: 6 };
  const slot = (W - pad.l - pad.r) / Math.max(1, data.length);
  const bw = Math.min(34, slot * 0.34);
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }} preserveAspectRatio="none">
        <line x1={pad.l} x2={W - pad.r} y1={H - pad.b} y2={H - pad.b} stroke="rgb(var(--line))" />
        {data.map((d, i) => {
          const cx = pad.l + slot * i + slot / 2, ch = H - pad.t - pad.b;
          return (
            <g key={d.label} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={pad.l + slot * i} y={pad.t} width={slot} height={ch} fill="transparent" />
              <rect x={cx - bw - 1} y={H - pad.b - (ch * d.a) / max} width={bw} height={Math.max(d.a > 0 ? 2 : 0, (ch * d.a) / max)} rx="3" fill="rgb(var(--good) / .8)" />
              <rect x={cx + 1} y={H - pad.b - (ch * d.b) / max} width={bw} height={Math.max(d.b > 0 ? 2 : 0, (ch * d.b) / max)} rx="3" fill="rgb(var(--bad) / .75)" />
              <text x={cx} y={H - 6} textAnchor="middle" fontSize="11" fill="rgb(var(--muted))">{d.label}</text>
            </g>
          );
        })}
      </svg>
      {hover !== null && <div className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs shadow-lg" style={{ left: `${((hover + 0.5) / data.length) * 100}%` }}>
        <div className="font-medium">{data[hover].label}</div><div className="tnum text-good">+ {new Intl.NumberFormat('ru-RU').format(Math.round(data[hover].a))}</div><div className="tnum text-bad">− {new Intl.NumberFormat('ru-RU').format(Math.round(data[hover].b))}</div></div>}
    </div>
  );
}

/** Выбор месяца (стрелки + поле). */
export function MonthPicker({ value, onChange }: { value: string; onChange: (m: string) => void }) {
  const shift = (d: number) => { const [y, m] = value.split('-').map(Number); const t = new Date(Date.UTC(y, m - 1 + d, 1)); onChange(t.toISOString().slice(0, 7)); };
  return (
    <div className="no-print inline-flex items-center gap-1 rounded-lg border border-line bg-surface p-0.5">
      <button className="btn btn-ghost btn-sm !px-2" onClick={() => shift(-1)}>←</button>
      <input type="month" className="input !h-8 !w-[150px] !border-0 !px-1 text-center text-[13px] font-medium" value={value} onChange={(e) => e.target.value && onChange(e.target.value)} />
      <button className="btn btn-ghost btn-sm !px-2" onClick={() => shift(1)}>→</button>
    </div>
  );
}

export const MONTHS = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
export const monthLabel = (m: string): string => `${MONTHS[Number(m.slice(5)) - 1]} ${m.slice(2, 4)}`;
