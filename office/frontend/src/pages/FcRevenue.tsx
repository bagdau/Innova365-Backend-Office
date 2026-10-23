import { AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { get, qs } from '../api';
import { HBars } from '../charts';
import { money, num, pct } from '../format';
import { Col, DataTable, ErrorBox, Loading, PageHeader, PeriodPicker, StatCard, useFetch, usePeriod } from '../ui';

interface Row { outletId: string; name: string; status: string; commissionPct: number; orders: number; qty: number; revenue: number; commission: number; rent: number; payable: number }
interface R { from: string; to: string; rows: Row[]; unassigned: { orders: number; qty: number; revenue: number }; total: { revenue: number; assigned: number; commission: number; rent: number; payable: number } }

export default function FcRevenue() {
  const [period, setPeriod] = usePeriod('month');
  const { data, error, reload, loading } = useFetch(() => get<R>('/fc/revenue' + qs(period)), [period.from, period.to]);
  if (error && !data) return <ErrorBox error={error} onRetry={reload} />;
  if (!data) return <Loading />;
  const t = data.total;
  const cols: Col<Row>[] = [
    { key: 'n', header: 'Точка', render: (r) => <b>{r.name}</b>, sort: (r) => r.name, csv: (r) => r.name },
    { key: 'o', header: 'Заказов', align: 'right', render: (r) => num(r.orders), sort: (r) => r.orders, csv: (r) => r.orders, hideOnMobile: true },
    { key: 'r', header: 'Выручка', align: 'right', render: (r) => money(r.revenue), sort: (r) => r.revenue, csv: (r) => r.revenue },
    { key: 'cp', header: 'Комиссия', align: 'right', render: (r) => <span>{money(r.commission)} <span className="text-[11px] text-muted">{pct(r.commissionPct)}</span></span>, csv: (r) => r.commission, hideOnMobile: true },
    { key: 'rent', header: 'Аренда за период', align: 'right', render: (r) => money(r.rent), csv: (r) => r.rent, hideOnMobile: true },
    { key: 'pay', header: 'К выплате точке', align: 'right', render: (r) => <b className={r.payable < 0 ? 'text-bad' : ''}>{money(r.payable)}</b>, sort: (r) => r.payable, csv: (r) => r.payable },
  ];
  return (
    <>
      <PageHeader title="Выручка по точкам" subtitle="Выручка делится по категориям меню, закреплённым за точками. К выплате = выручка − комиссия − аренда" actions={<PeriodPicker value={period} onChange={setPeriod} />} />
      <div className={loading ? 'opacity-60 transition' : 'transition'}>
        <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Выручка всего" value={money(t.revenue)} sub={`по точкам: ${money(t.assigned)}`} />
          <StatCard label="Комиссия фудкорта" value={money(t.commission)} tone="good" />
          <StatCard label="Аренда за период" value={money(t.rent)} />
          <StatCard label="К выплате точкам" value={money(t.payable)} sub="выручка − комиссия − аренда" />
        </div>
        {data.unassigned.revenue > 0 && (
          <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-warn/40 bg-warn/10 p-3.5 text-sm text-warn"><AlertTriangle size={17} className="mt-0.5 shrink-0" />
            <div>Выручка без точки: <b>{money(data.unassigned.revenue)}</b> ({num(data.unassigned.orders)} заказов) — категории меню не закреплены ни за одной точкой. <Link className="underline" to="/foodcourt/outlets">Закрепить</Link></div></div>
        )}
        <div className="grid gap-5 xl:grid-cols-3">
          <div className="xl:col-span-2"><DataTable cols={cols} rows={data.rows} rowKey={(r) => r.outletId} csvName={`foodcourt_${data.from}_${data.to}`} initialSort={{ key: 'r', dir: 'desc' }}
            footer={<tr><td className="td">Итого по точкам</td><td className="td hidden md:table-cell" /><td className="td tnum text-right">{money(t.assigned)}</td><td className="td tnum hidden text-right md:table-cell">{money(t.commission)}</td><td className="td tnum hidden text-right md:table-cell">{money(t.rent)}</td><td className="td tnum text-right">{money(t.payable)}</td></tr>} /></div>
          <section className="card p-4"><h2 className="mb-3 font-semibold">Доля в выручке</h2>
            {data.rows.some((r) => r.revenue > 0) ? <HBars rows={data.rows.filter((r) => r.revenue > 0).sort((a, b) => b.revenue - a.revenue).map((r) => ({ name: r.name, value: r.revenue, sub: `комиссия ${money(r.commission)}` }))} /> : <p className="py-8 text-center text-sm text-muted">Нет выручки по точкам</p>}</section>
        </div>
      </div>
    </>
  );
}
