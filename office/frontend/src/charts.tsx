import { useState } from 'react';
import { fmtShort, money } from './format';

/** Столбчатая диаграмма по дням: наведение показывает значение. Без внешних библиотек. */
export function BarChart({ data, height = 190 }: { data: { date: string; value: number; extra?: string }[]; height?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.value));
  const n = data.length;
  const W = 800, H = height, pad = { l: 8, r: 8, t: 12, b: 24 };
  const bw = Math.max(2, (W - pad.l - pad.r) / Math.max(1, n));
  const gap = Math.min(6, bw * 0.25);
  const ticks = [0, 0.5, 1];
  const step = Math.max(1, Math.ceil(n / 8));
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }} preserveAspectRatio="none" role="img" aria-label="График по дням">
        {ticks.map((t) => <line key={t} x1={pad.l} x2={W - pad.r} y1={pad.t + (H - pad.t - pad.b) * (1 - t)} y2={pad.t + (H - pad.t - pad.b) * (1 - t)} stroke="rgb(var(--line))" strokeDasharray={t ? '3 4' : ''} />)}
        {data.map((d, i) => {
          const h = ((H - pad.t - pad.b) * d.value) / max;
          const x = pad.l + i * bw + gap / 2;
          return (
            <g key={d.date} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={pad.l + i * bw} y={pad.t} width={bw} height={H - pad.t - pad.b} fill="transparent" />
              <rect x={x} y={H - pad.b - h} width={Math.max(1, bw - gap)} height={Math.max(d.value > 0 ? 2 : 0, h)} rx={Math.min(4, bw / 3)} fill={hover === i ? 'rgb(var(--brand))' : 'rgb(var(--brand) / .72)'} />
              {i % step === 0 && <text x={x + (bw - gap) / 2} y={H - 6} textAnchor="middle" fontSize="11" fill="rgb(var(--muted))">{fmtShort(d.date)}</text>}
            </g>
          );
        })}
      </svg>
      {hover !== null && (
        <div className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs shadow-lg"
          style={{ left: `${((pad.l + hover * bw + bw / 2) / W) * 100}%`, top: 0 }}>
          <div className="font-medium">{fmtShort(data[hover].date)}</div><div className="tnum text-brand">{money(data[hover].value)}</div>{data[hover].extra && <div className="text-muted">{data[hover].extra}</div>}
        </div>
      )}
    </div>
  );
}

/** Горизонтальный рейтинг (точки, блюда, категории). */
export function HBars({ rows, format = money }: { rows: { name: string; value: number; sub?: string }[]; format?: (v: number) => string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="space-y-2.5">
      {rows.map((r) => (
        <div key={r.name}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-[13px]"><span className="min-w-0 truncate">{r.name}</span><span className="tnum shrink-0 font-medium">{format(r.value)}</span></div>
          <div className="h-1.5 overflow-hidden rounded-full bg-surface2"><div className="h-full rounded-full bg-brand" style={{ width: `${Math.max(2, (r.value / max) * 100)}%` }} /></div>
          {r.sub && <div className="mt-0.5 text-[11px] text-muted">{r.sub}</div>}
        </div>
      ))}
    </div>
  );
}

const PALETTE = ['rgb(var(--brand))', 'rgb(var(--good))', 'rgb(var(--info))', 'rgb(var(--warn))', 'rgb(var(--bad))'];

/** Кольцевая диаграмма долей (способы оплаты). */
export function Donut({ rows }: { rows: { name: string; value: number }[] }) {
  const total = rows.reduce((a, r) => a + r.value, 0) || 1;
  const R = 52, C = 2 * Math.PI * R;
  let acc = 0;
  return (
    <div className="flex items-center gap-5">
      <svg viewBox="0 0 140 140" className="h-[120px] w-[120px] shrink-0 -rotate-90">
        <circle cx="70" cy="70" r={R} fill="none" stroke="rgb(var(--surface2))" strokeWidth="18" />
        {rows.map((r, i) => {
          const len = (r.value / total) * C;
          const el = <circle key={r.name} cx="70" cy="70" r={R} fill="none" stroke={PALETTE[i % PALETTE.length]} strokeWidth="18" strokeDasharray={`${Math.max(0, len - 1.5)} ${C}`} strokeDashoffset={-acc} />;
          acc += len;
          return el;
        })}
      </svg>
      <ul className="min-w-0 flex-1 space-y-1.5 text-[13px]">
        {rows.map((r, i) => (
          <li key={r.name} className="flex items-center gap-2"><i className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: PALETTE[i % PALETTE.length] }} />
            <span className="min-w-0 flex-1 truncate">{r.name}</span><span className="tnum text-muted">{Math.round((r.value / total) * 100)}%</span></li>
        ))}
      </ul>
    </div>
  );
}
