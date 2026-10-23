import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Check, CheckCheck, Printer, XCircle } from 'lucide-react';
import { get, post, put } from '../api';
import { useAuth } from '../auth';
import { fmtDateTime, money } from '../format';
import { Badge, ErrorBox, Loading, PageHeader, StatCard, useFetch, useUi } from '../ui';
import { Chips, fmtQty, parseNum, ProgressBar, SearchBox } from '../ui2';
import { ST_STATUS } from './Stocktakes';

interface Line { insumoId: string; nombre: string; unidad: string; categoria: string | null; book: number; actual: number | null; cost: number | null; applied: number | null }
interface Doc { id: string; number: number; title: string; note: string | null; status: 'draft' | 'closed' | 'cancelled'; scope: string | null; created_by_name: string | null; created_at: string; closed_at: string | null; closed_by_name: string | null; shortage_value: number | null; surplus_value: number | null; canCost: boolean; lines: Line[] }

/** Экран подсчёта: вводим факт напротив каждой позиции, изменения сохраняются сами. */
export default function StocktakeCount() {
  const { id } = useParams();
  const nav = useNavigate();
  const { can } = useAuth();
  const { toast, confirm } = useUi();
  const { data, error, reload } = useFetch(() => get<Doc>('/inv/stocktakes/' + id), [id], { live: false });
  const [vals, setVals] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [view, setView] = useState<'all' | 'todo' | 'diff'>('all');
  const dirty = useRef(new Set<string>());
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => { if (data) setVals(Object.fromEntries(data.lines.map((l) => [l.insumoId, l.actual === null ? '' : String(l.actual)]))); }, [data?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const editable = data?.status === 'draft' && can('inv.edit');
  const flush = async () => {
    if (!dirty.current.size) return;
    const ids = [...dirty.current]; dirty.current.clear();
    setSaving(true);
    try {
      await put(`/inv/stocktakes/${id}/lines`, { lines: ids.map((k) => { const s = vals[k] ?? ''; return { insumoId: k, actual: s.trim() === '' ? null : parseNum(s) }; }) });
    } catch (e) { ids.forEach((k) => dirty.current.add(k)); toast('err', (e as Error).message); } finally { setSaving(false); }
  };
  const flushRef = useRef(flush); flushRef.current = flush;
  const set = (k: string, v: string) => { setVals((o) => ({ ...o, [k]: v })); dirty.current.add(k); clearTimeout(timer.current); timer.current = setTimeout(() => void flushRef.current(), 700); };
  useEffect(() => () => { clearTimeout(timer.current); void flushRef.current(); }, []);

  const lines = data?.lines ?? [];
  const actualOf = (l: Line): number | null => { if (!editable) return l.actual; const s = vals[l.insumoId]; return s === undefined || s.trim() === '' || Number.isNaN(parseNum(s)) ? null : parseNum(s); };
  const stats = useMemo(() => {
    let counted = 0, diffs = 0, short = 0, sur = 0;
    for (const l of lines) { const a = actualOf(l); if (a === null) continue; counted++; const d = a - l.book; if (Math.abs(d) > 1e-9) { diffs++; if (l.cost !== null) { if (d < 0) short += -d * l.cost; else sur += d * l.cost; } } }
    return { counted, diffs, short, sur };
  }, [lines, vals, editable]); // eslint-disable-line react-hooks/exhaustive-deps
  if (error && !data) return <ErrorBox error={error} onRetry={reload} />;
  if (!data) return <Loading />;

  const cats = [...new Set(lines.map((l) => l.categoria).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b, 'ru'));
  const shown = lines.filter((l) => {
    const a = actualOf(l);
    return (!cat || l.categoria === cat) && (!q || l.nombre.toLowerCase().includes(q.trim().toLowerCase())) && (view === 'all' || (view === 'todo' ? a === null : a !== null && Math.abs(a - l.book) > 1e-9));
  });

  const close = async () => {
    await flush();
    const ok = await confirm({ title: `Закрыть инвентаризацию №${data.number}?`, confirmLabel: 'Закрыть и применить', danger: stats.diffs > 0,
      text: <div className="space-y-1 text-sm"><div>Подсчитано позиций: <b>{stats.counted}</b> из {lines.length}. Расхождений: <b>{stats.diffs}</b>.</div>{data.canCost && <div>Недостача <b className="text-bad">{money(stats.short)}</b>, излишек <b className="text-good">{money(stats.sur)}</b>.</div>}<div className="text-muted">Остатки на складе будут исправлены, а в журнале движения появятся строки «Инвентаризация». Неподсчитанные позиции не меняются. Отменить закрытие нельзя.</div></div> });
    if (!ok) return;
    try { const r = await post<{ applied: number }>(`/inv/stocktakes/${id}/close`); toast('ok', `Склад исправлен по ${r.applied} позициям`); await reload(); } catch (e) { toast('err', (e as Error).message); }
  };
  const cancel = async () => {
    if (!(await confirm({ title: 'Отменить инвентаризацию?', text: 'Введённые данные будут потеряны, остатки не изменятся.', danger: true, confirmLabel: 'Отменить подсчёт' }))) return;
    try { await post(`/inv/stocktakes/${id}/cancel`); toast('ok', 'Инвентаризация отменена'); nav('/inventory/stocktakes'); } catch (e) { toast('err', (e as Error).message); }
  };

  return (
    <>
      <PageHeader title={<span className="flex items-center gap-2"><Link to="/inventory/stocktakes" className="text-muted hover:text-ink"><ArrowLeft size={20} /></Link>№{data.number} · {data.title} <Badge tone={ST_STATUS[data.status].tone}>{ST_STATUS[data.status].label}</Badge></span>}
        subtitle={`${data.scope ? `Категория: ${data.scope}` : 'Весь склад'} · начата ${fmtDateTime(data.created_at)}, ${data.created_by_name ?? '—'}${data.closed_at ? ` · закрыта ${fmtDateTime(data.closed_at)}, ${data.closed_by_name}` : ''}`}
        actions={<>
          {data.status === 'closed' && <Link to={`/print/stocktake/${data.id}`} target="_blank" className="btn btn-soft"><Printer size={15} /> Акт</Link>}
          {editable && <button className="btn btn-ghost" onClick={() => void cancel()}><XCircle size={15} /> Отменить</button>}
          {editable && can('inv.approve') && <button className="btn btn-primary" disabled={!stats.counted} onClick={() => void close()}><CheckCheck size={15} /> Закрыть и применить</button>}
        </>} />
      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Подсчитано" value={`${stats.counted} / ${lines.length}`} sub={<div className="mt-1"><ProgressBar value={stats.counted} max={lines.length} tone={stats.counted === lines.length ? 'good' : 'brand'} /></div>} />
        <StatCard label="Расхождений" value={stats.diffs} tone={stats.diffs ? 'warn' : undefined} />
        {data.canCost ? <><StatCard label="Недостача" value={money(data.status === 'closed' ? data.shortage_value ?? 0 : stats.short)} tone="bad" /><StatCard label="Излишек" value={money(data.status === 'closed' ? data.surplus_value ?? 0 : stats.sur)} tone="good" /></> : <StatCard label="Статус" value={saving ? 'Сохраняю…' : editable ? 'Сохранено' : '—'} />}
      </div>
      {editable && !can('inv.approve') && <p className="mb-3 rounded-lg bg-info/10 p-3 text-[13px] text-info">Закрыть инвентаризацию и исправить склад может только утверждающий (владелец или администратор). Вы вводите факт — он сохраняется автоматически.</p>}
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <Chips value={view} onChange={setView} options={[{ id: 'all', label: 'Все', count: lines.length }, { id: 'todo', label: 'Не посчитано', count: lines.length - stats.counted }, { id: 'diff', label: 'Расхождения', count: stats.diffs }]} />
        <select className="input !h-8 !w-auto text-[13px]" value={cat} onChange={(e) => setCat(e.target.value)}><option value="">Все категории</option>{cats.map((c) => <option key={c}>{c}</option>)}</select>
        <SearchBox value={q} onChange={setQ} placeholder="Найти сырьё…" className="w-56" />
        {editable && <span className="ml-auto text-xs text-muted">{saving ? 'Сохраняю…' : 'Изменения сохраняются автоматически'}</span>}
      </div>
      <div className="card overflow-auto">
        <table className="w-full text-[13.5px]">
          <thead className="sticky top-0 z-[1]"><tr><th className="th">Сырьё</th><th className="th text-right">По учёту</th><th className="th w-[180px] text-right">Фактически</th><th className="th text-right">Разница</th>{data.canCost && <th className="th hidden text-right md:table-cell">Сумма</th>}</tr></thead>
          <tbody>
            {shown.map((l) => {
              const a = actualOf(l); const d = a === null ? null : Math.round((a - l.book) * 1e6) / 1e6;
              return (
                <tr key={l.insumoId} className="hover:bg-surface2/50">
                  <td className="td"><div className="font-medium">{l.nombre}</div><div className="text-xs text-muted">{l.categoria ?? '—'}</div></td>
                  <td className="td tnum text-right text-muted">{fmtQty(l.book)} {l.unidad}</td>
                  <td className="td text-right">
                    {editable ? (
                      <div className="flex items-center justify-end gap-1.5">
                        <input className="input tnum !h-8 !w-[110px] text-right" inputMode="decimal" value={vals[l.insumoId] ?? ''} placeholder="—" onChange={(e) => set(l.insumoId, e.target.value)} onFocus={(e) => e.target.select()} />
                        <button className="btn btn-ghost btn-sm !px-1.5" title="Совпадает с учётом" onClick={() => set(l.insumoId, String(l.book))}><Check size={15} /></button>
                      </div>
                    ) : (a === null ? <span className="text-muted">не считали</span> : <b>{fmtQty(a)} {l.unidad}</b>)}
                  </td>
                  <td className="td tnum text-right">{d === null ? '' : d === 0 ? <span className="text-good">✓</span> : <b className={d < 0 ? 'text-bad' : 'text-good'}>{d > 0 ? '+' : ''}{fmtQty(d)}</b>}</td>
                  {data.canCost && <td className="td tnum hidden text-right md:table-cell">{d !== null && d !== 0 && l.cost !== null ? <span className={d < 0 ? 'text-bad' : 'text-good'}>{money(d * l.cost)}</span> : ''}</td>}
                </tr>
              );
            })}
            {!shown.length && <tr><td className="td py-10 text-center text-muted" colSpan={5}>Нет позиций по выбранному фильтру</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
