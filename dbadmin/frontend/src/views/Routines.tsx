import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { ArrowLeft, Braces, ChevronDown, FunctionSquare, Play, Plus, Save, Search, Trash2, Zap } from 'lucide-react';
import { ApiError, del, get, post } from '../api';
import { go, useApp } from '../ctx';
import { DataGrid, Cell } from '../grid';
import { SqlEditor, SqlEditorHandle } from '../editor';
import { Empty, ErrorBox, Loading, Spinner, Toggle, useUi } from '../ui';

interface Routine { oid: number; schema: string; name: string; kind: 'f' | 'p'; type: string; args: string; full_args: string; returns: string | null; language: string; volatility: string; security_definer: boolean; owner: string; comment: string | null }
interface Detail { oid: number; schema: string; name: string; kind: string; def: string; args: string; type: string }
interface Trigger { oid: number; name: string; schema: string; table: string; def: string; enabled: string; function: string }

const VOL: Record<string, string> = { i: 'IMMUTABLE', s: 'STABLE', v: 'VOLATILE' };
const NEW_FN = `create or replace function public.my_function(a integer, b integer)\nreturns integer\nlanguage plpgsql\nas $$\nbegin\n  return a + b;\nend;\n$$;`;
const NEW_PROC = `create or replace procedure public.my_procedure(p_id integer)\nlanguage plpgsql\nas $$\nbegin\n  -- ваш код\n  raise notice 'id = %', p_id;\nend;\n$$;`;

export default function Routines({ oid }: { oid?: number }) {
  const { session, db } = useApp();
  const [list, setList] = useState<Routine[] | null>(null);
  const [triggers, setTriggers] = useState<Trigger[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [q, setQ] = useState('');
  const [view, setView] = useState<'routines' | 'triggers'>('routines');
  const [creating, setCreating] = useState<null | string>(null);

  const reload = useCallback(async () => {
    try { setList(await get<Routine[]>('/routines')); setTriggers(await get<Trigger[]>('/triggers')); setError(null); } catch (e) { setError(e); }
  }, []);
  useEffect(() => { void reload(); }, [reload, db]);

  const filtered = useMemo(() => (list ?? []).filter((r) => !q || (r.schema + '.' + r.name).toLowerCase().includes(q.toLowerCase())), [list, q]);
  const showDetail = oid !== undefined || creating !== null;

  if (error && !list) return <ErrorBox error={error} onRetry={reload} />;
  if (!list) return <Loading />;

  return (
    <div className="flex h-full min-h-0">
      <div className={clsx('flex w-full min-w-0 flex-col border-line lg:w-[340px] lg:shrink-0 lg:border-r', showDetail && 'hidden lg:flex')}>
        <div className="space-y-2.5 border-b border-line p-3">
          <div className="flex rounded-lg border border-line p-0.5 text-[13px] font-medium">
            {([['routines', 'Функции и процедуры', list.length], ['triggers', 'Триггеры', triggers?.length ?? 0]] as const).map(([k, l, n]) => (
              <button key={k} onClick={() => setView(k)} className={clsx('flex-1 rounded-md px-2 py-1.5 transition', view === k ? 'bg-accent/15 text-accent' : 'text-muted hover:text-ink')}>{l} <span className="opacity-60">{n}</span></button>
            ))}
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1"><Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><input className="input !h-8 !pl-8 text-[13px]" placeholder="Поиск…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
            {view === 'routines' && !session.readOnly && (
              <div className="group relative">
                <button className="btn btn-primary btn-sm"><Plus size={14} /><ChevronDown size={12} /></button>
                <div className="absolute right-0 top-full z-20 hidden w-44 pt-1 group-focus-within:block group-hover:block"><div className="overflow-hidden rounded-xl border border-line bg-surface shadow-2xl">
                  <button className="block w-full px-3.5 py-2 text-left text-[13px] hover:bg-surface2" onClick={() => { setCreating(NEW_FN); go('routines'); }}>Новая функция</button>
                  <button className="block w-full px-3.5 py-2 text-left text-[13px] hover:bg-surface2" onClick={() => { setCreating(NEW_PROC); go('routines'); }}>Новая процедура</button>
                </div></div>
              </div>
            )}
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {view === 'routines' ? (
            filtered.length ? filtered.map((r) => (
              <a key={r.oid} href={`#/routines/${r.oid}`} onClick={() => setCreating(null)} className={clsx('block border-b border-line/50 px-4 py-2.5 transition hover:bg-surface2/60', oid === r.oid && 'bg-accent/10')}>
                <div className="flex items-center gap-2"><span className={clsx('chip', r.kind === 'p' ? 'bg-info/15 text-info' : 'bg-accent/15 text-accent')}>{r.kind === 'p' ? 'PROC' : 'FUNC'}</span>
                  <span className="min-w-0 truncate font-mono text-[13px] font-semibold">{r.schema !== 'public' && <span className="text-muted">{r.schema}.</span>}{r.name}</span></div>
                <div className="mt-1 truncate font-mono text-[11px] text-muted">({r.args}){r.returns ? ` → ${r.returns}` : ''}</div>
              </a>
            )) : <Empty icon={<FunctionSquare size={36} />} title="Ничего нет" text={q ? 'Нет совпадений' : 'В этой базе нет пользовательских функций и процедур. Создайте первую кнопкой «+».'} />
          ) : (
            <TriggerList items={(triggers ?? []).filter((t) => !q || (t.table + t.name).toLowerCase().includes(q.toLowerCase()))} onChange={reload} />
          )}
        </div>
      </div>

      <div className={clsx('min-w-0 flex-1', !showDetail && 'hidden lg:block')}>
        {creating !== null ? <RoutineEditor key="new" initial={creating} isNew onSaved={() => { setCreating(null); void reload(); }} onBack={() => setCreating(null)} />
          : oid !== undefined ? <RoutineEditor key={oid} oid={oid} onSaved={reload} onBack={() => go('routines')} onDeleted={() => { go('routines'); void reload(); }} />
          : <Empty icon={<Braces size={40} />} title="Выберите функцию или процедуру" text="Слева — список. Можно посмотреть и изменить определение, запустить с аргументами или удалить." />}
      </div>
    </div>
  );
}

function RoutineEditor({ oid, initial, isNew, onSaved, onBack, onDeleted }: { oid?: number; initial?: string; isNew?: boolean; onSaved: () => void; onBack: () => void; onDeleted?: () => void }) {
  const { session } = useApp();
  const { toast, confirm } = useUi();
  const ed = useRef<SqlEditorHandle>(null);
  const [d, setD] = useState<Detail | null>(null);
  const [text, setText] = useState(initial ?? '');
  const [err, setErr] = useState<unknown>(null);
  const [args, setArgs] = useState('');
  const [running, setRunning] = useState(false);
  const [out, setOut] = useState<null | { sql: string; fields: { name: string }[]; rows: Cell[][]; rowCount: number | null; ms: number }>(null);
  const [runErr, setRunErr] = useState<ApiError | null>(null);
  const canWrite = !session.readOnly;

  useEffect(() => {
    if (oid === undefined) return;
    get<Detail>(`/routines/${oid}`).then((x) => { setD(x); setText(x.def); }).catch(setErr);
  }, [oid]);

  if (err) return <ErrorBox error={err} onRetry={() => go('routines')} />;
  if (!isNew && !d) return <Loading />;

  const save = async () => {
    try { await post('/routines/save', { def: ed.current?.getText() || text }); toast('ok', 'Сохранено'); onSaved(); } catch (e) { toast('err', (e as Error).message); }
  };
  const run = async () => {
    if (!d) return;
    setRunning(true); setRunErr(null); setOut(null);
    try { setOut(await post(`/routines/${d.oid}/run`, { args })); } catch (e) { setRunErr(e as ApiError); } finally { setRunning(false); }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2.5 sm:px-5">
        <button className="btn btn-ghost btn-sm !px-2 lg:hidden" onClick={onBack}><ArrowLeft size={17} /></button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2"><span className={clsx('chip', d?.kind === 'p' ? 'bg-info/15 text-info' : 'bg-accent/15 text-accent')}>{isNew ? 'НОВАЯ' : d?.kind === 'p' ? 'PROCEDURE' : 'FUNCTION'}</span>
            <span className="truncate font-mono text-[15px] font-semibold">{isNew ? 'Новое определение' : `${d!.schema}.${d!.name}`}</span></div>
          {d && <div className="mt-0.5 truncate font-mono text-[11px] text-muted">({d.args})</div>}
        </div>
        <button className="btn btn-primary btn-sm" disabled={!canWrite} onClick={() => void save()} title={canWrite ? '' : 'Включите режим записи'}><Save size={14} /> Сохранить</button>
        {!isNew && d && <button className="btn btn-danger btn-sm" disabled={!canWrite} onClick={async () => {
          if (!(await confirm({ title: `Удалить ${d.type} «${d.name}»?`, danger: true, confirmLabel: 'Удалить', typeToConfirm: d.name }))) return;
          try { await del(`/routines/${d.oid}`); toast('ok', 'Удалено'); onDeleted?.(); } catch (e) { toast('err', (e as Error).message); }
        }}><Trash2 size={14} /></button>}
      </div>
      <div className="min-h-[200px] flex-1 overflow-hidden border-b border-line"><SqlEditor ref={ed} value={text} onChange={setText} className="h-full" /></div>
      {!isNew && d && (
        <div className="max-h-[48%] shrink-0 overflow-auto">
          <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 sm:px-5">
            <span className="text-[13px] font-medium">{d.kind === 'p' ? 'CALL' : 'SELECT * FROM'}</span>
            <code className="font-mono text-[12.5px] text-muted">{d.schema}.{d.name}(</code>
            <input className="input !h-8 min-w-[180px] flex-1 font-mono text-[12.5px]" placeholder="аргументы как SQL: 1, 'abc', now()" value={args} onChange={(e) => setArgs(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void run()} />
            <code className="font-mono text-[12.5px] text-muted">)</code>
            <button className="btn btn-soft btn-sm" disabled={running} onClick={() => void run()}>{running ? <Spinner size={14} /> : <Play size={14} />} Запустить</button>
          </div>
          {runErr && <div className="mx-3 mb-3 rounded-lg border border-danger/40 bg-danger/10 p-3 text-[13px] text-danger sm:mx-5">{runErr.message}{runErr.pg?.detail && <div className="mt-1 text-muted">{runErr.pg.detail}</div>}{runErr.pg?.where && <div className="mt-1 font-mono text-[11px] text-muted">{runErr.pg.where}</div>}</div>}
          {out && (
            <div className="border-t border-line">
              <div className="px-5 py-2 text-xs text-muted">{out.fields.length ? `${out.rows.length} строк` : `Выполнено`} · {out.ms} мс</div>
              {out.fields.length > 0 && <DataGrid columns={out.fields} rows={out.rows} />}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TriggerList({ items, onChange }: { items: Trigger[]; onChange: () => void }) {
  const { session } = useApp();
  const { toast } = useUi();
  if (!items.length) return <Empty icon={<Zap size={34} />} title="Триггеров нет" />;
  return (
    <>
      {items.map((t) => (
        <div key={t.oid} className="border-b border-line/50 px-4 py-3">
          <div className="flex items-center gap-2">
            <Zap size={14} className="text-warn" /><span className="min-w-0 flex-1 truncate font-mono text-[13px] font-semibold">{t.name}</span>
            <Toggle checked={t.enabled !== 'D'} disabled={session.readOnly} onChange={async (v) => {
              try { await post('/triggers/toggle', { schema: t.schema, table: t.table, name: t.name, enable: v }); toast('ok', v ? 'Включён' : 'Выключен'); onChange(); } catch (e) { toast('err', (e as Error).message); }
            }} />
          </div>
          <div className="mt-1 text-[11px] text-muted">на {t.schema}.{t.table} · функция {t.function}</div>
          <code className="mt-1 block break-all font-mono text-[11px] leading-relaxed text-muted/80">{t.def}</code>
        </div>
      ))}
    </>
  );
}
