import { ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { formatCurrency } from '../../utils/cn';
import { t } from '../../i18n';

const GREEN = '#22c55e';
const RED = '#ef4444';

interface Row { fecha: string; ventas: number; pedidos?: number }

const shortDate = (day: string) => `${day.slice(8, 10)}.${day.slice(5, 7)}`;
const grid = 'rgb(var(--muted-foreground) / 0.22)';
const tick = { fill: 'rgb(var(--muted-foreground))', fontSize: 11 };

/** Продажи и заказы используют отдельные оси: деньги и количество нельзя сравнивать по одной шкале. */
export function SalesLineChart({ data }: { data: Row[] }) {
  const hasOrders = data.some((day) => day.pedidos != null);
  const singleDay = data.length === 1;
  const axes = <>
    <CartesianGrid stroke={grid} vertical={false} />
    <XAxis dataKey="fecha" tickFormatter={shortDate} tick={tick} tickMargin={8} stroke={grid} minTickGap={24} />
    <YAxis yAxisId="sales" tick={tick} stroke={grid} width={56} domain={[0, 'auto']} />
    {hasOrders && !singleDay && <YAxis yAxisId="orders" orientation="right" tick={tick} allowDecimals={false} stroke={grid} width={32} domain={[0, 'auto']} />}
    <Tooltip
      contentStyle={{ backgroundColor: 'rgb(var(--card))', border: '1px solid rgb(var(--border))', borderRadius: 8 }}
      labelStyle={{ color: 'rgb(var(--foreground))' }}
      formatter={(value: number, name: string) => name === 'pedidos' ? [value, t('Pedidos')] : [formatCurrency(value), t('Ventas')]}
    />
  </>;

  if (singleDay) {
    return <>
      <ResponsiveContainer width="100%" height={270}>
        <BarChart data={data} margin={{ top: 16, right: 12, left: 4, bottom: 4 }}>
          {axes}
          <Bar yAxisId="sales" dataKey="ventas" name="ventas" fill={GREEN} maxBarSize={64} radius={[4, 4, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
      {hasOrders && <div className="text-center text-xs text-muted-foreground -mt-2">
        {t('Pedidos')}: {data[0].pedidos ?? 0}
      </div>}
    </>;
  }

  return <ResponsiveContainer width="100%" height={300}>
    <LineChart data={data} margin={{ top: 16, right: 12, left: 4, bottom: 4 }}>
      {axes}
      <Legend formatter={(name) => name === 'pedidos' ? t('Pedidos') : t('Ventas')} wrapperStyle={{ fontSize: 12 }} />
      <Line yAxisId="sales" type="linear" dataKey="ventas" name="ventas" stroke={GREEN} strokeWidth={2.5}
        dot={{ r: 3, fill: GREEN, strokeWidth: 0 }} activeDot={{ r: 6 }} isAnimationActive={false} />
      {hasOrders && <Line yAxisId="orders" type="linear" dataKey="pedidos" name="pedidos" stroke={RED} strokeWidth={2.5}
        dot={{ r: 3, fill: RED, strokeWidth: 0 }} activeDot={{ r: 6 }} isAnimationActive={false} />}
    </LineChart>
  </ResponsiveContainer>;
}
