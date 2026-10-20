import { useCallback, useEffect, useState } from 'react';
import clsx from 'clsx';
import { Activity, Boxes, Clock, Database, FunctionSquare, HardDrive, Layers, Network, RefreshCw, Rows3, Users, XCircle, Zap } from 'lucide-react';
import { get, post } from '../api';
import { go, tableLink, useApp } from '../ctx';
import { ErrorBox, fmtBytes, fmtDate, fmtDuration, fmtNum, Loading, Stat, useUi } from '../ui';

interface Overview {
  info: { version: string; db: string; user: string; started: string; size: string; max_conn: number; encoding: string; tz: string; stmt_timeout: string };
  stat: { numbackends: number; xact_commit: string; xact_rollback: string; blks_read: string; blks_hit: string; tup_returned: string; tup_fetched: string; tup_inserted: string; tup_updated: string; tup_deleted: string; deadlocks: string; temp_files: string; temp_bytes: string };
  conns: { total: number; active: number; idle_tx: number };
  tables: { schema: string; name: string; rows: number; total: number; data: number; idx: number }[];
  counts: { tables: number; views: number; routines: number; roles: number; indexes: number };
  activity: { pid: number; user: string; db: string; app: string; state: string | null; wait: string | null; seconds: number | null; query: string; client: string | null }[];
}

export default function Overview() {
  const { db, session, changeDb } = useApp();
  const { toast, confirm } = useUi();
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [auto, setAuto] = useState(true);
  const [dbs, setDbs] = useState<{ name: string; owner: string; size: string | null; can_connect: boolean; encoding: string }[]>([]);

  const load = useCallback(async () => {
    try { setData(await get<Overview>('/overview')); setError(null); } catch (e) { setError(e); }
  }, []);
  useEffect(() => { void load(); get('/databases').then(setDbs).catch(() => undefined); }, [load, db]);
  useEffect(() => {
    if (!auto) return;
    const t = setInterval(() => { if (!document.hidden) void load(); }, 5000);
    return () => clearInterval(t);
  }, [auto, load]);

  const cancel = async (pid: number, terminate: boolean) => {
    if (terminate && !(await confirm({ title: `Завершить сессию ${pid}?`, text: 'Соединение будет разорвано, незавершённая транзакция откатится.', danger: true, confirmLabel: 'Завершить' }))) return;
    try { await post('/activity/cancel', { pid, terminate }); toast('ok', terminate ? 'Сессия завершена' : 'Запрос отменён'); void load(); } catch (e) { toast('err', (e as Error).message); }
  };

  if (error && !data) return <ErrorBox error={error} onRetry={load} />;
  if (!data) return <Loading />;
  const { info, stat, conns, tables, counts, activity } = data;
  const hit = Number(stat.blks_hit), read = Number(stat.blks_read);
  const hitRatio = hit + read > 0 ? (hit / (hit + read)) * 100 : 100;
  const uptime = (Date.now() - new Date(info.started).getTime()) / 1000;
  const maxTotal = Math.max(1, ...tables.map((t) => t.total));
  const ver = info.version.match(/PostgreSQL ([\d.]+)/)?.[1] ?? info.version;

  return (
    <div className="mx-auto max-w-[1400px] space-y-5 p-3 sm:p-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-lg font-semibold"><Database size={20} className="text-accent" />{info.db}</div>
          <div className="mt-0.5 truncate text-xs text-muted">PostgreSQL {ver} · {info.encoding} · {info.tz} · запущен {fmtDate(info.started)}</div>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-xs text-muted"><input type="checkbox" className="accent-[rgb(var(--accent))]" checked={auto} onChange={(e) => setAuto(e.target.checked)} /> Автообновление</label>
        <button className="btn btn-soft btn-sm" onClick={() => void load()}><RefreshCw size={14} /> Обновить</button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
        <Stat label="Размер базы" value={fmtBytes(Number(info.size))} icon={<HardDrive size={16} />} sub={`${counts.tables} таблиц · ${counts.indexes} индексов`} />
        <Stat label="Подключения" value={`${conns.total} / ${info.max_conn}`} icon={<Network size={16} />} sub={`активных: ${conns.active}${conns.idle_tx ? ` · в транзакции: ${conns.idle_tx}` : ''}`} tone={conns.total / info.max_conn > 0.8 ? 'warn' : undefined} />
        <Stat label="Кэш-попаданий" value={`${hitRatio.toFixed(1)}%`} icon={<Zap size={16} />} sub="чтение из памяти" tone={hitRatio >= 95 ? 'ok' : hitRatio >= 85 ? 'warn' : 'danger'} />
        <Stat label="Время работы" value={fmtDuration(uptime)} icon={<Clock size={16} />} sub={`timeout запроса: ${info.stmt_timeout}`} />
        <Stat label="Транзакции" value={fmtNum(stat.xact_commit)} icon={<Activity size={16} />} sub={`откатов: ${fmtNum(stat.xact_rollback)} · deadlock: ${stat.deadlocks}`} />
        <Stat label="Объекты" value={`${counts.views} / ${counts.routines}`} icon={<Layers size={16} />} sub="представлений / процедур" />
      </div>

      <div className="grid gap-5 xl:grid-cols-5">
        <section className="card overflow-hidden xl:col-span-3">
          <div className="flex items-center justify-between border-b border-line px-4 py-3"><h2 className="flex items-center gap-2 font-semibold"><Boxes size={16} className="text-accent" />Таблицы по размеру</h2>
            <div className="flex items-center gap-3 text-[11px] text-muted"><span className="flex items-center gap-1"><i className="h-2 w-2 rounded-sm bg-accent" />данные</span><span className="flex items-center gap-1"><i className="h-2 w-2 rounded-sm bg-info" />индексы</span><span className="flex items-center gap-1"><i className="h-2 w-2 rounded-sm bg-muted/50" />TOAST</span></div></div>
          <div className="max-h-[520px] overflow-auto">
            {tables.map((t) => {
              const toast_ = Math.max(0, t.total - t.data - t.idx);
              return (
                <a key={t.schema + t.name} href={tableLink(t.schema, t.name)} className="block border-b border-line/50 px-4 py-2.5 transition hover:bg-surface2/70">
                  <div className="mb-1.5 flex items-center justify-between gap-3 text-[13px]">
                    <span className="min-w-0 truncate font-medium">{t.schema !== 'public' && <span className="text-muted">{t.schema}.</span>}{t.name}</span>
                    <span className="shrink-0 tabular-nums text-xs text-muted"><Rows3 size={11} className="mr-1 inline" />{fmtNum(t.rows)} · <b className="text-ink">{fmtBytes(t.total)}</b></span>
                  </div>
                  <div className="flex h-2 overflow-hidden rounded-full bg-surface2" style={{ width: `${Math.max(3, (t.total / maxTotal) * 100)}%` }}>
                    <i className="bg-accent" style={{ width: `${(t.data / t.total) * 100}%` }} /><i className="bg-info" style={{ width: `${(t.idx / t.total) * 100}%` }} /><i className="bg-muted/50" style={{ width: `${(toast_ / t.total) * 100}%` }} />
                  </div>
                </a>
              );
            })}
            {!tables.length && <div className="p-8 text-center text-sm text-muted">Таблиц нет</div>}
          </div>
        </section>

        <div className="space-y-5 xl:col-span-2">
          <section className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-4 py-3"><h2 className="flex items-center gap-2 font-semibold"><Database size={16} className="text-accent" />Базы данных</h2></div>
            <div className="divide-y divide-line/60">
              {dbs.map((d) => (
                <button key={d.name} disabled={!d.can_connect} onClick={() => changeDb(d.name)} className={clsx('flex w-full items-center gap-3 px-4 py-2.5 text-left text-[13px] transition hover:bg-surface2/70 disabled:opacity-40', d.name === db && 'bg-accent/10')}>
                  <Database size={15} className={d.name === db ? 'text-accent' : 'text-muted'} />
                  <span className="min-w-0 flex-1"><span className="block truncate font-medium">{d.name}</span><span className="block truncate text-[11px] text-muted">{d.owner} · {d.encoding}</span></span>
                  <span className="tabular-nums text-xs text-muted">{fmtBytes(d.size ? Number(d.size) : null)}</span>
                </button>
              ))}
            </div>
          </section>
          <section className="card p-4">
            <h2 className="mb-3 flex items-center gap-2 font-semibold"><Rows3 size={16} className="text-accent" />Операции с данными</h2>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[13px]">
              {([['Прочитано строк', stat.tup_returned], ['Выбрано по индексу', stat.tup_fetched], ['Вставлено', stat.tup_inserted], ['Изменено', stat.tup_updated], ['Удалено', stat.tup_deleted], ['Временных файлов', stat.temp_files]] as const).map(([k, v]) => (
                <div key={k} className="flex items-baseline justify-between gap-2 border-b border-line/50 pb-1.5"><dt className="text-muted">{k}</dt><dd className="tabular-nums font-medium">{fmtNum(v)}</dd></div>
              ))}
            </dl>
          </section>
          <section className="card flex items-center gap-4 p-4">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-info/15 text-info"><Users size={20} /></div>
            <div className="min-w-0 flex-1 text-[13px]"><div className="font-medium">Ролей: {counts.roles}</div><div className="text-xs text-muted">Вы вошли как {session.user}{session.isSuper ? ' (суперпользователь)' : ''}</div></div>
            <button className="btn btn-soft btn-sm" onClick={() => go('roles')}>Управлять</button>
          </section>
        </div>
      </div>

      <section className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-4 py-3"><h2 className="flex items-center gap-2 font-semibold"><Activity size={16} className="text-accent" />Активность сессий <span className="chip bg-surface2 text-muted">{activity.length}</span></h2></div>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead><tr><th className="th">PID</th><th className="th">Пользователь</th><th className="th">База</th><th className="th">Состояние</th><th className="th">Длит.</th><th className="th">Запрос</th><th className="th" /></tr></thead>
            <tbody>
              {activity.map((a) => (
                <tr key={a.pid} className="hover:bg-surface2/50">
                  <td className="td tabular-nums text-muted">{a.pid}</td>
                  <td className="td whitespace-nowrap">{a.user}<div className="text-[11px] text-muted">{a.app || a.client || ''}</div></td>
                  <td className="td">{a.db}</td>
                  <td className="td"><span className={clsx('chip', a.state === 'active' ? 'bg-ok/15 text-ok' : a.state?.startsWith('idle in') ? 'bg-warn/15 text-warn' : 'bg-surface2 text-muted')}>{a.state || '—'}</span></td>
                  <td className="td whitespace-nowrap tabular-nums">{a.seconds !== null ? fmtDuration(a.seconds) : '—'}</td>
                  <td className="td max-w-[520px]"><code className="line-clamp-2 break-all font-mono text-[11.5px] text-muted">{a.query || '—'}</code></td>
                  <td className="td whitespace-nowrap text-right">
                    {!session.readOnly && <>
                      <button className="btn btn-ghost btn-sm" onClick={() => void cancel(a.pid, false)}>Отменить</button>
                      <button className="btn btn-ghost btn-sm text-danger" onClick={() => void cancel(a.pid, true)} title="Завершить сессию"><XCircle size={15} /></button>
                    </>}
                  </td>
                </tr>
              ))}
              {!activity.length && <tr><td colSpan={7} className="td py-8 text-center text-muted">Других сессий нет</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
      <p className="px-1 text-[11px] text-muted"><FunctionSquare size={11} className="mr-1 inline" />{info.version}</p>
    </div>
  );
}
