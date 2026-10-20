import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { AlertCircle, Bookmark, CheckCircle2, ClipboardCopy, Clock, Download, FileCode2, GripHorizontal, History, Lightbulb, Play, Save, Trash2, Wand2, X } from 'lucide-react';
import { ApiError, get, post } from '../api';
import { useApp } from '../ctx';
import { downloadText, DataGrid, toCsv, Cell } from '../grid';
import { SqlEditor, SqlEditorHandle } from '../editor';
import { fmtNum, Modal, Spinner, useUi } from '../ui';

interface ResultSet { command: string; rowCount: number | null; fields: { name: string; type: string }[]; rows: Cell[][]; truncated: boolean }
interface RunResp { results: ResultSet[]; ms: number }
interface HistoryItem { sql: string; at: number; ms: number; ok: boolean }
interface Saved { name: string; sql: string }

const LS_DRAFT = 'dbs-sql-draft', LS_HIST = 'dbs-sql-history', LS_SAVED = 'dbs-sql-saved';
const load = <T,>(k: string, d: T): T => { try { return JSON.parse(localStorage.getItem(k) || '') as T; } catch { return d; } };

const TEMPLATES: { title: string; sql: string }[] = [
  { title: 'Таблицы и их размеры', sql: `select schemaname as schema, relname as table, n_live_tup as rows,\n       pg_size_pretty(pg_total_relation_size(relid)) as total_size\nfrom pg_stat_user_tables\norder by pg_total_relation_size(relid) desc;` },
  { title: 'Активные запросы', sql: `select pid, usename, state, now() - query_start as duration, left(query, 120) as query\nfrom pg_stat_activity\nwhere state <> 'idle' and pid <> pg_backend_pid()\norder by query_start;` },
  { title: 'Неиспользуемые индексы', sql: `select schemaname, relname as table, indexrelname as index, idx_scan,\n       pg_size_pretty(pg_relation_size(indexrelid)) as size\nfrom pg_stat_user_indexes\nwhere idx_scan = 0\norder by pg_relation_size(indexrelid) desc;` },
  { title: 'Блокировки', sql: `select l.pid, a.usename, l.mode, l.granted, l.relation::regclass as relation, left(a.query, 100) as query\nfrom pg_locks l join pg_stat_activity a using (pid)\nwhere l.relation is not null and l.pid <> pg_backend_pid()\norder by l.granted, l.pid;` },
  { title: 'Колонки всех таблиц', sql: `select table_name, ordinal_position as n, column_name, data_type, is_nullable, column_default\nfrom information_schema.columns\nwhere table_schema = 'public'\norder by table_name, ordinal_position;` },
  { title: 'Размеры баз данных', sql: `select datname, pg_size_pretty(pg_database_size(datname)) as size\nfrom pg_database where not datistemplate order by pg_database_size(datname) desc;` },
];

export default function SqlConsole() {
  const { session, db } = useApp();
  const { toast, confirm } = useUi();
  const ed = useRef<SqlEditorHandle>(null);
  const [sql, setSql] = useState(() => localStorage.getItem(LS_DRAFT) || 'select * from pg_tables limit 20;');
  const [limit, setLimit] = useState(1000);
  const [running, setRunning] = useState(false);
  const [resp, setResp] = useState<RunResp | null>(null);
  const [plan, setPlan] = useState<string | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [active, setActive] = useState(0);
  const [completion, setCompletion] = useState<Record<string, string[]>>();
  const [history, setHistory] = useState<HistoryItem[]>(() => load(LS_HIST, []));
  const [saved, setSaved] = useState<Saved[]>(() => load(LS_SAVED, []));
  const [panel, setPanel] = useState<null | 'history' | 'saved' | 'templates'>(null);
  const [saveName, setSaveName] = useState<string | null>(null);
  const [height, setHeight] = useState(() => Number(localStorage.getItem('dbs-sql-h')) || 240);
  const lastRun = useRef('');

  useEffect(() => { get<Record<string, string[]>>('/completion').then(setCompletion).catch(() => undefined); }, [db]);
  useEffect(() => { const t = setTimeout(() => localStorage.setItem(LS_DRAFT, sql), 400); return () => clearTimeout(t); }, [sql]);

  const pushHistory = (text: string, ms: number, ok: boolean) => {
    const h = [{ sql: text, at: Date.now(), ms, ok }, ...history.filter((x) => x.sql !== text)].slice(0, 60);
    setHistory(h); localStorage.setItem(LS_HIST, JSON.stringify(h));
  };

  const run = useCallback(async (mode: 'run' | 'explain' | 'analyze' = 'run') => {
    const text = ed.current?.getSelectionOrAll().trim() || '';
    if (!text) return;
    if (mode === 'run' && !session.readOnly && /\b(drop|truncate)\b/i.test(text)) {
      if (!(await confirm({ title: 'Выполнить опасный запрос?', text: <code className="block max-h-32 overflow-auto whitespace-pre-wrap break-all rounded bg-surface2 p-2 text-xs text-ink">{text.slice(0, 600)}</code>, danger: true, confirmLabel: 'Выполнить' }))) return;
    }
    setRunning(true); setError(null); lastRun.current = text;
    const started = Date.now();
    try {
      if (mode === 'run') {
        const r = await post<RunResp>('/sql', { sql: text, limit });
        setResp(r); setPlan(null); setActive(0); pushHistory(text, r.ms, true);
      } else {
        const r = await post<{ plan: string }>('/sql/explain', { sql: text, analyze: mode === 'analyze' });
        setPlan(r.plan); setResp(null); pushHistory(text, Date.now() - started, true);
      }
    } catch (e) {
      const err = e as ApiError;
      setError(err); setResp(null); setPlan(null); pushHistory(text, Date.now() - started, false);
      if (err.pg?.position && mode === 'run') {
        const all = ed.current?.getText() || '';
        const off = all.indexOf(text);
        ed.current?.gotoPosition((off < 0 ? 0 : off) + err.pg.position - 1);
      }
    } finally { setRunning(false); }
  }, [limit, session.readOnly, history]); // eslint-disable-line react-hooks/exhaustive-deps

  // Ctrl+Enter в редакторе вызывает актуальную версию run
  const runRef = useRef(run);
  runRef.current = run;

  const startResize = (e: React.MouseEvent | React.TouchEvent) => {
    const y0 = 'touches' in e ? e.touches[0].clientY : e.clientY; const h0 = height;
    const move = (ev: MouseEvent | TouchEvent) => { const y = 'touches' in ev ? ev.touches[0].clientY : ev.clientY; setHeight(Math.min(700, Math.max(120, h0 + y - y0))); };
    const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('touchmove', move); window.removeEventListener('mouseup', up); window.removeEventListener('touchend', up); setHeight((h) => { localStorage.setItem('dbs-sql-h', String(h)); return h; }); };
    window.addEventListener('mousemove', move); window.addEventListener('touchmove', move); window.addEventListener('mouseup', up); window.addEventListener('touchend', up);
  };

  const res = resp?.results[active];
  const title = useMemo(() => (res ? res.fields.length ? `${fmtNum(res.rows.length)} строк${res.truncated ? ' (обрезано)' : ''}` : `${res.command}${res.rowCount !== null ? ` · ${fmtNum(res.rowCount)}` : ''}` : ''), [res]);
  const load_ = (text: string) => { setSql(text); ed.current?.setText(text); setPanel(null); ed.current?.focus(); };

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* панель */}
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2 sm:px-5">
        <button className="btn btn-primary" disabled={running} onClick={() => void runRef.current('run')}>{running ? <Spinner size={16} /> : <Play size={15} fill="currentColor" />} Выполнить <kbd className="ml-1 hidden rounded bg-black/20 px-1.5 text-[10px] font-medium sm:inline">Ctrl+Enter</kbd></button>
        <button className="btn btn-soft btn-sm" disabled={running} onClick={() => void runRef.current('explain')} title="План выполнения"><Wand2 size={14} /> Explain</button>
        <button className="btn btn-soft btn-sm" disabled={running} onClick={() => void runRef.current('analyze')} title="План с реальным выполнением"><Clock size={14} /> Analyze</button>
        <select className="input !h-8 !w-auto text-[13px]" value={limit} onChange={(e) => setLimit(Number(e.target.value))} title="Максимум строк в результате">
          {[100, 500, 1000, 5000, 10000].map((n) => <option key={n} value={n}>до {fmtNum(n)} строк</option>)}
        </select>
        <div className="ml-auto flex items-center gap-1">
          <button className={clsx('btn btn-sm', panel === 'templates' ? 'btn-primary' : 'btn-ghost')} onClick={() => setPanel(panel === 'templates' ? null : 'templates')}><Lightbulb size={14} /><span className="hidden md:inline">Шаблоны</span></button>
          <button className={clsx('btn btn-sm', panel === 'saved' ? 'btn-primary' : 'btn-ghost')} onClick={() => setPanel(panel === 'saved' ? null : 'saved')}><Bookmark size={14} /><span className="hidden md:inline">Сохранённые</span></button>
          <button className={clsx('btn btn-sm', panel === 'history' ? 'btn-primary' : 'btn-ghost')} onClick={() => setPanel(panel === 'history' ? null : 'history')}><History size={14} /><span className="hidden md:inline">История</span></button>
          <button className="btn btn-ghost btn-sm" onClick={() => setSaveName('')} title="Сохранить запрос"><Save size={14} /></button>
          <button className="btn btn-ghost btn-sm" onClick={() => load_('')} title="Очистить"><X size={15} /></button>
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col">
        {/* редактор */}
        <div className="shrink-0 border-b border-line bg-surface/40" style={{ height }}>
          <SqlEditor ref={ed} value={sql} onChange={setSql} onRun={() => void runRef.current('run')} completion={completion} placeholderText="Введите SQL… (Ctrl+Enter — выполнить, выделение — выполнить только его)" className="h-full overflow-hidden" />
        </div>
        <div className="group flex h-2.5 shrink-0 cursor-row-resize items-center justify-center bg-surface2/50 hover:bg-accent/20" onMouseDown={startResize} onTouchStart={startResize}><GripHorizontal size={14} className="text-muted/60 group-hover:text-accent" /></div>

        {/* выпадающие панели */}
        {panel && (
          <div className="absolute right-3 top-2 z-30 w-[min(94vw,480px)] overflow-hidden rounded-xl border border-line bg-surface shadow-2xl animate-pop">
            <div className="flex items-center justify-between border-b border-line px-4 py-2.5 text-sm font-semibold">
              {panel === 'history' ? 'История запросов' : panel === 'saved' ? 'Сохранённые запросы' : 'Готовые шаблоны'}
              <button className="btn btn-ghost btn-sm !px-1.5" onClick={() => setPanel(null)}><X size={15} /></button>
            </div>
            <div className="max-h-[52dvh] overflow-y-auto">
              {panel === 'templates' && TEMPLATES.map((t) => <button key={t.title} onClick={() => load_(t.sql)} className="block w-full border-b border-line/50 px-4 py-2.5 text-left hover:bg-surface2"><div className="text-[13px] font-medium">{t.title}</div><code className="line-clamp-1 text-[11px] text-muted">{t.sql.replace(/\s+/g, ' ')}</code></button>)}
              {panel === 'history' && (history.length ? history.map((h) => (
                <button key={h.at} onClick={() => load_(h.sql)} className="block w-full border-b border-line/50 px-4 py-2.5 text-left hover:bg-surface2">
                  <div className="flex items-center gap-2 text-[11px] text-muted">{h.ok ? <CheckCircle2 size={12} className="text-ok" /> : <AlertCircle size={12} className="text-danger" />}{new Date(h.at).toLocaleString('ru-RU')} · {h.ms} мс</div>
                  <code className="line-clamp-2 break-all font-mono text-[12px]">{h.sql.replace(/\s+/g, ' ')}</code></button>
              )) : <div className="p-6 text-center text-sm text-muted">История пуста</div>)}
              {panel === 'saved' && (saved.length ? saved.map((s, i) => (
                <div key={s.name + i} className="flex items-center border-b border-line/50 hover:bg-surface2">
                  <button onClick={() => load_(s.sql)} className="min-w-0 flex-1 px-4 py-2.5 text-left"><div className="text-[13px] font-medium">{s.name}</div><code className="line-clamp-1 text-[11px] text-muted">{s.sql.replace(/\s+/g, ' ')}</code></button>
                  <button className="btn btn-ghost btn-sm mr-2 !px-1.5 hover:!text-danger" onClick={() => { const n = saved.filter((_, j) => j !== i); setSaved(n); localStorage.setItem(LS_SAVED, JSON.stringify(n)); }}><Trash2 size={14} /></button>
                </div>
              )) : <div className="p-6 text-center text-sm text-muted">Нет сохранённых запросов. Нажмите <Save size={12} className="inline" />.</div>)}
            </div>
          </div>
        )}

        {/* результаты */}
        <div className="flex min-h-0 flex-1 flex-col">
          {running && !resp && !error && !plan && <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted"><Spinner /> Выполняется…</div>}
          {!running && !resp && !error && !plan && (
            <div className="m-auto max-w-sm px-6 py-12 text-center text-sm text-muted"><FileCode2 size={34} className="mx-auto mb-3 text-muted/50" />Напишите запрос и нажмите <b className="text-ink">Ctrl+Enter</b>.<br />Режим сейчас: <b className="text-ink">{session.readOnly ? 'только чтение' : 'запись разрешена'}</b>.</div>
          )}
          {error && (
            <div className="m-3 rounded-xl border border-danger/40 bg-danger/10 p-4 text-sm sm:m-5">
              <div className="flex items-start gap-2"><AlertCircle size={18} className="mt-0.5 shrink-0 text-danger" /><div className="min-w-0">
                <div className="font-medium text-danger break-words">{error.message}</div>
                {error.pg?.code && <div className="mt-1 text-xs text-muted">SQLSTATE {error.pg.code}{error.pg.position ? ` · позиция ${error.pg.position}` : ''}</div>}
                {error.pg?.detail && <div className="mt-1 text-muted">{error.pg.detail}</div>}
                {error.pg?.hint && <div className="mt-1 text-muted">Подсказка: {error.pg.hint}</div>}
                {error.status === 403 && <div className="mt-2 text-xs text-muted">Нужен режим записи — переключатель в шапке.</div>}
              </div></div>
            </div>
          )}
          {plan !== null && <pre className="m-3 min-h-0 flex-1 overflow-auto rounded-xl border border-line bg-surface p-4 font-mono text-[12.5px] leading-relaxed sm:m-5">{plan}</pre>}
          {resp && (
            <>
              <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2 text-xs sm:px-5">
                {resp.results.length > 1 && (
                  <div className="mr-2 flex gap-1">{resp.results.map((r, i) => (
                    <button key={i} onClick={() => setActive(i)} className={clsx('rounded-lg px-2.5 py-1 font-medium', i === active ? 'bg-accent/15 text-accent' : 'text-muted hover:bg-surface2')}>#{i + 1} {r.command}</button>
                  ))}</div>
                )}
                {res && <span className="chip bg-ok/15 text-ok"><CheckCircle2 size={12} />{res.fields.length ? title : `${res.command}${res.rowCount !== null ? ` · затронуто строк: ${fmtNum(res.rowCount)}` : ''}`}</span>}
                <span className="text-muted">{resp.ms} мс</span>
                {res?.truncated && <span className="chip bg-warn/15 text-warn">показаны первые {fmtNum(res.rows.length)} строк — увеличьте лимит</span>}
                {res && res.fields.length > 0 && (
                  <div className="ml-auto flex gap-1">
                    <button className="btn btn-ghost btn-sm" onClick={() => { void navigator.clipboard.writeText([res.fields.map((f) => f.name).join('\t'), ...res.rows.map((r) => r.map((v) => v ?? '').join('\t'))].join('\n')); toast('ok', 'Скопировано (TSV)'); }}><ClipboardCopy size={14} /> Копировать</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => downloadText('result.csv', toCsv(res.fields.map((f) => f.name), res.rows), 'text/csv')}><Download size={14} /> CSV</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => downloadText('result.json', JSON.stringify(res.rows.map((r) => Object.fromEntries(res.fields.map((f, i) => [f.name, r[i]]))), null, 2), 'application/json')}><Download size={14} /> JSON</button>
                  </div>
                )}
              </div>
              <div className="min-h-0 flex-1 overflow-auto">
                {res && res.fields.length > 0 ? <DataGrid columns={res.fields} rows={res.rows} emptyText="Запрос не вернул строк" />
                  : <div className="p-8 text-center text-sm text-muted">Команда выполнена: <b className="text-ink">{res?.command}</b>{res?.rowCount !== null && res?.rowCount !== undefined ? ` · затронуто строк: ${res.rowCount}` : ''}</div>}
              </div>
            </>
          )}
        </div>
      </div>

      <Modal open={saveName !== null} onClose={() => setSaveName(null)} title="Сохранить запрос" width={420}
        footer={<><button className="btn btn-soft" onClick={() => setSaveName(null)}>Отмена</button><button className="btn btn-primary" disabled={!saveName?.trim()} onClick={() => {
          const n = [{ name: saveName!.trim(), sql: ed.current?.getText() || sql }, ...saved.filter((s) => s.name !== saveName!.trim())];
          setSaved(n); localStorage.setItem(LS_SAVED, JSON.stringify(n)); setSaveName(null); toast('ok', 'Запрос сохранён');
        }}>Сохранить</button></>}>
        <label className="label">Название</label>
        <input className="input" autoFocus value={saveName ?? ''} onChange={(e) => setSaveName(e.target.value)} />
      </Modal>
    </div>
  );
}
