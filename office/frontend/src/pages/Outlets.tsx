import { useState } from 'react';
import clsx from 'clsx';
import { Mail, Pencil, Percent, Phone, Plus, Store, Tags, Trash2, Wallet } from 'lucide-react';
import { del, get, post, put } from '../api';
import { useAuth } from '../auth';
import { fmtDate, money, num } from '../format';
import { Badge, Empty, ErrorBox, Field, Loading, Modal, PageHeader, StatCard, useFetch, useUi } from '../ui';

interface Outlet { id: string; name: string; legalName: string | null; bin: string | null; contact: string | null; phone: string | null; email: string | null; rentMonthly: number; commissionPct: number; status: 'active' | 'paused' | 'closed'; startDate: string | null; endDate: string | null; notes: string | null; categoryIds: string[] }
interface Cat { id: string; nombre: string; products: number; outletId: string | null }
interface Resp { outlets: Outlet[]; categories: Cat[] }

const ST: Record<string, [string, 'good' | 'warn' | 'muted']> = { active: ['Работает', 'good'], paused: ['Приостановлена', 'warn'], closed: ['Закрыта', 'muted'] };

export default function Outlets() {
  const { can } = useAuth();
  const { toast, confirm } = useUi();
  const { data, error, reload } = useFetch(() => get<Resp>('/fc/outlets'), []);
  const [edit, setEdit] = useState<Outlet | 'new' | null>(null);
  const [cats, setCats] = useState<Outlet | null>(null);
  const edt = can('fc.edit');
  if (error && !data) return <ErrorBox error={error} onRetry={reload} />;
  if (!data) return <Loading />;
  const active = data.outlets.filter((o) => o.status === 'active');
  const unassigned = data.categories.filter((c) => !c.outletId);
  const catName = (id: string) => data.categories.find((c) => c.id === id)?.nombre ?? id;

  return (
    <>
      <PageHeader title="Точки фудкорта" subtitle="Арендаторы: условия аренды, комиссия и закреплённые категории меню" actions={edt && <button className="btn btn-primary" onClick={() => setEdit('new')}><Plus size={15} /> Новая точка</button>} />
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <StatCard label="Работающих точек" value={`${active.length} из ${data.outlets.length}`} icon={<Store size={16} />} />
        <StatCard label="Аренда в месяц" value={money(active.reduce((a, o) => a + o.rentMonthly, 0))} sub="по работающим точкам" icon={<Wallet size={16} />} />
        <StatCard label="Категорий без точки" value={num(unassigned.length)} tone={unassigned.length ? 'warn' : 'good'} sub={unassigned.slice(0, 3).map((c) => c.nombre).join(', ') || 'всё распределено'} icon={<Tags size={16} />} />
      </div>
      {data.outlets.length === 0 ? (
        <div className="card"><Empty icon={<Store size={42} />} title="Точек пока нет" text="Добавьте первую точку фудкорта и закрепите за ней категории меню — выручка начнёт считаться по каждой точке." action={edt && <button className="btn btn-primary" onClick={() => setEdit('new')}><Plus size={15} /> Добавить точку</button>} /></div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.outlets.map((o) => (
            <div key={o.id} className={clsx('card flex flex-col p-4', o.status !== 'active' && 'opacity-75')}>
              <div className="flex items-start gap-3">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand/12 text-brand"><Store size={21} /></div>
                <div className="min-w-0 flex-1"><div className="truncate text-[16px] font-semibold">{o.name}</div><div className="truncate text-xs text-muted">{o.legalName || 'юр. лицо не указано'}{o.bin ? ` · БИН ${o.bin}` : ''}</div></div>
                <Badge tone={ST[o.status][1]}>{ST[o.status][0]}</Badge>
              </div>
              <div className="my-4 grid grid-cols-2 gap-2.5 text-center">
                <div className="rounded-lg bg-surface2 p-2.5"><div className="tnum text-[15px] font-semibold">{money(o.rentMonthly)}</div><div className="text-[11px] text-muted">аренда / мес</div></div>
                <div className="rounded-lg bg-surface2 p-2.5"><div className="tnum text-[15px] font-semibold"><Percent size={12} className="mr-0.5 inline text-muted" />{num(o.commissionPct, 1)}</div><div className="text-[11px] text-muted">комиссия с выручки</div></div>
              </div>
              <div className="mb-3 min-h-[44px]">
                <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted">Категории меню</div>
                {o.categoryIds.length ? <div className="flex flex-wrap gap-1.5">{o.categoryIds.map((id) => <span key={id} className="chip bg-brand/10 text-brand">{catName(id)}</span>)}</div> : <span className="text-[13px] text-warn">не закреплены — выручка не считается</span>}
              </div>
              <div className="space-y-1 text-[12.5px] text-muted">
                {o.contact && <div>{o.contact}</div>}
                {o.phone && <div className="flex items-center gap-1.5"><Phone size={12} />{o.phone}</div>}
                {o.email && <div className="flex items-center gap-1.5"><Mail size={12} />{o.email}</div>}
                {(o.startDate || o.endDate) && <div>Договор: {fmtDate(o.startDate)} — {o.endDate ? fmtDate(o.endDate) : 'бессрочно'}</div>}
              </div>
              {edt && (
                <div className="mt-auto flex gap-2 border-t border-line pt-3">
                  <button className="btn btn-soft btn-sm flex-1" onClick={() => setCats(o)}><Tags size={14} /> Категории</button>
                  <button className="btn btn-soft btn-sm flex-1" onClick={() => setEdit(o)}><Pencil size={14} /> Изменить</button>
                  <button className="btn btn-ghost btn-sm !px-2 hover:!text-bad" title="Удалить" onClick={async () => {
                    if (!(await confirm({ title: `Удалить точку «${o.name}»?`, text: 'Если по точке были взаиморасчёты, удалить нельзя — переведите её в статус «Закрыта».', danger: true, confirmLabel: 'Удалить' }))) return;
                    try { await del('/fc/outlets/' + o.id); toast('ok', 'Точка удалена'); void reload(); } catch (e) { toast('err', (e as Error).message); }
                  }}><Trash2 size={15} /></button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {edit && <OutletModal outlet={edit === 'new' ? null : edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); void reload(); }} />}
      {cats && <CategoriesModal outlet={cats} categories={data.categories} outlets={data.outlets} onClose={() => setCats(null)} onSaved={() => { setCats(null); void reload(); }} />}
    </>
  );
}

function OutletModal({ outlet, onClose, onSaved }: { outlet: Outlet | null; onClose: () => void; onSaved: () => void }) {
  const { toast } = useUi();
  const [f, setF] = useState({
    name: outlet?.name ?? '', legalName: outlet?.legalName ?? '', bin: outlet?.bin ?? '', contact: outlet?.contact ?? '', phone: outlet?.phone ?? '', email: outlet?.email ?? '',
    rentMonthly: String(outlet?.rentMonthly ?? ''), commissionPct: String(outlet?.commissionPct ?? ''), status: outlet?.status ?? 'active', startDate: outlet?.startDate ?? '', endDate: outlet?.endDate ?? '', notes: outlet?.notes ?? '',
  });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const save = async () => {
    setBusy(true);
    try {
      const body = { name: f.name, legalName: f.legalName || null, bin: f.bin || null, contact: f.contact || null, phone: f.phone || null, email: f.email || null,
        rentMonthly: Number(f.rentMonthly.replace(',', '.') || 0), commissionPct: Number(f.commissionPct.replace(',', '.') || 0), status: f.status, startDate: f.startDate || null, endDate: f.endDate || null, notes: f.notes || null };
      if (outlet) await put('/fc/outlets/' + outlet.id, body); else await post('/fc/outlets', body);
      toast('ok', 'Сохранено'); onSaved();
    } catch (e) { toast('err', (e as Error).message); } finally { setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title={outlet ? 'Изменить точку' : 'Новая точка'} width={640}
      footer={<><button className="btn btn-soft" onClick={onClose}>Отмена</button><button className="btn btn-primary" disabled={busy || !f.name.trim()} onClick={() => void save()}>Сохранить</button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Название точки *" className="sm:col-span-2"><input className="input" autoFocus value={f.name} onChange={set('name')} placeholder="Например: Шашлычная «Жар»" /></Field>
        <Field label="Юридическое лицо"><input className="input" value={f.legalName} onChange={set('legalName')} placeholder="ИП / ТОО" /></Field>
        <Field label="БИН / ИИН"><input className="input" inputMode="numeric" value={f.bin} onChange={set('bin')} /></Field>
        <Field label="Аренда в месяц"><input className="input tnum" inputMode="decimal" value={f.rentMonthly} onChange={set('rentMonthly')} placeholder="0" /></Field>
        <Field label="Комиссия с выручки, %"><input className="input tnum" inputMode="decimal" value={f.commissionPct} onChange={set('commissionPct')} placeholder="0" /></Field>
        <Field label="Контактное лицо"><input className="input" value={f.contact} onChange={set('contact')} /></Field>
        <Field label="Телефон"><input className="input" value={f.phone} onChange={set('phone')} /></Field>
        <Field label="Email" className="sm:col-span-2"><input className="input" type="email" value={f.email} onChange={set('email')} /></Field>
        <Field label="Начало договора"><input type="date" className="input" value={f.startDate} onChange={set('startDate')} /></Field>
        <Field label="Окончание договора"><input type="date" className="input" value={f.endDate} onChange={set('endDate')} /></Field>
        <Field label="Статус"><select className="input" value={f.status} onChange={set('status')}><option value="active">Работает</option><option value="paused">Приостановлена</option><option value="closed">Закрыта</option></select></Field>
        <Field label="Заметки" className="sm:col-span-2"><textarea className="input" rows={2} value={f.notes} onChange={set('notes')} /></Field>
      </div>
    </Modal>
  );
}

function CategoriesModal({ outlet, categories, outlets, onClose, onSaved }: { outlet: Outlet; categories: Cat[]; outlets: Outlet[]; onClose: () => void; onSaved: () => void }) {
  const { toast } = useUi();
  const [sel, setSel] = useState<string[]>(outlet.categoryIds);
  const [busy, setBusy] = useState(false);
  const owner = (c: Cat) => outlets.find((o) => o.id === c.outletId && o.id !== outlet.id)?.name;
  const save = async () => {
    setBusy(true);
    try { await put(`/fc/outlets/${outlet.id}/categories`, { categoryIds: sel }); toast('ok', 'Категории закреплены'); onSaved(); } catch (e) { toast('err', (e as Error).message); } finally { setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title={`Категории: ${outlet.name}`} width={520}
      footer={<><button className="btn btn-soft" onClick={onClose}>Отмена</button><button className="btn btn-primary" disabled={busy} onClick={() => void save()}>Сохранить</button></>}>
      <p className="mb-3 text-sm text-muted">Выручка по блюдам этих категорий идёт в расчёт точки. Категория принадлежит одной точке — если она уже закреплена за другой, она будет перенесена.</p>
      <ul className="divide-y divide-line/70 rounded-lg border border-line">{categories.map((c) => {
        const on = sel.includes(c.id), o = owner(c);
        return (
          <li key={c.id}><label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-surface2/60">
            <input type="checkbox" className="h-4 w-4 accent-[rgb(var(--brand))]" checked={on} onChange={() => setSel(on ? sel.filter((x) => x !== c.id) : [...sel, c.id])} />
            <span className="min-w-0 flex-1"><span className="font-medium">{c.nombre}</span><span className="ml-2 text-xs text-muted">{c.products} блюд</span></span>
            {o && <span className="chip bg-warn/15 text-warn">сейчас: {o}</span>}
          </label></li>);
      })}</ul>
    </Modal>
  );
}
