import { useState } from 'react';
import { AlertTriangle, CheckCircle2, DatabaseBackup, Download, HardDrive, Printer, ShieldCheck, Trash2, XCircle } from 'lucide-react';
import { del, get, post, put } from '../api';
import { useAuth } from '../auth';
import { fmtDateTime } from '../format';
import { Badge, Col, DataTable, ErrorBox, Field, Loading, PageHeader, StatCard, Tabs, Toggle, useFetch, useUi } from '../ui';
import { ProgressBar } from '../ui2';

interface Health {
  status: 'ok' | 'warn' | 'bad'; checks: { id: string; label: string; status: 'ok' | 'warn' | 'bad'; detail: string }[];
  db: { version: string | null; latency: number; size: number; connections: { total: number; active: number }; tables: { name: string; bytes: number; rows: number }[] };
  office: { uptimeSec: number; memoryMb: number; node: string; pool: { total: number; idle: number; waiting: number } }; disk: { total: number; free: number } | null;
  printers: { id: string; nombre: string; tipo: string; activa: boolean; ok24: number; fail24: number; lastError: string | null; lastOk: boolean | null }[];
  activity: { lastOrder: string | null; ordersLastHour: number; openOrders: number };
}
interface Backups { config: { enabled: boolean; time: string; keep: number }; tools: boolean; running: boolean; rows: { id: string; stamp: string; dbSize: number | null; filesSize: number | null; hasFiles: boolean; status: string; error: string | null; auto: boolean; verifiedOk: boolean | null; by: string | null; at: string }[] }

const size = (b: number | null) => (b === null ? '—' : b < 1048576 ? `${(b / 1024).toFixed(0)} КБ` : b < 1073741824 ? `${(b / 1048576).toFixed(1)} МБ` : `${(b / 1073741824).toFixed(2)} ГБ`);
const uptime = (s: number) => (s < 3600 ? `${Math.floor(s / 60)} мин` : s < 86400 ? `${Math.floor(s / 3600)} ч ${Math.floor((s % 3600) / 60)} мин` : `${Math.floor(s / 86400)} дн ${Math.floor((s % 86400) / 3600)} ч`);
const TONE = { ok: 'good', warn: 'warn', bad: 'bad' } as const;
const ICON = { ok: <CheckCircle2 size={18} className="text-good" />, warn: <AlertTriangle size={18} className="text-warn" />, bad: <XCircle size={18} className="text-bad" /> };

export default function SystemPage() {
  const { can } = useAuth();
  const [tab, setTab] = useState<'health' | 'backups'>('health');
  return (
    <>
      <PageHeader title="Система" subtitle="Состояние сервисов и резервные копии базы данных" />
      <Tabs value={tab} onChange={setTab} tabs={[...(can('sys.view') ? [{ id: 'health' as const, label: 'Состояние' }] : []), ...(can('sys.backup') ? [{ id: 'backups' as const, label: 'Резервные копии' }] : [])]} />
      {tab === 'health' && can('sys.view') ? <HealthTab /> : <BackupsTab />}
    </>
  );
}

function HealthTab() {
  const { data, error, reload } = useFetch(() => get<Health>('/sys/health'), []);
  if (error && !data) return <ErrorBox error={error} onRetry={reload} />;
  if (!data) return <Loading />;
  const d = data;
  return (
    <>
      <div className={`mb-5 flex items-center gap-3 rounded-xl border p-4 ${d.status === 'ok' ? 'border-good/30 bg-good/10' : d.status === 'warn' ? 'border-warn/30 bg-warn/10' : 'border-bad/30 bg-bad/10'}`}>
        <ShieldCheck size={26} className={d.status === 'ok' ? 'text-good' : d.status === 'warn' ? 'text-warn' : 'text-bad'} />
        <div><div className="font-semibold">{d.status === 'ok' ? 'Всё работает' : d.status === 'warn' ? 'Есть замечания' : 'Есть проблемы, требующие внимания'}</div><div className="text-xs text-muted">Страница обновляется сама при изменениях; полная проверка — при открытии</div></div>
        <button className="btn btn-soft btn-sm ml-auto" onClick={reload}>Проверить снова</button>
      </div>
      <div className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {d.checks.map((c) => <div key={c.id} className="card flex items-start gap-3 p-4">{ICON[c.status]}<div className="min-w-0"><div className="font-medium">{c.label}</div><div className="text-[13px] text-muted">{c.detail}</div></div></div>)}
      </div>
      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="База данных" value={size(d.db.size)} sub={`${d.db.version ?? ''} · ответ ${d.db.latency} мс`} icon={<DatabaseBackup size={16} />} />
        <StatCard label="Подключений к БД" value={`${d.db.connections.total}`} sub={`активных ${d.db.connections.active}`} />
        <StatCard label="Сервис Office" value={uptime(d.office.uptimeSec)} sub={`память ${d.office.memoryMb} МБ · Node ${d.office.node}`} />
        <StatCard label="Заказы" value={`${d.activity.openOrders} открыто`} sub={`за час: ${d.activity.ordersLastHour}${d.activity.lastOrder ? ` · последний ${fmtDateTime(d.activity.lastOrder)}` : ''}`} icon={<Printer size={16} />} />
      </div>
      {d.disk && <div className="card mb-5 p-4"><div className="mb-2 flex items-center gap-2 text-sm font-medium"><HardDrive size={15} className="text-muted" />Диск для вложений и копий: свободно {size(d.disk.free)} из {size(d.disk.total)}</div><ProgressBar value={d.disk.total - d.disk.free} max={d.disk.total} tone={d.disk.free / d.disk.total < 0.15 ? 'warn' : 'brand'} /></div>}
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="card p-4"><h2 className="mb-3 font-semibold">Принтеры (за 24 часа)</h2>
          {!d.printers.length ? <p className="text-sm text-muted">Принтеры не настроены в кассе</p> : <ul className="divide-y divide-line/70">{d.printers.map((p) => (
            <li key={p.id} className="flex items-center gap-3 py-2 text-[13px]"><div className="min-w-0 flex-1"><div className="font-medium">{p.nombre} <span className="text-xs font-normal text-muted">{p.tipo}</span></div>{p.lastError && p.lastOk === false && <div className="truncate text-xs text-bad">{p.lastError}</div>}</div>
              {!p.activa ? <Badge>отключён</Badge> : <><Badge tone="good">{p.ok24} ок</Badge>{p.fail24 > 0 && <Badge tone="bad">{p.fail24} ошибок</Badge>}</>}</li>))}</ul>}
        </section>
        <section className="card p-4"><h2 className="mb-3 font-semibold">Самые большие таблицы</h2>
          <ul className="divide-y divide-line/70">{d.db.tables.map((t) => <li key={t.name} className="flex items-center gap-3 py-1.5 text-[13px]"><span className="min-w-0 flex-1 truncate font-mono text-xs">{t.name}</span><span className="tnum text-muted">{t.rows.toLocaleString('ru-RU')} строк</span><span className="tnum w-20 text-right">{size(t.bytes)}</span></li>)}</ul>
        </section>
      </div>
    </>
  );
}

function BackupsTab() {
  const { toast, confirm } = useUi();
  const { data, error, reload } = useFetch(() => get<Backups>('/sys/backups'), []);
  const [busy, setBusy] = useState(false);
  const [cfg, setCfg] = useState<Backups['config'] | null>(null);
  if (error && !data) return <ErrorBox error={error} onRetry={reload} />;
  if (!data) return <Loading />;
  const c = cfg ?? data.config;
  const create = async () => { setBusy(true); try { await post('/sys/backups'); toast('ok', 'Резервная копия создана'); await reload(); } catch (e) { toast('err', (e as Error).message); } finally { setBusy(false); } };
  const saveCfg = async (n: Backups['config']) => { setCfg(n); try { await put('/sys/backups/config', n); toast('ok', 'Расписание сохранено'); await reload(); setCfg(null); } catch (e) { toast('err', (e as Error).message); setCfg(null); } };
  const cols: Col<Backups['rows'][number]>[] = [
    { key: 'at', header: 'Создана', render: (r) => <div><div className="font-medium">{fmtDateTime(r.at)}</div><div className="text-xs text-muted">{r.auto ? 'по расписанию' : `вручную · ${r.by ?? ''}`}</div></div>, sort: (r) => r.at, csv: (r) => r.at },
    { key: 's', header: 'Статус', render: (r) => (r.status === 'ok' ? <div className="flex flex-wrap gap-1"><Badge tone="good">готова</Badge>{r.verifiedOk ? <Badge tone="info">проверена</Badge> : <Badge tone="warn">не проверена</Badge>}</div> : r.status === 'running' ? <Badge tone="info">создаётся…</Badge> : <div><Badge tone="bad">ошибка</Badge><div className="mt-0.5 max-w-[260px] text-xs text-bad">{r.error}</div></div>), csv: (r) => r.status },
    { key: 'sz', header: 'База', align: 'right', render: (r) => size(r.dbSize), csv: (r) => r.dbSize },
    { key: 'fs', header: 'Вложения', align: 'right', render: (r) => (r.hasFiles ? size(r.filesSize) : '—'), hideOnMobile: true, csv: (r) => r.filesSize },
    { key: 'x', header: '', align: 'right', render: (r) => (r.status === 'ok' ? (
      <span className="inline-flex gap-0.5">
        <a className="btn btn-ghost btn-sm !px-2" href={`/api/sys/backups/${r.id}/download`} title="Скачать базу"><Download size={15} /> БД</a>
        {r.hasFiles && <a className="btn btn-ghost btn-sm !px-2" href={`/api/sys/backups/${r.id}/download?kind=files`} title="Скачать вложения"><Download size={15} /> Файлы</a>}
        <button className="btn btn-ghost btn-sm !px-1.5 hover:!text-bad" title="Удалить" onClick={async () => { if (await confirm({ title: 'Удалить копию?', text: fmtDateTime(r.at), danger: true, confirmLabel: 'Удалить' })) { try { await del('/sys/backups/' + r.id); void reload(); } catch (e) { toast('err', (e as Error).message); } } }}><Trash2 size={15} /></button>
      </span>) : null) },
  ];
  return (
    <>
      {!data.tools && <p className="mb-4 rounded-lg bg-bad/10 p-3 text-sm text-bad">В сервисе нет утилит PostgreSQL — копирование недоступно. Пересоберите образ office: <code>docker compose up -d --build office</code>.</p>}
      <div className="mb-5 grid gap-4 lg:grid-cols-[1fr_340px]">
        <section className="card p-4">
          <div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">Расписание</h2><button className="btn btn-primary" disabled={busy || data.running || !data.tools} onClick={() => void create()}><DatabaseBackup size={15} /> {busy || data.running ? 'Создаётся…' : 'Создать копию сейчас'}</button></div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Ежедневно"><div className="pt-1.5"><Toggle checked={c.enabled} onChange={(v) => void saveCfg({ ...c, enabled: v })} label={c.enabled ? 'включено' : 'выключено'} /></div></Field>
            <Field label="Время (по часовому поясу ресторана)"><input type="time" className="input" value={c.time} onChange={(e) => setCfg({ ...c, time: e.target.value })} onBlur={() => cfg && void saveCfg(cfg)} /></Field>
            <Field label="Хранить копий"><input type="number" min={2} max={90} className="input tnum" value={c.keep} onChange={(e) => setCfg({ ...c, keep: Number(e.target.value) })} onBlur={() => cfg && void saveCfg(cfg)} /></Field>
          </div>
          <p className="mt-3 text-xs text-muted">Копия — полный дамп базы (заказы, склад, меню, пользователи, данные Office) плюс архив вложений. Старые копии удаляются автоматически. Если сервис был выключен в назначенное время, копия создастся при следующем запуске.</p>
        </section>
        <section className="card p-4 text-[12.5px] leading-relaxed">
          <h2 className="mb-2 font-semibold">Как восстановить</h2>
          <p className="mb-2 text-muted">Восстановление выполняется вручную на сервере — это защита от случайной подмены рабочей базы.</p>
          <ol className="list-decimal space-y-1 pl-4 text-muted"><li>Скачайте файл «БД» и положите на сервер.</li><li>Остановите backend и office.</li><li>Выполните pg_restore в пустую базу (команда — в README Office, раздел «Резервные копии»).</li><li>Запустите сервисы.</li></ol>
          <p className="mt-2 text-muted"><b className="text-ink">Важно:</b> копии лежат на том же сервере. Периодически скачивайте их к себе — при поломке диска пропадёт и база, и копии.</p>
        </section>
      </div>
      <DataTable cols={cols} rows={data.rows} rowKey={(r) => r.id} initialSort={{ key: 'at', dir: 'desc' }} empty={<div className="py-12 text-center text-sm text-muted">Копий ещё нет. Нажмите «Создать копию сейчас».</div>} />
    </>
  );
}
