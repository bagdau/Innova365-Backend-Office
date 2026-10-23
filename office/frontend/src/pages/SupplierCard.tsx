import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, FileSignature, Pencil, Trash2 } from 'lucide-react';
import { del, get, patch } from '../api';
import { Attachments } from '../Attachments';
import { useAuth } from '../auth';
import { fmtDate, money, todayIn } from '../format';
import { Badge, Col, DataTable, ErrorBox, Loading, PageHeader, StatCard, Tabs, Toggle, useFetch, useUi } from '../ui';
import { fmtQty } from '../ui2';
import { Supplier, SupplierModal } from './Suppliers';

interface Card {
  supplier: Supplier;
  totals: { purchases: number; received: number; paid: number; debt: number };
  purchases: { id: string; numero: number; estado: string; created: string; total: number; received: number; paid: number; debt: number }[];
  payments: { id: string; date: string; amount: number; method: string | null; purchase: number }[];
  items: { id: string; nombre: string; unidad: string; qty: number; total: number; lastPrice: number; prevPrice: number | null }[];
}
const ESTADO: Record<string, { label: string; tone: 'good' | 'warn' | 'info' | 'bad' | 'muted' }> = { PEDIDA: { label: 'Заказана', tone: 'info' }, PARCIAL: { label: 'Принята частично', tone: 'warn' }, RECIBIDA: { label: 'Принята', tone: 'good' }, CANCELADA: { label: 'Отменена', tone: 'muted' } };

/** Карточка поставщика: реквизиты, закупки и долг, купленное сырьё с ценами, оплаты, акт сверки, файлы. */
export default function SupplierCard() {
  const { id } = useParams();
  const nav = useNavigate();
  const { me, can } = useAuth();
  const { toast, confirm } = useUi();
  const { data, error, reload } = useFetch(() => get<Card>('/sup/suppliers/' + id), [id]);
  const [tab, setTab] = useState<'purchases' | 'items' | 'payments' | 'files'>('purchases');
  const [edit, setEdit] = useState(false);
  const [recon, setRecon] = useState({ from: '', to: '' });
  if (error && !data) return <ErrorBox error={error} onRetry={reload} />;
  if (!data) return <Loading />;
  const s = data.supplier, edit_ = can('sup.edit');
  const today = todayIn(me!.settings.timezone);
  const rf = recon.from || today.slice(0, 8) + '01', rt = recon.to || today;

  const remove = async () => {
    if (!(await confirm({ title: `Удалить «${s.nombre}»?`, text: 'Удалить можно только поставщика без закупок. Иначе отключите его.', danger: true, confirmLabel: 'Удалить' }))) return;
    try { await del('/sup/suppliers/' + s.id); toast('ok', 'Поставщик удалён'); nav('/suppliers'); } catch (e) { toast('err', (e as Error).message); }
  };

  const pc: Col<Card['purchases'][number]>[] = [
    { key: 'n', header: '№', render: (r) => <b>{r.numero}</b>, sort: (r) => r.numero, csv: (r) => r.numero, width: 60 },
    { key: 'd', header: 'Дата', render: (r) => fmtDate(r.created), sort: (r) => r.created, csv: (r) => r.created },
    { key: 's', header: 'Статус', render: (r) => <Badge tone={ESTADO[r.estado]?.tone ?? 'muted'}>{ESTADO[r.estado]?.label ?? r.estado}</Badge>, csv: (r) => r.estado },
    { key: 'rc', header: 'Принято', align: 'right', render: (r) => money(r.received), csv: (r) => r.received },
    { key: 'p', header: 'Оплачено', align: 'right', render: (r) => money(r.paid), hideOnMobile: true, csv: (r) => r.paid },
    { key: 'db', header: 'Долг', align: 'right', render: (r) => (r.debt > 0 ? <b className="text-warn">{money(r.debt)}</b> : '—'), sort: (r) => r.debt, csv: (r) => r.debt },
  ];
  const ic: Col<Card['items'][number]>[] = [
    { key: 'n', header: 'Сырьё', render: (r) => <span className="font-medium">{r.nombre}</span>, sort: (r) => r.nombre, csv: (r) => r.nombre },
    { key: 'q', header: 'Куплено', align: 'right', render: (r) => `${fmtQty(r.qty)} ${r.unidad}`, sort: (r) => r.qty, csv: (r) => r.qty },
    { key: 't', header: 'На сумму', align: 'right', render: (r) => money(r.total), sort: (r) => r.total, csv: (r) => r.total },
    { key: 'lp', header: 'Последняя цена', align: 'right', render: (r) => money(r.lastPrice), csv: (r) => r.lastPrice },
    { key: 'ch', header: 'Изменение', align: 'right', render: (r) => { if (r.prevPrice === null || r.prevPrice === 0) return <span className="text-muted">—</span>; const c = ((r.lastPrice - r.prevPrice) / r.prevPrice) * 100; return <span className={c > 0 ? 'text-bad' : c < 0 ? 'text-good' : 'text-muted'}>{c > 0 ? '▲' : c < 0 ? '▼' : ''} {Math.abs(c).toFixed(1)}%</span>; }, csv: (r) => r.prevPrice },
  ];
  return (
    <>
      <PageHeader title={<span className="flex items-center gap-2"><Link to="/suppliers" className="text-muted hover:text-ink"><ArrowLeft size={20} /></Link>{s.nombre}{!s.activo && <Badge>отключён</Badge>}</span>}
        subtitle={[s.category, s.contacto, s.telefono, s.email].filter(Boolean).join(' · ') || 'Контакты не заполнены'}
        actions={<>
          <Link className="btn btn-soft" target="_blank" to={`/print/reconciliation/${s.id}?from=${rf}&to=${rt}`}><FileSignature size={15} /> Акт сверки</Link>
          {edit_ && <button className="btn btn-soft" onClick={() => setEdit(true)}><Pencil size={15} /> Изменить</button>}
          {edit_ && <button className="btn btn-ghost hover:!text-bad" onClick={() => void remove()}><Trash2 size={15} /></button>}
        </>} />
      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Закупок" value={data.totals.purchases} />
        <StatCard label="Принято на сумму" value={money(data.totals.received)} />
        <StatCard label="Оплачено" value={money(data.totals.paid)} tone="good" />
        <StatCard label="Долг" value={money(data.totals.debt)} tone={data.totals.debt ? 'warn' : undefined} sub={s.paymentDays !== null ? `отсрочка ${s.paymentDays} дн.` : undefined} />
      </div>
      <div className="mb-5 grid gap-x-8 gap-y-1 rounded-xl border border-line bg-surface p-4 text-[13px] sm:grid-cols-2 xl:grid-cols-3">
        {[['БИН / ИИН', s.bin], ['Адрес', s.address], ['Банк', s.bank], ['IBAN', s.iban], ['Заметки', s.notas]].map(([k, v]) => <div key={k as string} className="flex gap-2"><span className="w-24 shrink-0 text-muted">{k}</span><span className="min-w-0 break-words">{(v as string) || '—'}</span></div>)}
        {edit_ && <div className="flex items-center gap-2 sm:col-span-2 xl:col-span-1"><span className="w-24 shrink-0 text-muted">Активен</span><Toggle checked={s.activo} onChange={(v) => void patch('/sup/suppliers/' + s.id, { activo: v }).then(reload)} /></div>}
      </div>
      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'purchases', label: 'Закупки' }, { id: 'items', label: 'Что покупаем' }, { id: 'payments', label: 'Оплаты' }, { id: 'files', label: 'Файлы' }]} />
      {tab === 'purchases' && <DataTable cols={pc} rows={data.purchases} rowKey={(r) => r.id} csvName="supplier-purchases" initialSort={{ key: 'd', dir: 'desc' }} empty={<div className="py-10 text-center text-sm text-muted">Закупок у этого поставщика ещё не было</div>} />}
      {tab === 'items' && <DataTable cols={ic} rows={data.items} rowKey={(r) => r.id} csvName="supplier-items" initialSort={{ key: 't', dir: 'desc' }} empty={<div className="py-10 text-center text-sm text-muted">Принятого товара нет</div>} />}
      {tab === 'payments' && (
        <div className="card divide-y divide-line/70">
          {data.payments.map((p) => <div key={p.id} className="flex items-center gap-4 px-4 py-2.5 text-[13.5px]"><span className="w-24 text-muted">{fmtDate(p.date)}</span><b className="tnum w-32">{money(p.amount)}</b><span className="text-muted">{p.method ?? '—'} · по закупке №{p.purchase}</span></div>)}
          {!data.payments.length && <div className="py-10 text-center text-sm text-muted">Оплат ещё не было. Оплату вносят в разделе «Закупки и долги».</div>}
        </div>
      )}
      {tab === 'files' && <Attachments entity="supplier" entityId={s.id} canEdit={can('files') && edit_} title="Договоры, счета, сертификаты" />}
      <div className="mt-5 flex flex-wrap items-center gap-2 text-[13px] text-muted no-print">
        Акт сверки за период:
        <input type="date" className="input !h-8 !w-[140px] !px-2 text-[13px]" value={rf} onChange={(e) => setRecon({ from: e.target.value, to: rt })} />—
        <input type="date" className="input !h-8 !w-[140px] !px-2 text-[13px]" value={rt} onChange={(e) => setRecon({ from: rf, to: e.target.value })} />
      </div>
      {edit && <SupplierModal s={s} onClose={() => setEdit(false)} onSaved={() => { setEdit(false); void reload(); }} />}
    </>
  );
}
