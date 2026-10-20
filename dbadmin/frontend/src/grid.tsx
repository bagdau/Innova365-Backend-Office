import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { ArrowDown, ArrowUp, ChevronsUpDown, Copy, Key } from 'lucide-react';
import { isNumericType, Modal, useUi } from './ui';

export type Cell = string | null;
export interface GridCol { name: string; type?: string; pk?: boolean }

interface Props {
  columns: GridCol[];
  rows: Cell[][];
  /** Номер первой строки (для пагинации). */
  startIndex?: number;
  sort?: { col: string; dir: 'asc' | 'desc' } | null;
  onSort?: (col: string) => void;
  selectable?: boolean;
  selected?: Set<number>;
  onSelect?: (s: Set<number>) => void;
  /** Если задан — ячейки редактируются двойным щелчком. Должен вернуть промис: при ошибке правка откатывается. */
  onEdit?: (row: number, col: number, value: Cell) => Promise<void>;
  /** Какие колонки нельзя править. */
  readonlyCols?: Set<string>;
  rowActions?: (row: number) => ReactNode;
  maxHeight?: string;
  emptyText?: string;
}

/** numeric(65,30) из Prisma даёт «400.000000000000000000» — для чтения убираем хвост нулей (в ячейке-подсказке остаётся полное значение). */
const trimZeros = (v: string) => (/^-?\d+\.\d+$/.test(v) ? v.replace(/(\.\d*?[1-9])0+$/, '$1').replace(/\.0+$/, '') : v);

const isLong = (v: Cell) => v !== null && (v.length > 60 || v.includes('\n'));
const prettyJson = (v: string): string | null => {
  const t = v.trim();
  if (!(t.startsWith('{') || t.startsWith('['))) return null;
  try { return JSON.stringify(JSON.parse(t), null, 2); } catch { return null; }
};

export function DataGrid({ columns, rows, startIndex = 0, sort, onSort, selectable, selected, onSelect, onEdit, readonlyCols, rowActions, maxHeight, emptyText = 'Нет строк' }: Props) {
  const { toast } = useUi();
  const [view, setView] = useState<{ title: string; value: Cell } | null>(null);
  const [edit, setEdit] = useState<{ r: number; c: number; v: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { if (edit) { inputRef.current?.focus(); inputRef.current?.select(); } }, [edit?.r, edit?.c]); // eslint-disable-line react-hooks/exhaustive-deps

  const allSel = !!selected && rows.length > 0 && selected.size === rows.length;
  const numeric = useMemo(() => columns.map((c) => !!c.type && isNumericType(c.type)), [columns]);

  const commit = async (value: Cell) => {
    if (!edit || !onEdit) return;
    const { r, c } = edit;
    if (value === rows[r][c]) { setEdit(null); return; }
    setBusy(true);
    try { await onEdit(r, c, value); setEdit(null); } catch (e) { toast('err', (e as Error).message); } finally { setBusy(false); }
  };

  const copy = (v: Cell) => { void navigator.clipboard?.writeText(v ?? '').then(() => toast('ok', 'Скопировано')); };

  return (
    <>
      <div className="grid-wrap" style={{ maxHeight }}>
        <table className="data-table min-w-full">
          <thead>
            <tr>
              {selectable && (
                <th className="w-9 !px-2.5">
                  <input type="checkbox" className="accent-[rgb(var(--accent))]" checked={allSel} onChange={(e) => onSelect?.(e.target.checked ? new Set(rows.map((_, i) => i)) : new Set())} />
                </th>
              )}
              <th className="w-10 text-right !text-muted/60">#</th>
              {columns.map((c) => (
                <th key={c.name} className={clsx(onSort && 'cursor-pointer select-none hover:text-ink')} onClick={() => onSort?.(c.name)}>
                  <span className="inline-flex items-center gap-1.5">
                    {c.pk && <Key size={11} className="text-warn" />}
                    <span className="text-ink/90">{c.name}</span>
                    {c.type && <span className="font-normal normal-case text-muted/60">{c.type.length > 18 ? c.type.slice(0, 17) + '…' : c.type}</span>}
                    {onSort && (sort?.col === c.name ? (sort.dir === 'asc' ? <ArrowUp size={12} className="text-accent" /> : <ArrowDown size={12} className="text-accent" />) : <ChevronsUpDown size={11} className="text-muted/40" />)}
                  </span>
                </th>
              ))}
              {rowActions && <th className="w-px" />}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={columns.length + 2 + (selectable ? 1 : 0) + (rowActions ? 1 : 0)} className="!py-10 text-center !font-sans text-muted">{emptyText}</td></tr>
            )}
            {rows.map((row, ri) => (
              <tr key={ri} className={clsx(selected?.has(ri) && 'sel')}>
                {selectable && (
                  <td className="!px-2.5">
                    <input type="checkbox" className="accent-[rgb(var(--accent))]" checked={!!selected?.has(ri)}
                      onChange={(e) => { const n = new Set(selected); if (e.target.checked) n.add(ri); else n.delete(ri); onSelect?.(n); }} />
                  </td>
                )}
                <td className="text-right text-muted/50 select-none">{startIndex + ri + 1}</td>
                {row.map((v, ci) => {
                  const editing = edit?.r === ri && edit.c === ci;
                  const canEdit = !!onEdit && !readonlyCols?.has(columns[ci].name);
                  return (
                    <td key={ci} className={clsx(numeric[ci] && 'num', editing && '!max-w-none !overflow-visible !p-1')} title={!editing && v !== null && v.length > 40 ? v.slice(0, 300) : undefined}
                      onDoubleClick={() => {
                        if (canEdit) setEdit({ r: ri, c: ci, v: v ?? '' });
                        else setView({ title: `${columns[ci].name} · строка ${startIndex + ri + 1}`, value: v });
                      }}>
                      {editing ? (
                        <div className="flex items-start gap-1">
                          <textarea ref={inputRef} rows={Math.min(8, Math.max(1, edit!.v.split('\n').length))} value={edit!.v} disabled={busy}
                            onChange={(e) => setEdit({ ...edit!, v: e.target.value })}
                            onKeyDown={(e) => { if (e.key === 'Escape') setEdit(null); if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void commit(edit!.v); } }}
                            className="input !h-auto min-w-[160px] !py-1 font-mono text-[12.5px]" />
                          <div className="flex flex-col gap-1">
                            <button className="btn btn-primary btn-sm !h-7" disabled={busy} onClick={() => void commit(edit!.v)}>OK</button>
                            <button className="btn btn-soft btn-sm !h-7" disabled={busy} onClick={() => void commit(null)}>NULL</button>
                          </div>
                        </div>
                      ) : v === null ? <span className="null-cell">NULL</span>
                        : v === '' ? <span className="null-cell">(пусто)</span>
                        : (v === 't' || v === 'f') && columns[ci].type === 'boolean' ? <span className={clsx('chip', v === 't' ? 'bg-ok/15 text-ok' : 'bg-muted/15 text-muted')}>{v === 't' ? 'true' : 'false'}</span>
                        : <span className={clsx(isLong(v) && 'cursor-zoom-in')} onClick={() => isLong(v) && setView({ title: `${columns[ci].name} · строка ${startIndex + ri + 1}`, value: v })}>{numeric[ci] ? trimZeros(v) : v.replace(/\s+/g, ' ')}</span>}
                    </td>
                  );
                })}
                {rowActions && <td className="!py-1 text-right">{rowActions(ri)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Modal open={!!view} onClose={() => setView(null)} title={view?.title} width={760}
        footer={<><button className="btn btn-soft" onClick={() => copy(view?.value ?? null)}><Copy size={15} /> Копировать</button><button className="btn btn-primary" onClick={() => setView(null)}>Закрыть</button></>}>
        {view?.value === null ? <span className="null-cell">NULL</span>
          : <pre className="max-h-[60dvh] overflow-auto whitespace-pre-wrap break-words rounded-lg bg-surface2 p-3 font-mono text-[12.5px] leading-relaxed">{prettyJson(view?.value ?? '') ?? view?.value}</pre>}
      </Modal>
    </>
  );
}

/** Вспомогательно: CSV для копирования/скачивания результатов. */
export function toCsv(columns: string[], rows: Cell[][]): string {
  const esc = (v: Cell) => (v === null ? '' : /[",\r\n;]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v);
  return '﻿' + [columns.map(esc).join(';'), ...rows.map((r) => r.map(esc).join(';'))].join('\r\n');
}

export function downloadText(name: string, text: string, mime = 'text/plain') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: mime + ';charset=utf-8' }));
  a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
