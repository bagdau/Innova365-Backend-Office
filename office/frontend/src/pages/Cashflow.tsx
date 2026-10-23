import { get, qs } from '../api';
import { money } from '../format';
import { ErrorBox, Loading, PageHeader, PeriodPicker, StatCard, useFetch, usePeriod } from '../ui';
import { monthLabel, PairBars } from '../ui2';
import { Link } from 'react-router-dom';

interface Resp {
  hasAccounts: boolean; opening: number; closing: number; totalIn: number; totalOut: number; net: number; unassigned: number;
  inflow: { name: string; total: number }[]; outflow: { name: string; total: number }[];
  months: { month: string; in: number; out: number; net: number }[]; byAccount: { id: string; name: string; opening: number; closing: number }[];
}

/** Отчёт о движении денег (ДДС): остаток на начало → поступления → выплаты → остаток на конец. */
export default function Cashflow() {
  const [period, setPeriod] = usePeriod('month');
  const { data, error, reload, loading } = useFetch(() => get<Resp>('/fin/cashflow' + qs(period)), [period.from, period.to]);
  if (error && !data) return <ErrorBox error={error} onRetry={reload} />;
  if (!data) return <Loading />;
  const bar = (v: number, max: number, tone: string) => <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface2"><div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.max(2, max ? (v / max) * 100 : 0)}%` }} /></div>;
  const maxIn = Math.max(0, ...data.inflow.map((x) => x.total)), maxOut = Math.max(0, ...data.outflow.map((x) => x.total));
  return (
    <>
      <PageHeader title="Движение денег (ДДС)" subtitle="Сколько денег пришло и ушло. Считаются только реальные платежи: неоплаченные расходы и переводы между своими счетами не входят" />
      <div className="mb-4"><PeriodPicker value={period} onChange={setPeriod} /></div>
      {!data.hasAccounts && <p className="mb-4 rounded-lg bg-info/10 p-3 text-sm text-info">Счета не созданы — остатки не считаются. <Link className="font-medium underline" to="/finance/accounts">Создать счета</Link></p>}
      <div className={loading ? 'opacity-60 transition' : 'transition'}>
        <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard label="Остаток на начало" value={money(data.opening)} />
          <StatCard label="Поступило" value={money(data.totalIn)} tone="good" />
          <StatCard label="Выплачено" value={money(data.totalOut)} tone="bad" />
          <StatCard label="Чистый поток" value={money(data.net)} tone={data.net >= 0 ? 'good' : 'bad'} />
          <StatCard label="Остаток на конец" value={money(data.closing)} />
        </div>
        {data.months.length > 1 && <section className="card mb-5 p-4"><h2 className="mb-2 font-semibold">По месяцам</h2><PairBars data={data.months.map((m) => ({ label: monthLabel(m.month), a: m.in, b: m.out }))} /></section>}
        <div className="grid gap-5 lg:grid-cols-2">
          <section className="card p-4"><h2 className="mb-3 font-semibold text-good">Поступления</h2>
            <div className="space-y-3">{data.inflow.map((x) => <div key={x.name}><div className="flex justify-between text-[13.5px]"><span>{x.name}</span><b className="tnum">{money(x.total)}</b></div>{bar(x.total, maxIn, 'bg-good')}</div>)}{!data.inflow.length && <p className="text-sm text-muted">Поступлений не было</p>}</div>
            <div className="mt-4 flex justify-between border-t border-line pt-3 font-semibold"><span>Итого поступило</span><span className="tnum text-good">{money(data.totalIn)}</span></div></section>
          <section className="card p-4"><h2 className="mb-3 font-semibold text-bad">Выплаты</h2>
            <div className="space-y-3">{data.outflow.map((x) => <div key={x.name}><div className="flex justify-between text-[13.5px]"><span>{x.name}</span><b className="tnum">{money(x.total)}</b></div>{bar(x.total, maxOut, 'bg-bad')}</div>)}{!data.outflow.length && <p className="text-sm text-muted">Выплат не было</p>}</div>
            <div className="mt-4 flex justify-between border-t border-line pt-3 font-semibold"><span>Итого выплачено</span><span className="tnum text-bad">{money(data.totalOut)}</span></div></section>
        </div>
        {data.byAccount.length > 0 && (
          <section className="card mt-5 overflow-x-auto p-4"><h2 className="mb-3 font-semibold">По счетам</h2>
            <table className="w-full text-[13.5px]"><thead><tr><th className="th">Счёт</th><th className="th text-right">На начало</th><th className="th text-right">Изменение</th><th className="th text-right">На конец</th></tr></thead>
              <tbody>{data.byAccount.map((a) => <tr key={a.id}><td className="td">{a.name}</td><td className="td tnum text-right">{money(a.opening)}</td><td className={`td tnum text-right ${a.closing - a.opening >= 0 ? 'text-good' : 'text-bad'}`}>{a.closing - a.opening >= 0 ? '+' : '−'} {money(Math.abs(a.closing - a.opening))}</td><td className="td tnum text-right font-semibold">{money(a.closing)}</td></tr>)}</tbody></table>
            {data.unassigned !== 0 && <p className="mt-3 text-xs text-muted">Движение вне счетов (до даты их открытия): {money(data.unassigned)} — на остатки не влияет.</p>}
          </section>
        )}
      </div>
    </>
  );
}
