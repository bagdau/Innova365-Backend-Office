import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Customized } from 'recharts';
import { formatCurrency } from '../../utils/cn';
import { t } from '../../i18n';

const GREEN = '#22c55e';
const RED = '#ef4444';

interface Row { fecha: string; ventas: number; pedidos?: number }

/** Стрелка на конце линии, повёрнутая по направлению последнего отрезка. */
function Arrows(props: any) {
  const items: any[] = props.formattedGraphicalItems ?? [];
  return (
    <g>
      {items.map((it, k) => {
        const pts: Array<{ x: number; y: number }> = (it.props?.points ?? []).filter((p: any) => Number.isFinite(p.x) && Number.isFinite(p.y));
        if (pts.length === 0) return null;
        const color = it.props?.stroke === GREEN || k === 0 ? GREEN : RED;
        const last = pts[pts.length - 1];
        const prev = pts.length > 1 ? pts[pts.length - 2] : { x: last.x - 20, y: last.y };
        const ang = (Math.atan2(last.y - prev.y, last.x - prev.x) * 180) / Math.PI;
        return (
          <g key={k} transform={`translate(${last.x},${last.y}) rotate(${ang})`} style={{ filter: 'drop-shadow(0 2px 3px rgba(0,0,0,.35))' }}>
            <path d="M 2 0 L -12 -9 L -9 0 L -12 9 Z" fill={color} stroke={color} strokeWidth="2" strokeLinejoin="round" />
          </g>
        );
      })}
    </g>
  );
}

/** Линейный график «как на схеме»: сетка, толстые объёмные линии, стрелки на концах. Зелёная — выручка, красная — число заказов. */
export function SalesLineChart({ data }: { data: Row[] }) {
  const grid = 'rgb(var(--muted-foreground) / 0.28)';
  const tick = { fill: 'rgb(var(--muted-foreground))', fontSize: 11 };
  const hasOrders = data.some((d) => d.pedidos != null);
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 16, right: 28, left: 4, bottom: 4 }}>
        <defs>
          <filter id="lineShadow" x="-10%" y="-10%" width="120%" height="140%">
            <feDropShadow dx="0" dy="3" stdDeviation="2.5" floodColor="#000" floodOpacity="0.35" />
          </filter>
        </defs>
        <CartesianGrid stroke={grid} strokeWidth={1} />
        <XAxis dataKey="fecha" tick={tick} tickMargin={6} stroke={grid} />
        <YAxis yAxisId="l" tick={tick} tickFormatter={(v) => `${v}`} stroke={grid} width={56} />
        {hasOrders && <YAxis yAxisId="r" orientation="right" tick={tick} allowDecimals={false} stroke={grid} width={32} />}
        <Tooltip
          contentStyle={{ backgroundColor: 'rgb(var(--card))', border: '1px solid rgb(var(--border))', borderRadius: 8 }}
          labelStyle={{ color: 'rgb(var(--foreground))' }}
          formatter={(v: number, name: string) => (name === 'pedidos' ? [v, t('Pedidos')] : [formatCurrency(v), t('Ventas')])}
        />
        <Legend formatter={(v) => (v === 'pedidos' ? t('Pedidos') : t('Ventas'))} wrapperStyle={{ fontSize: 12 }} />
        <Line yAxisId="l" type="monotone" dataKey="ventas" stroke={GREEN} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round"
          dot={{ r: 4, fill: GREEN, strokeWidth: 0 }} activeDot={{ r: 7 }} style={{ filter: 'url(#lineShadow)' }} isAnimationActive />
        {hasOrders && (
          <Line yAxisId="r" type="monotone" dataKey="pedidos" stroke={RED} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round"
            dot={{ r: 4, fill: RED, strokeWidth: 0 }} activeDot={{ r: 7 }} style={{ filter: 'url(#lineShadow)' }} isAnimationActive />
        )}
        <Customized component={Arrows} />
      </LineChart>
    </ResponsiveContainer>
  );
}
