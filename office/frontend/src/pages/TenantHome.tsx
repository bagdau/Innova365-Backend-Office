import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Coins, FileText, Percent, Receipt, ShoppingBag, Store } from 'lucide-react';
import { get, qs } from '../api';
import { BarChart, HBars } from '../charts';
import { useAuth } from '../auth';
import { fmtDate, money, num } from '../format';
import { Badge, Col, DataTable, ErrorBox, Loading, PageHeader, PeriodPicker, StatCard, Tabs, useFetch, usePeriod } from '../ui';
import { TONE } from './Invoices';

interface Inv { id: string; number: number; kind: 'invoice' | 'act'; date: string; dueDate: string | null; title: string | null; state: keyof typeof TONE; stateLabel: string; total: number; remaining: number }
interface Resp {
  outlet: { name: string; legalName: string | null; status: string; commissionPct: number; rentMonthly: number }; company: string; from: string; to: string;
  period: { revenue: number; orders: number; qty: number; avgCheck: number; commission: number; rent: number; payable: number };
  daily: { date: string; revenue: number; orders: number }[]; top: { nombre: string; qty: number; revenue: number }[];
  settlements: { id: string; number: number; periodFrom: string; periodTo: string; revenue: number; commission: number; rent: number; payable: number; status: 'issued' | 'paid' }[];
  invoices: { rows: Inv[]; open: number; overdue: number };
  lease: { number: string; startDate: string; endDate: string | null; rentMonthly: number; commissionPct: number; deposit: number; paymentDay: number | null } | null;
}

/** Кабинет арендатора: «Моя точка». Только данные своей точки. */
export default function TenantHome() {
  const { me } = useAuth();
  const [period, setPeriod] = usePeriod('month');
  const [tab, setTab] = useState<'overview' | 'settlements' | 'invoices' | 'lease'>('overview');
  const { data, error, reload, loading } = useFetch(() => get<Resp>('/tenant/overview' + qs(period)), [period.from, period.to]);
  if (error && !data) return <ErrorBox error={error} onRetry={reload} />;
  if (!data) return <Loading />;
  const p = data.period;
  const sc: Col<Resp['settlements'][number]>[] = [
    { key: 'n', header: '№', render: (r) => <b>{r.number}</b>, sort: (r) => r.number, csv: (r) => r.number, width: 60 },
    { key: 'p', header: 'Период', render: (r) => `${fmtDate(r.periodFrom)} — ${fmtDate(r.periodTo)}`, sort: (r) => r.periodFrom, csv: (r) => r.periodFrom },
    { key: 'r', header: 'Выручка', align: 'right', render: (r) => money(r.revenue), csv: (r) => r.revenue },
    { key: 'c', header: 'Комиссия', align: 'right', render: (r) => money(r.commission), hideOnMobile: true, csv: (r) => r.commission },
    { key: 'a', header: 'Аренда', align: 'right', render: (r) => money(r.rent), hideOnMobile: true, csv: (r) => r.rent },
    { key: 'pa', header: 'К выплате', align: 'right', render: (r) => <b className={r.payable < 0 ? 'text-bad' : ''}>{money(r.payable)}</b>, csv: (r) => r.payable },
    { key: 's', header: 'Статус', render: (r) => <Badge tone={r.status === 'paid' ? 'good' : 'info'}>{r.status === 'paid' ? 'Выплачен' : 'Выставлен'}</Badge>, csv: (r) => r.status },
    { key: 'x', header: '', align: 'right', render: (r) => <Link className="btn btn-ghost btn-sm" target="_blank" to={`/print/my-settlement/${r.id}`}>Акт</Link> },
  ];
  const ic: Col<Inv>[] = [
    { key: 'n', header: '№', render: (r) => <div><b>{r.number}</b><div className="text-[11px] text-muted">{r.kind === 'act' ? 'акт' : 'счёт'}</div></div>, sort: (r) => r.number, csv: (r) => r.number, width: 70 },
    { key: 't', header: 'Документ', render: (r) => r.title ?? (r.kind === 'act' ? 'Акт оказанных услуг' : 'Счёт на оплату'), csv: (r) => r.title },
    { key: 'd', header: 'Дата', render: (r) => fmtDate(r.date), sort: (r) => r.date, hideOnMobile: true, csv: (r) => r.date },
    { key: 'du', header: 'Оплатить до', render: (r) => (r.dueDate ? <span className={r.state === 'overdue' ? 'font-semibold text-bad' : ''}>{fmtDate(r.dueDate)}</span> : '—'), hideOnMobile: true, csv: (r) => r.dueDate },
    { key: 's', header: 'Статус', render: (r) => <Badge tone={TONE[r.state]}>{r.stateLabel}</Badge>, csv: (r) => r.stateLabel },
    { key: 'tt', header: 'Сумма', align: 'right', render: (r) => <b>{money(r.total)}</b>, csv: (r) => r.total },
    { key: 'rm', header: 'Остаток', align: 'right', render: (r) => (r.remaining > 0 ? <span className={r.state === 'overdue' ? 'font-semibold text-bad' : 'text-warn'}>{money(r.remaining)}</span> : '—'), csv: (r) => r.remaining },
    { key: 'x', header: '', align: 'right', render: (r) => <Link className="btn btn-ghost btn-sm" target="_blank" to={`/print/my-invoice/${r.id}`}>Печать</Link> },
  ];
  return (
    <>
      <PageHeader title={<span className="flex items-center gap-2"><Store size={22} className="text-brand" />{data.outlet.name}</span>} subtitle={`${data.company ? data.company + ' · ' : ''}кабинет арендатора · ${me!.name}`} />
      {data.invoices.overdue > 0 && <p className="mb-4 rounded-lg bg-bad/10 p-3 text-sm text-bad">Есть просроченные счета на {money(data.invoices.overdue)}. Пожалуйста, оплатите их — подробности во вкладке «Счета и акты».</p>}
      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'overview', label: 'Выручка' }, { id: 'settlements', label: 'Расчёты', badge: <Badge>{data.settlements.length}</Badge> }, { id: 'invoices', label: 'Счета и акты', badge: data.invoices.open > 0 ? <Badge tone="warn">{data.invoices.rows.filter((r) => r.remaining > 0).length}</Badge> : undefined }, { id: 'lease', label: 'Договор' }]} />
      {tab === 'overview' && (
        <>
          <div className="mb-4"><PeriodPicker value={period} onChange={setPeriod} /></div>
          <div className={loading ? 'opacity-60 transition' : 'transition'}>
            <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Выручка точки" value={money(p.revenue)} icon={<Coins size={16} />} sub={`${num(p.orders)} заказов · ${num(p.qty)} позиций`} />
              <StatCard label="Средний чек" value={money(p.avgCheck)} icon={<ShoppingBag size={16} />} />
              <StatCard label={`Комиссия фудкорта ${data.outlet.commissionPct}%`} value={money(p.commission)} icon={<Percent size={16} />} />
              <StatCard label="К выплате за период (оценка)" value={money(p.payable)} tone={p.payable >= 0 ? 'good' : 'bad'} icon={<Receipt size={16} />} sub={`после комиссии и аренды ${money(p.rent)}`} />
            </div>
            <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
              <section className="card p-4"><h2 className="mb-3 font-semibold">Выручка по дням</h2>{data.daily.length ? <BarChart data={data.daily.map((d) => ({ date: d.date, value: d.revenue, extra: `${d.orders} заказов` }))} /> : <p className="py-10 text-center text-sm text-muted">Продаж за период нет</p>}</section>
              <section className="card p-4"><h2 className="mb-3 font-semibold">Что продаётся лучше всего</h2>{data.top.length ? <HBars rows={data.top.map((t) => ({ name: t.nombre, value: t.revenue, sub: `${num(t.qty)} шт` }))} /> : <p className="py-10 text-center text-sm text-muted">Нет данных</p>}</section>
            </div>
            <p className="mt-3 text-xs text-muted">Оценка к выплате ориентировочная: окончательная сумма фиксируется в расчёте, который выставляет фудкорт.</p>
          </div>
        </>
      )}
      {tab === 'settlements' && <DataTable cols={sc} rows={data.settlements} rowKey={(r) => r.id} csvName="my-settlements" initialSort={{ key: 'p', dir: 'desc' }} empty={<div className="py-12 text-center text-sm text-muted">Расчётов пока нет</div>} />}
      {tab === 'invoices' && <DataTable cols={ic} rows={data.invoices.rows} rowKey={(r) => r.id} csvName="my-invoices" initialSort={{ key: 'd', dir: 'desc' }} empty={<div className="py-12 text-center text-sm text-muted">Документов пока нет</div>} />}
      {tab === 'lease' && (
        <section className="card p-5">
          <h2 className="mb-3 flex items-center gap-2 font-semibold"><FileText size={17} className="text-muted" />Договор аренды</h2>
          {data.lease ? (
            <dl className="grid gap-x-8 gap-y-2.5 text-[14px] sm:grid-cols-2">
              {[['Номер', data.lease.number], ['Действует', `с ${fmtDate(data.lease.startDate)}${data.lease.endDate ? ` по ${fmtDate(data.lease.endDate)}` : ' (бессрочно)'}`], ['Аренда в месяц', money(data.lease.rentMonthly)], ['Комиссия', `${data.lease.commissionPct}% от выручки`], ['Депозит', data.lease.deposit ? money(data.lease.deposit) : '—'], ['День оплаты', data.lease.paymentDay ? `до ${data.lease.paymentDay}-го числа` : '—']].map(([k, v]) => <div key={k} className="flex justify-between gap-3 border-b border-line/60 pb-1.5"><dt className="text-muted">{k}</dt><dd className="font-medium">{v}</dd></div>)}
            </dl>
          ) : <p className="text-sm text-muted">Действующий договор не найден. Условия: аренда {money(data.outlet.rentMonthly)} в месяц, комиссия {data.outlet.commissionPct}%.</p>}
        </section>
      )}
    </>
  );
}
