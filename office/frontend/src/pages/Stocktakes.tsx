import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardCheck, Plus } from 'lucide-react';
import { get, post } from '../api';
import { useAuth } from '../auth';
import { fmtDateTime, money } from '../format';
import { Badge, Col, DataTable, ErrorBox, Field, Loading, Modal, PageHeader, useFetch, useUi } from '../ui';
import { ProgressBar } from '../ui2';

interface Row { id: string; number: number; title: string; status: 'draft' | 'closed' | 'cancelled'; scope: string | null; created_by_name: string | null; created_at: string; closed_at: string | null; closed_by_name: string | null; shortage_value: number | null; surplus_value: number | null; total: number; counted: number; diffs: number }

export const ST_STATUS = { draft: { label: 'Идёт подсчёт', tone: 'warn' as const }, closed: { label: 'Закрыта', tone: 'good' as const }, cancelled: { label: 'Отменена', tone: 'muted' as const } };

/** Список инвентаризаций + создание новой (снимок остатков на момент начала). */
export default function Stocktakes() {
  const { can } = useAuth();
  const nav = useNavigate();
  const { data, error, reload } = useFetch(() => get<Row[]>('/inv/stocktakes'), []);
  const [creating, setCreating] = useState(false);
  if (error && !data) return <ErrorBox error={error} onRetry={reload} />;
  if (!data) return <Loading />;
  const open = data.find((r) => r.status === 'draft');
  const money_ = data.some((r) => r.shortage_value !== null);
  const cols: Col<Row>[] = [
    { key: 'n', header: '№', render: (r) => <b>{r.number}</b>, sort: (r) => r.number, csv: (r) => r.number, width: 60 },
    { key: 't', header: 'Инвентаризация', render: (r) => <div><div className="font-medium">{r.title}</div><div className="text-xs text-muted">{r.scope ? `Категория: ${r.scope}` : 'Весь склад'} · {r.created_by_name ?? '—'}</div></div>, csv: (r) => r.title },
    { key: 's', header: 'Статус', render: (r) => <Badge tone={ST_STATUS[r.status].tone}>{ST_STATUS[r.status].label}</Badge>, csv: (r) => ST_STATUS[r.status].label },
    { key: 'p', header: 'Подсчитано', render: (r) => <div className="min-w-[110px]"><div className="mb-1 text-xs"><b>{r.counted}</b> из {r.total}{r.diffs ? <span className="text-warn"> · расхождений {r.diffs}</span> : ''}</div><ProgressBar value={r.counted} max={r.total} tone={r.counted === r.total ? 'good' : 'brand'} /></div>, hideOnMobile: true },
    ...(money_ ? [{ key: 'sh', header: 'Недостача', align: 'right' as const, render: (r: Row) => (r.shortage_value ? <span className="text-bad">{money(r.shortage_value)}</span> : '—'), sort: (r: Row) => r.shortage_value, hideOnMobile: true, csv: (r: Row) => r.shortage_value },
      { key: 'su', header: 'Излишек', align: 'right' as const, render: (r: Row) => (r.surplus_value ? <span className="text-good">{money(r.surplus_value)}</span> : '—'), sort: (r: Row) => r.surplus_value, hideOnMobile: true, csv: (r: Row) => r.surplus_value }] : []),
    { key: 'd', header: 'Дата', render: (r) => <span className="text-xs text-muted">{fmtDateTime(r.closed_at ?? r.created_at)}</span>, sort: (r) => r.closed_at ?? r.created_at, csv: (r) => r.created_at },
  ];
  return (
    <>
      <PageHeader title="Инвентаризация" subtitle="Подсчёт фактических остатков и расхождения с учётом. После закрытия склад исправляется, а в журнале остаётся след"
        actions={can('inv.edit') && (open ? <button className="btn btn-primary" onClick={() => nav(`/inventory/stocktakes/${open.id}`)}><ClipboardCheck size={15} /> Продолжить подсчёт №{open.number}</button> : <button className="btn btn-primary" onClick={() => setCreating(true)}><Plus size={15} /> Начать инвентаризацию</button>)} />
      <DataTable cols={cols} rows={data} rowKey={(r) => r.id} onRowClick={(r) => nav(`/inventory/stocktakes/${r.id}`)} initialSort={{ key: 'n', dir: 'desc' }}
        empty={<div className="py-14 text-center text-sm text-muted">Инвентаризаций пока не было. Начните подсчёт — система запомнит учётные остатки на этот момент.</div>} />
      {creating && <CreateModal onClose={() => setCreating(false)} onCreated={(id) => nav(`/inventory/stocktakes/${id}`)} />}
    </>
  );
}

function CreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const { toast } = useUi();
  const { data: stock } = useFetch(() => get<{ items: { categoria: string | null }[] }>('/inv/stock'), [], { live: false });
  const cats = [...new Set((stock?.items ?? []).map((i) => i.categoria).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b, 'ru'));
  const [title, setTitle] = useState(() => `Инвентаризация ${new Date().toLocaleDateString('ru-RU')}`);
  const [category, setCategory] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true);
    try { const r = await post<{ id: string }>('/inv/stocktakes', { title, category: category || null, note: note || null }); onCreated(r.id); } catch (e) { toast('err', (e as Error).message); setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title="Новая инвентаризация" width={500} footer={<><button className="btn btn-soft" onClick={onClose}>Отмена</button><button className="btn btn-primary" disabled={busy || title.trim().length < 2} onClick={() => void go()}>Начать подсчёт</button></>}>
      <div className="space-y-3">
        <Field label="Название"><input className="input" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
        <Field label="Что считаем" hint="Можно пересчитать только одну категорию — например, бар или мясной цех"><select className="input" value={category} onChange={(e) => setCategory(e.target.value)}><option value="">Весь склад</option>{cats.map((c) => <option key={c}>{c}</option>)}</select></Field>
        <Field label="Комментарий"><input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="необязательно" /></Field>
        <p className="rounded-lg bg-surface2 p-3 text-xs leading-relaxed text-muted">Система запомнит текущие остатки. Продажи во время подсчёта не помешают: при закрытии к текущему остатку прибавляется только разница «факт − запомненный учёт».</p>
      </div>
    </Modal>
  );
}
