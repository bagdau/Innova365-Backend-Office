import { useState } from 'react';
import { Check, Pencil, Plus, Printer, Trash2, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { get, post, put, qs } from '../api';
import { Attachments } from '../Attachments';
import { useAuth } from '../auth';
import { fmtDate, money, todayIn } from '../format';
import { Badge, Col, DataTable, ErrorBox, Field, Loading, Modal, PageHeader, PeriodPicker, StatCard, useFetch, usePeriod, useUi } from '../ui';
import { fmtQty, parseNum, Picker } from '../ui2';

interface Row { id: string; number: number; date: string; reason: string; reasonLabel: string; note: string | null; status: 'draft' | 'approved' | 'cancelled'; total_cost: number | null; created_by_name: string | null; approved_by_name: string | null; lines: number }
interface Resp { canCost: boolean; rows: Row[]; total: number | null; byReason: { reason: string; label: string; total: number }[] }
interface Detail { id: string; number: number; date: string; reason: string; note: string | null; status: Row['status']; total_cost: number | null; canCost: boolean; created_by_name: string | null; approved_by_name: string | null; lines: { id: string; insumoId: string; nombre: string; unidad: string; qty: number; cost: number | null; stock: number | null }[] }
interface Stock { items: { id: string; nombre: string; unidad: string; stock: number }[] }

const REASONS: [string, string][] = [['spoilage', 'Порча'], ['expired', 'Истёк срок годности'], ['breakage', 'Бой / поломка'], ['staff_meal', 'Питание персонала'], ['tasting', 'Проба / дегустация'], ['return', 'Возврат поставщику'], ['other', 'Прочее']];
const ST = { draft: { label: 'Черновик', tone: 'warn' as const }, approved: { label: 'Проведено', tone: 'good' as const }, cancelled: { label: 'Отменено', tone: 'muted' as const } };

/** Списания сырья: порча, бой, угощение. Проведённое списание уменьшает склад и пишет в общий журнал. */
export default function Writeoffs() {
  const { can } = useAuth();
  const [period, setPeriod] = usePeriod('month');
  const [open, setOpen] = useState<string | 'new' | null>(null);
  const { data, error, reload, loading } = useFetch(() => get<Resp>('/inv/writeoffs' + qs(period)), [period.from, period.to]);
  if (error && !data) return <ErrorBox error={error} onRetry={reload} />;
  if (!data) return <Loading />;
  const cols: Col<Row>[] = [
    { key: 'n', header: '№', render: (r) => <b>{r.number}</b>, sort: (r) => r.number, csv: (r) => r.number, width: 60 },
    { key: 'd', header: 'Дата', render: (r) => fmtDate(r.date), sort: (r) => r.date, csv: (r) => r.date },
    { key: 'r', header: 'Причина', render: (r) => <div><div>{r.reasonLabel}</div>{r.note && <div className="text-xs text-muted">{r.note}</div>}</div>, csv: (r) => r.reasonLabel },
    { key: 'l', header: 'Позиций', align: 'right', render: (r) => r.lines, hideOnMobile: true, csv: (r) => r.lines },
    { key: 's', header: 'Статус', render: (r) => <Badge tone={ST[r.status].tone}>{ST[r.status].label}</Badge>, csv: (r) => ST[r.status].label },
    { key: 'w', header: 'Составил', render: (r) => <span className="text-xs text-muted">{r.created_by_name ?? '—'}</span>, hideOnMobile: true, csv: (r) => r.created_by_name },
    ...(data.canCost ? [{ key: 'c', header: 'Сумма', align: 'right' as const, render: (r: Row) => (r.status === 'approved' ? <b>{money(r.total_cost)}</b> : <span className="text-muted">—</span>), sort: (r: Row) => r.total_cost, csv: (r: Row) => r.total_cost }] : []),
  ];
  return (
    <>
      <PageHeader title="Списания" subtitle="Порча, бой, питание персонала, пробы. Списание проводит утверждающий — после этого остатки уменьшаются"
        actions={can('inv.edit') && <button className="btn btn-primary" onClick={() => setOpen('new')}><Plus size={15} /> Новое списание</button>} />
      <div className="mb-4"><PeriodPicker value={period} onChange={setPeriod} /></div>
      <div className={loading ? 'opacity-60 transition' : 'transition'}>
        {data.canCost && (
          <div className="mb-5 grid gap-3 sm:grid-cols-3">
            <StatCard label="Списано за период" value={money(data.total)} tone={data.total ? 'bad' : undefined} sub={`${data.rows.filter((r) => r.status === 'approved').length} проведённых актов`} />
            <StatCard label="Ждут проведения" value={data.rows.filter((r) => r.status === 'draft').length} tone={data.rows.some((r) => r.status === 'draft') ? 'warn' : undefined} />
            <StatCard label="Главная причина" value={data.byReason[0]?.label ?? '—'} sub={data.byReason[0] ? money(data.byReason[0].total) : undefined} />
          </div>
        )}
        <DataTable cols={cols} rows={data.rows} rowKey={(r) => r.id} csvName="writeoffs" onRowClick={(r) => setOpen(r.id)} initialSort={{ key: 'd', dir: 'desc' }} />
      </div>
      {open && <Editor id={open === 'new' ? null : open} onClose={() => setOpen(null)} onChanged={() => void reload()} />}
    </>
  );
}

function Editor({ id, onClose, onChanged }: { id: string | null; onClose: () => void; onChanged: () => void }) {
  const { me, can } = useAuth();
  const { toast, confirm } = useUi();
  const { data: stock } = useFetch(() => get<Stock>('/inv/stock'), [], { live: false });
  const { data: doc, reload } = useFetch(() => (id ? get<Detail>('/inv/writeoffs/' + id) : Promise.resolve(null)), [id], { live: false });
  const [f, setF] = useState<{ date: string; reason: string; note: string; lines: { insumoId: string; qty: string }[] } | null>(null);
  const [busy, setBusy] = useState(false);
  if (!stock || (id && !doc)) return <Modal open onClose={onClose} title="Списание"><Loading /></Modal>;
  const readOnly = !!doc && doc.status !== 'draft';
  const form = f ?? { date: doc?.date.slice(0, 10) ?? todayIn(me!.settings.timezone), reason: doc?.reason ?? 'spoilage', note: doc?.note ?? '', lines: doc ? doc.lines.map((l) => ({ insumoId: l.insumoId, qty: String(l.qty) })) : [{ insumoId: '', qty: '' }] };
  const patch = (p: Partial<typeof form>) => setF({ ...form, ...p });
  const byId = new Map(stock.items.map((i) => [i.id, i]));
  const payload = () => ({ date: form.date, reason: form.reason, note: form.note || null, lines: form.lines.filter((l) => l.insumoId).map((l) => ({ insumoId: l.insumoId, qty: parseNum(l.qty) })) });
  const valid = form.lines.some((l) => l.insumoId) && form.lines.filter((l) => l.insumoId).every((l) => parseNum(l.qty) > 0);

  const save = async (approve: boolean) => {
    setBusy(true);
    try {
      if (id) { await put('/inv/writeoffs/' + id, payload()); if (approve) await post(`/inv/writeoffs/${id}/approve`); } else await post('/inv/writeoffs', { ...payload(), approve });
      toast('ok', approve ? 'Списание проведено' : 'Черновик сохранён'); onChanged(); onClose();
    } catch (e) { toast('err', (e as Error).message); } finally { setBusy(false); }
  };
  const cancel = async () => {
    if (!(await confirm({ title: 'Отменить списание?', danger: true, confirmLabel: 'Отменить' }))) return;
    try { await post(`/inv/writeoffs/${id}/cancel`); toast('ok', 'Списание отменено'); onChanged(); onClose(); } catch (e) { toast('err', (e as Error).message); }
  };

  return (
    <Modal open onClose={onClose} title={doc ? `Списание №${doc.number}` : 'Новое списание'} width={680}
      footer={readOnly ? <><span className="mr-auto self-center text-xs text-muted">{doc?.status === 'approved' ? `Проведено: ${doc.approved_by_name ?? ''}` : 'Отменено'}</span>{doc && <Link className="btn btn-soft" target="_blank" to={`/print/writeoff/${doc.id}`}><Printer size={15} /> Акт</Link>}<button className="btn btn-primary" onClick={onClose}>Закрыть</button></> : (
        <>{id && <button className="btn btn-ghost mr-auto" onClick={() => void cancel()}><X size={15} /> Отменить</button>}<button className="btn btn-soft" onClick={onClose}>Закрыть</button>
          <button className="btn btn-soft" disabled={busy || !valid} onClick={() => void save(false)}>Сохранить черновик</button>
          {can('inv.approve') && <button className="btn btn-primary" disabled={busy || !valid} onClick={() => void save(true)}><Check size={15} /> Провести</button>}</>)}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Дата"><input type="date" className="input" disabled={readOnly} value={form.date} onChange={(e) => patch({ date: e.target.value })} /></Field>
        <Field label="Причина"><select className="input" disabled={readOnly} value={form.reason} onChange={(e) => patch({ reason: e.target.value })}>{REASONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
        <Field label="Комментарий" className="sm:col-span-2"><input className="input" disabled={readOnly} value={form.note} onChange={(e) => patch({ note: e.target.value })} placeholder="например: холодильник отключался ночью" /></Field>
      </div>
      <h4 className="mb-2 mt-4 text-sm font-semibold">Что списываем</h4>
      <div className="space-y-2">
        {form.lines.map((l, i) => {
          const it = byId.get(l.insumoId);
          const over = it && parseNum(l.qty) > it.stock;
          return (
            <div key={i} className="grid grid-cols-[1fr_110px_auto] items-start gap-2">
              <div><Picker items={stock.items} value={l.insumoId} disabled={readOnly} onChange={(v) => patch({ lines: form.lines.map((x, j) => (j === i ? { ...x, insumoId: v } : x)) })} label={(x) => `${x.nombre} (${fmtQty(x.stock)} ${x.unidad})`} placeholder="Выберите сырьё" />{over && <p className="mt-1 text-[11px] text-bad">Больше остатка ({fmtQty(it!.stock)} {it!.unidad})</p>}</div>
              <div className="relative"><input className="input tnum text-right" disabled={readOnly} inputMode="decimal" value={l.qty} placeholder="0" onChange={(e) => patch({ lines: form.lines.map((x, j) => (j === i ? { ...x, qty: e.target.value } : x)) })} />{it && <span className="pointer-events-none absolute -bottom-4 right-1 text-[10px] text-muted">{it.unidad}</span>}</div>
              {!readOnly && form.lines.length > 1 && <button className="btn btn-ghost btn-sm !px-1.5 hover:!text-bad" onClick={() => patch({ lines: form.lines.filter((_, j) => j !== i) })}><Trash2 size={15} /></button>}
            </div>
          );
        })}
      </div>
      {!readOnly && <button className="btn btn-soft btn-sm mt-5" onClick={() => patch({ lines: [...form.lines, { insumoId: '', qty: '' }] })}><Plus size={14} /> Добавить позицию</button>}
      {doc?.canCost && doc.status === 'approved' && <p className="mt-4 text-sm">Сумма списания: <b>{money(doc.total_cost)}</b></p>}
      {id && <div className="mt-4"><Attachments entity="writeoff" entityId={id} canEdit={can('files') && can('inv.edit')} title="Фото и документы" /></div>}
      {readOnly && doc && <p className="mt-3 flex items-center gap-1 text-xs text-muted"><Pencil size={12} /> Проведённое списание изменить нельзя — исправьте ошибку новой операцией (корректировка или инвентаризация).</p>}
    </Modal>
  );
}
