import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight, ChefHat, Coins, FileCheck2, Handshake, Landmark, Receipt, ShoppingBag, Store, TrendingUp, Truck } from 'lucide-react';
import { get, qs } from '../api';
import { useAuth } from '../auth';
import { BarChart, Donut, HBars } from '../charts';
import { fmtShort, money, num } from '../format';
import { ReminderCard } from '../Reminders';
import { Delta, ErrorBox, Loading, PageHeader, PeriodPicker, StatCard, useFetch, usePeriod } from '../ui';

interface D {
  from: string; to: string;
  revenue?: { total: number; orders: number; avgCheck: number; prevTotal: number; prevOrders: number; methods: { name: string; value: number }[]; series: { date: string; revenue: number; orders: number }[] };
  categories?: { id: string; nombre: string; qty: number; revenue: number }[];
  topProducts?: { nombre: string; qty: number; revenue: number }[];
  finance?: { expenses: number; cogs: number; vat: number; grossProfit: number; profit: number; debt: number; noCard: number };
  outlets?: { count: number; active: number; rows: { name: string; revenue: number; orders: number }[]; unassigned: number };
  settlements?: { draft: number; issued: number; toPay: number };
  techcards?: { total: number; withoutCard: number; incomplete: number; lowMargin: number; draft: number; review: number; approved: number; rejected: number };
}

export default function Dashboard() {
  const { me, can } = useAuth();
  const [period, setPeriod] = usePeriod('month');
  const { data, error, loading, reload } = useFetch(() => get<D>('/dashboard' + qs(period)), [period.from, period.to]);

  if (error && !data) return <ErrorBox error={error} onRetry={reload} />;
  if (!data) return <Loading />;
  const r = data.revenue, f = data.finance;
  const hasMoney = can('acc.view'), hasFc = can('fc.view');

  return (
    <>
      <PageHeader title={`Здравствуйте, ${me!.name.split(' ')[0]}`} subtitle={`${me!.roleLabel} · ${me!.settings.company || 'Innova365'}`} actions={r ? <PeriodPicker value={period} onChange={setPeriod} /> : undefined} />
      <ReminderCard />
      <div className={loading ? 'opacity-60 transition' : 'transition'}>
        {r && (
          <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Выручка" value={money(r.total)} sub={<Delta now={r.total} prev={r.prevTotal} />} icon={<Coins size={16} />} />
            <StatCard label="Заказов оплачено" value={num(r.orders)} sub={`прошлый период: ${num(r.prevOrders)}`} icon={<ShoppingBag size={16} />} />
            <StatCard label="Средний чек" value={money(r.avgCheck)} icon={<Receipt size={16} />} />
            {f ? <StatCard label="Прибыль (оценка)" value={money(f.profit)} tone={f.profit >= 0 ? 'good' : 'bad'} sub={`расходы ${money(f.expenses)} · себестоимость ${money(f.cogs)}`} icon={<TrendingUp size={16} />} />
              : <StatCard label="Точек фудкорта" value={data.outlets ? `${data.outlets.active} / ${data.outlets.count}` : '—'} sub="активных / всего" icon={<Store size={16} />} />}
          </div>
        )}

        {r && (
          <div className="mb-5 grid gap-4 xl:grid-cols-3">
            <section className="card p-4 xl:col-span-2">
              <div className="mb-3 flex items-baseline justify-between"><h2 className="font-semibold">Выручка по дням</h2><span className="text-xs text-muted">{fmtShort(data.from)} — {fmtShort(data.to)}</span></div>
              {r.series.length ? <BarChart data={r.series.map((s) => ({ date: s.date, value: s.revenue, extra: `${s.orders} заказов` }))} /> : null}
            </section>
            <section className="card p-4">
              <h2 className="mb-4 font-semibold">Способы оплаты</h2>
              {r.methods.length ? <Donut rows={r.methods} /> : <p className="py-8 text-center text-sm text-muted">Нет оплат за период</p>}
            </section>
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {data.topProducts && (
            <section className="card p-4"><h2 className="mb-3 font-semibold">Топ блюд по выручке</h2>
              {data.topProducts.length ? <HBars rows={data.topProducts.map((p) => ({ name: p.nombre, value: p.revenue, sub: `${num(p.qty)} шт` }))} /> : <p className="py-6 text-center text-sm text-muted">Нет продаж</p>}
            </section>
          )}
          {data.categories && (
            <section className="card p-4"><h2 className="mb-3 font-semibold">Выручка по категориям меню</h2>
              {data.categories.length ? <HBars rows={data.categories.map((c) => ({ name: c.nombre, value: c.revenue, sub: `${num(c.qty)} шт` }))} /> : <p className="py-6 text-center text-sm text-muted">Нет продаж</p>}
            </section>
          )}
          {data.outlets && hasFc && (
            <section className="card p-4">
              <div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">Выручка по точкам</h2><Link to="/foodcourt/revenue" className="flex items-center gap-1 text-xs text-brand hover:underline">Подробнее <ArrowRight size={12} /></Link></div>
              {data.outlets.rows.length ? <HBars rows={data.outlets.rows.map((o) => ({ name: o.name, value: o.revenue, sub: `${num(o.orders)} заказов` }))} /> : <p className="py-6 text-center text-sm text-muted">Нет выручки по точкам. Закрепите категории меню за точками.</p>}
              {data.outlets.unassigned > 0 && <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-warn/10 p-2.5 text-xs text-warn"><AlertTriangle size={13} className="mt-0.5 shrink-0" />Без точки: {money(data.outlets.unassigned)} — категории не закреплены.</p>}
            </section>
          )}
          {data.settlements && (
            <section className="card p-4">
              <div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">Взаиморасчёты</h2><Link to="/foodcourt/settlements" className="flex items-center gap-1 text-xs text-brand hover:underline">Открыть <ArrowRight size={12} /></Link></div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <Mini label="Черновики" v={data.settlements.draft} /><Mini label="Выставлено" v={data.settlements.issued} /><Mini label="К выплате" v={money(data.settlements.toPay)} small />
              </div>
            </section>
          )}
          {f && hasMoney && (
            <section className="card p-4">
              <div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">Финансы периода</h2><Link to="/accounting/pnl" className="flex items-center gap-1 text-xs text-brand hover:underline">ОПУ <ArrowRight size={12} /></Link></div>
              <dl className="space-y-2 text-[13.5px]">
                <Row k="НДС в выручке" v={money(f.vat)} /><Row k="Себестоимость продаж" v={money(f.cogs)} /><Row k="Валовая прибыль" v={money(f.grossProfit)} /><Row k="Расходы" v={money(f.expenses)} />
                <Row k="Чистая прибыль" v={money(f.profit)} strong tone={f.profit >= 0 ? 'good' : 'bad'} />
              </dl>
              <Link to="/accounting/purchases" className="mt-4 flex items-center gap-2 rounded-lg bg-surface2 p-2.5 text-[13px] hover:bg-line/50"><Truck size={15} className="text-muted" />Долг поставщикам: <b className="tnum ml-auto">{money(f.debt)}</b></Link>
              {f.noCard > 0 && <p className="mt-2 flex items-start gap-1.5 text-xs text-warn"><AlertTriangle size={13} className="mt-0.5 shrink-0" />{num(f.noCard)} проданных позиций без техкарты — себестоимость занижена.</p>}
            </section>
          )}
          {data.techcards && (
            <section className="card p-4">
              <div className="mb-3 flex items-center justify-between"><h2 className="flex items-center gap-2 font-semibold"><ChefHat size={16} className="text-brand" />Техкарты</h2><Link to="/techcards" className="flex items-center gap-1 text-xs text-brand hover:underline">Открыть <ArrowRight size={12} /></Link></div>
              <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4 lg:grid-cols-2">
                <Mini label="Утверждено" v={data.techcards.approved} tone="good" /><Mini label="На согласовании" v={data.techcards.review} tone="info" /><Mini label="Черновики" v={data.techcards.draft} /><Mini label="Возвращены" v={data.techcards.rejected} tone={data.techcards.rejected ? 'bad' : undefined} />
              </div>
              <ul className="mt-3 space-y-1.5 text-[13px] text-muted">
                {data.techcards.withoutCard > 0 && <li className="flex items-center gap-2"><AlertTriangle size={13} className="text-warn" />Без техкарты: <b className="ml-auto text-ink">{data.techcards.withoutCard}</b></li>}
                {data.techcards.incomplete > 0 && <li className="flex items-center gap-2"><AlertTriangle size={13} className="text-warn" />Не у всего сырья есть цена: <b className="ml-auto text-ink">{data.techcards.incomplete}</b></li>}
                <li className="flex items-center gap-2"><Landmark size={13} />Маржа ниже 50%: <b className="ml-auto text-ink">{data.techcards.lowMargin}</b></li>
                <li className="flex items-center gap-2"><FileCheck2 size={13} />Всего блюд: <b className="ml-auto text-ink">{data.techcards.total}</b></li>
              </ul>
            </section>
          )}
          {!r && !data.techcards && !data.outlets && <p className="text-sm text-muted"><Handshake size={14} className="mr-1 inline" />Для вашей роли нет сводных показателей.</p>}
        </div>
      </div>
    </>
  );
}

function Mini({ label, v, tone, small }: { label: string; v: number | string; tone?: 'good' | 'bad' | 'info'; small?: boolean }) {
  const c = tone === 'good' ? 'text-good' : tone === 'bad' ? 'text-bad' : tone === 'info' ? 'text-info' : '';
  return <div className="rounded-lg bg-surface2 p-2.5"><div className={`tnum font-semibold ${small ? 'text-[13px] leading-6' : 'text-xl'} ${c}`}>{v}</div><div className="text-[11px] text-muted">{label}</div></div>;
}
function Row({ k, v, strong, tone }: { k: string; v: string; strong?: boolean; tone?: 'good' | 'bad' }) {
  return <div className={`flex justify-between gap-3 ${strong ? 'border-t border-line pt-2 font-semibold' : ''}`}><dt className="text-muted">{k}</dt><dd className={`tnum ${tone === 'good' ? 'text-good' : tone === 'bad' ? 'text-bad' : ''}`}>{v}</dd></div>;
}
