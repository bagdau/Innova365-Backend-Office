import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Plus, Truck, Wallet } from 'lucide-react';
import { get, patch, post } from '../api';
import { useAuth } from '../auth';
import { fmtDate, money } from '../format';
import { Badge, Col, DataTable, ErrorBox, Field, Loading, Modal, PageHeader, StatCard, useFetch, useUi } from '../ui';
import { Chips, SearchBox } from '../ui2';

export interface Supplier { id: string; nombre: string; contacto: string | null; telefono: string | null; email: string | null; notas: string | null; activo: boolean; bin: string | null; address: string | null; bank: string | null; iban: string | null; paymentDays: number | null; category: string | null }
interface Row extends Supplier { purchases: number; lastAt: string | null; received: number; paid: number; debt: number; overdue: number }
interface Resp { rows: Row[]; totalDebt: number; totalOverdue: number }

/** Справочник поставщиков: долг, просрочка, последняя закупка. Карточка — по клику на строку. */
export default function Suppliers() {
  const { can } = useAuth();
  const nav = useNavigate();
  const { data, error, reload } = useFetch(() => get<Resp>('/sup/suppliers'), []);
  const [edit, setEdit] = useState<Supplier | 'new' | null>(null);
  const [view, setView] = useState<'active' | 'debt' | 'all'>('active');
  const [q, setQ] = useState('');
  if (error && !data) return <ErrorBox error={error} onRetry={reload} />;
  if (!data) return <Loading />;
  const rows = data.rows.filter((r) => (view === 'all' || (view === 'debt' ? r.debt > 0 : r.activo)) && (!q || r.nombre.toLowerCase().includes(q.toLowerCase()) || (r.category ?? '').toLowerCase().includes(q.toLowerCase())));
  const cols: Col<Row>[] = [
    { key: 'n', header: 'Поставщик', render: (r) => <div><div className="flex items-center gap-2 font-medium">{r.nombre}{!r.activo && <Badge>отключён</Badge>}</div><div className="text-xs text-muted">{[r.category, r.contacto, r.telefono].filter(Boolean).join(' · ') || '—'}</div></div>, sort: (r) => r.nombre, csv: (r) => r.nombre },
    { key: 'p', header: 'Закупок', align: 'right', render: (r) => r.purchases, sort: (r) => r.purchases, hideOnMobile: true, csv: (r) => r.purchases },
    { key: 'l', header: 'Последняя', render: (r) => <span className="text-xs text-muted">{r.lastAt ? fmtDate(r.lastAt) : '—'}</span>, sort: (r) => r.lastAt, hideOnMobile: true, csv: (r) => r.lastAt },
    { key: 'rc', header: 'Принято', align: 'right', render: (r) => money(r.received), sort: (r) => r.received, hideOnMobile: true, csv: (r) => r.received },
    { key: 'd', header: 'Долг', align: 'right', render: (r) => (r.debt > 0 ? <b className="text-warn">{money(r.debt)}</b> : <span className="text-muted">—</span>), sort: (r) => r.debt, csv: (r) => r.debt },
    { key: 'o', header: 'Просрочено', align: 'right', render: (r) => (r.overdue > 0 ? <b className="text-bad">{money(r.overdue)}</b> : <span className="text-muted">—</span>), sort: (r) => r.overdue, csv: (r) => r.overdue },
  ];
  return (
    <>
      <PageHeader title="Поставщики" subtitle="Кому мы должны, сколько и как давно. Справочник общий с кассой: новые поставщики сразу доступны для закупок"
        actions={can('sup.edit') && <button className="btn btn-primary" onClick={() => setEdit('new')}><Plus size={15} /> Добавить поставщика</button>} />
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <StatCard label="Поставщиков" value={data.rows.filter((r) => r.activo).length} sub={`всего ${data.rows.length}`} icon={<Truck size={16} />} />
        <StatCard label="Общий долг" value={money(data.totalDebt)} tone={data.totalDebt ? 'warn' : undefined} icon={<Wallet size={16} />} />
        <StatCard label="Просрочено" value={money(data.totalOverdue)} tone={data.totalOverdue ? 'bad' : undefined} sub="по сроку отсрочки поставщика" icon={<AlertTriangle size={16} />} />
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Chips value={view} onChange={setView} options={[{ id: 'active', label: 'Активные' }, { id: 'debt', label: 'С долгом', count: data.rows.filter((r) => r.debt > 0).length }, { id: 'all', label: 'Все' }]} />
        <SearchBox value={q} onChange={setQ} placeholder="Название или категория…" className="w-60" />
      </div>
      <DataTable cols={cols} rows={rows} rowKey={(r) => r.id} csvName="suppliers" onRowClick={(r) => nav('/suppliers/' + r.id)} initialSort={{ key: 'd', dir: 'desc' }}
        empty={<div className="py-12 text-center text-sm text-muted">Поставщиков нет</div>} />
      {edit && <SupplierModal s={edit === 'new' ? null : edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); void reload(); }} />}
    </>
  );
}

export function SupplierModal({ s, onClose, onSaved }: { s: Supplier | null; onClose: () => void; onSaved: () => void }) {
  const { toast } = useUi();
  const [f, setF] = useState({ nombre: s?.nombre ?? '', contacto: s?.contacto ?? '', telefono: s?.telefono ?? '', email: s?.email ?? '', category: s?.category ?? '', bin: s?.bin ?? '', address: s?.address ?? '', bank: s?.bank ?? '', iban: s?.iban ?? '', paymentDays: s?.paymentDays === null || s?.paymentDays === undefined ? '' : String(s.paymentDays), notas: s?.notas ?? '' });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const save = async () => {
    setBusy(true);
    try {
      const body = { ...f, paymentDays: f.paymentDays === '' ? null : Number(f.paymentDays) };
      if (s) await patch('/sup/suppliers/' + s.id, body); else await post('/sup/suppliers', body);
      toast('ok', s ? 'Сохранено' : 'Поставщик добавлен'); onSaved();
    } catch (e) { toast('err', (e as Error).message); } finally { setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title={s ? 'Изменить поставщика' : 'Новый поставщик'} width={640} footer={<><button className="btn btn-soft" onClick={onClose}>Отмена</button><button className="btn btn-primary" disabled={busy || f.nombre.trim().length < 2} onClick={() => void save()}>Сохранить</button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Название" className="sm:col-span-2"><input className="input" autoFocus value={f.nombre} onChange={set('nombre')} /></Field>
        <Field label="Контактное лицо"><input className="input" value={f.contacto} onChange={set('contacto')} /></Field>
        <Field label="Телефон"><input className="input" value={f.telefono} onChange={set('telefono')} /></Field>
        <Field label="Email"><input className="input" type="email" value={f.email} onChange={set('email')} /></Field>
        <Field label="Категория" hint="что поставляет: мясо, овощи, напитки…"><input className="input" value={f.category} onChange={set('category')} /></Field>
        <Field label="БИН / ИИН"><input className="input" value={f.bin} onChange={set('bin')} /></Field>
        <Field label="Отсрочка платежа, дней" hint="для контроля просрочки долга"><input className="input tnum" inputMode="numeric" value={f.paymentDays} onChange={set('paymentDays')} /></Field>
        <Field label="Адрес" className="sm:col-span-2"><input className="input" value={f.address} onChange={set('address')} /></Field>
        <Field label="Банк"><input className="input" value={f.bank} onChange={set('bank')} /></Field>
        <Field label="IBAN"><input className="input font-mono" value={f.iban} onChange={set('iban')} /></Field>
        <Field label="Заметки" className="sm:col-span-2"><input className="input" value={f.notas} onChange={set('notas')} /></Field>
      </div>
    </Modal>
  );
}
