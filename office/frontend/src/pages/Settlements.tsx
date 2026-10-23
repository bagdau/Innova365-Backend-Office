import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CheckCheck, FilePlus2, Printer, RefreshCw, Send, Trash2 } from 'lucide-react';
import { del, get, patch, post, qs } from '../api';
import { useAuth } from '../auth';
import { addDays, fmtDate, fmtDateTime, money, num, pct, todayIn } from '../format';
import { Badge, Col, DataTable, ErrorBox, Field, Loading, Modal, PageHeader, StatCard, useFetch, useUi } from '../ui';

export interface Settlement { id: string; number: number; outletId: string; outletName: string; periodFrom: string; periodTo: string; orders: number; revenue: number; commissionPct: number; commission: number; rent: number; payable: number; status: 'draft' | 'issued' | 'paid'; issuedAt: string | null; paidAt: string | null; paidMethod: string | null; notes: string | null }
interface Detail extends Settlement { outlet: { name: string; legalName: string | null; bin: string | null; contact: string | null; phone: string | null; email: string | null }; lines: { nombre: string; qty: number; revenue: number }[] }
interface Outlet { id: string; name: string }

export const ST: Record<string, [string, 'muted' | 'info' | 'good']> = { draft: ['Черновик', 'muted'], issued: ['Выставлен', 'info'], paid: ['Выплачен', 'good'] };

export default function Settlements() {
  const { id } = useParams();
  const nav = useNavigate();
  const { can } = useAuth();
  const [status, setStatus] = useState('');
  const [outletId, setOutletId] = useState('');
  const [gen, setGen] = useState(false);
  const { data, error, reload } = useFetch(() => get<Settlement[]>('/fc/settlements' + qs({ status, outletId })), [status, outletId]);
  const { data: outlets } = useFetch(() => get<{ outlets: Outlet[] }>('/fc/outlets'), []);
  if (error && !data) return <ErrorBox error={error} onRetry={reload} />;
  if (!data || !outlets) return <Loading />;

  const cols: Col<Settlement>[] = [
    { key: 'n', header: '№', render: (s) => <b>{s.number}</b>, sort: (s) => s.number, csv: (s) => s.number },
    { key: 'o', header: 'Точка', render: (s) => s.outletName, sort: (s) => s.outletName, csv: (s) => s.outletName },
    { key: 'p', header: 'Период', render: (s) => `${fmtDate(s.periodFrom)} — ${fmtDate(s.periodTo)}`, sort: (s) => s.periodFrom, csv: (s) => `${s.periodFrom}..${s.periodTo}`, hideOnMobile: true },
    { key: 'r', header: 'Выручка', align: 'right', render: (s) => money(s.revenue), sort: (s) => s.revenue, csv: (s) => s.revenue, hideOnMobile: true },
    { key: 'pay', header: 'К выплате', align: 'right', render: (s) => <b className={s.payable < 0 ? 'text-bad' : ''}>{money(s.payable)}</b>, sort: (s) => s.payable, csv: (s) => s.payable },
    { key: 'st', header: 'Статус', render: (s) => <Badge tone={ST[s.status][1]}>{ST[s.status][0]}</Badge>, csv: (s) => s.status },
  ];
  const toPay = data.filter((s) => s.status === 'issued').reduce((a, s) => a + s.payable, 0);
  return (
    <>
      <PageHeader title="Взаиморасчёты с точками" subtitle="Акт за период: выручка точки, комиссия фудкорта, аренда и сумма к выплате"
        actions={can('fc.settle') && <button className="btn btn-primary" onClick={() => setGen(true)}><FilePlus2 size={15} /> Сформировать расчёт</button>} />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select className="input !h-8 !w-auto text-[13px]" value={outletId} onChange={(e) => setOutletId(e.target.value)}><option value="">Все точки</option>{outlets.outlets.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select>
        <select className="input !h-8 !w-auto text-[13px]" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Любой статус</option><option value="draft">Черновики</option><option value="issued">Выставленные</option><option value="paid">Выплаченные</option></select>
      </div>
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <StatCard label="Расчётов" value={num(data.length)} />
        <StatCard label="Выставлено, ожидает выплаты" value={money(toPay)} tone={toPay ? 'warn' : undefined} />
        <StatCard label="Выплачено" value={money(data.filter((s) => s.status === 'paid').reduce((a, s) => a + s.payable, 0))} tone="good" />
      </div>
      <DataTable cols={cols} rows={data} rowKey={(s) => s.id} onRowClick={(s) => nav('/foodcourt/settlements/' + s.id)} csvName="settlements" empty={<div className="py-12 text-center text-sm text-muted">Расчётов пока нет. Нажмите «Сформировать расчёт».</div>} />
      {id && <DetailModal id={id} onClose={() => nav('/foodcourt/settlements')} onChanged={() => void reload()} />}
      {gen && <GenerateModal outlets={outlets.outlets} onClose={() => setGen(false)} onCreated={(sid) => { setGen(false); void reload(); nav('/foodcourt/settlements/' + sid); }} />}
    </>
  );
}

function GenerateModal({ outlets, onClose, onCreated }: { outlets: Outlet[]; onClose: () => void; onCreated: (id: string) => void }) {
  const { me } = useAuth();
  const { toast } = useUi();
  const t = todayIn(me!.settings.timezone);
  const prevEnd = addDays(t.slice(0, 8) + '01', -1);
  const [f, setF] = useState({ outletId: outlets[0]?.id ?? '', from: prevEnd.slice(0, 8) + '01', to: prevEnd });
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true);
    try { const r = await post<{ id: string }>('/fc/settlements/generate', f); toast('ok', 'Расчёт сформирован'); onCreated(r.id); } catch (e) { toast('err', (e as Error).message); } finally { setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title="Новый расчёт с точкой" width={480} footer={<><button className="btn btn-soft" onClick={onClose}>Отмена</button><button className="btn btn-primary" disabled={busy || !f.outletId} onClick={() => void go()}>Сформировать</button></>}>
      <div className="space-y-3">
        <Field label="Точка"><select className="input" value={f.outletId} onChange={(e) => setF({ ...f, outletId: e.target.value })}>{outlets.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></Field>
        <div className="grid grid-cols-2 gap-3"><Field label="С"><input type="date" className="input" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></Field><Field label="По"><input type="date" className="input" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></Field></div>
        <p className="text-xs text-muted">По умолчанию — прошлый месяц. Периоды расчётов одной точки не могут пересекаться.</p>
      </div>
    </Modal>
  );
}

function DetailModal({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const { can } = useAuth();
  const { toast, confirm } = useUi();
  const [method, setMethod] = useState('Перевод');
  const { data, error, reload } = useFetch(() => get<Detail>('/fc/settlements/' + id), [id]);
  const run = async (fn: () => Promise<unknown>, ok: string, close = false) => {
    try { await fn(); toast('ok', ok); onChanged(); if (close) onClose(); else await reload(); } catch (e) { toast('err', (e as Error).message); }
  };
  if (error) return <Modal open onClose={onClose} title="Расчёт"><ErrorBox error={error} /></Modal>;
  if (!data) return <Modal open onClose={onClose} title="Расчёт"><Loading /></Modal>;
  const settle = can('fc.settle');
  return (
    <Modal open onClose={onClose} title={`Расчёт №${data.number} · ${data.outletName}`} width={680}
      footer={<>
        <a className="btn btn-soft" href={`/print/settlement/${data.id}`} target="_blank" rel="noreferrer"><Printer size={15} /> Печать акта</a>
        {settle && data.status !== 'draft' && (data.rent > 0 || data.commission > 0) && <button className="btn btn-soft" onClick={() => void run(() => post(`/fc/invoices/from-settlement/${id}`), 'Акт оказанных услуг создан — он в «Счета и акты»')}>Создать акт услуг</button>}
        {settle && data.status === 'draft' && <><button className="btn btn-danger" onClick={async () => { if (await confirm({ title: 'Удалить черновик?', danger: true, confirmLabel: 'Удалить' })) void run(() => del('/fc/settlements/' + id), 'Удалено', true); }}><Trash2 size={15} /></button>
          <button className="btn btn-soft" onClick={() => void run(() => post(`/fc/settlements/${id}/recalc`), 'Пересчитано')}><RefreshCw size={15} /> Пересчитать</button>
          <button className="btn btn-primary" onClick={async () => { if (await confirm({ title: 'Выставить расчёт?', text: 'После выставления суммы фиксируются и больше не пересчитываются.', confirmLabel: 'Выставить' })) void run(() => patch('/fc/settlements/' + id, { status: 'issued' }), 'Расчёт выставлен'); }}><Send size={15} /> Выставить</button></>}
        {settle && data.status === 'issued' && <button className="btn btn-good" onClick={() => void run(() => patch('/fc/settlements/' + id, { status: 'paid', paidMethod: method }), 'Выплата отмечена')}><CheckCheck size={15} /> Отметить выплаченным</button>}
      </>}>
      <div className="mb-4 flex flex-wrap items-center gap-2"><Badge tone={ST[data.status][1]}>{ST[data.status][0]}</Badge><span className="text-sm text-muted">{fmtDate(data.periodFrom)} — {fmtDate(data.periodTo)}</span>
        {data.issuedAt && <span className="text-xs text-muted">· выставлен {fmtDateTime(data.issuedAt)}</span>}{data.paidAt && <span className="text-xs text-muted">· выплачен {fmtDateTime(data.paidAt)} ({data.paidMethod})</span>}</div>
      <dl className="mb-5 space-y-2 rounded-xl border border-line p-4 text-[14px]">
        <Line k={`Выручка точки (${num(data.orders)} заказов)`} v={money(data.revenue)} />
        <Line k={`Комиссия фудкорта ${pct(data.commissionPct)}`} v={'− ' + money(data.commission)} />
        <Line k="Аренда за период" v={'− ' + money(data.rent)} />
        <div className="flex justify-between border-t border-line pt-2 text-[15px] font-semibold"><dt>К выплате точке</dt><dd className={`tnum ${data.payable < 0 ? 'text-bad' : ''}`}>{money(data.payable)}</dd></div>
        {data.payable < 0 && <p className="text-xs text-bad">Отрицательная сумма: точка должна фудкорту.</p>}
      </dl>
      {settle && data.status === 'issued' && <Field label="Способ выплаты" className="mb-4"><select className="input !w-auto" value={method} onChange={(e) => setMethod(e.target.value)}><option>Перевод</option><option>Наличные</option><option>Зачёт</option></select></Field>}
      <h4 className="mb-2 text-sm font-semibold">Выручка по категориям</h4>
      <div className="overflow-hidden rounded-lg border border-line"><table className="w-full text-[13px]"><tbody>
        {data.lines.map((l) => <tr key={l.nombre}><td className="td">{l.nombre}</td><td className="td tnum text-right text-muted">{num(l.qty)} шт</td><td className="td tnum text-right">{money(l.revenue)}</td></tr>)}
        {!data.lines.length && <tr><td className="td text-center text-muted">Нет продаж за период</td></tr>}
      </tbody></table></div>
    </Modal>
  );
}
const Line = ({ k, v }: { k: string; v: string }) => <div className="flex justify-between gap-3"><dt className="text-muted">{k}</dt><dd className="tnum">{v}</dd></div>;
