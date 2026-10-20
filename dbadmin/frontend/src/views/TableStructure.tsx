import { useCallback, useEffect, useState } from 'react';
import clsx from 'clsx';
import { Eye, Hash, Key, Link2, MoreHorizontal, Pencil, Plus, Trash2, Zap } from 'lucide-react';
import { get, post, tpath } from '../api';
import { useApp } from '../ctx';
import { ErrorBox, fmtBytes, fmtDate, fmtNum, Loading, Modal, Stat, useUi } from '../ui';
import type { ColInfo } from './RowForm';

export interface Structure {
  oid: number; schema: string; name: string; kind: string; columns: ColInfo[]; pk: string[];
  indexes: { name: string; def: string; primary: boolean; unique: boolean; size: number; method: string; columns: string }[];
  constraints: { name: string; type: string; def: string; ref: string | null }[];
  referencedBy: { table: string; name: string; def: string }[];
  triggers: { name: string; def: string; enabled: string }[];
  viewDef: string | null;
  stats: { est_rows: number; total: number; data: number; idx: number; toast: number; owner: string; comment: string | null; n_live_tup: string | null; n_dead_tup: string | null; seq_scan: string | null; idx_scan: string | null; last_vacuum: string | null; last_autovacuum: string | null; last_analyze: string | null; last_autoanalyze: string | null };
}

export const KIND: Record<string, string> = { r: 'Таблица', p: 'Партиционированная таблица', v: 'Представление', m: 'Материализованное представление', f: 'Внешняя таблица' };
const CT: Record<string, string> = { p: 'PRIMARY KEY', f: 'FOREIGN KEY', u: 'UNIQUE', c: 'CHECK', x: 'EXCLUDE' };
const COMMON_TYPES = ['text', 'varchar(255)', 'integer', 'bigint', 'numeric(14,2)', 'boolean', 'timestamp', 'timestamptz', 'date', 'uuid', 'jsonb', 'serial', 'double precision'];

export function useStructure(schema: string, name: string) {
  const [data, setData] = useState<Structure | null>(null);
  const [error, setError] = useState<unknown>(null);
  const load = useCallback(async () => {
    try { setData(await get<Structure>(`${tpath(schema, name)}/structure`)); setError(null); } catch (e) { setError(e); }
  }, [schema, name]);
  useEffect(() => { void load(); }, [load]);
  return { data, error, reload: load };
}

export default function TableStructure({ schema, name, onChanged }: { schema: string; name: string; onChanged: () => void }) {
  const { session } = useApp();
  const { toast, confirm } = useUi();
  const { data, error, reload } = useStructure(schema, name);
  const [modal, setModal] = useState<null | { kind: 'addCol' } | { kind: 'rename'; col: string } | { kind: 'type'; col: ColInfo } | { kind: 'default'; col: ColInfo } | { kind: 'index' }>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const canWrite = !session.readOnly;
  const isTable = data ? ['r', 'p'].includes(data.kind) : false;

  const run = async (body: Record<string, unknown>, okText: string) => {
    try { const r = await post<{ sql: string }>(`${tpath(schema, name)}/alter`, body); toast('ok', okText); setModal(null); await reload(); onChanged(); return r; }
    catch (e) { toast('err', (e as Error).message); }
  };

  if (error && !data) return <ErrorBox error={error} onRetry={reload} />;
  if (!data) return <Loading />;
  const s = data.stats;

  return (
    <div className="mx-auto max-w-[1400px] space-y-5 p-3 sm:p-5" onClick={() => setMenu(null)}>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Строк (оценка)" value={fmtNum(s.est_rows)} sub={s.n_dead_tup ? `мёртвых: ${fmtNum(s.n_dead_tup)}` : undefined} />
        <Stat label="Размер" value={fmtBytes(s.total)} sub={`данные ${fmtBytes(s.data)} · индексы ${fmtBytes(s.idx)}`} />
        <Stat label="Сканирования" value={fmtNum(Number(s.seq_scan ?? 0) + Number(s.idx_scan ?? 0))} sub={`seq ${fmtNum(s.seq_scan)} · idx ${fmtNum(s.idx_scan)}`} />
        <Stat label="Владелец" value={s.owner} sub={`анализ: ${fmtDate(s.last_autoanalyze || s.last_analyze)}`} />
      </div>

      {data.viewDef && (
        <section className="card overflow-hidden"><div className="border-b border-line px-4 py-3 font-semibold"><Eye size={15} className="mr-2 inline text-info" />Определение представления</div>
          <pre className="overflow-auto p-4 font-mono text-[12.5px] leading-relaxed text-muted">{data.viewDef}</pre></section>
      )}

      <section className="card">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="font-semibold">Колонки <span className="chip ml-1 bg-surface2 text-muted">{data.columns.length}</span></h2>
          {isTable && canWrite && <button className="btn btn-primary btn-sm" onClick={() => setModal({ kind: 'addCol' })}><Plus size={14} /> Добавить колонку</button>}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead><tr><th className="th w-10">#</th><th className="th">Имя</th><th className="th">Тип</th><th className="th">NULL</th><th className="th">По умолчанию</th><th className="th">Комментарий</th><th className="th w-px" /></tr></thead>
            <tbody>
              {data.columns.map((c) => (
                <tr key={c.name} className="hover:bg-surface2/40">
                  <td className="td text-muted tabular-nums">{c.num}</td>
                  <td className="td font-mono font-semibold">{c.isPk && <Key size={12} className="mr-1.5 inline text-warn" />}{c.name}</td>
                  <td className="td font-mono text-info">{c.type}{c.identity && <span className="chip ml-2 bg-info/10 text-info">identity</span>}{c.generated && <span className="chip ml-2 bg-warn/10 text-warn">generated</span>}</td>
                  <td className="td">{c.notnull ? <span className="chip bg-danger/10 text-danger">NOT NULL</span> : <span className="text-muted">да</span>}</td>
                  <td className="td max-w-[280px] truncate font-mono text-[12px] text-muted" title={c.default || ''}>{c.default || <span className="text-muted/50">—</span>}</td>
                  <td className="td max-w-[220px] truncate text-muted">{c.comment || ''}</td>
                  <td className="td relative text-right">
                    {isTable && canWrite && (
                      <>
                        <button className="btn btn-ghost btn-sm !h-7 !px-1.5" onClick={(e) => { e.stopPropagation(); setMenu(menu === c.name ? null : c.name); }}><MoreHorizontal size={16} /></button>
                        {menu === c.name && (
                          <div className="absolute right-3 top-9 z-20 w-52 overflow-hidden rounded-xl border border-line bg-surface text-left shadow-2xl animate-pop">
                            {[
                              ['Переименовать', () => setModal({ kind: 'rename', col: c.name })],
                              ['Изменить тип', () => setModal({ kind: 'type', col: c })],
                              ['Значение по умолчанию', () => setModal({ kind: 'default', col: c })],
                              [c.notnull ? 'Разрешить NULL' : 'Запретить NULL', () => void run({ action: 'setNotNull', name: c.name, notnull: !c.notnull }, 'Готово')],
                            ].map(([label, fn]) => <button key={label as string} className="block w-full px-3.5 py-2 text-left text-[13px] hover:bg-surface2" onClick={fn as () => void}>{label as string}</button>)}
                            <button className="block w-full px-3.5 py-2 text-left text-[13px] text-danger hover:bg-danger/10" onClick={async () => {
                              if (await confirm({ title: `Удалить колонку «${c.name}»?`, text: 'Данные колонки будут потеряны безвозвратно.', danger: true, confirmLabel: 'Удалить' })) void run({ action: 'dropColumn', name: c.name }, 'Колонка удалена');
                            }}>Удалить колонку</button>
                          </div>
                        )}
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {isTable && (
        <section className="card">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <h2 className="font-semibold"><Hash size={15} className="mr-2 inline text-accent" />Индексы <span className="chip ml-1 bg-surface2 text-muted">{data.indexes.length}</span></h2>
            {canWrite && <button className="btn btn-soft btn-sm" onClick={() => setModal({ kind: 'index' })}><Plus size={14} /> Индекс</button>}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead><tr><th className="th">Имя</th><th className="th">Колонки</th><th className="th">Тип</th><th className="th">Размер</th><th className="th w-px" /></tr></thead>
              <tbody>
                {data.indexes.map((i) => (
                  <tr key={i.name} className="hover:bg-surface2/40">
                    <td className="td font-mono font-semibold">{i.name}</td>
                    <td className="td font-mono text-[12px]">{i.columns}</td>
                    <td className="td whitespace-nowrap">{i.primary && <span className="chip mr-1 bg-warn/15 text-warn">PRIMARY</span>}{i.unique && !i.primary && <span className="chip mr-1 bg-info/15 text-info">UNIQUE</span>}<span className="text-muted">{i.method}</span></td>
                    <td className="td tabular-nums text-muted">{fmtBytes(i.size)}</td>
                    <td className="td text-right">{canWrite && !i.primary && <button className="btn btn-ghost btn-sm !h-7 !px-1.5 hover:!text-danger" onClick={async () => {
                      if (await confirm({ title: `Удалить индекс «${i.name}»?`, danger: true, confirmLabel: 'Удалить' })) void run({ action: 'dropIndex', name: i.name }, 'Индекс удалён');
                    }}><Trash2 size={14} /></button>}</td>
                  </tr>
                ))}
                {!data.indexes.length && <tr><td colSpan={5} className="td py-6 text-center text-muted">Индексов нет</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {(data.constraints.length > 0 || data.referencedBy.length > 0) && (
        <section className="card">
          <div className="border-b border-line px-4 py-3 font-semibold"><Link2 size={15} className="mr-2 inline text-accent" />Ограничения и связи</div>
          <div className="divide-y divide-line/60">
            {data.constraints.map((c) => (
              <div key={c.name} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-[13px]">
                <span className={clsx('chip', c.type === 'p' ? 'bg-warn/15 text-warn' : c.type === 'f' ? 'bg-info/15 text-info' : 'bg-surface2 text-muted')}>{CT[c.type] || c.type}</span>
                <span className="font-mono font-semibold">{c.name}</span>
                <code className="min-w-0 flex-1 break-all font-mono text-[12px] text-muted">{c.def}</code>
                {canWrite && c.type !== 'p' && <button className="btn btn-ghost btn-sm !h-7 !px-1.5 hover:!text-danger" onClick={async () => {
                  if (await confirm({ title: `Удалить ограничение «${c.name}»?`, danger: true, confirmLabel: 'Удалить' })) void run({ action: 'dropConstraint', name: c.name }, 'Ограничение удалено');
                }}><Trash2 size={14} /></button>}
              </div>
            ))}
            {data.referencedBy.map((c) => (
              <div key={c.name + c.table} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-[13px]">
                <span className="chip bg-ok/15 text-ok">ССЫЛАЕТСЯ НА ЭТУ</span>
                <span className="font-mono font-semibold">{c.table}</span>
                <code className="min-w-0 flex-1 break-all font-mono text-[12px] text-muted">{c.def}</code>
              </div>
            ))}
          </div>
        </section>
      )}

      {data.triggers.length > 0 && (
        <section className="card">
          <div className="border-b border-line px-4 py-3 font-semibold"><Zap size={15} className="mr-2 inline text-accent" />Триггеры</div>
          <div className="divide-y divide-line/60">{data.triggers.map((t) => (
            <div key={t.name} className="px-4 py-2.5 text-[13px]"><span className="font-mono font-semibold">{t.name}</span> <span className={clsx('chip ml-2', t.enabled === 'D' ? 'bg-muted/15 text-muted' : 'bg-ok/15 text-ok')}>{t.enabled === 'D' ? 'выключен' : 'включён'}</span>
              <code className="mt-1 block break-all font-mono text-[12px] text-muted">{t.def}</code></div>
          ))}</div>
        </section>
      )}

      {modal?.kind === 'addCol' && <AddColumn onClose={() => setModal(null)} onSubmit={(b) => run({ action: 'addColumn', ...b }, 'Колонка добавлена')} />}
      {modal?.kind === 'rename' && <TextPrompt title={`Переименовать «${modal.col}»`} label="Новое имя" initial={modal.col} onClose={() => setModal(null)} onSubmit={(v) => run({ action: 'renameColumn', name: modal.col, to: v }, 'Переименовано')} />}
      {modal?.kind === 'type' && <ChangeType col={modal.col} onClose={() => setModal(null)} onSubmit={(b) => run({ action: 'changeType', name: modal.col.name, ...b }, 'Тип изменён')} />}
      {modal?.kind === 'default' && <TextPrompt title={`Значение по умолчанию: ${modal.col.name}`} label="SQL-выражение (пусто — убрать)" initial={modal.col.default || ''} mono allowEmpty onClose={() => setModal(null)} onSubmit={(v) => run({ action: 'setDefault', name: modal.col.name, default: v }, 'Сохранено')} />}
      {modal?.kind === 'index' && <AddIndex columns={data.columns.map((c) => c.name)} table={name} onClose={() => setModal(null)} onSubmit={(b) => run({ action: 'addIndex', ...b }, 'Индекс создан')} />}
    </div>
  );
}

/* ───────── Диалоги ───────── */
export function TextPrompt({ title, label, initial = '', mono, allowEmpty, onClose, onSubmit }: { title: string; label: string; initial?: string; mono?: boolean; allowEmpty?: boolean; onClose: () => void; onSubmit: (v: string) => void }) {
  const [v, setV] = useState(initial);
  return (
    <Modal open onClose={onClose} title={title} width={440} footer={<><button className="btn btn-soft" onClick={onClose}>Отмена</button><button className="btn btn-primary" disabled={!allowEmpty && !v.trim()} onClick={() => onSubmit(v.trim())}>Сохранить</button></>}>
      <label className="label">{label}</label>
      <input className={clsx('input', mono && 'font-mono')} value={v} autoFocus onChange={(e) => setV(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (allowEmpty || v.trim()) && onSubmit(v.trim())} />
    </Modal>
  );
}

function AddColumn({ onClose, onSubmit }: { onClose: () => void; onSubmit: (b: Record<string, unknown>) => void }) {
  const [name, setName] = useState(''); const [type, setType] = useState('text'); const [notnull, setNotnull] = useState(false); const [def, setDef] = useState('');
  return (
    <Modal open onClose={onClose} title="Новая колонка" width={480} footer={<><button className="btn btn-soft" onClick={onClose}>Отмена</button><button className="btn btn-primary" disabled={!name.trim()} onClick={() => onSubmit({ name: name.trim(), type, notnull, default: def.trim() || undefined })}>Добавить</button></>}>
      <div className="space-y-3">
        <div><label className="label">Имя</label><input className="input font-mono" autoFocus value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div><label className="label">Тип</label><input className="input font-mono" list="pg-types" value={type} onChange={(e) => setType(e.target.value)} /><datalist id="pg-types">{COMMON_TYPES.map((t) => <option key={t} value={t} />)}</datalist></div>
        <div><label className="label">Значение по умолчанию (SQL)</label><input className="input font-mono" placeholder="например: 0, now(), 'abc'" value={def} onChange={(e) => setDef(e.target.value)} /></div>
        <label className="flex cursor-pointer items-center gap-2 text-sm"><input type="checkbox" className="accent-[rgb(var(--accent))]" checked={notnull} onChange={(e) => setNotnull(e.target.checked)} /> NOT NULL (для непустой таблицы нужно значение по умолчанию)</label>
      </div>
    </Modal>
  );
}

function ChangeType({ col, onClose, onSubmit }: { col: ColInfo; onClose: () => void; onSubmit: (b: Record<string, unknown>) => void }) {
  const [type, setType] = useState(col.type); const [using, setUsing] = useState('');
  return (
    <Modal open onClose={onClose} title={`Тип колонки «${col.name}»`} width={480} footer={<><button className="btn btn-soft" onClick={onClose}>Отмена</button><button className="btn btn-primary" disabled={!type.trim()} onClick={() => onSubmit({ type, using: using.trim() || undefined })}>Изменить</button></>}>
      <div className="space-y-3">
        <div><label className="label">Новый тип</label><input className="input font-mono" list="pg-types2" value={type} onChange={(e) => setType(e.target.value)} /><datalist id="pg-types2">{COMMON_TYPES.map((t) => <option key={t} value={t} />)}</datalist></div>
        <div><label className="label">USING (преобразование, если нужно)</label><input className="input font-mono" placeholder={`${col.name}::${type}`} value={using} onChange={(e) => setUsing(e.target.value)} /></div>
        <p className="text-xs text-muted"><Pencil size={11} className="mr-1 inline" />Текущий тип: <code>{col.type}</code>. Смена типа перезаписывает таблицу.</p>
      </div>
    </Modal>
  );
}

function AddIndex({ columns, table, onClose, onSubmit }: { columns: string[]; table: string; onClose: () => void; onSubmit: (b: Record<string, unknown>) => void }) {
  const [sel, setSel] = useState<string[]>([]); const [unique, setUnique] = useState(false); const [name, setName] = useState('');
  const auto = `${table}_${sel.join('_')}_idx`;
  return (
    <Modal open onClose={onClose} title="Новый индекс" width={480} footer={<><button className="btn btn-soft" onClick={onClose}>Отмена</button><button className="btn btn-primary" disabled={!sel.length} onClick={() => onSubmit({ columns: sel, unique, name: name.trim() || auto })}>Создать</button></>}>
      <div className="space-y-3">
        <div><label className="label">Колонки (порядок важен)</label>
          <div className="flex flex-wrap gap-1.5">{columns.map((c) => (
            <button key={c} type="button" onClick={() => setSel(sel.includes(c) ? sel.filter((x) => x !== c) : [...sel, c])}
              className={clsx('rounded-lg border px-2.5 py-1 font-mono text-[12.5px] transition', sel.includes(c) ? 'border-accent bg-accent/15 text-accent' : 'border-line text-muted hover:text-ink')}>{sel.includes(c) ? `${sel.indexOf(c) + 1}. ` : ''}{c}</button>
          ))}</div></div>
        <div><label className="label">Имя</label><input className="input font-mono" value={name} placeholder={auto} onChange={(e) => setName(e.target.value)} /></div>
        <label className="flex cursor-pointer items-center gap-2 text-sm"><input type="checkbox" className="accent-[rgb(var(--accent))]" checked={unique} onChange={(e) => setUnique(e.target.checked)} /> Уникальный индекс</label>
      </div>
    </Modal>
  );
}
