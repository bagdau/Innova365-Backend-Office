import { useEffect, useState } from 'react';
import { Copy, Save, Wand2 } from 'lucide-react';
import { get, post, put } from '../api';
import { useAuth } from '../auth';
import { money, pct, todayIn } from '../format';
import { ErrorBox, Loading, PageHeader, StatCard, useFetch, useUi } from '../ui';
import { MonthPicker, ProgressBar, parseNum } from '../ui2';

interface Line { key: string; label: string; kind: 'revenue' | 'purchases' | 'expense'; plan: number; actual: number; variance: number; pct: number | null }
interface Resp { month: string; lines: Line[]; totals: { planRevenue: number; actualRevenue: number; planCost: number; actualCost: number; planProfit: number; actualProfit: number } }

/** Бюджет по месяцам: план и факт. Для выручки хорошо «больше плана», для расходов — «меньше плана». */
export default function Budget() {
  const { me, can } = useAuth();
  const { toast, confirm } = useUi();
  const [month, setMonth] = useState(() => todayIn(me!.settings.timezone).slice(0, 7));
  const { data, error, reload } = useFetch(() => get<Resp>('/fin/budget?month=' + month), [month]);
  const [vals, setVals] = useState<Record<string, string>>({});
  const write = can('fin.write');
  useEffect(() => { if (data) setVals(Object.fromEntries(data.lines.map((l) => [l.key, l.plan ? String(l.plan) : '']))); }, [data]);
  if (error && !data) return <ErrorBox error={error} onRetry={reload} />;
  if (!data) return <Loading />;
  const dirty = data.lines.some((l) => (parseNum(vals[l.key] ?? '') || 0) !== l.plan);

  const save = async () => {
    try { await put('/fin/budget/' + month, { lines: data.lines.map((l) => ({ key: l.key, amount: Math.max(0, parseNum(vals[l.key] ?? '') || 0) })) }); toast('ok', 'План сохранён'); void reload(); } catch (e) { toast('err', (e as Error).message); }
  };
  const suggest = async () => {
    try { const r = await get<{ values: Record<string, number> }>(`/fin/budget/${month}/suggest`); setVals((v) => ({ ...v, ...Object.fromEntries(Object.entries(r.values).filter(([k]) => data.lines.some((l) => l.key === k)).map(([k, x]) => [k, String(x)])) })); toast('info', 'Подставлено среднее за 3 прошлых месяца — проверьте и сохраните'); } catch (e) { toast('err', (e as Error).message); }
  };
  const copy = async () => {
    const prev = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)) - 2, 1)).toISOString().slice(0, 7);
    if (!(await confirm({ title: `Скопировать план из ${prev}?`, text: 'План текущего месяца будет заменён там, где в прошлом месяце есть значения.', confirmLabel: 'Скопировать' }))) return;
    try { const r = await post<{ copied: number }>(`/fin/budget/${month}/copy`, { from: prev }); toast('ok', r.copied ? `Скопировано строк: ${r.copied}` : 'В прошлом месяце плана не было'); void reload(); } catch (e) { toast('err', (e as Error).message); }
  };
  const t = data.totals;
  return (
    <>
      <PageHeader title="Бюджет" subtitle="План и факт по выручке, закупкам и расходам. Фактические расходы берутся из раздела «Расходы» (включая зарплату и налоги), закупки — по принятому товару"
        actions={<>{write && <button className="btn btn-soft" onClick={() => void suggest()}><Wand2 size={15} /> Предложить план</button>}{write && <button className="btn btn-soft" onClick={() => void copy()}><Copy size={15} /> Из прошлого месяца</button>}{write && <button className="btn btn-primary" disabled={!dirty} onClick={() => void save()}><Save size={15} /> Сохранить</button>}</>} />
      <div className="mb-4"><MonthPicker value={month} onChange={setMonth} /></div>
      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Выручка: факт / план" value={money(t.actualRevenue)} sub={t.planRevenue ? `план ${money(t.planRevenue)} · ${pct((t.actualRevenue / t.planRevenue) * 100)}` : 'план не задан'} />
        <StatCard label="Затраты: факт / план" value={money(t.actualCost)} sub={t.planCost ? `план ${money(t.planCost)} · ${pct((t.actualCost / t.planCost) * 100)}` : 'план не задан'} tone={t.planCost && t.actualCost > t.planCost ? 'bad' : undefined} />
        <StatCard label="Прибыль по плану" value={money(t.planProfit)} />
        <StatCard label="Прибыль по факту" value={money(t.actualProfit)} tone={t.actualProfit >= 0 ? 'good' : 'bad'} sub="выручка − закупки − расходы" />
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[720px] text-[13.5px]">
          <thead><tr><th className="th">Статья</th><th className="th w-[160px] text-right">План</th><th className="th text-right">Факт</th><th className="th text-right">Отклонение</th><th className="th w-[180px]">Выполнение</th></tr></thead>
          <tbody>
            {data.lines.map((l, i) => {
              const plan = parseNum(vals[l.key] ?? '') || 0;
              const variance = l.kind === 'revenue' ? l.actual - plan : plan - l.actual;
              const over = l.kind !== 'revenue' && plan > 0 && l.actual > plan;
              return (
                <tr key={l.key} className={i === 0 || i === 2 ? 'border-t-2 border-line' : ''}>
                  <td className="td"><span className="font-medium">{l.label}</span>{l.kind === 'expense' && <span className="ml-2 text-xs text-muted">расход</span>}</td>
                  <td className="td text-right">{write ? <input className="input tnum !h-8 !w-[140px] text-right" inputMode="decimal" value={vals[l.key] ?? ''} placeholder="—" onChange={(e) => setVals({ ...vals, [l.key]: e.target.value })} /> : <b>{plan ? money(plan) : '—'}</b>}</td>
                  <td className="td tnum text-right font-semibold">{money(l.actual)}</td>
                  <td className="td tnum text-right">{plan ? <span className={variance >= 0 ? 'text-good' : 'text-bad'}>{variance >= 0 ? '+' : '−'} {money(Math.abs(variance))}</span> : <span className="text-muted">—</span>}</td>
                  <td className="td">{plan ? <div><div className="mb-1 text-xs text-muted">{pct((l.actual / plan) * 100)}</div><ProgressBar value={l.actual} max={plan} tone={over ? 'warn' : l.kind === 'revenue' && l.actual >= plan ? 'good' : 'brand'} /></div> : null}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-muted">Отклонение: для выручки — «факт минус план» (плюс — хорошо), для расходов — «план минус факт» (плюс — сэкономили).</p>
    </>
  );
}
