import { useState } from 'react';
import { AlertTriangle, Ban, Receipt, UserCheck } from 'lucide-react';
import { get, qs } from '../api';
import { fmtDateTime, money, num } from '../format';
import { Badge, Col, DataTable, ErrorBox, Loading, Modal, PageHeader, PeriodPicker, StatCard, useFetch, usePeriod } from '../ui';
import { Chips } from '../ui2';

interface Row { id: string; nombre: string; rol: string; activo: boolean; orders: number; paid: number; revenue: number; avgCheck: number; cashShare: number; cancelled: number; cancelledAmount: number; cancelledReady: number; cancelRate: number; cancelledByThem: number; flags: string[] }
interface Resp { from: string; to: string; rows: Row[]; flagged: number; totals: { orders: number; paid: number; revenue: number; avgCheck: number; cancelled: number; cancelRate: number; cancelledAmount: number } }
interface Canc { rows: { id: string; numero: number; tipo: string; mesa: number | null; created: string; cancelledAt: string; afterReady: boolean; minutes: number; waiter: string | null; actor: string | null; amount: number; lines: string | null }[] }

const ROLE: Record<string, string> = { MESERO: 'Официант', CAJERO: 'Кассир', COCINERO: 'Повар', ADMIN: 'Администратор', SUPERADMIN: 'Владелец', REPARTIDOR: 'Доставщик' };

/** Контроль сотрудников: выручка, средний чек и отмены заказов. Подозрительные показатели подсвечены. */
export default function StaffControl() {
  const [period, setPeriod] = usePeriod('month');
  const [view, setView] = useState<'all' | 'flag'>('all');
  const [open, setOpen] = useState<Row | 'all' | null>(null);
  const { data, error, reload, loading } = useFetch(() => get<Resp>('/ctl/staff' + qs(period)), [period.from, period.to]);
  if (error && !data) return <ErrorBox error={error} onRetry={reload} />;
  if (!data) return <Loading />;
  const t = data.totals;
  const rows = data.rows.filter((r) => view === 'all' || r.flags.length);
  const cols: Col<Row>[] = [
    { key: 'n', header: 'Сотрудник', render: (r) => <div><div className="flex items-center gap-2 font-medium">{r.nombre}{!r.activo && <Badge>отключён</Badge>}</div><div className="text-xs text-muted">{ROLE[r.rol] ?? r.rol}</div></div>, sort: (r) => r.nombre, csv: (r) => r.nombre },
    { key: 'o', header: 'Заказов', align: 'right', render: (r) => num(r.orders), sort: (r) => r.orders, csv: (r) => r.orders },
    { key: 'rv', header: 'Выручка', align: 'right', render: (r) => <b>{money(r.revenue)}</b>, sort: (r) => r.revenue, csv: (r) => r.revenue },
    { key: 'ac', header: 'Средний чек', align: 'right', render: (r) => (r.paid ? money(r.avgCheck) : '—'), sort: (r) => r.avgCheck, hideOnMobile: true, csv: (r) => r.avgCheck },
    { key: 'cs', header: 'Наличные', align: 'right', render: (r) => (r.paid ? `${Math.round(r.cashShare)}%` : '—'), sort: (r) => r.cashShare, hideOnMobile: true, csv: (r) => r.cashShare },
    { key: 'cn', header: 'Отмены (его заказы)', align: 'right', render: (r) => (r.cancelled ? <span className={r.cancelRate >= 10 ? 'font-semibold text-bad' : ''}>{r.cancelled} · {r.cancelRate}%</span> : <span className="text-muted">0</span>), sort: (r) => r.cancelRate, csv: (r) => r.cancelled },
    { key: 'ca', header: 'Сумма отмен', align: 'right', render: (r) => (r.cancelledAmount ? money(r.cancelledAmount) : '—'), sort: (r) => r.cancelledAmount, hideOnMobile: true, csv: (r) => r.cancelledAmount },
    { key: 'cr', header: 'После «готово»', align: 'right', render: (r) => (r.cancelledReady ? <b className="text-warn">{r.cancelledReady}</b> : '—'), sort: (r) => r.cancelledReady, hideOnMobile: true, csv: (r) => r.cancelledReady },
    { key: 'bt', header: 'Отменил сам', align: 'right', render: (r) => r.cancelledByThem || '—', sort: (r) => r.cancelledByThem, hideOnMobile: true, csv: (r) => r.cancelledByThem },
    { key: 'f', header: 'Сигналы', render: (r) => (r.flags.length ? <div className="space-y-0.5">{r.flags.map((f) => <div key={f} className="flex items-start gap-1 text-[12px] text-warn"><AlertTriangle size={12} className="mt-0.5 shrink-0" />{f}</div>)}</div> : <span className="text-muted">—</span>), csv: (r) => r.flags.join('; ') },
  ];
  return (
    <>
      <PageHeader title="Контроль сотрудников" subtitle="Кто сколько продал и как часто отменяет заказы. Период считается по дате создания заказа. Сигнал — повод поговорить, а не приговор"
        actions={<button className="btn btn-soft" onClick={() => setOpen('all')}><Ban size={15} /> Все отмены</button>} />
      <div className="mb-4 flex flex-wrap items-center gap-3"><PeriodPicker value={period} onChange={setPeriod} /><Chips value={view} onChange={setView} options={[{ id: 'all', label: 'Все' }, { id: 'flag', label: 'Есть сигналы', count: data.flagged }]} /></div>
      <div className={loading ? 'opacity-60 transition' : 'transition'}>
        <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Заказов" value={num(t.orders)} sub={`оплачено ${num(t.paid)}`} icon={<Receipt size={16} />} />
          <StatCard label="Средний чек" value={money(t.avgCheck)} icon={<UserCheck size={16} />} />
          <StatCard label="Отменено" value={`${num(t.cancelled)} · ${t.cancelRate}%`} tone={t.cancelRate >= 10 ? 'bad' : undefined} sub={money(t.cancelledAmount)} icon={<Ban size={16} />} />
          <StatCard label="Сотрудников с сигналами" value={data.flagged} tone={data.flagged ? 'warn' : 'good'} icon={<AlertTriangle size={16} />} />
        </div>
        <DataTable cols={cols} rows={rows} rowKey={(r) => r.id} csvName="staff-control" onRowClick={(r) => setOpen(r)} initialSort={{ key: 'rv', dir: 'desc' }} empty={<div className="py-12 text-center text-sm text-muted">За период нет заказов</div>} />
        <p className="mt-3 text-xs text-muted">Скидки в кассе не ведутся, поэтому контролируются отмены. «Отмены после готово» — заказ был приготовлен и всё равно отменён: частый признак злоупотребления. «Отменил сам» — сколько отмен выполнил сотрудник (из журнала кассы), даже если заказ принимал не он.</p>
      </div>
      {open && <CancModal who={open === 'all' ? null : open} period={period} onClose={() => setOpen(null)} />}
    </>
  );
}

function CancModal({ who, period, onClose }: { who: Row | null; period: { from: string; to: string }; onClose: () => void }) {
  const { data } = useFetch(() => get<Canc>('/ctl/cancellations' + qs({ ...period, userId: who?.id })), [who?.id, period.from, period.to], { live: false });
  return (
    <Modal open onClose={onClose} title={who ? `Отмены: ${who.nombre}` : 'Все отменённые заказы'} width={820} footer={<button className="btn btn-primary" onClick={onClose}>Закрыть</button>}>
      {!data ? <Loading /> : !data.rows.length ? <p className="py-8 text-center text-sm text-muted">Отмен за период нет</p> : (
        <div className="overflow-x-auto"><table className="w-full text-[13px]"><thead><tr><th className="th">Заказ</th><th className="th">Состав</th><th className="th text-right">Сумма</th><th className="th">Принял</th><th className="th">Отменил</th><th className="th">Когда</th></tr></thead>
          <tbody>{data.rows.map((r) => (
            <tr key={r.id}><td className="td whitespace-nowrap"><b>№{r.numero}</b>{r.mesa ? <span className="text-muted"> · стол {r.mesa}</span> : <span className="text-muted"> · с собой</span>}{r.afterReady && <div><Badge tone="warn">после «готово»</Badge></div>}</td>
              <td className="td max-w-[240px] text-muted">{r.lines ?? '—'}</td><td className="td tnum text-right">{money(r.amount)}</td><td className="td">{r.waiter ?? '—'}</td><td className="td">{r.actor ?? '—'}</td>
              <td className="td whitespace-nowrap text-xs text-muted">{fmtDateTime(r.cancelledAt)}<div>через {r.minutes} мин</div></td></tr>))}</tbody></table></div>
      )}
    </Modal>
  );
}
