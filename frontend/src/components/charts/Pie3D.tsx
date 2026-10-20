import { useState } from 'react';
import { formatCurrency } from '../../utils/cn';

export interface PieItem { name: string; value: number }

const COLORS = ['#3b82f6', '#a78bfa', '#a3e635', '#f59e0b', '#f472b6', '#2dd4bf', '#94a3b8'];

/** Затемняет hex-цвет для боковой стенки. */
function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * k)));
  return `rgb(${c(n >> 16)},${c((n >> 8) & 255)},${c(n & 255)})`;
}

const W = 340, H = 250, CX = 170, CY = 112, RX = 128, RY = 64, DEPTH = 26, START = -Math.PI / 2;
const pt = (a: number, dx = 0, dy = 0, dz = 0) => [CX + dx + RX * Math.cos(a), CY + dy + dz + RY * Math.sin(a)] as const;
const f = (n: number) => n.toFixed(2);

/** Объёмная круговая диаграмма (3D-вид сверху-спереди) с выдвинутым сектором при наведении. */
export function Pie3D({ items, money = true }: { items: PieItem[]; money?: boolean }) {
  const [hover, setHover] = useState<number | null>(null);
  const total = items.reduce((s, i) => s + i.value, 0);
  if (!total) return null;

  let acc = START;
  const slices = items.map((it, i) => {
    const span = (it.value / total) * Math.PI * 2;
    const a0 = acc; const a1 = acc + span; acc = a1;
    const mid = (a0 + a1) / 2;
    const pop = hover === i ? 16 : i === 0 ? 7 : 0;
    return { it, i, a0, a1, mid, span, dx: pop * Math.cos(mid), dy: pop * Math.sin(mid) * (RY / RX), color: COLORS[i % COLORS.length] };
  });
  // дальние секторы рисуем первыми
  const order = [...slices].sort((a, b) => Math.sin(a.mid) - Math.sin(b.mid));

  const top = (s: typeof slices[number]) => {
    if (s.span >= Math.PI * 2 - 1e-6) {
      const [x, y] = pt(START, s.dx, s.dy);
      const [x2, y2] = pt(START + Math.PI, s.dx, s.dy);
      return `M${f(x)},${f(y)} A${RX},${RY} 0 1 1 ${f(x2)},${f(y2)} A${RX},${RY} 0 1 1 ${f(x)},${f(y)} Z`;
    }
    const [x0, y0] = pt(s.a0, s.dx, s.dy); const [x1, y1] = pt(s.a1, s.dx, s.dy);
    return `M${f(CX + s.dx)},${f(CY + s.dy)} L${f(x0)},${f(y0)} A${RX},${RY} 0 ${s.span > Math.PI ? 1 : 0} 1 ${f(x1)},${f(y1)} Z`;
  };
  // боковая стенка видна только у передней половины (θ ∈ [0, π])
  const wall = (s: typeof slices[number]) => {
    const lo = Math.max(s.a0, 0), hi = Math.min(s.a1, Math.PI);
    if (hi <= lo) return null;
    const [x0, y0] = pt(lo, s.dx, s.dy); const [x1, y1] = pt(hi, s.dx, s.dy);
    const [bx1, by1] = pt(hi, s.dx, s.dy, DEPTH); const [bx0, by0] = pt(lo, s.dx, s.dy, DEPTH);
    const large = hi - lo > Math.PI ? 1 : 0;
    return `M${f(x0)},${f(y0)} A${RX},${RY} 0 ${large} 1 ${f(x1)},${f(y1)} L${f(bx1)},${f(by1)} A${RX},${RY} 0 ${large} 0 ${f(bx0)},${f(by0)} Z`;
  };

  return (
    <div className="flex flex-col md:flex-row items-center gap-4">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-[380px] flex-shrink-0" role="img">
        <ellipse cx={CX} cy={CY + DEPTH + 12} rx={RX * 0.95} ry={RY * 0.55} fill="#000" opacity="0.18" style={{ filter: 'blur(6px)' }} />
        {order.map((s) => {
          const w = wall(s);
          const lx = CX + s.dx + RX * 0.62 * Math.cos(s.mid);
          const ly = CY + s.dy + RY * 0.62 * Math.sin(s.mid);
          const pct = Math.round((s.it.value / total) * 100);
          return (
            <g key={s.i} onMouseEnter={() => setHover(s.i)} onMouseLeave={() => setHover(null)} style={{ cursor: 'pointer', transition: 'transform .2s' }}>
              <title>{`${s.it.name}: ${money ? formatCurrency(s.it.value) : s.it.value} (${pct}%)`}</title>
              {w && <path d={w} fill={shade(s.color, 0.62)} stroke={shade(s.color, 0.5)} strokeWidth="1" strokeLinejoin="round" />}
              <path d={top(s)} fill={s.color} stroke={shade(s.color, 0.8)} strokeWidth="1.5" strokeLinejoin="round" />
              <path d={top(s)} fill="url(#pieGloss)" opacity="0.55" pointerEvents="none" />
              {pct >= 6 && <text x={lx} y={ly + 4} textAnchor="middle" fontSize="13" fontWeight="700" fill="#fff" stroke="rgba(0,0,0,.35)" strokeWidth="2.5" paintOrder="stroke" pointerEvents="none">{pct}%</text>}
            </g>
          );
        })}
        <defs>
          <linearGradient id="pieGloss" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity="0.55" />
            <stop offset="0.55" stopColor="#fff" stopOpacity="0" />
            <stop offset="1" stopColor="#000" stopOpacity="0.18" />
          </linearGradient>
        </defs>
      </svg>

      <ul className="flex-1 w-full space-y-2 min-w-0">
        {slices.map((s) => (
          <li key={s.i} onMouseEnter={() => setHover(s.i)} onMouseLeave={() => setHover(null)}
            className={`flex items-center gap-2 text-sm rounded-m px-2 py-1 transition-colors ${hover === s.i ? 'bg-muted' : ''}`}>
            <span className="w-3.5 h-3.5 rounded-sm flex-shrink-0" style={{ background: s.color, boxShadow: `inset 0 -3px 0 ${shade(s.color, 0.62)}` }} />
            <span className="truncate text-foreground flex-1">{s.it.name}</span>
            <span className="text-muted-foreground tabular-nums">{money ? formatCurrency(s.it.value) : s.it.value}</span>
            <span className="font-semibold text-foreground w-10 text-right tabular-nums">{Math.round((s.it.value / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
