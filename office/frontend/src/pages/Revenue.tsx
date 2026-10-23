import { get, qs } from '../api';
import { BarChart } from '../charts';
import { fmtDate, money, num } from '../format';
import { Col, DataTable, ErrorBox, Loading, PageHeader, PeriodPicker, StatCard, useFetch, usePeriod } from '../ui';

interface Day { date: string; orders: number; revenue: number; cash: number; card: number; qr: number; transfer: number; other: number }
interface R { from: string; to: string; rows: Day[]; total: Day & { avgCheck: number }; vat: number; vatRate: number }

export default function Revenue() {
  const [period, setPeriod] = usePeriod('month');
  const { data, error, reload, loading } = useFetch(() => get<R>('/acc/revenue' + qs(period)), [period.from, period.to]);
  if (error && !data) return <ErrorBox error={error} onRetry={reload} />;
  if (!data) return <Loading />;
  const cols: Col<Day>[] = [
    { key: 'date', header: 'Дата', render: (r) => fmtDate(r.date), sort: (r) => r.date, csv: (r) => r.date },
    { key: 'orders', header: 'Заказов', align: 'right', render: (r) => num(r.orders), sort: (r) => r.orders, csv: (r) => r.orders },
    { key: 'cash', header: 'Наличные', align: 'right', render: (r) => money(r.cash), sort: (r) => r.cash, csv: (r) => r.cash, hideOnMobile: true },
    { key: 'card', header: 'Карта', align: 'right', render: (r) => money(r.card), sort: (r) => r.card, csv: (r) => r.card, hideOnMobile: true },
    { key: 'qr', header: 'QR', align: 'right', render: (r) => money(r.qr), sort: (r) => r.qr, csv: (r) => r.qr, hideOnMobile: true },
    { key: 'transfer', header: 'Перевод', align: 'right', render: (r) => money(r.transfer), sort: (r) => r.transfer, csv: (r) => r.transfer, hideOnMobile: true },
    { key: 'other', header: 'Прочее', align: 'right', render: (r) => money(r.other), csv: (r) => r.other, hideOnMobile: true },
    { key: 'revenue', header: 'Выручка', align: 'right', render: (r) => <b>{money(r.revenue)}</b>, sort: (r) => r.revenue, csv: (r) => r.revenue },
  ];
  const t = data.total;
  return (
    <>
      <PageHeader title="Выручка" subtitle="Оплаченные заказы по дате оплаты, по способам оплаты" actions={<PeriodPicker value={period} onChange={setPeriod} />} />
      <div className={loading ? 'opacity-60 transition' : 'transition'}>
        <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Выручка (с НДС)" value={money(t.revenue)} sub={`${num(t.orders)} заказов`} />
          <StatCard label={`НДС ${data.vatRate ? data.vatRate + '%' : 'не учитывается'}`} value={money(data.vat)} sub={`без НДС: ${money(t.revenue - data.vat)}`} />
          <StatCard label="Средний чек" value={money(t.avgCheck)} />
          <StatCard label="Безналичные" value={money(t.card + t.qr + t.transfer)} sub={`наличные: ${money(t.cash)}`} />
        </div>
        <section className="card mb-5 p-4"><h2 className="mb-3 font-semibold">Динамика</h2>
          <BarChart data={data.rows.map((r) => ({ date: r.date, value: r.revenue, extra: `${r.orders} заказов` }))} /></section>
        <DataTable cols={cols} rows={data.rows} rowKey={(r) => r.date} csvName={`revenue_${data.from}_${data.to}`} initialSort={{ key: 'date', dir: 'desc' }}
          footer={<tr><td className="td">Итого</td><td className="td tnum text-right">{num(t.orders)}</td><td className="td tnum hidden text-right md:table-cell">{money(t.cash)}</td><td className="td tnum hidden text-right md:table-cell">{money(t.card)}</td><td className="td tnum hidden text-right md:table-cell">{money(t.qr)}</td><td className="td tnum hidden text-right md:table-cell">{money(t.transfer)}</td><td className="td tnum hidden text-right md:table-cell">{money(t.other)}</td><td className="td tnum text-right">{money(t.revenue)}</td></tr>} />
      </div>
    </>
  );
}
