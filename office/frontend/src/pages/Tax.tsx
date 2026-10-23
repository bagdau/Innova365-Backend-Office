import { useState } from 'react';
import { AlertTriangle, Save } from 'lucide-react';
import { get, put } from '../api';
import { useAuth } from '../auth';
import { money, todayIn } from '../format';
import { Col, DataTable, ErrorBox, Field, Loading, PageHeader, StatCard, useFetch, useUi } from '../ui';
import { monthLabel, parseNum } from '../ui2';

interface M { month: string; revenue: number; vat: number; revenueNet: number; cogs: number; expenses: number; profit: number; turnoverTax: number; incomeTax: number; withheld: number; employer: number; total: number }
interface Resp { year: number; config: { revenueRate: number; profitRate: number; note: string }; vat: { enabled: boolean; rate: number }; months: M[]; totals: Omit<M, 'month'> }

/** Налоговая оценка по месяцам. Ставки задаёт бухгалтер: система не подставляет законодательные значения. */
export default function Tax() {
  const { me, can } = useAuth();
  const { toast } = useUi();
  const [year, setYear] = useState(() => Number(todayIn(me!.settings.timezone).slice(0, 4)));
  const { data, error, reload } = useFetch(() => get<Resp>('/fin/tax?year=' + year), [year]);
  const [cfg, setCfg] = useState<{ revenueRate: string; profitRate: string; note: string } | null>(null);
  if (error && !data) return <ErrorBox error={error} onRetry={reload} />;
  if (!data) return <Loading />;
  const c = cfg ?? { revenueRate: String(data.config.revenueRate), profitRate: String(data.config.profitRate), note: data.config.note };
  const save = async () => { try { await put('/fin/tax/config', { revenueRate: parseNum(c.revenueRate) || 0, profitRate: parseNum(c.profitRate) || 0, note: c.note }); toast('ok', 'Ставки сохранены'); setCfg(null); void reload(); } catch (e) { toast('err', (e as Error).message); } };
  const t = data.totals;
  const cols: Col<M>[] = [
    { key: 'm', header: 'Месяц', render: (r) => <b>{monthLabel(r.month)}</b>, sort: (r) => r.month, csv: (r) => r.month },
    { key: 'r', header: 'Выручка', align: 'right', render: (r) => money(r.revenue), csv: (r) => r.revenue },
    { key: 'v', header: data.vat.enabled ? `НДС в выручке (${data.vat.rate}%)` : 'НДС', align: 'right', render: (r) => (data.vat.enabled ? money(r.vat) : '—'), hideOnMobile: true, csv: (r) => r.vat },
    { key: 'p', header: 'Прибыль (оценка)', align: 'right', render: (r) => <span className={r.profit < 0 ? 'text-bad' : ''}>{money(r.profit)}</span>, csv: (r) => r.profit },
    { key: 'tt', header: 'С оборота', align: 'right', render: (r) => (r.turnoverTax ? money(r.turnoverTax) : '—'), hideOnMobile: true, csv: (r) => r.turnoverTax },
    { key: 'it', header: 'С прибыли', align: 'right', render: (r) => (r.incomeTax ? money(r.incomeTax) : '—'), hideOnMobile: true, csv: (r) => r.incomeTax },
    { key: 'w', header: 'Удержано с зарплат', align: 'right', render: (r) => (r.withheld ? money(r.withheld) : '—'), hideOnMobile: true, csv: (r) => r.withheld },
    { key: 'e', header: 'Взносы работодателя', align: 'right', render: (r) => (r.employer ? money(r.employer) : '—'), hideOnMobile: true, csv: (r) => r.employer },
    { key: 'tot', header: 'Нагрузка', align: 'right', render: (r) => <b>{money(r.total)}</b>, sort: (r) => r.total, csv: (r) => r.total },
  ];
  return (
    <>
      <PageHeader title="Налоги (оценка)" subtitle="Планирование налоговой нагрузки по данным учёта" actions={<div className="inline-flex items-center gap-1 rounded-lg border border-line bg-surface p-0.5"><button className="btn btn-ghost btn-sm" onClick={() => setYear(year - 1)}>←</button><span className="px-2 text-sm font-semibold">{year}</span><button className="btn btn-ghost btn-sm" onClick={() => setYear(year + 1)}>→</button></div>} />
      <p className="mb-4 flex items-start gap-2 rounded-lg bg-warn/10 p-3 text-[13px] leading-relaxed text-warn"><AlertTriangle size={16} className="mt-0.5 shrink-0" /><span>Это оценка для планирования, а не налоговая отчётность. Ставки и порядок расчёта зависят от вашего режима налогообложения — задайте их ниже вместе с бухгалтером. Удержания и взносы работодателя берутся из зарплатных ведомостей.</span></p>
      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Выручка за год" value={money(t.revenue)} sub={data.vat.enabled ? `в ней НДС ${money(t.vat)}` : undefined} />
        <StatCard label="Прибыль (оценка)" value={money(t.profit)} tone={t.profit >= 0 ? 'good' : 'bad'} />
        <StatCard label="Налоговая нагрузка" value={money(t.total)} sub={t.revenue ? `${((t.total / t.revenue) * 100).toFixed(1)}% от выручки` : undefined} />
        <StatCard label="Удержания и взносы" value={money(t.withheld + t.employer)} />
      </div>
      <section className="card mb-5 p-4">
        <h2 className="mb-3 font-semibold">Ставки для оценки</h2>
        <div className="grid gap-3 sm:grid-cols-[160px_160px_1fr_auto]">
          <Field label="С оборота, % от выручки"><input className="input tnum" inputMode="decimal" value={c.revenueRate} disabled={!can('fin.write')} onChange={(e) => setCfg({ ...c, revenueRate: e.target.value })} /></Field>
          <Field label="С прибыли, %"><input className="input tnum" inputMode="decimal" value={c.profitRate} disabled={!can('fin.write')} onChange={(e) => setCfg({ ...c, profitRate: e.target.value })} /></Field>
          <Field label="Заметка (режим, основание)"><input className="input" value={c.note} disabled={!can('fin.write')} onChange={(e) => setCfg({ ...c, note: e.target.value })} /></Field>
          {can('fin.write') && <div className="flex items-end"><button className="btn btn-primary" disabled={!cfg} onClick={() => void save()}><Save size={15} /> Сохранить</button></div>}
        </div>
        <p className="mt-2 text-xs text-muted">НДС берётся из «Настроек» (ставка {data.vat.rate}%, {data.vat.enabled ? 'включён' : 'выключен'}). Проценты удержаний и взносов — в зарплатной ведомости.</p>
      </section>
      <DataTable cols={cols} rows={data.months} rowKey={(r) => r.month} csvName={`tax-${year}`} initialSort={{ key: 'm', dir: 'asc' }}
        footer={<tr><td className="td">Итого</td><td className="td tnum text-right">{money(t.revenue)}</td><td className="td tnum hidden text-right md:table-cell">{data.vat.enabled ? money(t.vat) : '—'}</td><td className="td tnum text-right">{money(t.profit)}</td><td className="td tnum hidden text-right md:table-cell">{money(t.turnoverTax)}</td><td className="td tnum hidden text-right md:table-cell">{money(t.incomeTax)}</td><td className="td tnum hidden text-right md:table-cell">{money(t.withheld)}</td><td className="td tnum hidden text-right md:table-cell">{money(t.employer)}</td><td className="td tnum text-right">{money(t.total)}</td></tr>}
        empty={<div className="py-10 text-center text-sm text-muted">За этот год данных нет</div>} />
    </>
  );
}
