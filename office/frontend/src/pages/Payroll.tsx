import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, BadgeCheck, Calculator, Plus, Printer, RotateCcw, Save, Trash2, Wallet } from 'lucide-react';
import { del, get, post, put } from '../api';
import { Attachments } from '../Attachments';
import { useAuth } from '../auth';
import { fmtDate, money, todayIn } from '../format';
import { Badge, Col, DataTable, ErrorBox, Field, Loading, Modal, PageHeader, StatCard, Tabs, useFetch, useUi } from '../ui';
import { fmtQty, MonthPicker, monthLabel, parseNum } from '../ui2';

interface Item { id: string; period: string; status: 'draft' | 'approved' | 'paid'; paidDate: string | null; lines: number; gross: number; deduction: number; advance: number; net: number; employer: number }
interface Line { employeeId: string; name: string; position: string | null; payKind: string; payKindLabel: string; rate: number; workedDays: number; workedHours: number; base: number; bonus: number; penalty: number; gross: number; advance: number; deduction: number; net: number; note: string | null }
interface Detail { id: string; period: string; status: Item['status']; normDays: number; deductionPct: number; employerPct: number; note: string | null; paidDate: string | null; lines: Line[]; totals: { gross: number; deduction: number; advance: number; net: number; employer: number } }
interface Adv { id: string; date: string; amount: number; method: string | null; note: string | null; employee: string; employeeId: string }

export const PST = { draft: { label: 'Черновик', tone: 'warn' as const }, approved: { label: 'Утверждена', tone: 'info' as const }, paid: { label: 'Выплачена', tone: 'good' as const } };
const METHODS = ['Наличные', 'Перевод', 'Карта', 'Kaspi'];

/** Зарплата: ведомости по месяцам и авансы. */
export default function Payroll() {
  const { can } = useAuth();
  const nav = useNavigate();
  const [tab, setTab] = useState<'payrolls' | 'advances'>('payrolls');
  const { data, error, reload } = useFetch(() => get<Item[]>('/hr/payrolls'), []);
  const [creating, setCreating] = useState(false);
  if (error && !data) return <ErrorBox error={error} onRetry={reload} />;
  if (!data) return <Loading />;
  const cols: Col<Item>[] = [
    { key: 'p', header: 'Период', render: (r) => <b>{monthLabel(r.period)}</b>, sort: (r) => r.period, csv: (r) => r.period },
    { key: 's', header: 'Статус', render: (r) => <Badge tone={PST[r.status].tone}>{PST[r.status].label}</Badge>, csv: (r) => PST[r.status].label },
    { key: 'l', header: 'Сотрудников', align: 'right', render: (r) => r.lines, hideOnMobile: true, csv: (r) => r.lines },
    { key: 'g', header: 'Начислено', align: 'right', render: (r) => money(r.gross), sort: (r) => r.gross, csv: (r) => r.gross },
    { key: 'a', header: 'Авансы', align: 'right', render: (r) => (r.advance ? money(r.advance) : '—'), hideOnMobile: true, csv: (r) => r.advance },
    { key: 'd', header: 'Удержания', align: 'right', render: (r) => (r.deduction ? money(r.deduction) : '—'), hideOnMobile: true, csv: (r) => r.deduction },
    { key: 'n', header: 'К выдаче', align: 'right', render: (r) => <b>{money(r.net)}</b>, sort: (r) => r.net, csv: (r) => r.net },
    { key: 'pd', header: 'Выплачена', render: (r) => <span className="text-xs text-muted">{r.paidDate ? fmtDate(r.paidDate) : '—'}</span>, hideOnMobile: true, csv: (r) => r.paidDate },
  ];
  return (
    <>
      <PageHeader title="Зарплата" subtitle="Ведомости по месяцам: начисление по табелю, премии и штрафы, авансы, удержания и выплата"
        actions={can('hr.write') && <button className="btn btn-primary" onClick={() => setCreating(true)}><Plus size={15} /> Новая ведомость</button>} />
      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'payrolls', label: 'Ведомости' }, { id: 'advances', label: 'Авансы' }]} />
      {tab === 'payrolls' ? <DataTable cols={cols} rows={data} rowKey={(r) => r.id} csvName="payrolls" onRowClick={(r) => nav('/hr/payroll/' + r.id)} initialSort={{ key: 'p', dir: 'desc' }} empty={<div className="py-12 text-center text-sm text-muted">Ведомостей ещё нет. Заполните табель и создайте ведомость за месяц.</div>} /> : <Advances />}
      {creating && <CreateModal onClose={() => setCreating(false)} onCreated={(id) => nav('/hr/payroll/' + id)} />}
    </>
  );
}

function CreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const { me } = useAuth();
  const { toast } = useUi();
  const [month, setMonth] = useState(() => todayIn(me!.settings.timezone).slice(0, 7));
  const [busy, setBusy] = useState(false);
  const go = async () => { setBusy(true); try { const r = await post<{ id: string }>('/hr/payrolls', { period: month }); onCreated(r.id); } catch (e) { toast('err', (e as Error).message); setBusy(false); } };
  return (
    <Modal open onClose={onClose} title="Новая ведомость" width={440} footer={<><button className="btn btn-soft" onClick={onClose}>Отмена</button><button className="btn btn-primary" disabled={busy} onClick={() => void go()}>Создать</button></>}>
      <Field label="Месяц"><MonthPicker value={month} onChange={setMonth} /></Field>
      <p className="mt-3 text-xs leading-relaxed text-muted">Начисления посчитаются по табелю и ставкам, авансы подтянутся сами. Проценты удержаний и взносов возьмутся из прошлой ведомости — их можно изменить в самой ведомости.</p>
    </Modal>
  );
}

/* ───────── Ведомость ───────── */
export function PayrollDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { me, can } = useAuth();
  const { toast, confirm } = useUi();
  const { data, error, reload } = useFetch(() => get<Detail>('/hr/payrolls/' + id), [id], { live: false });
  const [edits, setEdits] = useState<Record<string, { bonus: string; penalty: string; base: string; note: string }>>({});
  const [pct, setPct] = useState({ d: '', e: '', norm: '' });
  const [paying, setPaying] = useState(false);
  useEffect(() => {
    if (!data) return;
    setEdits(Object.fromEntries(data.lines.map((l) => [l.employeeId, { bonus: l.bonus ? String(l.bonus) : '', penalty: l.penalty ? String(l.penalty) : '', base: String(l.base), note: l.note ?? '' }])));
    setPct({ d: String(data.deductionPct), e: String(data.employerPct), norm: String(data.normDays) });
  }, [data]);
  if (error && !data) return <ErrorBox error={error} onRetry={reload} />;
  if (!data) return <Loading />;
  const write = can('hr.write'), draft = data.status === 'draft';
  const num = (s: string | undefined) => parseNum(s ?? '') || 0;
  const dpct = num(pct.d);
  // «живой» пересчёт до сохранения
  const calc = data.lines.map((l) => { const e = edits[l.employeeId]; const base = e ? num(e.base) : l.base, bonus = e ? num(e.bonus) : l.bonus, pen = e ? num(e.penalty) : l.penalty; const gross = base + bonus - pen; const ded = draft ? gross * dpct / 100 : l.deduction; return { l, gross, ded, net: gross - ded - l.advance }; });
  const tot = { gross: calc.reduce((s, c) => s + c.gross, 0), ded: calc.reduce((s, c) => s + c.ded, 0), adv: data.totals.advance, net: calc.reduce((s, c) => s + c.net, 0) };
  const employer = tot.gross * (draft ? num(pct.e) : data.employerPct) / 100;
  const dirty = draft && (data.lines.some((l) => { const e = edits[l.employeeId]; return e && (num(e.bonus) !== l.bonus || num(e.penalty) !== l.penalty || num(e.base) !== l.base || (e.note || '') !== (l.note ?? '')); }) || dpct !== data.deductionPct || num(pct.e) !== data.employerPct || num(pct.norm) !== data.normDays);

  const act = async (fn: () => Promise<unknown>, ok: string, andReload = true) => { try { await fn(); toast('ok', ok); if (andReload) await reload(); } catch (e) { toast('err', (e as Error).message); } };
  const save = () => act(() => put('/hr/payrolls/' + id, { deductionPct: dpct, employerPct: num(pct.e), normDays: Math.max(1, Math.round(num(pct.norm))) || undefined,
    lines: data.lines.map((l) => ({ employeeId: l.employeeId, base: num(edits[l.employeeId]?.base), bonus: num(edits[l.employeeId]?.bonus), penalty: num(edits[l.employeeId]?.penalty), note: edits[l.employeeId]?.note || null })) }), 'Сохранено');

  return (
    <>
      <PageHeader title={<span className="flex items-center gap-2"><Link to="/hr/payroll" className="text-muted hover:text-ink"><ArrowLeft size={20} /></Link>Ведомость за {monthLabel(data.period)} <Badge tone={PST[data.status].tone}>{PST[data.status].label}</Badge></span>}
        subtitle={data.paidDate ? `Выплачена ${fmtDate(data.paidDate)}` : `Норма месяца ${data.normDays} раб. дн.`}
        actions={<>
          <Link className="btn btn-soft" target="_blank" to={`/print/payroll/${data.id}`}><Printer size={15} /> Печать</Link>
          {write && draft && <button className="btn btn-soft" onClick={() => void act(() => post(`/hr/payrolls/${id}/recalc`), 'Пересчитано по табелю')}><Calculator size={15} /> Пересчитать по табелю</button>}
          {write && draft && <button className="btn btn-soft" disabled={!dirty} onClick={() => void save()}><Save size={15} /> Сохранить</button>}
          {write && draft && <button className="btn btn-primary" onClick={async () => { if (dirty) await save(); void act(() => post(`/hr/payrolls/${id}/approve`), 'Ведомость утверждена'); }}><BadgeCheck size={15} /> Утвердить</button>}
          {write && data.status === 'approved' && <button className="btn btn-primary" onClick={() => setPaying(true)}><Wallet size={15} /> Выплатить</button>}
          {write && data.status === 'approved' && <button className="btn btn-ghost" onClick={() => void act(() => post(`/hr/payrolls/${id}/reopen`), 'Возвращена в черновик')}><RotateCcw size={15} /> В черновик</button>}
          {write && data.status === 'paid' && <button className="btn btn-ghost" onClick={async () => { if (await confirm({ title: 'Отменить выплату?', text: 'Расходы по этой ведомости будут удалены из бухгалтерии. Ведомость станет «утверждена».', danger: true, confirmLabel: 'Отменить выплату' })) void act(() => post(`/hr/payrolls/${id}/unpay`), 'Выплата отменена'); }}>Отменить выплату</button>}
          {write && draft && <button className="btn btn-ghost hover:!text-bad" onClick={async () => { if (await confirm({ title: 'Удалить черновик ведомости?', danger: true, confirmLabel: 'Удалить' })) void act(() => del('/hr/payrolls/' + id), 'Удалено', false).then(() => nav('/hr/payroll')); }}><Trash2 size={15} /></button>}
        </>} />
      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Начислено" value={money(tot.gross)} /><StatCard label="Авансы" value={money(tot.adv)} /><StatCard label="Удержания" value={money(tot.ded)} /><StatCard label="К выдаче" value={money(tot.net)} tone="good" />
        <StatCard label="Взносы работодателя" value={money(employer)} sub="сверх начисленного" />
      </div>
      {draft && write && (
        <section className="card mb-5 grid gap-3 p-4 sm:grid-cols-4">
          <Field label="Удержания с сотрудника, %" hint="задаёт бухгалтер"><input className="input tnum" inputMode="decimal" value={pct.d} onChange={(e) => setPct({ ...pct, d: e.target.value })} /></Field>
          <Field label="Взносы работодателя, %" hint="задаёт бухгалтер"><input className="input tnum" inputMode="decimal" value={pct.e} onChange={(e) => setPct({ ...pct, e: e.target.value })} /></Field>
          <Field label="Норма месяца, раб. дней" hint="для окладных"><input className="input tnum" inputMode="numeric" value={pct.norm} onChange={(e) => setPct({ ...pct, norm: e.target.value })} /></Field>
          <p className="text-xs leading-relaxed text-muted sm:pt-6">Ставки по умолчанию 0%: система не подставляет законодательные значения. После изменения нормы нажмите «Пересчитать по табелю».</p>
        </section>
      )}
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[980px] text-[13px]">
          <thead><tr><th className="th">Сотрудник</th><th className="th text-right">Ставка</th><th className="th text-right">Табель</th><th className="th text-right">Начислено</th><th className="th text-right">Премия</th><th className="th text-right">Штраф</th><th className="th text-right">Всего</th><th className="th text-right">Аванс</th><th className="th text-right">Удержано</th><th className="th text-right">К выдаче</th></tr></thead>
          <tbody>
            {calc.map(({ l, gross, ded, net }) => {
              const e = edits[l.employeeId];
              return (
                <tr key={l.employeeId}>
                  <td className="td"><div className="font-medium">{l.name}</div><div className="text-[11px] text-muted">{l.position ?? ''} · {l.payKindLabel}</div></td>
                  <td className="td tnum text-right text-muted">{money(l.rate)}</td>
                  <td className="td tnum text-right text-muted">{l.workedDays} дн.{l.payKind === 'hourly' ? ` · ${fmtQty(l.workedHours, 1)} ч` : ''}</td>
                  <td className="td text-right">{draft && write ? <input className="input tnum !h-8 !w-[110px] text-right" inputMode="decimal" value={e?.base ?? ''} onChange={(x) => setEdits({ ...edits, [l.employeeId]: { ...e!, base: x.target.value } })} /> : <span className="tnum">{money(l.base)}</span>}</td>
                  <td className="td text-right">{draft && write ? <input className="input tnum !h-8 !w-[90px] text-right" inputMode="decimal" placeholder="0" value={e?.bonus ?? ''} onChange={(x) => setEdits({ ...edits, [l.employeeId]: { ...e!, bonus: x.target.value } })} /> : <span className="tnum">{l.bonus ? money(l.bonus) : '—'}</span>}</td>
                  <td className="td text-right">{draft && write ? <input className="input tnum !h-8 !w-[90px] text-right" inputMode="decimal" placeholder="0" value={e?.penalty ?? ''} onChange={(x) => setEdits({ ...edits, [l.employeeId]: { ...e!, penalty: x.target.value } })} /> : <span className="tnum">{l.penalty ? money(l.penalty) : '—'}</span>}</td>
                  <td className="td tnum text-right font-medium">{money(gross)}</td>
                  <td className="td tnum text-right text-muted">{l.advance ? money(l.advance) : '—'}</td>
                  <td className="td tnum text-right text-muted">{ded ? money(ded) : '—'}</td>
                  <td className={`td tnum text-right font-semibold ${net < 0 ? 'text-bad' : ''}`}>{money(net)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="bg-surface2/50 font-semibold"><tr><td className="td" colSpan={6}>Итого</td><td className="td tnum text-right">{money(tot.gross)}</td><td className="td tnum text-right">{money(tot.adv)}</td><td className="td tnum text-right">{money(tot.ded)}</td><td className="td tnum text-right">{money(tot.net)}</td></tr></tfoot>
        </table>
      </div>
      {calc.some((c) => c.net < 0) && <p className="mt-3 text-[13px] text-bad">У некоторых сотрудников авансы больше начисления — утвердить ведомость нельзя, пока это не исправлено (премия, табель или удаление аванса).</p>}
      <div className="mt-5"><Attachments entity="payroll" entityId={data.id} canEdit={can('files') && write} title="Документы по ведомости" /></div>
      {paying && <PayModal total={tot.net} tax={tot.ded + employer} onClose={() => setPaying(false)} onDone={() => { setPaying(false); void reload(); }} id={data.id} />}
    </>
  );
}

function PayModal({ id, total, tax, onClose, onDone }: { id: string; total: number; tax: number; onClose: () => void; onDone: () => void }) {
  const { me } = useAuth();
  const { toast } = useUi();
  const [date, setDate] = useState(() => todayIn(me!.settings.timezone));
  const [method, setMethod] = useState('Наличные');
  const [busy, setBusy] = useState(false);
  const go = async () => { setBusy(true); try { await post(`/hr/payrolls/${id}/pay`, { date, method }); toast('ok', 'Выплата проведена'); onDone(); } catch (e) { toast('err', (e as Error).message); setBusy(false); } };
  return (
    <Modal open onClose={onClose} title="Выплата зарплаты" width={460} footer={<><button className="btn btn-soft" onClick={onClose}>Отмена</button><button className="btn btn-primary" disabled={busy} onClick={() => void go()}>Провести выплату</button></>}>
      <div className="grid gap-3 sm:grid-cols-2"><Field label="Дата выплаты"><input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} /></Field><Field label="Способ"><select className="input" value={method} onChange={(e) => setMethod(e.target.value)}>{METHODS.map((m) => <option key={m}>{m}</option>)}</select></Field></div>
      <ul className="mt-4 space-y-1.5 text-[13.5px]"><li className="flex justify-between"><span>Расход «Зарплата» (к выдаче)</span><b className="tnum">{money(total)}</b></li>{tax > 0 && <li className="flex justify-between"><span>Расход «Налоги» (удержания и взносы, к оплате)</span><b className="tnum">{money(tax)}</b></li>}</ul>
      <p className="mt-3 text-xs leading-relaxed text-muted">Расходы появятся в «Расходах», в ОПУ и в «Движении денег» (выплата — со счёта по способу оплаты). Налоговая часть создаётся как «к оплате» — оплатите её в «Расходах».</p>
    </Modal>
  );
}

/* ───────── Авансы ───────── */
function Advances() {
  const { me, can } = useAuth();
  const { toast, confirm } = useUi();
  const [month, setMonth] = useState(() => todayIn(me!.settings.timezone).slice(0, 7));
  const { data, error, reload } = useFetch(() => get<Adv[]>('/hr/advances?month=' + month), [month]);
  const [adding, setAdding] = useState(false);
  if (error && !data) return <ErrorBox error={error} onRetry={reload} />;
  if (!data) return <Loading />;
  const cols: Col<Adv>[] = [
    { key: 'd', header: 'Дата', render: (a) => fmtDate(a.date), sort: (a) => a.date, csv: (a) => a.date },
    { key: 'e', header: 'Сотрудник', render: (a) => <span className="font-medium">{a.employee}</span>, sort: (a) => a.employee, csv: (a) => a.employee },
    { key: 'a', header: 'Сумма', align: 'right', render: (a) => <b>{money(a.amount)}</b>, sort: (a) => a.amount, csv: (a) => a.amount },
    { key: 'm', header: 'Способ', render: (a) => a.method ?? '—', hideOnMobile: true, csv: (a) => a.method },
    { key: 'n', header: 'Комментарий', render: (a) => <span className="text-muted">{a.note ?? ''}</span>, hideOnMobile: true, csv: (a) => a.note },
    ...(can('hr.write') ? [{ key: 'x', header: '', align: 'right' as const, render: (a: Adv) => <button className="btn btn-ghost btn-sm !px-1.5 hover:!text-bad" onClick={async () => { if (await confirm({ title: 'Удалить аванс?', text: `${a.employee}, ${money(a.amount)}`, danger: true, confirmLabel: 'Удалить' })) { try { await del('/hr/advances/' + a.id); void reload(); } catch (e) { toast('err', (e as Error).message); } } }}><Trash2 size={14} /></button> }] : []),
  ];
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3"><MonthPicker value={month} onChange={setMonth} />{can('hr.write') && <button className="btn btn-primary btn-sm ml-auto" onClick={() => setAdding(true)}><Plus size={14} /> Выдать аванс</button>}</div>
      <DataTable cols={cols} rows={data} rowKey={(a) => a.id} csvName={`advances-${month}`} footer={<tr><td className="td" colSpan={2}>Итого за месяц</td><td className="td tnum text-right">{money(data.reduce((s, a) => s + a.amount, 0))}</td><td className="td" colSpan={3} /></tr>} empty={<div className="py-10 text-center text-sm text-muted">Авансов за месяц нет. Аванс создаёт расход в бухгалтерии и вычитается из ведомости.</div>} />
      {adding && <AdvModal month={month} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); void reload(); }} />}
    </>
  );
}

function AdvModal({ month, onClose, onSaved }: { month: string; onClose: () => void; onSaved: () => void }) {
  const { me } = useAuth();
  const { toast } = useUi();
  const { data: emps } = useFetch(() => get<{ id: string; name: string; active: boolean }[]>('/hr/employees'), [], { live: false });
  const today = todayIn(me!.settings.timezone);
  const [f, setF] = useState({ employeeId: '', date: today.slice(0, 7) === month ? today : `${month}-01`, amount: '', method: 'Наличные', note: '' });
  const [busy, setBusy] = useState(false);
  const save = async () => { setBusy(true); try { await post('/hr/advances', { ...f, amount: parseNum(f.amount), note: f.note || null }); toast('ok', 'Аванс выдан'); onSaved(); } catch (e) { toast('err', (e as Error).message); setBusy(false); } };
  return (
    <Modal open onClose={onClose} title="Выдать аванс" width={480} footer={<><button className="btn btn-soft" onClick={onClose}>Отмена</button><button className="btn btn-primary" disabled={busy || !f.employeeId || !(parseNum(f.amount) > 0)} onClick={() => void save()}>Выдать</button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Сотрудник" className="sm:col-span-2"><select className="input" value={f.employeeId} onChange={(e) => setF({ ...f, employeeId: e.target.value })}><option value="">— выберите —</option>{(emps ?? []).filter((e) => e.active).map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select></Field>
        <Field label="Сумма"><input className="input tnum" autoFocus inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></Field>
        <Field label="Дата"><input type="date" className="input" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
        <Field label="Способ"><select className="input" value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })}>{METHODS.map((m) => <option key={m}>{m}</option>)}</select></Field>
        <Field label="Комментарий"><input className="input" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}

/* ───────── Печать ведомости ───────── */
export function PayrollPrint() {
  const { id } = useParams();
  const { me } = useAuth();
  const { data, error } = useFetch(() => get<Detail>('/hr/payrolls/' + id), [id], { live: false });
  const { data: st } = useFetch(() => get<{ company: string; bin: string; signer: string }>('/settings'), [], { live: false });
  if (error) return <ErrorBox error={error} />;
  if (!data || !st) return <Loading />;
  const th = 'border border-gray-400 p-1.5';
  return (
    <div className="min-h-full bg-slate-100 py-6 print:bg-white print:py-0">
      <div className="no-print mx-auto mb-4 flex max-w-[297mm] justify-end"><button className="btn btn-primary" onClick={() => window.print()}><Printer size={15} /> Печать / PDF</button></div>
      <article className="print-page mx-auto max-w-[297mm] bg-white p-[12mm] text-[12px] leading-relaxed text-black shadow-lg">
        <header className="mb-4 text-center"><div className="text-[11px] text-gray-600">{st.company || me!.settings.company}{st.bin ? ` · БИН ${st.bin}` : ''}</div><h1 className="text-[17px] font-bold uppercase tracking-wide">Расчётно-платёжная ведомость</h1><div>за {monthLabel(data.period)} · {PST[data.status].label.toLowerCase()}</div></header>
        <table className="mb-5 w-full border-collapse text-[11.5px]">
          <thead><tr className="bg-gray-100"><th className={`${th} text-left`}>№</th><th className={`${th} text-left`}>Сотрудник</th><th className={`${th} text-left`}>Должность</th><th className={`${th} text-right`}>Начислено</th><th className={`${th} text-right`}>Премия</th><th className={`${th} text-right`}>Штраф</th><th className={`${th} text-right`}>Аванс</th><th className={`${th} text-right`}>Удержано</th><th className={`${th} text-right`}>К выдаче</th><th className={`${th} w-[90px]`}>Подпись</th></tr></thead>
          <tbody>{data.lines.map((l, i) => <tr key={l.employeeId}><td className={th}>{i + 1}</td><td className={th}>{l.name}</td><td className={th}>{l.position ?? ''}</td><td className={`${th} text-right`}>{money(l.base)}</td><td className={`${th} text-right`}>{l.bonus ? money(l.bonus) : ''}</td><td className={`${th} text-right`}>{l.penalty ? money(l.penalty) : ''}</td><td className={`${th} text-right`}>{l.advance ? money(l.advance) : ''}</td><td className={`${th} text-right`}>{l.deduction ? money(l.deduction) : ''}</td><td className={`${th} text-right font-semibold`}>{money(l.net)}</td><td className={th} /></tr>)}</tbody>
          <tfoot><tr className="bg-gray-100 font-bold"><td className={th} colSpan={3}>Итого</td><td className={`${th} text-right`} colSpan={3}>{money(data.totals.gross)}</td><td className={`${th} text-right`}>{money(data.totals.advance)}</td><td className={`${th} text-right`}>{money(data.totals.deduction)}</td><td className={`${th} text-right`}>{money(data.totals.net)}</td><td className={th} /></tr></tfoot>
        </table>
        <section className="mt-12 grid grid-cols-2 gap-10"><div><div className="mb-7">Руководитель:</div><div className="border-t border-black pt-1">{st.signer || '_______________'} / подпись</div></div><div><div className="mb-7">Бухгалтер:</div><div className="border-t border-black pt-1">_______________ / подпись</div></div></section>
        <footer className="mt-8 text-[10px] text-gray-500">Сформировано в Innova Office · {me!.name}{data.paidDate ? ` · выплачена ${fmtDate(data.paidDate)}` : ''}</footer>
      </article>
    </div>
  );
}
