import { useState } from 'react';
import { Bike, ChefHat, Crown, KeyRound, Plus, Shield, Trash2, UserCog, Utensils, Wallet } from 'lucide-react';
import { del, get, patch, post } from '../api';
import { fmtDateTime } from '../format';
import { Badge, Col, DataTable, ErrorBox, Field, Loading, Modal, PageHeader, Toggle, useFetch, useUi } from '../ui';

interface S { id: string; nombre: string; email: string; role: string; roleLabel: string; active: boolean; created_at: string; last_login: string | null; outlet_id: string | null; outlet_name: string | null }
interface P { id: string; nombre: string; email: string; rol: string; roleLabel: string; active: boolean; created_at: string; orders: number }
interface Resp { pos: P[]; staff: S[]; admins: { id: string; nombre: string; email: string; role: string; roleLabel: string; active: boolean }[] }

const ROLES: [string, string, string][] = [
  ['accountant', 'Бухгалтер', 'выручка, расходы, закупки и долги, ОПУ, расчёты с точками, цены сырья'],
  ['technologist', 'Технолог', 'техкарты, согласование, версии, справочник сырья (без денег и цен)'],
  ['foodcourt', 'Менеджер фудкорта', 'точки, договоры, счета и акты, выручка по точкам и взаиморасчёты'],
  ['storekeeper', 'Кладовщик', 'склад: приёмка, инвентаризация, списания, поставщики'],
  ['tenant', 'Арендатор (точка)', 'кабинет арендатора: только своя точка — выручка, расчёты, счета и акты'],
];

/** Роли кассы: эти сотрудники входят в кассовую систему innova365.kz (таблица пользователей основной БД). */
const POS_ROLES: [string, string, string, typeof Utensils][] = [
  ['MESERO', 'Официант', 'принимает заказы в зале, видит свои столы и заказы', Utensils],
  ['CAJERO', 'Кассир', 'касса: оплата заказов, смена, чеки', Wallet],
  ['COCINERO', 'Повар', 'экран кухни: готовит заказы и отмечает «готово»', ChefHat],
  ['REPARTIDOR', 'Доставщик', 'видит готовые заказы «с собой» и отмечает их доставленными', Bike],
];

export default function Staff() {
  const [tab, setTab] = useState<'office' | 'pos'>('office');
  return (
    <>
      <div className="mb-4 inline-flex rounded-lg border border-line bg-card p-0.5 text-sm">
        {([['office', 'Сотрудники офиса'], ['pos', 'Персонал кассы']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={'rounded-md px-3.5 py-1.5 font-medium transition ' + (tab === k ? 'bg-brand text-white' : 'text-muted hover:text-ink')}>{l}</button>))}
      </div>
      {tab === 'office' ? <OfficeStaff /> : <PosStaff />}
    </>
  );
}

function OfficeStaff() {
  const { toast, confirm } = useUi();
  const { data, error, reload } = useFetch(() => get<Resp>('/staff'), []);
  const [edit, setEdit] = useState<S | 'new' | null>(null);
  if (error && !data) return <ErrorBox error={error} onRetry={reload} />;
  if (!data) return <Loading />;
  const act = async (fn: () => Promise<unknown>, ok: string) => { try { await fn(); toast('ok', ok); void reload(); } catch (e) { toast('err', (e as Error).message); } };
  const cols: Col<S>[] = [
    { key: 'n', header: 'Сотрудник', render: (s) => <div><div className="font-medium">{s.nombre}</div><div className="text-xs text-muted">{s.email}</div></div>, sort: (s) => s.nombre, csv: (s) => s.nombre },
    { key: 'r', header: 'Роль', render: (s) => <div><Badge tone="brand">{s.roleLabel}</Badge>{s.outlet_name && <div className="mt-0.5 text-xs text-muted">{s.outlet_name}</div>}</div>, csv: (s) => s.roleLabel },
    { key: 'l', header: 'Последний вход', render: (s) => <span className="text-xs text-muted">{fmtDateTime(s.last_login)}</span>, hideOnMobile: true, csv: (s) => s.last_login },
    { key: 'a', header: 'Доступ', render: (s) => <Toggle checked={s.active} onChange={(v) => void act(() => patch('/staff/' + s.id, { active: v }), v ? 'Доступ открыт' : 'Доступ закрыт')} /> },
    { key: 'x', header: '', align: 'right', render: (s) => (
      <span className="inline-flex gap-0.5"><button className="btn btn-ghost btn-sm !px-1.5" title="Изменить" onClick={() => setEdit(s)}><UserCog size={15} /></button>
        <button className="btn btn-ghost btn-sm !px-1.5 hover:!text-bad" title="Удалить" onClick={async () => { if (await confirm({ title: `Удалить «${s.nombre}»?`, text: 'Учётная запись будет удалена, доступ закроется сразу.', danger: true, confirmLabel: 'Удалить' })) void act(() => del('/staff/' + s.id), 'Сотрудник удалён'); }}><Trash2 size={15} /></button></span>) },
  ];
  return (
    <>
      <PageHeader title="Сотрудники офиса" subtitle="Технологи, бухгалтеры и менеджеры фудкорта. Владелец и администраторы входят с данными кассовой системы" actions={<button className="btn btn-primary" onClick={() => setEdit('new')}><Plus size={15} /> Добавить сотрудника</button>} />
      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {ROLES.map(([k, l, d]) => <div key={k} className="card p-4"><div className="mb-1 flex items-center gap-2 font-semibold"><Shield size={16} className="text-brand" />{l}</div><p className="text-[12.5px] leading-relaxed text-muted">{d}</p><div className="mt-2 text-xs text-muted">Сотрудников: <b className="text-ink">{data.staff.filter((s) => s.role === k).length}</b></div></div>)}
      </div>
      <DataTable cols={cols} rows={data.staff} rowKey={(s) => s.id} csvName="staff" empty={<div className="py-12 text-center text-sm text-muted">Сотрудников офиса пока нет</div>} />
      <section className="card mt-6 p-4"><h2 className="mb-3 flex items-center gap-2 font-semibold"><Crown size={16} className="text-warn" />Владелец и администраторы (из кассовой системы)</h2>
        <ul className="divide-y divide-line/70">{data.admins.map((a) => <li key={a.id} className="flex items-center gap-3 py-2.5 text-[13.5px]"><div className="min-w-0 flex-1"><div className="font-medium">{a.nombre}</div><div className="text-xs text-muted">{a.email}</div></div><Badge tone={a.role === 'owner' ? 'warn' : 'info'}>{a.roleLabel}</Badge>{!a.active && <Badge tone="bad">отключён</Badge>}</li>)}</ul>
        <p className="mt-3 text-xs text-muted">Пароли и доступ этих пользователей меняются в основной системе (Пользователи).</p></section>
      {edit && <Edit s={edit === 'new' ? null : edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); void reload(); }} />}
    </>
  );
}

function Edit({ s, onClose, onSaved }: { s: S | null; onClose: () => void; onSaved: () => void }) {
  const { toast } = useUi();
  const [f, setF] = useState({ nombre: s?.nombre ?? '', email: s?.email ?? '', role: s?.role ?? 'accountant', password: '', outletId: s?.outlet_id ?? '' });
  const { data: outlets } = useFetch(() => get<{ outlets: { id: string; name: string }[] }>('/fc/outlets'), [], { live: false });
  const [busy, setBusy] = useState(false);
  const gen = () => { const a = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789'; setF({ ...f, password: Array.from(crypto.getRandomValues(new Uint32Array(12)), (n) => a[n % a.length]).join('') }); };
  const save = async () => {
    setBusy(true);
    try {
      const outletId = f.role === 'tenant' ? f.outletId || null : null;
      if (s) await patch('/staff/' + s.id, { nombre: f.nombre, role: f.role, outletId, ...(f.password ? { password: f.password } : {}) });
      else await post('/staff', { ...f, outletId });
      toast('ok', s ? 'Сохранено' : 'Сотрудник добавлен'); onSaved();
    } catch (e) { toast('err', (e as Error).message); } finally { setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title={s ? 'Изменить сотрудника' : 'Новый сотрудник'} width={520}
      footer={<><button className="btn btn-soft" onClick={onClose}>Отмена</button><button className="btn btn-primary" disabled={busy || !f.nombre.trim() || (!s && (!f.email || f.password.length < 8)) || (f.role === 'tenant' && !f.outletId)} onClick={() => void save()}>Сохранить</button></>}>
      <div className="space-y-3">
        <Field label="Имя и фамилия"><input className="input" autoFocus value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} /></Field>
        <Field label="Email (логин)"><input className="input" type="email" disabled={!!s} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        <Field label="Роль"><select className="input" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>{ROLES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
        {f.role === 'tenant' && <Field label="Точка фудкорта" hint="Арендатор увидит только данные этой точки"><select className="input" value={f.outletId} onChange={(e) => setF({ ...f, outletId: e.target.value })}><option value="">— выберите —</option>{(outlets?.outlets ?? []).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></Field>}
        <Field label={s ? 'Новый пароль (оставьте пустым, чтобы не менять)' : 'Пароль (минимум 8 символов)'}>
          <div className="flex gap-2"><input className="input font-mono" autoComplete="new-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /><button type="button" className="btn btn-soft shrink-0" onClick={gen}><KeyRound size={15} /> Создать</button></div></Field>
        <p className="text-xs text-muted">{ROLES.find((r) => r[0] === f.role)?.[2]}</p>
      </div>
    </Modal>
  );
}

/* ───────── Персонал кассы: официанты, кассиры, повара, доставщики ───────── */
function PosStaff() {
  const { toast, confirm } = useUi();
  const { data, error, reload } = useFetch(() => get<Resp>('/staff'), []);
  const [edit, setEdit] = useState<P | 'new' | null>(null);
  if (error && !data) return <ErrorBox error={error} onRetry={reload} />;
  if (!data) return <Loading />;
  const act = async (fn: () => Promise<unknown>, ok: string) => { try { await fn(); toast('ok', ok); void reload(); } catch (e) { toast('err', (e as Error).message); } };
  const cols: Col<P>[] = [
    { key: 'n', header: 'Сотрудник', render: (u) => <div><div className="font-medium">{u.nombre}</div><div className="text-xs text-muted">{u.email}</div></div>, sort: (u) => u.nombre, csv: (u) => u.nombre },
    { key: 'r', header: 'Роль', render: (u) => <Badge tone="brand">{u.roleLabel}</Badge>, sort: (u) => u.roleLabel, csv: (u) => u.roleLabel },
    { key: 'o', header: 'Заказов', align: 'right', render: (u) => <span className="tabular-nums text-muted">{u.orders}</span>, sort: (u) => u.orders, hideOnMobile: true, csv: (u) => u.orders },
    { key: 'a', header: 'Доступ', render: (u) => <Toggle checked={u.active} onChange={(v) => void act(() => patch('/staff/pos/' + u.id, { active: v }), v ? 'Доступ открыт' : 'Доступ закрыт')} /> },
    { key: 'x', header: '', align: 'right', render: (u) => (
      <span className="inline-flex gap-0.5"><button className="btn btn-ghost btn-sm !px-1.5" title="Изменить" onClick={() => setEdit(u)}><UserCog size={15} /></button>
        <button className="btn btn-ghost btn-sm !px-1.5 hover:!text-bad" title="Удалить" onClick={async () => { if (await confirm({ title: `Удалить «${u.nombre}»?`, text: 'Учётная запись будет удалена. Если у сотрудника есть заказы, удалить нельзя — отключите доступ.', danger: true, confirmLabel: 'Удалить' })) void act(() => del('/staff/pos/' + u.id), 'Сотрудник удалён'); }}><Trash2 size={15} /></button></span>) },
  ];
  return (
    <>
      <PageHeader title="Персонал кассы" subtitle="Официанты, кассиры, повара и доставщики. Они входят в кассовую систему innova365.kz со своим email и паролем" actions={<button className="btn btn-primary" onClick={() => setEdit('new')}><Plus size={15} /> Добавить сотрудника</button>} />
      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {POS_ROLES.map(([k, l, d, Icon]) => <div key={k} className="card p-4"><div className="mb-1 flex items-center gap-2 font-semibold"><Icon size={16} className="text-brand" />{l}</div><p className="text-[12.5px] leading-relaxed text-muted">{d}</p><div className="mt-2 text-xs text-muted">Сотрудников: <b className="text-ink">{data.pos.filter((u) => u.rol === k).length}</b></div></div>)}
      </div>
      <DataTable cols={cols} rows={data.pos} rowKey={(u) => u.id} csvName="pos-staff" empty={<div className="py-12 text-center text-sm text-muted">Персонала кассы пока нет</div>} />
      {edit && <PosEdit u={edit === 'new' ? null : edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); void reload(); }} />}
    </>
  );
}

function PosEdit({ u, onClose, onSaved }: { u: P | null; onClose: () => void; onSaved: () => void }) {
  const { toast } = useUi();
  const [f, setF] = useState({ nombre: u?.nombre ?? '', email: u?.email ?? '', rol: u?.rol ?? 'MESERO', password: '' });
  const [busy, setBusy] = useState(false);
  const gen = () => { const a = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789'; setF({ ...f, password: Array.from(crypto.getRandomValues(new Uint32Array(12)), (n) => a[n % a.length]).join('') }); };
  const save = async () => {
    setBusy(true);
    try {
      if (u) await patch('/staff/pos/' + u.id, { nombre: f.nombre, rol: f.rol, ...(f.password ? { password: f.password } : {}) });
      else await post('/staff/pos', f);
      toast('ok', u ? 'Сохранено' : 'Сотрудник добавлен'); onSaved();
    } catch (e) { toast('err', (e as Error).message); } finally { setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title={u ? 'Изменить сотрудника' : 'Новый сотрудник кассы'} width={520}
      footer={<><button className="btn btn-soft" onClick={onClose}>Отмена</button><button className="btn btn-primary" disabled={busy || !f.nombre.trim() || (!u && (!f.email || f.password.length < 8))} onClick={() => void save()}>Сохранить</button></>}>
      <div className="space-y-3">
        <Field label="Имя и фамилия"><input className="input" autoFocus value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} /></Field>
        <Field label="Email (логин для кассы)"><input className="input" type="email" disabled={!!u} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        <Field label="Роль"><select className="input" value={f.rol} onChange={(e) => setF({ ...f, rol: e.target.value })}>{POS_ROLES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
        <Field label={u ? 'Новый пароль (оставьте пустым, чтобы не менять)' : 'Пароль (минимум 8 символов)'}>
          <div className="flex gap-2"><input className="input font-mono" autoComplete="new-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /><button type="button" className="btn btn-soft shrink-0" onClick={gen}><KeyRound size={15} /> Создать</button></div></Field>
        <p className="text-xs text-muted">{POS_ROLES.find((r) => r[0] === f.rol)?.[2]}</p>
      </div>
    </Modal>
  );
}
