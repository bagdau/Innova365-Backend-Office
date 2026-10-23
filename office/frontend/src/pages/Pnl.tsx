import { AlertTriangle, Printer } from 'lucide-react';
import { get, qs } from '../api';
import { useAuth } from '../auth';
import { fmtDate, money, num, pct } from '../format';
import { ErrorBox, Loading, PageHeader, PeriodPicker, StatCard, useFetch, usePeriod } from '../ui';

interface P {
  from: string; to: string; revenueGross: number; vat: number; vatRate: number; revenueNet: number; cogs: number; grossProfit: number; grossMargin: number | null;
  expenses: { category: string; kind: string; total: number }[]; expensesTotal: number; netProfit: number; netMargin: number | null;
  notes: { itemsWithoutCard: number; revenueWithoutCard: number; itemsIncomplete: number }; topCost: { id: string; nombre: string; qty: number; revenue: number; cost: number | null }[];
}

export default function Pnl() {
  const { me } = useAuth();
  const [period, setPeriod] = usePeriod('month');
  const { data, error, reload, loading } = useFetch(() => get<P>('/acc/pnl' + qs(period)), [period.from, period.to]);
  if (error && !data) return <ErrorBox error={error} onRetry={reload} />;
  if (!data) return <Loading />;
  const L = ({ label, value, strong, indent, tone, note }: { label: string; value: number | string; strong?: boolean; indent?: boolean; tone?: 'good' | 'bad'; note?: string }) => (
    <tr className={strong ? 'bg-surface2/60 font-semibold' : ''}>
      <td className={`td ${indent ? 'pl-8 text-muted' : ''}`}>{label}{note && <span className="ml-2 text-[11px] font-normal text-muted">{note}</span>}</td>
      <td className={`td tnum text-right ${tone === 'good' ? 'text-good' : tone === 'bad' ? 'text-bad' : ''}`}>{typeof value === 'number' ? money(value) : value}</td>
    </tr>
  );
  return (
    <>
      <PageHeader title="ОПУ — отчёт о прибылях и убытках" subtitle="Выручка − НДС − себестоимость по техкартам − расходы" actions={<><PeriodPicker value={period} onChange={setPeriod} /><button className="btn btn-soft" onClick={() => window.print()}><Printer size={15} /> Печать</button></>} />
      <div className="hidden print:block"><h1 className="text-xl font-semibold">ОПУ за {fmtDate(data.from)} — {fmtDate(data.to)}</h1><p className="mb-3 text-sm">{me!.settings.company}</p></div>
      <div className={loading ? 'opacity-60 transition' : 'transition'}>
        <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Выручка без НДС" value={money(data.revenueNet)} />
          <StatCard label="Валовая прибыль" value={money(data.grossProfit)} sub={`маржа ${pct(data.grossMargin)}`} tone={data.grossProfit >= 0 ? 'good' : 'bad'} />
          <StatCard label="Расходы" value={money(data.expensesTotal)} />
          <StatCard label="Чистая прибыль" value={money(data.netProfit)} sub={`рентабельность ${pct(data.netMargin)}`} tone={data.netProfit >= 0 ? 'good' : 'bad'} />
        </div>
        {(data.notes.itemsWithoutCard > 0 || data.notes.itemsIncomplete > 0) && (
          <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-warn/40 bg-warn/10 p-3.5 text-sm text-warn"><AlertTriangle size={17} className="mt-0.5 shrink-0" />
            <div>Себестоимость посчитана не полностью: {data.notes.itemsWithoutCard > 0 && <>проданных позиций без техкарты — <b>{num(data.notes.itemsWithoutCard)}</b> (выручка {money(data.notes.revenueWithoutCard)}, для неё себестоимость = 0). </>}
              {data.notes.itemsIncomplete > 0 && <>Позиций, где у части сырья нет цены, — <b>{num(data.notes.itemsIncomplete)}</b>. </>}Заполните техкарты и цены сырья — прибыль станет точнее.</div></div>
        )}
        <div className="grid gap-5 xl:grid-cols-3">
          <section className="card overflow-hidden xl:col-span-2">
            <table className="w-full text-[14px]"><tbody>
              <L label="Выручка (с НДС)" value={data.revenueGross} strong />
              <L label={`НДС ${data.vatRate ? data.vatRate + '%' : ''}`} value={-data.vat} indent />
              <L label="Выручка без НДС" value={data.revenueNet} strong />
              <L label="Себестоимость продаж (по техкартам)" value={-data.cogs} indent />
              <L label="Валовая прибыль" value={data.grossProfit} strong tone={data.grossProfit >= 0 ? 'good' : 'bad'} note={`маржа ${pct(data.grossMargin)}`} />
              {data.expenses.map((e) => <L key={e.category} label={e.category} value={-e.total} indent />)}
              {!data.expenses.length && <tr><td className="td pl-8 text-muted" colSpan={2}>Расходов за период нет</td></tr>}
              <L label="Итого расходы" value={-data.expensesTotal} strong />
              <L label="Чистая прибыль" value={data.netProfit} strong tone={data.netProfit >= 0 ? 'good' : 'bad'} note={`рентабельность ${pct(data.netMargin)}`} />
            </tbody></table>
          </section>
          <section className="card p-4"><h2 className="mb-3 font-semibold">Где больше всего себестоимости</h2>
            {data.topCost.length ? <ul className="space-y-2.5 text-[13px]">{data.topCost.map((p) => (
              <li key={p.id}><div className="flex justify-between gap-3"><span className="truncate">{p.nombre}</span><span className="tnum font-medium">{money(p.cost)}</span></div>
                <div className="text-[11px] text-muted">{num(p.qty)} шт · выручка {money(p.revenue)} · маржа {pct(p.cost !== null && p.revenue ? (1 - p.cost / p.revenue) * 100 : null)}</div></li>))}</ul> : <p className="py-6 text-center text-sm text-muted">Нет продаж с техкартами</p>}
          </section>
        </div>
      </div>
    </>
  );
}
