import { useState } from 'react';
import { Printer } from 'lucide-react';
import qrcode from 'qrcode-generator';
import { get, qs } from '../api';
import { useAuth } from '../auth';
import { currencySymbol, fmtDate, fmtDateTime, money as baseMoney, num, todayIn } from '../format';
import { Col, DataTable, ErrorBox, Loading, PageHeader, StatCard, useFetch } from '../ui';

interface Order { numero: number; tipo: string; mesa: number | null; total: number; method: string; paidAt: string; items: number }
interface Z {
  date: string; orderCount: number; revenue: number; cash: number; card: number; qr: number; transfer: number; other: number;
  avgCheck: number; vat: number; vatRate: number; cancelled: { count: number; total: number };
  categories: { id: string; nombre: string; qty: number; revenue: number }[]; orders: Order[];
}

const td = 'border border-gray-400 px-2 py-1.5 align-top';
/** Дробные суммы отчёта не округляем до целого тенге. */
const money = (value: number) => Number.isInteger(value) ? baseMoney(value) : `${new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)} ${currencySymbol()}`;

/** Отдельный документ A4: экранные карточки и кнопки в печать не попадают. */
export function ZReportPaper({ data, company, author, currency }: { data: Z; company: string; author: string; currency: string }) {
  const generatedAt = fmtDateTime(new Date().toISOString());
  const qr = qrcode(0, 'M');
  qr.addData(JSON.stringify({ document: 'Innova Office Z-report', company, date: data.date, currency, orders: data.orderCount, revenue: data.revenue }));
  qr.make();
  const payments = [
    ['Наличные', data.cash], ['Карта', data.card], ['QR-код', data.qr], ['Перевод', data.transfer], ['Прочее', data.other],
  ] as const;
  return (
    <article className="office-z-print hidden print:block text-black">
      <header className="mb-5 flex items-start justify-between gap-6 border-b-2 border-black pb-4">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[.15em]">Innova Office</div>
          <h1 className="mt-2 text-[22px] font-bold leading-tight">Z-отчёт по продажам</h1>
          <p className="mt-1 text-[14px] font-semibold">{company}</p>
          <p className="mt-2 text-[12px]">Отчётная дата: <b>{fmtDate(data.date)}</b></p>
          <p className="text-[11px]">Сформирован: {generatedAt} · {author}</p>
        </div>
        <div className="w-[27mm] shrink-0 text-center">
          <div className="w-[27mm] [&_svg]:h-auto [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: qr.createSvgTag({ cellSize: 3, margin: 0, scalable: true }) }} />
          <div className="mt-1 text-[8px] leading-tight">Данные отчёта</div>
        </div>
      </header>

      <table className="mb-5 w-full border-collapse text-[12px]"><tbody>
        <tr><th className={`${td} text-left`}>Оплачено заказов</th><td className={`${td} text-right`}>{num(data.orderCount)}</td><th className={`${td} text-left`}>Выручка</th><td className={`${td} text-right font-bold`}>{money(data.revenue)}</td></tr>
        <tr><th className={`${td} text-left`}>Средний чек</th><td className={`${td} text-right`}>{money(data.avgCheck)}</td><th className={`${td} text-left`}>Отменено</th><td className={`${td} text-right`}>{num(data.cancelled.count)} · {money(data.cancelled.total)}</td></tr>
        {data.vatRate > 0 && <tr><th className={`${td} text-left`}>НДС {data.vatRate}%</th><td className={`${td} text-right`}>{money(data.vat)}</td><td className={td} colSpan={2} /></tr>}
      </tbody></table>

      <section className="mb-5">
        <h2 className="mb-2 text-[15px] font-bold">По способам оплаты</h2>
        <table className="w-full border-collapse text-[11.5px]"><thead><tr><th className={`${td} w-10 text-left`}>№</th><th className={`${td} text-left`}>Способ оплаты</th><th className={`${td} w-36 text-right`}>Сумма</th></tr></thead>
          <tbody>{payments.map(([name, value], i) => <tr key={name}><td className={td}>{i + 1}</td><td className={td}>{name}</td><td className={`${td} text-right`}>{money(value)}</td></tr>)}</tbody>
          <tfoot><tr className="font-bold"><td className={td} colSpan={2}>Итого</td><td className={`${td} text-right`}>{money(data.revenue)}</td></tr></tfoot></table>
      </section>

      <section className="mb-5">
        <h2 className="mb-2 text-[15px] font-bold">По категориям меню</h2>
        <table className="w-full border-collapse text-[11.5px]"><thead><tr><th className={`${td} w-10 text-left`}>№</th><th className={`${td} text-left`}>Наименование категории</th><th className={`${td} w-24 text-right`}>Позиций</th><th className={`${td} w-36 text-right`}>Сумма</th></tr></thead>
          <tbody>{data.categories.length ? data.categories.map((c, i) => <tr key={c.id}><td className={td}>{i + 1}</td><td className={td}>{c.nombre}</td><td className={`${td} text-right`}>{num(c.qty)}</td><td className={`${td} text-right`}>{money(c.revenue)}</td></tr>) : <tr><td className={td} colSpan={4}>Продаж нет</td></tr>}</tbody>
          <tfoot><tr className="font-bold"><td className={td} colSpan={2}>Итого по категориям</td><td className={`${td} text-right`}>{num(data.categories.reduce((sum, c) => sum + c.qty, 0))}</td><td className={`${td} text-right`}>{money(data.categories.reduce((sum, c) => sum + c.revenue, 0))}</td></tr></tfoot></table>
      </section>

      <section>
        <h2 className="mb-2 text-[15px] font-bold">Оплаченные заказы</h2>
        <table className="w-full border-collapse text-[10.5px]"><thead><tr><th className={`${td} text-left`}>№</th><th className={`${td} text-left`}>Время оплаты</th><th className={`${td} text-left`}>Стол / тип</th><th className={`${td} text-right`}>Позиций</th><th className={`${td} text-left`}>Способ оплаты</th><th className={`${td} text-right`}>Сумма</th></tr></thead>
          <tbody>{data.orders.length ? data.orders.map((o) => <tr key={o.numero}><td className={td}>#{o.numero}</td><td className={td}>{fmtDateTime(o.paidAt)}</td><td className={td}>{o.mesa ? `Стол ${o.mesa}` : 'С собой'}</td><td className={`${td} text-right`}>{num(o.items)}</td><td className={td}>{o.method}</td><td className={`${td} text-right`}>{money(o.total)}</td></tr>) : <tr><td className={td} colSpan={6}>Оплаченных заказов нет</td></tr>}</tbody>
          <tfoot><tr className="font-bold"><td className={td} colSpan={5}>Итого · {num(data.orderCount)} заказов</td><td className={`${td} text-right`}>{money(data.revenue)}</td></tr></tfoot></table>
      </section>
      <footer className="mt-6 border-t border-gray-400 pt-2 text-[10px] text-gray-600">Innova Office · {company} · {fmtDate(data.date)} · QR содержит реквизиты и итоги отчёта.</footer>
    </article>
  );
}

export default function ZReport() {
  const { me } = useAuth();
  const [date, setDate] = useState(() => todayIn(me!.settings.timezone));
  const { data, error, reload } = useFetch(() => get<Z>('/acc/zreport' + qs({ date })), [date]);
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
      <div className="print:hidden">
        <PageHeader title="Z-отчёт" subtitle="Закрытие дня: итоги по способам оплаты и список оплаченных заказов"
          actions={<><input type="date" className="input !w-[160px]" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} /><button className="btn btn-soft" onClick={() => window.print()}><Printer size={15} /> Печать</button></>} />
        <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Выручка за день" value={money(data.revenue)} sub={`${num(data.orderCount)} заказов`} />
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
      </div>
      <ZReportPaper data={data} company={me!.settings.company} author={me!.name} currency={me!.settings.currency} />
    </>
  );
}
