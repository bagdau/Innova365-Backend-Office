import { useState } from 'react';
import { Printer } from 'lucide-react';
import { get, qs } from '../api';
import { useAuth } from '../auth';
import { fmtDate, fmtDateTime, money, num, todayIn } from '../format';
import { Col, DataTable, ErrorBox, Loading, PageHeader, StatCard, useFetch } from '../ui';

interface Z {
  date: string; orders: number; revenue: number; cash: number; card: number; qr: number; transfer: number; other: number; avgCheck: number; vat: number; vatRate: number;
  cancelled: { count: number; total: number }; categories: { id: string; nombre: string; qty: number; revenue: number }[];
  orders_?: never;
}
interface Order { numero: number; tipo: string; mesa: number | null; total: number; method: string; paidAt: string; items: number }

export default function ZReport() {
  const { me } = useAuth();
  const [date, setDate] = useState(() => todayIn(me!.settings.timezone));
  const { data, error, reload } = useFetch(() => get<Z & { orders: Order[] }>('/acc/zreport' + qs({ date })), [date]);
  if (error && !data) return <ErrorBox error={error} onRetry={reload} />;
  if (!data) return <Loading />;
  const cols: Col<Order>[] = [
    { key: 'n', header: '№', render: (o) => <b>#{o.numero}</b>, sort: (o) => o.numero, csv: (o) => o.numero },
    { key: 'time', header: 'Время оплаты', render: (o) => fmtDateTime(o.paidAt), csv: (o) => o.paidAt },
    { key: 'where', header: 'Стол / тип', render: (o) => (o.mesa ? `Стол ${o.mesa}` : 'С собой'), csv: (o) => (o.mesa ? `Стол ${o.mesa}` : 'С собой') },
    { key: 'items', header: 'Позиций', align: 'right', render: (o) => num(o.items), csv: (o) => o.items },
    { key: 'method', header: 'Оплата', render: (o) => o.method, csv: (o) => o.method },
    { key: 'total', header: 'Сумма', align: 'right', render: (o) => <b>{money(o.total)}</b>, sort: (o) => o.total, csv: (o) => o.total },
  ];
  const lines: [string, number][] = [['Наличные', data.cash], ['Карта', data.card], ['QR', data.qr], ['Перевод', data.transfer], ['Прочее', data.other]];
  return (
    <>
      <PageHeader title="Z-отчёт" subtitle="Закрытие дня: итоги по способам оплаты и список оплаченных заказов"
        actions={<><input type="date" className="input !w-[160px]" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} /><button className="btn btn-soft" onClick={() => window.print()}><Printer size={15} /> Печать</button></>} />
      <div className="hidden print:block"><h1 className="text-xl font-semibold">Z-отчёт за {fmtDate(data.date)}</h1><p className="mb-3 text-sm">{me!.settings.company}</p></div>
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Выручка за день" value={money(data.revenue)} sub={`${num(data.orders)} заказов`} />
        <StatCard label="Средний чек" value={money(data.avgCheck)} />
        <StatCard label={`НДС ${data.vatRate ? data.vatRate + '%' : ''}`} value={money(data.vat)} />
        <StatCard label="Отменено заказов" value={num(data.cancelled.count)} sub={money(data.cancelled.total)} tone={data.cancelled.count ? 'warn' : undefined} />
      </div>
      <div className="mb-5 grid gap-4 lg:grid-cols-2">
        <section className="card p-4"><h2 className="mb-3 font-semibold">По способам оплаты</h2>
          <dl className="space-y-2 text-[13.5px]">{lines.map(([k, v]) => <div key={k} className="flex justify-between border-b border-line/60 pb-2"><dt className="text-muted">{k}</dt><dd className="tnum">{money(v)}</dd></div>)}
            <div className="flex justify-between pt-1 font-semibold"><dt>Итого</dt><dd className="tnum">{money(data.revenue)}</dd></div></dl></section>
        <section className="card p-4"><h2 className="mb-3 font-semibold">По категориям меню</h2>
          {data.categories.length ? <dl className="space-y-2 text-[13.5px]">{data.categories.map((c) => <div key={c.id} className="flex justify-between border-b border-line/60 pb-2"><dt>{c.nombre} <span className="text-muted">· {num(c.qty)} шт</span></dt><dd className="tnum">{money(c.revenue)}</dd></div>)}</dl>
            : <p className="py-6 text-center text-sm text-muted">Продаж нет</p>}</section>
      </div>
      <DataTable cols={cols} rows={data.orders} rowKey={(o) => String(o.numero)} csvName={`zreport_${data.date}`} dense />
    </>
  );
}
