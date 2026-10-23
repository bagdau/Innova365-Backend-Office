import { useState } from 'react';
import { Trash2, Truck } from 'lucide-react';
import { del, get, post } from '../api';
import { useAuth } from '../auth';
import { fmtDate, money, num, todayIn } from '../format';
import { Attachments } from '../Attachments';
import { Badge, Col, DataTable, ErrorBox, Field, Loading, Modal, PageHeader, StatCard, Toggle, useFetch, useUi } from '../ui';

interface P { id: string; numero: number; estado: string; created: string; supplier: string; total: number; received: number; paid: number; debt: number; overpaid: number }
interface Resp { rows: P[]; totalDebt: number; bySupplier: { supplier: string; debt: number }[] }
interface Detail extends P { items: { id: string; nombre: string; unidad: string; cantidad: number; recibida: number; costo: number; sum: number }[]; payments: { id: string; date: string; amount: number; method: string | null; note: string | null; createdBy: string }[] }

const ESTADO: Record<string, [string, 'muted' | 'info' | 'good']> = { PEDIDA: ['Заказана', 'muted'], PARCIAL: ['Принята частично', 'info'], RECIBIDA: ['Принята', 'good'] };

export default function Purchases() {
  const [onlyDebt, setOnlyDebt] = useState(true);
  const [open, setOpen] = useState<string | null>(null);
  const { data, error, reload } = useFetch(() => get<Resp>('/acc/purchases' + (onlyDebt ? '?debt=1' : '')), [onlyDebt]);
  if (error && !data) return <ErrorBox error={error} onRetry={reload} />;
  if (!data) return <Loading />;
  const cols: Col<P>[] = [
    { key: 'n', header: '№', render: (p) => <b>#{p.numero}</b>, sort: (p) => p.numero, csv: (p) => p.numero },
    { key: 'date', header: 'Дата', render: (p) => fmtDate(p.created), sort: (p) => p.created, csv: (p) => p.created, hideOnMobile: true },
    { key: 'sup', header: 'Поставщик', render: (p) => p.supplier, sort: (p) => p.supplier, csv: (p) => p.supplier },
    { key: 'st', header: 'Статус', render: (p) => <Badge tone={ESTADO[p.estado]?.[1] ?? 'muted'}>{ESTADO[p.estado]?.[0] ?? p.estado}</Badge>, hideOnMobile: true, csv: (p) => p.estado },
    { key: 'total', header: 'Заказано', align: 'right', render: (p) => money(p.total), csv: (p) => p.total, hideOnMobile: true },
    { key: 'rec', header: 'Принято', align: 'right', render: (p) => money(p.received), csv: (p) => p.received },
    { key: 'paid', header: 'Оплачено', align: 'right', render: (p) => money(p.paid), csv: (p) => p.paid },
    { key: 'debt', header: 'Долг', align: 'right', render: (p) => (p.debt > 0 ? <b className="text-bad">{money(p.debt)}</b> : <span className="text-good">—</span>), sort: (p) => p.debt, csv: (p) => p.debt },
  ];
  return (
    <>
      <PageHeader title="Закупки и долги" subtitle="Долг поставщику = стоимость принятого на склад товара − оплаты" actions={<Toggle checked={onlyDebt} onChange={setOnlyDebt} label="Только с долгом" />} />
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <StatCard label="Общий долг поставщикам" value={money(data.totalDebt)} tone={data.totalDebt ? 'bad' : 'good'} icon={<Truck size={16} />} />
        <StatCard label="Поставщиков с долгом" value={num(data.bySupplier.length)} />
        <StatCard label="Наибольший долг" value={data.bySupplier[0] ? money(data.bySupplier[0].debt) : '—'} sub={data.bySupplier[0]?.supplier} />
      </div>
      <DataTable cols={cols} rows={data.rows} rowKey={(p) => p.id} onRowClick={(p) => setOpen(p.id)} csvName="purchases" initialSort={{ key: 'debt', dir: 'desc' }}
        empty={<div className="py-12 text-center text-sm text-muted">{onlyDebt ? 'Долгов перед поставщиками нет 🎉' : 'Закупок пока нет'}</div>} />
      {open && <PurchaseModal id={open} onClose={() => setOpen(null)} onChanged={() => void reload()} />}
    </>
  );
}

function PurchaseModal({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const { me, can } = useAuth();
  const { toast, confirm } = useUi();
  const { data, reload } = useFetch(() => get<Detail>('/acc/purchases/' + id), [id]);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('Перевод');
  const [date, setDate] = useState(() => todayIn(me!.settings.timezone));
  const [busy, setBusy] = useState(false);
  if (!data) return <Modal open onClose={onClose} title="Закупка"><Loading /></Modal>;
  const pay = async () => {
    setBusy(true);
    try { await post(`/acc/purchases/${id}/payments`, { date, amount: Number(amount.replace(',', '.')), method }); toast('ok', 'Оплата внесена'); setAmount(''); await reload(); onChanged(); }
    catch (e) { toast('err', (e as Error).message); } finally { setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title={`Закупка №${data.numero} · ${data.supplier}`} width={680} footer={<button className="btn btn-primary" onClick={onClose}>Закрыть</button>}>
      <div className="mb-4 grid grid-cols-3 gap-2 text-center"><Cell k="Принято" v={money(data.received)} /><Cell k="Оплачено" v={money(data.paid)} /><Cell k="Долг" v={money(data.debt)} bad={data.debt > 0} /></div>
      <h4 className="mb-2 text-sm font-semibold">Состав</h4>
      <div className="mb-5 overflow-x-auto rounded-lg border border-line"><table className="w-full text-[13px]"><thead><tr><th className="th">Товар</th><th className="th text-right">Заказано</th><th className="th text-right">Принято</th><th className="th text-right">Цена</th></tr></thead>
        <tbody>{data.items.map((i) => <tr key={i.id}><td className="td">{i.nombre}</td><td className="td tnum text-right">{num(i.cantidad, 3)} {i.unidad}</td><td className="td tnum text-right">{num(i.recibida, 3)} {i.unidad}</td><td className="td tnum text-right">{money(i.costo)}</td></tr>)}</tbody></table></div>
      <h4 className="mb-2 text-sm font-semibold">Оплаты</h4>
      {data.payments.length ? <ul className="mb-4 divide-y divide-line/70 rounded-lg border border-line">{data.payments.map((p) => (
        <li key={p.id} className="flex items-center gap-3 px-3 py-2 text-[13px]"><span className="text-muted">{fmtDate(p.date)}</span><span className="tnum font-medium">{money(p.amount)}</span><span className="text-muted">{p.method}</span><span className="ml-auto text-[11px] text-muted">{p.createdBy}</span>
          {can('acc.write') && <button className="btn btn-ghost btn-sm !px-1.5 hover:!text-bad" onClick={async () => {
            if (!(await confirm({ title: 'Удалить оплату?', text: money(p.amount), danger: true, confirmLabel: 'Удалить' }))) return;
            try { await del('/acc/payments/' + p.id); toast('ok', 'Оплата удалена'); await reload(); onChanged(); } catch (e) { toast('err', (e as Error).message); }
          }}><Trash2 size={13} /></button>}</li>))}</ul> : <p className="mb-4 text-sm text-muted">Оплат пока нет.</p>}
      {can('acc.write') && data.debt > 0 && (
        <div className="rounded-xl border border-line bg-surface2/60 p-3"><div className="mb-2 text-sm font-medium">Внести оплату</div>
          <div className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
            <Field label="Дата"><input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
            <Field label="Сумма"><input className="input tnum" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={String(data.debt)} /></Field>
            <Field label="Способ"><select className="input" value={method} onChange={(e) => setMethod(e.target.value)}><option>Перевод</option><option>Наличные</option><option>Карта</option></select></Field>
            <div className="flex items-end gap-2"><button className="btn btn-soft" onClick={() => setAmount(String(data.debt))}>Весь долг</button><button className="btn btn-primary" disabled={busy || !amount} onClick={() => void pay()}>Оплатить</button></div>
          </div></div>
      )}
      <div className="mt-4"><Attachments entity="purchase" entityId={id} canEdit={can('acc.write') && can('files')} title="Накладные и сканы" /></div>
    </Modal>
  );
}
const Cell = ({ k, v, bad }: { k: string; v: string; bad?: boolean }) => <div className="rounded-lg bg-surface2 p-3"><div className={`tnum text-lg font-semibold ${bad ? 'text-bad' : ''}`}>{v}</div><div className="text-[11px] text-muted">{k}</div></div>;
