import { useState } from 'react';
import { AlertTriangle, FileSignature, Plus, Trash2, TrendingUp } from 'lucide-react';
import { del, get, patch, post } from '../api';
import { Attachments } from '../Attachments';
import { useAuth } from '../auth';
import { fmtDate, money, pct, todayIn } from '../format';
import { Badge, Col, DataTable, ErrorBox, Field, Loading, Modal, PageHeader, StatCard, Toggle, useFetch, useUi } from '../ui';
import { Chips, parseNum } from '../ui2';

interface Lease { id: string; outletId: string; outletName: string; number: string; signedDate: string | null; startDate: string; endDate: string | null; rentMonthly: number; commissionPct: number; deposit: number; depositPaid: boolean; paymentDay: number | null; indexationPct: number; indexationMonth: number | null; noticeDays: number; status: 'draft' | 'active' | 'ended' | 'terminated'; notes: string | null; daysLeft: number | null; expiring: boolean; overdueEnd: boolean }
interface Detail extends Lease { rentHistory: { from: string; rent: number; reason: string | null; who: string | null }[] }
interface Outlet { id: string; name: string }

const ST = { draft: { label: 'Черновик', tone: 'muted' as const }, active: { label: 'Действует', tone: 'good' as const }, ended: { label: 'Завершён', tone: 'info' as const }, terminated: { label: 'Расторгнут', tone: 'bad' as const } };
const MONTHS = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];

/** Договоры аренды: сроки, ставка, комиссия, депозит, индексация. Действующий договор управляет карточкой точки. */
export default function Leases() {
  const { can } = useAuth();
  const { data, error, reload } = useFetch(() => get<Lease[]>('/fc/leases'), []);
  const { data: outlets } = useFetch(() => get<{ outlets: Outlet[] }>('/fc/outlets'), [], { live: false });
  const [edit, setEdit] = useState<string | 'new' | null>(null);
  const [view, setView] = useState<'active' | 'all'>('active');
  if (error && !data) return <ErrorBox error={error} onRetry={reload} />;
  if (!data || !outlets) return <Loading />;
  const rows = data.filter((l) => view === 'all' || l.status === 'active' || l.status === 'draft');
  const active = data.filter((l) => l.status === 'active');
  const cols: Col<Lease>[] = [
    { key: 'n', header: 'Договор', render: (l) => <div><div className="font-medium">№{l.number} · {l.outletName}</div><div className="text-xs text-muted">с {fmtDate(l.startDate)}{l.endDate ? ` по ${fmtDate(l.endDate)}` : ' · бессрочный'}</div></div>, sort: (l) => l.outletName, csv: (l) => `${l.number} ${l.outletName}` },
    { key: 's', header: 'Статус', render: (l) => <div className="flex flex-wrap gap-1"><Badge tone={ST[l.status].tone}>{ST[l.status].label}</Badge>{l.expiring && <Badge tone="warn">заканчивается · {l.daysLeft} дн.</Badge>}{l.overdueEnd && <Badge tone="bad">срок истёк</Badge>}</div>, csv: (l) => ST[l.status].label },
    { key: 'r', header: 'Аренда в месяц', align: 'right', render: (l) => <b>{money(l.rentMonthly)}</b>, sort: (l) => l.rentMonthly, csv: (l) => l.rentMonthly },
    { key: 'c', header: 'Комиссия', align: 'right', render: (l) => pct(l.commissionPct), sort: (l) => l.commissionPct, hideOnMobile: true, csv: (l) => l.commissionPct },
    { key: 'd', header: 'Депозит', align: 'right', render: (l) => (l.deposit ? <span>{money(l.deposit)} {l.depositPaid ? <Badge tone="good">внесён</Badge> : <Badge tone="warn">не внесён</Badge>}</span> : '—'), hideOnMobile: true, csv: (l) => l.deposit },
    { key: 'i', header: 'Индексация', render: (l) => (l.indexationPct ? <span className="text-xs">{l.indexationPct}%{l.indexationMonth ? `, ${MONTHS[l.indexationMonth - 1]}` : ''}</span> : <span className="text-muted">—</span>), hideOnMobile: true, csv: (l) => l.indexationPct },
  ];
  return (
    <>
      <PageHeader title="Договоры аренды" subtitle="Условия, сроки и индексация. Ставка и комиссия действующего договора автоматически попадают в карточку точки и в расчёты"
        actions={can('fc.edit') && <button className="btn btn-primary" onClick={() => setEdit('new')}><Plus size={15} /> Новый договор</button>} />
      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Действующих договоров" value={active.length} icon={<FileSignature size={16} />} />
        <StatCard label="Аренда в месяц" value={money(active.reduce((s, l) => s + l.rentMonthly, 0))} />
        <StatCard label="Заканчиваются" value={active.filter((l) => l.expiring || l.overdueEnd).length} tone={active.some((l) => l.expiring || l.overdueEnd) ? 'warn' : undefined} icon={<AlertTriangle size={16} />} sub="в пределах срока уведомления" />
        <StatCard label="Депозиты не внесены" value={active.filter((l) => l.deposit > 0 && !l.depositPaid).length} tone={active.some((l) => l.deposit > 0 && !l.depositPaid) ? 'warn' : undefined} />
      </div>
      <div className="mb-4"><Chips value={view} onChange={setView} options={[{ id: 'active', label: 'Действующие' }, { id: 'all', label: 'Все (с архивом)' }]} /></div>
      <DataTable cols={cols} rows={rows} rowKey={(l) => l.id} csvName="leases" onRowClick={(l) => setEdit(l.id)} initialSort={{ key: 'n', dir: 'asc' }} empty={<div className="py-12 text-center text-sm text-muted">Договоров нет. Создайте договор — условия попадут в карточку точки.</div>} />
      {edit && <LeaseModal id={edit === 'new' ? null : edit} outlets={outlets.outlets} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); void reload(); }} />}
    </>
  );
}

function LeaseModal({ id, outlets, onClose, onSaved }: { id: string | null; outlets: Outlet[]; onClose: () => void; onSaved: () => void }) {
  const { me, can } = useAuth();
  const { toast, confirm } = useUi();
  const { data: d, reload } = useFetch(() => (id ? get<Detail>('/fc/leases/' + id) : Promise.resolve(null)), [id], { live: false });
  const today = todayIn(me!.settings.timezone);
  const [f, setF] = useState<null | { outletId: string; number: string; signedDate: string; startDate: string; endDate: string; rentMonthly: string; commissionPct: string; deposit: string; depositPaid: boolean; paymentDay: string; indexationPct: string; indexationMonth: string; noticeDays: string; status: Lease['status']; notes: string }>(null);
  const [busy, setBusy] = useState(false);
  const [idx, setIdx] = useState(false);
  if (id && !d) return <Modal open onClose={onClose} title="Договор"><Loading /></Modal>;
  const form = f ?? {
    outletId: d?.outletId ?? outlets[0]?.id ?? '', number: d?.number ?? '', signedDate: d?.signedDate ?? '', startDate: d?.startDate ?? today, endDate: d?.endDate ?? '', rentMonthly: d ? String(d.rentMonthly) : '', commissionPct: d ? String(d.commissionPct) : '0', deposit: d ? String(d.deposit) : '0',
    depositPaid: d?.depositPaid ?? false, paymentDay: d?.paymentDay ? String(d.paymentDay) : '10', indexationPct: d ? String(d.indexationPct) : '0', indexationMonth: d?.indexationMonth ? String(d.indexationMonth) : '', noticeDays: d ? String(d.noticeDays) : '30', status: d?.status ?? 'active', notes: d?.notes ?? '',
  };
  const set = (p: Partial<typeof form>) => setF({ ...form, ...p });
  const canEdit = can('fc.edit');
  const save = async () => {
    setBusy(true);
    try {
      const body = { outletId: form.outletId, number: form.number, signedDate: form.signedDate || null, startDate: form.startDate, endDate: form.endDate || null, rentMonthly: parseNum(form.rentMonthly) || 0, commissionPct: parseNum(form.commissionPct) || 0, deposit: parseNum(form.deposit) || 0, depositPaid: form.depositPaid,
        paymentDay: form.paymentDay ? Number(form.paymentDay) : null, indexationPct: parseNum(form.indexationPct) || 0, indexationMonth: form.indexationMonth ? Number(form.indexationMonth) : null, noticeDays: Number(form.noticeDays) || 30, status: form.status, notes: form.notes || null };
      if (id) await patch('/fc/leases/' + id, body); else await post('/fc/leases', body);
      toast('ok', 'Договор сохранён'); onSaved();
    } catch (e) { toast('err', (e as Error).message); } finally { setBusy(false); }
  };
  return (
    <>
      <Modal open onClose={onClose} title={id ? `Договор №${d!.number}` : 'Новый договор аренды'} width={760}
        footer={<>{id && canEdit && d!.status !== 'active' && <button className="btn btn-ghost mr-auto hover:!text-bad" onClick={async () => { if (await confirm({ title: 'Удалить договор?', danger: true, confirmLabel: 'Удалить' })) { try { await del('/fc/leases/' + id); onSaved(); } catch (e) { toast('err', (e as Error).message); } } }}><Trash2 size={15} /></button>}
          {id && canEdit && d!.status === 'active' && <button className="btn btn-soft mr-auto" onClick={() => setIdx(true)}><TrendingUp size={15} /> Индексировать аренду</button>}
          <button className="btn btn-soft" onClick={onClose}>Закрыть</button>{canEdit && <button className="btn btn-primary" disabled={busy || !form.number.trim() || !form.outletId} onClick={() => void save()}>Сохранить</button>}</>}>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Точка" className="sm:col-span-2"><select className="input" disabled={!!id || !canEdit} value={form.outletId} onChange={(e) => set({ outletId: e.target.value })}>{outlets.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></Field>
          <Field label="Номер договора"><input className="input" disabled={!canEdit} value={form.number} onChange={(e) => set({ number: e.target.value })} /></Field>
          <Field label="Дата подписания"><input type="date" className="input" disabled={!canEdit} value={form.signedDate} onChange={(e) => set({ signedDate: e.target.value })} /></Field>
          <Field label="Начало действия"><input type="date" className="input" disabled={!canEdit} value={form.startDate} onChange={(e) => set({ startDate: e.target.value })} /></Field>
          <Field label="Окончание" hint="пусто — бессрочный"><input type="date" className="input" disabled={!canEdit} value={form.endDate} onChange={(e) => set({ endDate: e.target.value })} /></Field>
          <Field label="Аренда в месяц"><input className="input tnum" inputMode="decimal" disabled={!canEdit} value={form.rentMonthly} onChange={(e) => set({ rentMonthly: e.target.value })} /></Field>
          <Field label="Комиссия, % от выручки"><input className="input tnum" inputMode="decimal" disabled={!canEdit} value={form.commissionPct} onChange={(e) => set({ commissionPct: e.target.value })} /></Field>
          <Field label="День оплаты в месяце"><input className="input tnum" inputMode="numeric" disabled={!canEdit} value={form.paymentDay} onChange={(e) => set({ paymentDay: e.target.value })} /></Field>
          <Field label="Депозит"><input className="input tnum" inputMode="decimal" disabled={!canEdit} value={form.deposit} onChange={(e) => set({ deposit: e.target.value })} /></Field>
          <div className="flex items-end pb-1.5"><Toggle checked={form.depositPaid} disabled={!canEdit} onChange={(v) => set({ depositPaid: v })} label="Депозит внесён" /></div>
          <Field label="Предупредить за, дней" hint="до окончания договора"><input className="input tnum" inputMode="numeric" disabled={!canEdit} value={form.noticeDays} onChange={(e) => set({ noticeDays: e.target.value })} /></Field>
          <Field label="Индексация, % в год"><input className="input tnum" inputMode="decimal" disabled={!canEdit} value={form.indexationPct} onChange={(e) => set({ indexationPct: e.target.value })} /></Field>
          <Field label="Месяц индексации"><select className="input" disabled={!canEdit} value={form.indexationMonth} onChange={(e) => set({ indexationMonth: e.target.value })}><option value="">—</option>{MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</select></Field>
          <Field label="Статус"><select className="input" disabled={!canEdit} value={form.status} onChange={(e) => set({ status: e.target.value as Lease['status'] })}>{Object.entries(ST).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></Field>
          <Field label="Заметки" className="sm:col-span-3"><input className="input" disabled={!canEdit} value={form.notes} onChange={(e) => set({ notes: e.target.value })} /></Field>
        </div>
        {form.status !== 'active' && d?.status === 'active' && <p className="mt-3 rounded-lg bg-warn/10 p-2.5 text-xs text-warn">После сохранения аренда по этой точке перестанет начисляться со следующего дня после даты окончания.</p>}
        {id && d && d.rentHistory.length > 0 && (
          <section className="mt-4"><h4 className="mb-2 text-sm font-semibold">История арендной ставки точки</h4>
            <div className="overflow-hidden rounded-lg border border-line"><table className="w-full text-[13px]"><thead><tr><th className="th">С даты</th><th className="th text-right">Ставка в месяц</th><th className="th">Основание</th></tr></thead>
              <tbody>{d.rentHistory.map((h) => <tr key={h.from}><td className="td">{h.from === '2000-01-01' ? 'исходная' : fmtDate(h.from)}</td><td className="td tnum text-right font-medium">{money(h.rent)}</td><td className="td text-muted">{h.reason ?? '—'}{h.who ? ` · ${h.who}` : ''}</td></tr>)}</tbody></table></div></section>
        )}
        {id && <div className="mt-4"><Attachments entity="lease" entityId={id} canEdit={can('files') && canEdit} title="Скан договора и допсоглашения" /></div>}
      </Modal>
      {idx && d && <IndexModal lease={d} today={today} onClose={() => setIdx(false)} onDone={() => { setIdx(false); void reload(); onSaved(); }} />}
    </>
  );
}

function IndexModal({ lease, today, onClose, onDone }: { lease: Lease; today: string; onClose: () => void; onDone: () => void }) {
  const { toast } = useUi();
  const next = new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)), 1)).toISOString().slice(0, 10);
  const [p, setP] = useState(lease.indexationPct ? String(lease.indexationPct) : '10');
  const [from, setFrom] = useState(next);
  const v = parseNum(p);
  const go = async () => { try { await post(`/fc/leases/${lease.id}/index`, { pct: v, from }); toast('ok', 'Аренда проиндексирована'); onDone(); } catch (e) { toast('err', (e as Error).message); } };
  return (
    <Modal open onClose={onClose} title="Индексация аренды" width={440} footer={<><button className="btn btn-soft" onClick={onClose}>Отмена</button><button className="btn btn-primary" disabled={!(v > 0)} onClick={() => void go()}>Применить</button></>}>
      <div className="grid gap-3 sm:grid-cols-2"><Field label="Повышение, %"><input className="input tnum" autoFocus inputMode="decimal" value={p} onChange={(e) => setP(e.target.value)} /></Field><Field label="Действует с"><input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} /></Field></div>
      <p className="mt-3 text-sm">Было <b>{money(lease.rentMonthly)}</b> → станет <b className="text-brand">{money(Math.round(lease.rentMonthly * (1 + (v || 0) / 100) * 100) / 100)}</b> в месяц.</p>
      <p className="mt-2 text-xs text-muted">Расчёты за периоды до этой даты останутся по старой ставке; за периоды, захватывающие дату, ставка считается по дням.</p>
    </Modal>
  );
}
