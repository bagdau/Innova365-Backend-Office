import { useCallback, useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Copy, Download, Filter, Pencil, Plus, RefreshCw, Search, Trash2, X } from 'lucide-react';
import { del, downloadUrl, enc, get, patch, post, tpath } from '../api';
import { useApp } from '../ctx';
import { Cell, DataGrid } from '../grid';
import { ErrorBox, fmtNum, Loading, Modal, Spinner, useUi } from '../ui';
import { ColInfo, RowForm } from './RowForm';

interface RowsResp {
  columns: ColInfo[]; pk: string[]; kind: string; useCtid: boolean;
  rows: Record<string, Cell>[]; total: number; estimated: boolean; limit: number; offset: number; ms: number;
}
interface Flt { col: string; op: string; value: string }

const OPS: [string, string][] = [
  ['contains', 'содержит'], ['eq', '='], ['ne', '≠'], ['starts', 'начинается с'], ['ends', 'заканчивается на'],
  ['gt', '>'], ['gte', '≥'], ['lt', '<'], ['lte', '≤'], ['isnull', 'IS NULL'], ['notnull', 'IS NOT NULL'],
];

export default function TableData({ schema, name, onInsert }: { schema: string; name: string; onInsert: () => void }) {
  const { session } = useApp();
  const { toast, confirm } = useUi();
  const [data, setData] = useState<RowsResp | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [limit, setLimit] = useState(() => Number(localStorage.getItem('dbs-limit')) || 50);
  const [sort, setSort] = useState<{ col: string; dir: 'asc' | 'desc' } | null>(null);
  const [filters, setFilters] = useState<Flt[]>([]);
  const [raw, setRaw] = useState('');
  const [applied, setApplied] = useState<{ filters: Flt[]; raw: string }>({ filters: [], raw: '' });
  const [showFilter, setShowFilter] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [editRow, setEditRow] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const canWrite = !session.readOnly;

  const load = useCallback(async () => {
    setLoading(true);
    const q = new URLSearchParams({ limit: String(limit), offset: String(page * limit) });
    if (sort) { q.set('sort', sort.col); q.set('dir', sort.dir); }
    const valid = applied.filters.filter((f) => f.col && (f.op === 'isnull' || f.op === 'notnull' || f.value !== ''));
    if (valid.length) q.set('filters', JSON.stringify(valid));
    if (applied.raw.trim()) q.set('where', applied.raw.trim());
    try { setData(await get<RowsResp>(`${tpath(schema, name)}/rows?${q}`)); setError(null); setSelected(new Set()); }
    catch (e) { setError(e); } finally { setLoading(false); }
  }, [schema, name, limit, page, sort, applied]);
  useEffect(() => { void load(); }, [load]);

  const cols = data?.columns ?? [];
  const grid = useMemo<Cell[][]>(() => (data ? data.rows.map((r) => cols.map((c) => r[c.name] ?? null)) : []), [data, cols]);
  const isTable = data ? ['r', 'p'].includes(data.kind) : false;
  const keyOf = (r: Record<string, Cell>) => (data!.pk.length ? Object.fromEntries(data!.pk.map((k) => [k, r[k]])) : { __ctid: r.__ctid });
  const canKey = !!data && (data.pk.length > 0 || data.useCtid);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / limit)) : 1;

  const onEdit = async (ri: number, ci: number, value: Cell) => {
    const r = data!.rows[ri];
    const res = await patch<{ row: Record<string, Cell> }>(`${tpath(schema, name)}/rows`, { key: keyOf(r), set: { [cols[ci].name]: value === null ? { null: true } : { v: value } } });
    setData((d) => d && ({ ...d, rows: d.rows.map((x, i) => (i === ri ? { ...res.row } : x)) }));
  };

  const deleteSelected = async (idx: number[]) => {
    if (!(await confirm({ title: `Удалить строк: ${idx.length}?`, text: 'Операция необратима. Если удаление затронет не ту строку, всё откатится.', danger: true, confirmLabel: 'Удалить' }))) return;
    setBusy(true);
    try { await del(`${tpath(schema, name)}/rows`, { keys: idx.map((i) => keyOf(data!.rows[i])) }); toast('ok', `Удалено строк: ${idx.length}`); await load(); }
    catch (e) { toast('err', (e as Error).message); } finally { setBusy(false); }
  };

  const saveRow = async (values: Record<string, unknown>) => {
    setBusy(true);
    try {
      const res = await patch<{ row: Record<string, Cell> }>(`${tpath(schema, name)}/rows`, { key: keyOf(data!.rows[editRow!]), set: values });
      setData((d) => d && ({ ...d, rows: d.rows.map((x, i) => (i === editRow ? res.row : x)) }));
      setEditRow(null); toast('ok', 'Строка сохранена');
    } catch (e) { toast('err', (e as Error).message); } finally { setBusy(false); }
  };

  const duplicate = async (ri: number) => {
    const r = data!.rows[ri];
    const values: Record<string, unknown> = {};
    for (const c of cols) {
      if (c.generated || c.identity || c.isPk && /^nextval/.test(c.default || '')) continue;
      values[c.name] = r[c.name] === null ? { null: true } : { v: r[c.name] };
    }
    setBusy(true);
    try { await post(`${tpath(schema, name)}/rows`, { values }); toast('ok', 'Строка продублирована'); await load(); } catch (e) { toast('err', (e as Error).message); } finally { setBusy(false); }
  };

  const applyFilters = () => { setPage(0); setApplied({ filters: filters.map((f) => ({ ...f })), raw }); };
  const resetFilters = () => { setFilters([]); setRaw(''); setPage(0); setApplied({ filters: [], raw: '' }); };
  const toggleSort = (col: string) => { setPage(0); setSort((s) => (s?.col !== col ? { col, dir: 'asc' } : s.dir === 'asc' ? { col, dir: 'desc' } : null)); };
  const activeFilters = applied.filters.length + (applied.raw ? 1 : 0);

  const exportLink = (format: string) => downloadUrl(`${tpath(schema, name)}/export`, {
    format, filters: applied.filters.length ? JSON.stringify(applied.filters) : undefined, where: applied.raw || undefined,
  });

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* панель инструментов */}
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2.5 sm:px-5">
        <button className={clsx('btn btn-sm', showFilter || activeFilters ? 'btn-primary' : 'btn-soft')} onClick={() => { setShowFilter(!showFilter); if (!filters.length && !showFilter) setFilters([{ col: cols[0]?.name ?? '', op: 'contains', value: '' }]); }}>
          <Filter size={14} /> Фильтр{activeFilters ? ` (${activeFilters})` : ''}
        </button>
        <button className="btn btn-soft btn-sm !px-2.5" onClick={() => void load()} title="Обновить"><RefreshCw size={14} className={loading ? 'spin' : ''} /></button>
        {isTable && canWrite && <button className="btn btn-soft btn-sm" onClick={onInsert}><Plus size={14} /> Вставить</button>}
        {selected.size > 0 && canWrite && canKey && <button className="btn btn-danger btn-sm" disabled={busy} onClick={() => void deleteSelected([...selected])}><Trash2 size={14} /> Удалить ({selected.size})</button>}
        {isTable && !canWrite && <span className="hidden text-xs text-muted md:inline">Для редактирования включите режим записи</span>}
        <div className="ml-auto flex items-center gap-2">
          <div className="hidden items-center gap-1 sm:flex">
            <Download size={14} className="text-muted" />
            {['csv', 'json', 'sql'].map((f) => <a key={f} href={exportLink(f)} className="btn btn-ghost btn-sm !px-2 uppercase" download>{f}</a>)}
          </div>
          <select className="input !h-8 !w-[88px] !px-2 text-[13px]" value={limit} onChange={(e) => { const n = Number(e.target.value); localStorage.setItem('dbs-limit', String(n)); setLimit(n); setPage(0); }}>
            {[25, 50, 100, 250, 500].map((n) => <option key={n} value={n}>{n} строк</option>)}
          </select>
        </div>
      </div>

      {showFilter && (
        <div className="space-y-2 border-b border-line bg-surface2/30 px-3 py-3 sm:px-5">
          {filters.map((f, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <select className="input !h-8 !w-auto min-w-[130px] text-[13px]" value={f.col} onChange={(e) => setFilters(filters.map((x, j) => (j === i ? { ...x, col: e.target.value } : x)))}>
                {cols.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
              </select>
              <select className="input !h-8 !w-auto text-[13px]" value={f.op} onChange={(e) => setFilters(filters.map((x, j) => (j === i ? { ...x, op: e.target.value } : x)))}>
                {OPS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              {f.op !== 'isnull' && f.op !== 'notnull' && (
                <input className="input !h-8 min-w-[160px] flex-1 text-[13px]" placeholder="значение" value={f.value} autoFocus={i === filters.length - 1}
                  onChange={(e) => setFilters(filters.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} onKeyDown={(e) => e.key === 'Enter' && applyFilters()} />
              )}
              <button className="btn btn-ghost btn-sm !px-2" onClick={() => setFilters(filters.filter((_, j) => j !== i))}><X size={15} /></button>
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-2">
            <button className="btn btn-soft btn-sm" onClick={() => setFilters([...filters, { col: cols[0]?.name ?? '', op: 'contains', value: '' }])}><Plus size={14} /> Условие</button>
            <input className="input !h-8 min-w-[220px] flex-1 font-mono text-[12.5px]" placeholder="или WHERE-выражение: price > 1000 and disponible" value={raw} onChange={(e) => setRaw(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && applyFilters()} />
            <button className="btn btn-primary btn-sm" onClick={applyFilters}><Search size={14} /> Применить</button>
            <button className="btn btn-ghost btn-sm" onClick={resetFilters}>Сбросить</button>
          </div>
        </div>
      )}

      {/* данные */}
      <div className="relative min-h-0 flex-1 overflow-auto">
        {error && !data ? <ErrorBox error={error} onRetry={load} />
          : !data ? <Loading />
          : (
            <>
              {error ? <ErrorBox error={error} /> : null}
              <DataGrid
                columns={cols.map((c) => ({ name: c.name, type: c.type, pk: c.isPk }))}
                rows={grid} startIndex={page * limit} sort={sort} onSort={toggleSort}
                selectable={isTable && canWrite && canKey} selected={selected} onSelect={setSelected}
                onEdit={isTable && canWrite && canKey ? onEdit : undefined}
                readonlyCols={new Set(cols.filter((c) => c.generated).map((c) => c.name))}
                emptyText={activeFilters ? 'По условиям ничего не найдено' : 'Таблица пуста'}
                rowActions={isTable && canWrite && canKey ? (ri) => (
                  <span className="inline-flex gap-0.5">
                    <button className="btn btn-ghost btn-sm !h-7 !px-1.5" title="Изменить" onClick={() => setEditRow(ri)}><Pencil size={13} /></button>
                    <button className="btn btn-ghost btn-sm !h-7 !px-1.5" title="Дублировать" onClick={() => void duplicate(ri)}><Copy size={13} /></button>
                    <button className="btn btn-ghost btn-sm !h-7 !px-1.5 hover:!text-danger" title="Удалить" onClick={() => void deleteSelected([ri])}><Trash2 size={13} /></button>
                  </span>
                ) : undefined}
              />
            </>
          )}
        {loading && data && <div className="absolute right-3 top-3 rounded-full bg-surface/90 p-1.5 shadow"><Spinner size={16} /></div>}
      </div>

      {/* пагинация */}
      {data && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line bg-surface px-3 py-2 text-xs text-muted sm:px-5">
          <span>{data.total === 0 ? 'Нет строк' : <>Строки {fmtNum(page * limit + 1)}–{fmtNum(Math.min(data.total, page * limit + data.rows.length))} из {data.estimated ? '≈' : ''}{fmtNum(data.total)} · {data.ms} мс</>}</span>
          <div className="flex items-center gap-1">
            <button className="btn btn-ghost btn-sm !px-2" disabled={page === 0} onClick={() => setPage(0)}><ChevronsLeft size={15} /></button>
            <button className="btn btn-ghost btn-sm !px-2" disabled={page === 0} onClick={() => setPage(page - 1)}><ChevronLeft size={15} /></button>
            <span className="px-2 tabular-nums">стр. <input className="input !inline-block !h-7 !w-14 !px-1.5 text-center text-xs" value={page + 1} onChange={(e) => { const n = Number(e.target.value); if (Number.isInteger(n) && n >= 1 && n <= totalPages) setPage(n - 1); }} /> из {fmtNum(totalPages)}</span>
            <button className="btn btn-ghost btn-sm !px-2" disabled={page + 1 >= totalPages} onClick={() => setPage(page + 1)}><ChevronRight size={15} /></button>
            <button className="btn btn-ghost btn-sm !px-2" disabled={page + 1 >= totalPages} onClick={() => setPage(totalPages - 1)}><ChevronsRight size={15} /></button>
          </div>
        </div>
      )}

      <Modal open={editRow !== null} onClose={() => setEditRow(null)} title={`Изменить строку #${editRow !== null ? page * limit + editRow + 1 : ''}`} width={640}>
        {editRow !== null && data && <RowForm columns={cols} mode="edit" initial={data.rows[editRow]} busy={busy} onSubmit={(v) => void saveRow(v)} onCancel={() => setEditRow(null)} />}
      </Modal>
    </div>
  );
}
