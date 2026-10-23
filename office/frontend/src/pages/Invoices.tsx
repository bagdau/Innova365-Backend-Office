import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Ban, CalendarClock, CheckCircle2, FilePlus2, Plus, Printer, Send, Trash2 } from 'lucide-react';
import { del, get, post, put } from '../api';
import { Attachments } from '../Attachments';
import { useAuth } from '../auth';
import { fmtDate, money, num, todayIn } from '../format';
import { Badge, Col, DataTable, ErrorBox, Field, Loading, Modal, PageHeader, StatCard, useFetch, useUi } from '../ui';
import { Chips, MonthPicker, parseNum } from '../ui2';

type State = 'draft' | 'issued' | 'partial' | 'paid' | 'overdue' | 'cancelled';
interface Row { id: string; number: number; kind: 'invoice' | 'act'; outletId: string; outletName: string; date: string; dueDate: string | null; periodFrom: string | null; periodTo: string | null; title: string | null; status: string; state: State; stateLabel: string; total: number; paid: number; remaining: number; settlementId: string | null; note: string | null }
interface Resp { rows: Row[]; totals: { open: number; overdue: number; overdueCount: number } }
export interface Detail extends Row {
  lines: { description: string; qty: number; price: number; amount: number }[]; payments: { id: string; date: string; amount: number; method: string | null; note: string | null; who: string | null }[];
  outlet: { name: string; legalName: string | null; bin: string | null; contact: string | null; phone: string | null; email: string | null }; company: { name: string; bin: string; address: string; signer: string };
}
export const TONE: Record<State, 'muted' | 'info' | 'warn' | 'good' | 'bad'> = { draft: 'muted', issued: 'info', partial: 'warn', paid: 'good', overdue: 'bad', cancelled: 'muted' };
const KIND = { invoice: 'Счёт на оплату', act: 'Акт оказанных услуг' };
const METHODS = ['Перевод', 'Наличные', 'Карта', 'Зачёт в расчёте'];

/** Счета и акты арендаторам: создание, оплаты, просрочка, печать. */
export default function Invoices() {
  const { me, can } = useAuth();
  const { toast } = useUi();
  const { data, error, reload } = useFetch(() => get<Resp>('/fc/invoices'), []);
  const { data: outlets } = useFetch(() => get<{ outlets: { id: string; name: string }[] }>('/fc/outlets'), [], { live: false });
  const [open, setOpen] = useState<string | 'new' | null>(null);
  const [view, setView] = useState<'all' | 'open' | 'overdue' | 'paid'>('all');
  const [rent, setRent] = useState(false);
  if (error && !data) return <ErrorBox error={error} onRetry={reload} />;
  if (!data || !outlets) return <Loading />;
  const rows = data.rows.filter((r) => view === 'all' || (view === 'open' ? ['issued', 'partial', 'overdue'].includes(r.state) : view === 'overdue' ? r.state === 'overdue' : r.state === 'paid'));
  const cols: Col<Row>[] = [
    { key: 'n', header: '№', render: (r) => <div><b>{r.number}</b><div className="text-[11px] text-muted">{r.kind === 'act' ? 'акт' : 'счёт'}</div></div>, sort: (r) => r.number, csv: (r) => r.number, width: 70 },
    { key: 'o', header: 'Арендатор', render: (r) => <div><div className="font-medium">{r.outletName}</div><div className="text-xs text-muted">{r.title ?? KIND[r.kind]}</div></div>, sort: (r) => r.outletName, csv: (r) => r.outletName },
    { key: 'd', header: 'Дата', render: (r) => fmtDate(r.date), sort: (r) => r.date, hideOnMobile: true, csv: (r) => r.date },
    { key: 'du', header: 'Срок оплаты', render: (r) => (r.dueDate ? <span className={r.state === 'overdue' ? 'font-semibold text-bad' : ''}>{fmtDate(r.dueDate)}</span> : '—'), sort: (r) => r.dueDate, hideOnMobile: true, csv: (r) => r.dueDate },
    { key: 's', header: 'Статус', render: (r) => <Badge tone={TONE[r.state]}>{r.stateLabel}</Badge>, csv: (r) => r.stateLabel },
    { key: 't', header: 'Сумма', align: 'right', render: (r) => <b>{money(r.total)}</b>, sort: (r) => r.total, csv: (r) => r.total },
    { key: 'r', header: 'Остаток', align: 'right', render: (r) => (r.remaining > 0 && r.state !== 'draft' ? <span className={r.state === 'overdue' ? 'font-semibold text-bad' : 'text-warn'}>{money(r.remaining)}</span> : <span className="text-muted">—</span>), sort: (r) => r.remaining, csv: (r) => r.remaining },
  ];
  return (
    <>
      <PageHeader title="Счета и акты арендаторам" subtitle="Счета на оплату аренды и услуг, акты по взаиморасчётам. Оплаты закрывают счёт, просрочка подсвечивается и попадает в напоминания"
        actions={can('fc.settle') && <><button className="btn btn-soft" onClick={() => setRent(true)}><CalendarClock size={15} /> Счета на аренду за месяц</button><button className="btn btn-primary" onClick={() => setOpen('new')}><Plus size={15} /> Новый документ</button></>} />
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <StatCard label="К получению" value={money(data.totals.open)} icon={<CheckCircle2 size={16} />} sub="по выставленным документам" />
        <StatCard label="Просрочено" value={money(data.totals.overdue)} tone={data.totals.overdue ? 'bad' : undefined} sub={`${data.totals.overdueCount} документов`} />
        <StatCard label="Документов" value={num(data.rows.length)} />
      </div>
      <div className="mb-4"><Chips value={view} onChange={setView} options={[{ id: 'all', label: 'Все' }, { id: 'open', label: 'Не оплачены', count: data.rows.filter((r) => ['issued', 'partial', 'overdue'].includes(r.state)).length }, { id: 'overdue', label: 'Просрочены', count: data.totals.overdueCount }, { id: 'paid', label: 'Оплачены' }]} /></div>
      <DataTable cols={cols} rows={rows} rowKey={(r) => r.id} csvName="invoices" onRowClick={(r) => setOpen(r.id)} initialSort={{ key: 'd', dir: 'desc' }} empty={<div className="py-12 text-center text-sm text-muted">Документов нет. Создайте счёт или акт — арендатор увидит его в своём кабинете.</div>} />
      {open && <InvoiceModal id={open === 'new' ? null : open} outlets={outlets.outlets} tz={me!.settings.timezone} onClose={() => setOpen(null)} onChanged={() => void reload()} />}
      {rent && <RentModal onClose={() => setRent(false)} onDone={(n) => { setRent(false); toast('ok', n ? `Создано счетов на аренду: ${n}` : 'Новых счетов нет — всё уже создано или аренда не задана'); void reload(); }} />}
    </>
  );
}

function RentModal({ onClose, onDone }: { onClose: () => void; onDone: (created: number) => void }) {
  const { me } = useAuth();
  const { toast } = useUi();
  const [month, setMonth] = useState(() => todayIn(me!.settings.timezone).slice(0, 7));
  const [issue, setIssue] = useState(false);
  const go = async () => { try { const r = await post<{ created: number }>('/fc/invoices/rent', { month, issue }); onDone(r.created); } catch (e) { toast('err', (e as Error).message); } };
  return (
    <Modal open onClose={onClose} title="Счета на аренду за месяц" width={460} footer={<><button className="btn btn-soft" onClick={onClose}>Отмена</button><button className="btn btn-primary" onClick={() => void go()}>Создать</button></>}>
      <Field label="Месяц"><MonthPicker value={month} onChange={setMonth} /></Field>
      <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-[rgb(var(--brand))]" checked={issue} onChange={(e) => setIssue(e.target.checked)} /> Сразу выставить (иначе — черновики для проверки)</label>
      <p className="mt-3 text-xs leading-relaxed text-muted">Для каждой действующей точки создаётся счёт на аренду по ставке (с учётом индексации и неполного месяца). Срок оплаты — день из договора (по умолчанию 10-е). Повторный запуск дубликатов не создаёт.</p>
    </Modal>
  );
}

function InvoiceModal({ id, outlets, tz, onClose, onChanged }: { id: string | null; outlets: { id: string; name: string }[]; tz: string; onClose: () => void; onChanged: () => void }) {
  const { can } = useAuth();
  const { toast, confirm } = useUi();
  const { data: d, reload } = useFetch(() => (id ? get<Detail>('/fc/invoices/' + id) : Promise.resolve(null)), [id], { live: false });
  const today = todayIn(tz);
  const [f, setF] = useState<null | { kind: 'invoice' | 'act'; outletId: string; date: string; dueDate: string; title: string; note: string; lines: { description: string; qty: string; price: string }[] }>(null);
  const [busy, setBusy] = useState(false);
  const [pay, setPay] = useState({ date: today, amount: '', method: 'Перевод' });
  if (id && !d) return <Modal open onClose={onClose} title="Документ"><Loading /></Modal>;
  const draft = !d || d.status === 'draft';
  const write = can('fc.settle');
  const form = f ?? { kind: d?.kind ?? 'invoice', outletId: d?.outletId ?? outlets[0]?.id ?? '', date: d?.date ?? today, dueDate: d?.dueDate ?? '', title: d?.title ?? '', note: d?.note ?? '', lines: d ? d.lines.map((l) => ({ description: l.description, qty: String(l.qty), price: String(l.price) })) : [{ description: '', qty: '1', price: '' }] };
  const patchF = (p: Partial<typeof form>) => setF({ ...form, ...p });
  const lines = form.lines.map((l) => ({ description: l.description, qty: parseNum(l.qty) || 0, price: parseNum(l.price) || 0 }));
  const total = lines.reduce((s, l) => s + Math.round(l.qty * l.price * 100) / 100, 0);
  const valid = lines.length > 0 && lines.every((l) => l.description.trim() && l.qty > 0 && l.price >= 0);
  const act = async (fn: () => Promise<unknown>, ok: string, close = false) => { try { await fn(); toast('ok', ok); onChanged(); if (close) onClose(); else await reload(); } catch (e) { toast('err', (e as Error).message); } };
  const body = () => ({ kind: form.kind, outletId: form.outletId, date: form.date, dueDate: form.dueDate || null, title: form.title || null, note: form.note || null, lines });

  return (
    <Modal open onClose={onClose} title={d ? `${KIND[d.kind]} №${d.number}` : 'Новый документ'} width={760}
      footer={d && !draft ? (
        <>{write && d.status === 'issued' && d.paid === 0 && <button className="btn btn-ghost mr-auto" onClick={() => void act(() => post(`/fc/invoices/${id}/cancel`), 'Документ отменён')}><Ban size={15} /> Отменить</button>}
          {write && d.status === 'cancelled' && <button className="btn btn-ghost mr-auto hover:!text-bad" onClick={() => void act(() => del('/fc/invoices/' + id), 'Удалено', true)}><Trash2 size={15} /></button>}
          <Link className="btn btn-soft" target="_blank" to={`/print/invoice/${d.id}`}><Printer size={15} /> Печать</Link><button className="btn btn-primary" onClick={onClose}>Закрыть</button></>
      ) : (
        <>{id && write && <button className="btn btn-ghost mr-auto hover:!text-bad" onClick={() => void act(() => del('/fc/invoices/' + id), 'Черновик удалён', true)}><Trash2 size={15} /></button>}
          <button className="btn btn-soft" onClick={onClose}>Закрыть</button>
          {write && <button className="btn btn-soft" disabled={busy || !valid || !form.outletId} onClick={() => void (async () => { setBusy(true); await act(() => (id ? put('/fc/invoices/' + id, body()) : post('/fc/invoices', body())), 'Сохранено', true); setBusy(false); })()}>Сохранить черновик</button>}
          {write && <button className="btn btn-primary" disabled={busy || !valid || !form.outletId} onClick={() => void (async () => { setBusy(true); try { if (id) { await put('/fc/invoices/' + id, body()); await post(`/fc/invoices/${id}/issue`); } else await post('/fc/invoices', { ...body(), issue: true }); toast('ok', 'Документ выставлен'); onChanged(); onClose(); } catch (e) { toast('err', (e as Error).message); } setBusy(false); })()}><Send size={15} /> Выставить</button>}</>)}>
      {d && !draft ? (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-4">
            <div className="rounded-lg bg-surface2 p-3"><div className="text-xs text-muted">Арендатор</div><div className="font-medium">{d.outletName}</div></div>
            <div className="rounded-lg bg-surface2 p-3"><div className="text-xs text-muted">Статус</div><Badge tone={TONE[d.state]}>{d.stateLabel}</Badge></div>
            <div className="rounded-lg bg-surface2 p-3"><div className="text-xs text-muted">Сумма</div><div className="tnum font-semibold">{money(d.total)}</div></div>
            <div className="rounded-lg bg-surface2 p-3"><div className="text-xs text-muted">Остаток</div><div className={`tnum font-semibold ${d.remaining ? 'text-warn' : 'text-good'}`}>{money(d.remaining)}</div></div>
          </div>
          <div className="mb-4 overflow-hidden rounded-lg border border-line"><table className="w-full text-[13px]"><thead><tr><th className="th">Наименование</th><th className="th text-right">Кол-во</th><th className="th text-right">Цена</th><th className="th text-right">Сумма</th></tr></thead>
            <tbody>{d.lines.map((l, i) => <tr key={i}><td className="td">{l.description}</td><td className="td tnum text-right">{l.qty}</td><td className="td tnum text-right">{money(l.price)}</td><td className="td tnum text-right font-medium">{money(l.amount)}</td></tr>)}</tbody></table></div>
          <p className="mb-3 text-xs text-muted">Дата {fmtDate(d.date)}{d.dueDate ? ` · оплатить до ${fmtDate(d.dueDate)}` : ''}{d.periodFrom ? ` · период ${fmtDate(d.periodFrom)} — ${fmtDate(d.periodTo)}` : ''}</p>
          <h4 className="mb-2 text-sm font-semibold">Оплаты</h4>
          {d.payments.length ? <ul className="mb-3 divide-y divide-line/70 rounded-lg border border-line">{d.payments.map((p) => (
            <li key={p.id} className="flex items-center gap-3 px-3 py-2 text-[13px]"><span className="text-muted">{fmtDate(p.date)}</span><b className="tnum">{money(p.amount)}</b><span className="min-w-0 flex-1 truncate text-muted">{p.method ?? ''} {p.who ? `· ${p.who}` : ''}</span>
              {write && <button className="btn btn-ghost btn-sm !px-1.5 hover:!text-bad" onClick={async () => { if (await confirm({ title: 'Удалить оплату?', text: money(p.amount), danger: true, confirmLabel: 'Удалить' })) void act(() => del('/fc/invoices/payments/' + p.id), 'Оплата удалена'); }}><Trash2 size={13} /></button>}</li>))}</ul> : <p className="mb-3 text-sm text-muted">Оплат пока нет.</p>}
          {write && d.status === 'issued' && d.remaining > 0 && (
            <div className="rounded-xl border border-line bg-surface2/60 p-3"><div className="mb-2 text-sm font-medium">Внести оплату</div>
              <div className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
                <Field label="Дата"><input type="date" className="input" value={pay.date} onChange={(e) => setPay({ ...pay, date: e.target.value })} /></Field>
                <Field label="Сумма"><input className="input tnum" inputMode="decimal" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} placeholder={String(d.remaining)} /></Field>
                <Field label="Способ"><select className="input" value={pay.method} onChange={(e) => setPay({ ...pay, method: e.target.value })}>{METHODS.map((m) => <option key={m}>{m}</option>)}</select></Field>
                <div className="flex items-end gap-2"><button className="btn btn-soft" onClick={() => setPay({ ...pay, amount: String(d.remaining) })}>Весь остаток</button><button className="btn btn-primary" disabled={!(parseNum(pay.amount) > 0)} onClick={() => void act(() => post(`/fc/invoices/${id}/payments`, { date: pay.date, amount: parseNum(pay.amount), method: pay.method }).then(() => setPay({ ...pay, amount: '' })), 'Оплата внесена')}>Внести</button></div>
              </div></div>
          )}
          <div className="mt-4"><Attachments entity="invoice" entityId={d.id} canEdit={can('files') && write} title="Подписанные копии" /></div>
        </>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Вид документа"><select className="input" disabled={!!id} value={form.kind} onChange={(e) => patchF({ kind: e.target.value as 'invoice' | 'act' })}><option value="invoice">Счёт на оплату</option><option value="act">Акт оказанных услуг</option></select></Field>
            <Field label="Арендатор" className="sm:col-span-2"><select className="input" disabled={!!id} value={form.outletId} onChange={(e) => patchF({ outletId: e.target.value })}>{outlets.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></Field>
            <Field label="Дата"><input type="date" className="input" value={form.date} onChange={(e) => patchF({ date: e.target.value })} /></Field>
            <Field label="Оплатить до"><input type="date" className="input" value={form.dueDate} onChange={(e) => patchF({ dueDate: e.target.value })} /></Field>
            <Field label="Название"><input className="input" value={form.title} onChange={(e) => patchF({ title: e.target.value })} placeholder="например: Коммунальные за октябрь" /></Field>
          </div>
          <h4 className="mb-2 mt-4 text-sm font-semibold">Позиции</h4>
          <div className="space-y-2">{form.lines.map((l, i) => (
            <div key={i} className="grid grid-cols-[1fr_80px_110px_auto] items-center gap-2">
              <input className="input" placeholder="Наименование" value={l.description} onChange={(e) => patchF({ lines: form.lines.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)) })} />
              <input className="input tnum text-right" inputMode="decimal" value={l.qty} onChange={(e) => patchF({ lines: form.lines.map((x, j) => (j === i ? { ...x, qty: e.target.value } : x)) })} />
              <input className="input tnum text-right" inputMode="decimal" placeholder="Цена" value={l.price} onChange={(e) => patchF({ lines: form.lines.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)) })} />
              {form.lines.length > 1 ? <button className="btn btn-ghost btn-sm !px-1.5 hover:!text-bad" onClick={() => patchF({ lines: form.lines.filter((_, j) => j !== i) })}><Trash2 size={15} /></button> : <span />}
            </div>))}</div>
          <div className="mt-3 flex items-center justify-between"><button className="btn btn-soft btn-sm" onClick={() => patchF({ lines: [...form.lines, { description: '', qty: '1', price: '' }] })}><FilePlus2 size={14} /> Добавить позицию</button><div className="text-sm">Итого: <b className="tnum text-base">{money(total)}</b></div></div>
          <Field label="Примечание" className="mt-3"><input className="input" value={form.note} onChange={(e) => patchF({ note: e.target.value })} /></Field>
        </>
      )}
    </Modal>
  );
}

/* ───────── Печать ───────── */
export function InvoicePrint({ tenant }: { tenant?: boolean }) {
  const { id } = useParams();
  const { me } = useAuth();
  const { data, error } = useFetch(() => get<Detail>(`${tenant ? '/tenant' : '/fc'}/invoices/${id}`), [id], { live: false });
  if (error) return <ErrorBox error={error} />;
  if (!data) return <Loading />;
  const th = 'border border-gray-400 p-1.5';
  const isAct = data.kind === 'act';
  return (
    <div className="min-h-full bg-slate-100 py-6 print:bg-white print:py-0">
      <div className="no-print mx-auto mb-4 flex max-w-[210mm] justify-end"><button className="btn btn-primary" onClick={() => window.print()}><Printer size={15} /> Печать / PDF</button></div>
      <article className="print-page mx-auto min-h-[297mm] max-w-[210mm] bg-white p-[16mm] text-[13px] leading-relaxed text-black shadow-lg">
        <header className="mb-6 text-center"><h1 className="text-[18px] font-bold uppercase tracking-wide">{isAct ? 'Акт оказанных услуг' : 'Счёт на оплату'} № {data.number}</h1><div>от {fmtDate(data.date)}{data.periodFrom ? ` · период ${fmtDate(data.periodFrom)} — ${fmtDate(data.periodTo)}` : ''}</div></header>
        <section className="mb-5 grid grid-cols-2 gap-6">
          <div><div className="text-[11px] uppercase text-gray-500">Исполнитель</div><div className="font-semibold">{data.company.name || me!.settings.company}</div>{data.company.bin && <div>БИН {data.company.bin}</div>}{data.company.address && <div>{data.company.address}</div>}</div>
          <div><div className="text-[11px] uppercase text-gray-500">{isAct ? 'Заказчик' : 'Плательщик'}</div><div className="font-semibold">{data.outlet.legalName || data.outlet.name}</div>{data.outlet.bin && <div>БИН/ИИН {data.outlet.bin}</div>}{data.outlet.contact && <div>{data.outlet.contact}{data.outlet.phone ? `, ${data.outlet.phone}` : ''}</div>}</div>
        </section>
        <table className="mb-5 w-full border-collapse text-[12.5px]">
          <thead><tr className="bg-gray-100"><th className={`${th} text-left`}>№</th><th className={`${th} text-left`}>Наименование</th><th className={`${th} text-right`}>Кол-во</th><th className={`${th} text-right`}>Цена</th><th className={`${th} text-right`}>Сумма</th></tr></thead>
          <tbody>{data.lines.map((l, i) => <tr key={i}><td className={th}>{i + 1}</td><td className={th}>{l.description}</td><td className={`${th} text-right`}>{l.qty}</td><td className={`${th} text-right`}>{money(l.price)}</td><td className={`${th} text-right`}>{money(l.amount)}</td></tr>)}</tbody>
          <tfoot><tr className="bg-gray-100 font-bold"><td className={th} colSpan={4}>Итого</td><td className={`${th} text-right`}>{money(data.total)}</td></tr></tfoot>
        </table>
        {!isAct && data.dueDate && <p className="mb-2">Срок оплаты: <b>{fmtDate(data.dueDate)}</b>.</p>}
        {data.paid > 0 && <p className="mb-2 text-[12px]">Оплачено: {money(data.paid)} · остаток к оплате: <b>{money(data.remaining)}</b>.</p>}
        {isAct && <p className="mt-4 text-[12.5px]">Вышеперечисленные услуги выполнены полностью и в срок. Заказчик претензий по объёму, качеству и срокам оказания услуг не имеет.</p>}
        {data.note && <p className="mt-2 text-[12px] text-gray-700">Примечание: {data.note}</p>}
        <section className="mt-16 grid grid-cols-2 gap-10 text-[12.5px]">
          <div><div className="mb-8">Исполнитель:</div><div className="border-t border-black pt-1">{data.company.signer || '_______________'} / подпись</div><div className="mt-3 text-gray-500">М.П.</div></div>
          <div><div className="mb-8">{isAct ? 'Заказчик' : 'Плательщик'}:</div><div className="border-t border-black pt-1">{data.outlet.contact || '_______________'} / подпись</div><div className="mt-3 text-gray-500">М.П.</div></div>
        </section>
        <footer className="mt-10 text-[10.5px] text-gray-500">Сформировано в Innova Office · {me!.name}</footer>
      </article>
    </div>
  );
}
