import { useMemo, useState } from 'react';
import { get, qs } from '../api';
import { Donut } from '../charts';
import { fmtDate, money, num, pct } from '../format';
import { Col, DataTable, ErrorBox, Loading, PageHeader, PeriodPicker, StatCard, Tabs, useFetch, usePeriod } from '../ui';
import { Chips } from '../ui2';
import { buildXlsx, downloadBlob } from '../xlsx';

const DOW = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

/** Расширенные отчёты: загрузка по часам, сравнение периодов, способы оплаты. */
export default function Reports() {
  const [tab, setTab] = useState<'heat' | 'compare' | 'pay'>('heat');
  const [period, setPeriod] = usePeriod('month');
  return (
    <>
      <PageHeader title="Отчёты" subtitle="Когда продаём больше всего, как изменились показатели и чем платят гости. Любую таблицу можно выгрузить в Excel или распечатать" />
      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'heat', label: 'Загрузка по часам' }, { id: 'compare', label: 'Сравнение периодов' }, { id: 'pay', label: 'Способы оплаты' }]} />
      <div className="mb-4"><PeriodPicker value={period} onChange={setPeriod} /></div>
      {tab === 'heat' && <Heat period={period} />}
      {tab === 'compare' && <Compare period={period} />}
      {tab === 'pay' && <Pay period={period} />}
    </>
  );
}

/* ───────── Тепловая карта ───────── */
interface HeatResp { cells: { dow: number; hour: number; orders: number; revenue: number }[]; byDow: { dow: number; revenue: number; orders: number; days: number; avgRevenue: number }[]; byHour: { hour: number; revenue: number; orders: number }[]; best: { dow: number; hour: number; revenue: number; orders: number } | null; total: { revenue: number; orders: number } }

function Heat({ period }: { period: { from: string; to: string } }) {
  const [basis, setBasis] = useState<'created' | 'paid'>('created');
  const [metric, setMetric] = useState<'revenue' | 'orders'>('revenue');
  const { data, error, reload, loading } = useFetch(() => get<HeatResp>('/rep/heatmap' + qs({ ...period, basis })), [period.from, period.to, basis]);
  const grid = useMemo(() => { const m = new Map<string, { revenue: number; orders: number }>(); for (const c of data?.cells ?? []) m.set(`${c.dow}:${c.hour}`, c); return m; }, [data]);
  if (error && !data) return <ErrorBox error={error} onRetry={reload} />;
  if (!data) return <Loading />;
  const val = (d: number, h: number) => grid.get(`${d}:${h}`)?.[metric] ?? 0;
  const max = Math.max(1, ...data.cells.map((c) => c[metric]));
  const hours = [...Array(24).keys()].filter((h) => data.byHour[h].orders > 0 || (h >= 8 && h <= 23));
  const exp = () => downloadBlob(buildXlsx('Загрузка по часам', ['День', ...hours.map((h) => `${h}:00`), 'Итого'], DOW.map((n, i) => [n, ...hours.map((h) => val(i + 1, h)), hours.reduce((a, h) => a + val(i + 1, h), 0)])), `heatmap_${period.from}_${period.to}.xlsx`);
  const dowCols: Col<HeatResp['byDow'][number]>[] = [
    { key: 'd', header: 'День недели', render: (r) => DOW[r.dow - 1], csv: (r) => DOW[r.dow - 1] }, { key: 'n', header: 'Дней в периоде', align: 'right', render: (r) => r.days, csv: (r) => r.days },
    { key: 'o', header: 'Заказов', align: 'right', render: (r) => num(r.orders), csv: (r) => r.orders }, { key: 'r', header: 'Выручка', align: 'right', render: (r) => money(r.revenue), csv: (r) => r.revenue },
    { key: 'a', header: 'В среднем за день', align: 'right', render: (r) => <b>{money(r.avgRevenue)}</b>, sort: (r) => r.avgRevenue, csv: (r) => r.avgRevenue },
  ];
  return (
    <div className={loading ? 'opacity-60 transition' : 'transition'}>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Chips value={metric} onChange={setMetric} options={[{ id: 'revenue', label: 'Выручка' }, { id: 'orders', label: 'Число заказов' }]} />
        <Chips value={basis} onChange={setBasis} options={[{ id: 'created', label: 'По времени заказа' }, { id: 'paid', label: 'По времени оплаты' }]} />
        <button className="btn btn-soft btn-sm ml-auto" onClick={exp}>Excel</button>
      </div>
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <StatCard label="Выручка за период" value={money(data.total.revenue)} sub={`${num(data.total.orders)} заказов`} />
        <StatCard label="Самый загруженный час" value={data.best ? `${DOW[data.best.dow - 1]}, ${data.best.hour}:00` : '—'} sub={data.best ? `${money(data.best.revenue)} · ${data.best.orders} заказов` : undefined} />
        <StatCard label="Самый сильный день недели" value={(() => { const b = [...data.byDow].sort((a, c) => c.avgRevenue - a.avgRevenue)[0]; return b && b.avgRevenue > 0 ? DOW[b.dow - 1] : '—'; })()} sub="по средней выручке за день" />
      </div>
      <section className="card mb-5 overflow-x-auto p-4">
        <table className="mx-auto border-separate border-spacing-1 text-[11px]">
          <thead><tr><th />{hours.map((h) => <th key={h} className="w-9 font-medium text-muted">{h}</th>)}</tr></thead>
          <tbody>{DOW.map((d, i) => (
            <tr key={d}><th className="pr-2 text-right text-[12px] font-medium text-muted">{d}</th>
              {hours.map((h) => { const v = val(i + 1, h); const a = v / max; return <td key={h} title={`${d} ${h}:00 — ${metric === 'revenue' ? money(v) : v + ' заказов'}`} className="h-8 w-9 rounded text-center align-middle" style={{ background: v ? `rgb(var(--brand) / ${0.1 + a * 0.85})` : 'rgb(var(--surface2))', color: a > 0.55 ? 'white' : 'rgb(var(--muted))' }}>{v ? (metric === 'revenue' ? (v >= 1000 ? Math.round(v / 1000) + 'k' : Math.round(v)) : v) : ''}</td>; })}</tr>))}</tbody>
        </table>
        <p className="mt-3 text-center text-xs text-muted">Чем темнее клетка, тем больше {metric === 'revenue' ? 'выручка (тыс.)' : 'заказов'} в этот час. Используйте для расписания смен и заготовок.</p>
      </section>
      <DataTable cols={dowCols} rows={data.byDow} rowKey={(r) => String(r.dow)} csvName={`by-weekday_${period.from}_${period.to}`} />
    </div>
  );
}

/* ───────── Сравнение периодов ───────── */
interface CmpResp {
  a: { from: string; to: string; days: number }; b: { from: string; to: string; days: number };
  metrics: { key: string; a: number; b: number; pct: number | null }[]; perDay: { a: number; b: number };
  methods: { name: string; a: number; b: number }[]; categories: { id: string; name: string; revA: number; revB: number; delta: number; pct: number | null }[];
  products: { id: string; name: string; qtyA: number; qtyB: number; revA: number; revB: number; delta: number; pct: number | null }[];
}
const LABEL: Record<string, string> = { revenue: 'Выручка', orders: 'Заказов', avgCheck: 'Средний чек', items: 'Позиций продано', cancelled: 'Отмен' };

function Compare({ period }: { period: { from: string; to: string } }) {
  const [mode, setMode] = useState<'prev' | 'year'>('prev');
  const { data, error, reload } = useFetch(() => get<CmpResp>('/rep/compare' + qs({ ...period, mode })), [period.from, period.to, mode]);
  if (error && !data) return <ErrorBox error={error} onRetry={reload} />;
  if (!data) return <Loading />;
  const Delta = ({ v, invert }: { v: number | null; invert?: boolean }) => (v === null ? <span className="text-muted">—</span> : <b className={(v >= 0) !== !!invert ? 'text-good' : 'text-bad'}>{v >= 0 ? '▲' : '▼'} {Math.abs(v).toFixed(1)}%</b>);
  const pc: Col<CmpResp['products'][number]>[] = [
    { key: 'n', header: 'Блюдо', render: (r) => <span className="font-medium">{r.name}</span>, sort: (r) => r.name, csv: (r) => r.name },
    { key: 'qa', header: 'Продано сейчас', align: 'right', render: (r) => num(r.qtyA), sort: (r) => r.qtyA, csv: (r) => r.qtyA }, { key: 'qb', header: 'Продано раньше', align: 'right', render: (r) => num(r.qtyB), hideOnMobile: true, csv: (r) => r.qtyB },
    { key: 'ra', header: 'Выручка сейчас', align: 'right', render: (r) => money(r.revA), sort: (r) => r.revA, csv: (r) => r.revA }, { key: 'rb', header: 'Выручка раньше', align: 'right', render: (r) => money(r.revB), hideOnMobile: true, csv: (r) => r.revB },
    { key: 'd', header: 'Разница', align: 'right', render: (r) => <span className={r.delta >= 0 ? 'text-good' : 'text-bad'}>{r.delta >= 0 ? '+' : '−'} {money(Math.abs(r.delta))}</span>, sort: (r) => r.delta, csv: (r) => r.delta },
    { key: 'p', header: '%', align: 'right', render: (r) => <Delta v={r.pct} />, sort: (r) => r.pct, csv: (r) => r.pct },
  ];
  const cc: Col<CmpResp['categories'][number]>[] = [
    { key: 'n', header: 'Категория', render: (r) => r.name, csv: (r) => r.name }, { key: 'ra', header: 'Сейчас', align: 'right', render: (r) => money(r.revA), sort: (r) => r.revA, csv: (r) => r.revA },
    { key: 'rb', header: 'Раньше', align: 'right', render: (r) => money(r.revB), csv: (r) => r.revB }, { key: 'p', header: 'Изменение', align: 'right', render: (r) => <Delta v={r.pct} />, sort: (r) => r.pct, csv: (r) => r.pct },
  ];
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Chips value={mode} onChange={setMode} options={[{ id: 'prev', label: 'С предыдущим периодом' }, { id: 'year', label: 'С тем же периодом год назад' }]} />
        <span className="text-xs text-muted">Сравниваем {fmtDate(data.a.from)} — {fmtDate(data.a.to)} ({data.a.days} дн.) и {fmtDate(data.b.from)} — {fmtDate(data.b.to)} ({data.b.days} дн.)</span>
      </div>
      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {data.metrics.map((m) => <div key={m.key} className="card p-4"><div className="text-xs font-medium text-muted">{LABEL[m.key]}</div><div className="tnum mt-1.5 text-[22px] font-semibold">{m.key === 'revenue' || m.key === 'avgCheck' ? money(m.a) : num(m.a)}</div>
          <div className="mt-0.5 flex items-center justify-between text-xs"><span className="text-muted">было {m.key === 'revenue' || m.key === 'avgCheck' ? money(m.b) : num(m.b)}</span><Delta v={m.pct} invert={m.key === 'cancelled'} /></div></div>)}
      </div>
      <div className="mb-5 grid gap-5 lg:grid-cols-2">
        <section className="card p-4"><h2 className="mb-1 font-semibold">Выручка за день в среднем</h2><div className="tnum text-2xl font-semibold">{money(data.perDay.a)}</div><div className="text-xs text-muted">раньше {money(data.perDay.b)} · <Delta v={data.perDay.b ? ((data.perDay.a - data.perDay.b) / data.perDay.b) * 100 : null} /></div>
          <p className="mt-2 text-xs text-muted">Периоды могут быть разной длины, поэтому смотрите и на средний день.</p></section>
        <section className="card p-4"><h2 className="mb-3 font-semibold">Способы оплаты сейчас</h2><Donut rows={data.methods.map((m) => ({ name: m.name, value: m.a }))} /></section>
      </div>
      <h2 className="mb-2 font-semibold">По категориям</h2><div className="mb-5"><DataTable cols={cc} rows={data.categories} rowKey={(r) => r.id} csvName="compare-categories" /></div>
      <h2 className="mb-2 font-semibold">Блюда: что изменилось сильнее всего</h2><DataTable cols={pc} rows={data.products} rowKey={(r) => r.id} csvName="compare-products" initialSort={{ key: 'd', dir: 'desc' }} />
    </>
  );
}

/* ───────── Способы оплаты ───────── */
interface PayResp { total: number; methods: { method: string; orders: number; revenue: number; share: number; avgCheck: number }[]; daily: { date: string; cash: number; card: number; qr: number; transfer: number; other: number; total: number }[] }

function Pay({ period }: { period: { from: string; to: string } }) {
  const { data, error, reload } = useFetch(() => get<PayResp>('/rep/payments' + qs(period)), [period.from, period.to]);
  if (error && !data) return <ErrorBox error={error} onRetry={reload} />;
  if (!data) return <Loading />;
  const mc: Col<PayResp['methods'][number]>[] = [
    { key: 'm', header: 'Способ', render: (r) => <span className="font-medium">{r.method}</span>, csv: (r) => r.method }, { key: 'o', header: 'Заказов', align: 'right', render: (r) => num(r.orders), sort: (r) => r.orders, csv: (r) => r.orders },
    { key: 'r', header: 'Выручка', align: 'right', render: (r) => money(r.revenue), sort: (r) => r.revenue, csv: (r) => r.revenue }, { key: 's', header: 'Доля', align: 'right', render: (r) => pct(r.share), sort: (r) => r.share, csv: (r) => r.share },
    { key: 'a', header: 'Средний чек', align: 'right', render: (r) => money(r.avgCheck), sort: (r) => r.avgCheck, csv: (r) => r.avgCheck },
  ];
  const dc: Col<PayResp['daily'][number]>[] = [
    { key: 'd', header: 'Дата', render: (r) => fmtDate(r.date), sort: (r) => r.date, csv: (r) => r.date }, { key: 'c', header: 'Наличные', align: 'right', render: (r) => money(r.cash), csv: (r) => r.cash }, { key: 'k', header: 'Карта', align: 'right', render: (r) => money(r.card), csv: (r) => r.card },
    { key: 'q', header: 'QR', align: 'right', render: (r) => money(r.qr), hideOnMobile: true, csv: (r) => r.qr }, { key: 't', header: 'Перевод', align: 'right', render: (r) => money(r.transfer), hideOnMobile: true, csv: (r) => r.transfer }, { key: 'tt', header: 'Всего', align: 'right', render: (r) => <b>{money(r.total)}</b>, sort: (r) => r.total, csv: (r) => r.total },
  ];
  return (
    <>
      <div className="mb-5 grid gap-5 lg:grid-cols-[1fr_1.4fr]"><section className="card p-4"><h2 className="mb-3 font-semibold">Доли способов оплаты</h2><Donut rows={data.methods.map((m) => ({ name: m.method, value: m.revenue }))} /></section>
        <div><DataTable cols={mc} rows={data.methods} rowKey={(r) => r.method} csvName={`payment-methods_${period.from}_${period.to}`} footer={<tr><td className="td">Итого</td><td className="td tnum text-right">{num(data.methods.reduce((a, r) => a + r.orders, 0))}</td><td className="td tnum text-right">{money(data.total)}</td><td className="td" colSpan={2} /></tr>} /></div></div>
      <h2 className="mb-2 font-semibold">По дням</h2><DataTable cols={dc} rows={data.daily} rowKey={(r) => r.date} csvName={`payments-daily_${period.from}_${period.to}`} initialSort={{ key: 'd', dir: 'desc' }} />
    </>
  );
}
