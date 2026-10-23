import { useState } from 'react';
import { Pencil, Plus, Trash2, UserPlus } from 'lucide-react';
import { del, get, patch, post } from '../api';
import { Attachments } from '../Attachments';
import { useAuth } from '../auth';
import { fmtDate, money } from '../format';
import { Badge, Col, DataTable, ErrorBox, Field, Loading, Modal, PageHeader, StatCard, Toggle, useFetch, useUi } from '../ui';
import { Chips, parseNum, SearchBox } from '../ui2';

interface Emp { id: string; name: string; position: string | null; payKind: 'salary' | 'hourly' | 'daily'; payKindLabel: string; rate: number; phone: string | null; hireDate: string | null; fireDate: string | null; posUserId: string | null; posUser: string | null; active: boolean; note: string | null }
const KINDS: [string, string, string][] = [['salary', 'Оклад (в месяц)', 'оклад × отработанные дни / норма месяца'], ['hourly', 'Почасовая', 'часы по табелю × ставка за час'], ['daily', 'Посуточная', 'отработанные дни × ставка за день']];

/** Штат: кто работает, как оплачивается, связь с пользователем кассы. */
export default function Employees() {
  const { can } = useAuth();
  const { toast } = useUi();
  const { data, error, reload } = useFetch(() => get<Emp[]>('/hr/employees'), []);
  const [edit, setEdit] = useState<Emp | 'new' | null>(null);
  const [view, setView] = useState<'active' | 'all'>('active');
  const [q, setQ] = useState('');
  if (error && !data) return <ErrorBox error={error} onRetry={reload} />;
  if (!data) return <Loading />;
  const write = can('hr.write');
  const rows = data.filter((e) => (view === 'all' || e.active) && (!q || e.name.toLowerCase().includes(q.toLowerCase()) || (e.position ?? '').toLowerCase().includes(q.toLowerCase())));
  const noRate = data.filter((e) => e.active && e.rate === 0).length;
  const cols: Col<Emp>[] = [
    { key: 'n', header: 'Сотрудник', render: (e) => <div><div className="flex items-center gap-2 font-medium">{e.name}{!e.active && <Badge>не работает</Badge>}</div><div className="text-xs text-muted">{e.position ?? '—'}{e.phone ? ` · ${e.phone}` : ''}</div></div>, sort: (e) => e.name, csv: (e) => e.name },
    { key: 'k', header: 'Оплата', render: (e) => <span>{e.payKindLabel}</span>, sort: (e) => e.payKind, csv: (e) => e.payKindLabel },
    { key: 'r', header: 'Ставка', align: 'right', render: (e) => (e.rate ? <b>{money(e.rate)}</b> : <span className="text-warn">не задана</span>), sort: (e) => e.rate, csv: (e) => e.rate },
    { key: 'p', header: 'Касса', render: (e) => (e.posUser ? <Badge tone="info">{e.posUser}</Badge> : <span className="text-muted">—</span>), hideOnMobile: true, csv: (e) => e.posUser },
    { key: 'h', header: 'Принят', render: (e) => <span className="text-xs text-muted">{e.hireDate ? fmtDate(e.hireDate) : '—'}{e.fireDate ? ` — уволен ${fmtDate(e.fireDate)}` : ''}</span>, hideOnMobile: true, csv: (e) => e.hireDate },
    ...(write ? [{ key: 'x', header: '', align: 'right' as const, render: (e: Emp) => <button className="btn btn-ghost btn-sm !px-1.5" onClick={(ev) => { ev.stopPropagation(); setEdit(e); }}><Pencil size={14} /></button> }] : []),
  ];
  return (
    <>
      <PageHeader title="Штат" subtitle="Сотрудники и условия оплаты. Табель и зарплатные ведомости строятся по этому списку"
        actions={write && <><button className="btn btn-soft" onClick={async () => { try { const r = await post<{ imported: number }>('/hr/employees/import-pos'); toast('ok', r.imported ? `Добавлено из кассы: ${r.imported}. Укажите им ставки` : 'Все пользователи кассы уже в штате'); void reload(); } catch (e) { toast('err', (e as Error).message); } }}><UserPlus size={15} /> Взять из кассы</button><button className="btn btn-primary" onClick={() => setEdit('new')}><Plus size={15} /> Добавить сотрудника</button></>} />
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <StatCard label="Работают" value={data.filter((e) => e.active).length} sub={`всего в базе ${data.length}`} />
        <StatCard label="ФОТ по окладам (месяц)" value={money(data.filter((e) => e.active && e.payKind === 'salary').reduce((s, e) => s + e.rate, 0))} />
        <StatCard label="Без ставки" value={noRate} tone={noRate ? 'warn' : 'good'} sub="начисление будет нулевым" />
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-3"><Chips value={view} onChange={setView} options={[{ id: 'active', label: 'Работают' }, { id: 'all', label: 'Все' }]} /><SearchBox value={q} onChange={setQ} placeholder="Имя или должность…" className="w-56" /></div>
      <DataTable cols={cols} rows={rows} rowKey={(e) => e.id} csvName="employees" onRowClick={write ? setEdit : undefined} initialSort={{ key: 'n', dir: 'asc' }} empty={<div className="py-12 text-center text-sm text-muted">Сотрудников нет. Нажмите «Взять из кассы», чтобы завести пользователей кассы одним действием.</div>} />
      {edit && <EmpModal e={edit === 'new' ? null : edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); void reload(); }} />}
    </>
  );
}

function EmpModal({ e, onClose, onSaved }: { e: Emp | null; onClose: () => void; onSaved: () => void }) {
  const { toast, confirm } = useUi();
  const { can } = useAuth();
  const { data: pos } = useFetch(() => get<{ id: string; nombre: string; rol: string; linked: boolean }[]>('/hr/pos-users'), [], { live: false });
  const [f, setF] = useState({ name: e?.name ?? '', position: e?.position ?? '', payKind: e?.payKind ?? 'salary', rate: e ? String(e.rate) : '', phone: e?.phone ?? '', hireDate: e?.hireDate ?? '', fireDate: e?.fireDate ?? '', posUserId: e?.posUserId ?? '', note: e?.note ?? '', active: e?.active ?? true });
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      const body = { name: f.name, position: f.position || null, payKind: f.payKind, rate: parseNum(f.rate) || 0, phone: f.phone || null, hireDate: f.hireDate || null, fireDate: f.fireDate || null, posUserId: f.posUserId || null, note: f.note || null, active: f.active };
      if (e) await patch('/hr/employees/' + e.id, body); else await post('/hr/employees', body);
      toast('ok', 'Сохранено'); onSaved();
    } catch (x) { toast('err', (x as Error).message); } finally { setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title={e ? 'Сотрудник' : 'Новый сотрудник'} width={620}
      footer={<>{e && <button className="btn btn-ghost mr-auto hover:!text-bad" onClick={async () => { if (await confirm({ title: `Удалить «${e.name}»?`, text: 'Удалить можно только сотрудника без ведомостей и авансов. Иначе отметьте «не работает».', danger: true, confirmLabel: 'Удалить' })) { try { await del('/hr/employees/' + e.id); onSaved(); } catch (x) { toast('err', (x as Error).message); } } }}><Trash2 size={15} /></button>}
        <button className="btn btn-soft" onClick={onClose}>Отмена</button><button className="btn btn-primary" disabled={busy || f.name.trim().length < 2} onClick={() => void save()}>Сохранить</button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Имя и фамилия" className="sm:col-span-2"><input className="input" autoFocus value={f.name} onChange={(x) => setF({ ...f, name: x.target.value })} /></Field>
        <Field label="Должность"><input className="input" value={f.position} onChange={(x) => setF({ ...f, position: x.target.value })} /></Field>
        <Field label="Телефон"><input className="input" value={f.phone} onChange={(x) => setF({ ...f, phone: x.target.value })} /></Field>
        <Field label="Вид оплаты" hint={KINDS.find((k) => k[0] === f.payKind)?.[2]}><select className="input" value={f.payKind} onChange={(x) => setF({ ...f, payKind: x.target.value as Emp['payKind'] })}>{KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
        <Field label={f.payKind === 'salary' ? 'Оклад в месяц' : f.payKind === 'hourly' ? 'Ставка за час' : 'Ставка за день'}><input className="input tnum" inputMode="decimal" value={f.rate} onChange={(x) => setF({ ...f, rate: x.target.value })} /></Field>
        <Field label="Принят"><input type="date" className="input" value={f.hireDate} onChange={(x) => setF({ ...f, hireDate: x.target.value })} /></Field>
        <Field label="Уволен"><input type="date" className="input" value={f.fireDate} onChange={(x) => setF({ ...f, fireDate: x.target.value })} /></Field>
        <Field label="Пользователь кассы" className="sm:col-span-2" hint="Связь нужна для справки: кто из сотрудников работает в кассе"><select className="input" value={f.posUserId} onChange={(x) => setF({ ...f, posUserId: x.target.value })}><option value="">— не связан —</option>{(pos ?? []).filter((u) => !u.linked || u.id === e?.posUserId).map((u) => <option key={u.id} value={u.id}>{u.nombre} ({u.rol})</option>)}</select></Field>
        <Field label="Заметка" className="sm:col-span-2"><input className="input" value={f.note} onChange={(x) => setF({ ...f, note: x.target.value })} /></Field>
        {e && <div className="sm:col-span-2"><Toggle checked={f.active} onChange={(v) => setF({ ...f, active: v })} label="Работает" /></div>}
        {e && <div className="sm:col-span-2"><Attachments entity="employee" entityId={e.id} canEdit={can('files') && can('hr.write')} title="Договор, документы" /></div>}
      </div>
    </Modal>
  );
}
