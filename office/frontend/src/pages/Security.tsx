import { useState } from 'react';
import { LogOut, ShieldAlert, ShieldCheck } from 'lucide-react';
import { del, get, post, put, qs } from '../api';
import { useAuth } from '../auth';
import { fmtDateTime } from '../format';
import { Badge, Col, DataTable, ErrorBox, Loading, PageHeader, Tabs, Toggle, useFetch, useUi } from '../ui';
import { Chips, SearchBox } from '../ui2';
import { device } from './Profile';

interface U { key: string; name: string; email: string; role: string; roleLabel: string; active: boolean; twofa: boolean; sessions: number; lastLogin: string | null }
interface S { id: string; userKey: string; userName: string; role: string; roleLabel: string; ip: string | null; userAgent: string | null; createdAt: string; lastSeenAt: string; current: boolean }
interface L { ok: boolean; reason: string | null; email: string; ip: string | null; userAgent: string | null; at: string }
const REASON: Record<string, string> = { login: 'вход выполнен', bad_credentials: 'неверный email или пароль', bad_2fa: 'неверный код 2FA', password_ok_2fa_pending: 'пароль верен, ожидался код', too_many_attempts: 'слишком много попыток' };

/** Безопасность: пользователи и двухфакторная защита, активные сеансы, журнал входов, политика. */
export default function Security() {
  const { can } = useAuth();
  const [tab, setTab] = useState<'users' | 'sessions' | 'logins'>(can('staff') ? 'users' : 'logins');
  const tabs = [...(can('staff') ? [{ id: 'users' as const, label: 'Пользователи' }, { id: 'sessions' as const, label: 'Активные сеансы' }] : []), ...(can('audit') ? [{ id: 'logins' as const, label: 'Журнал входов' }] : [])];
  return (
    <>
      <PageHeader title="Безопасность" subtitle="Кто и откуда входит в систему, двухфакторная защита и завершение чужих сеансов" />
      <Tabs value={tab} onChange={setTab} tabs={tabs} />
      {tab === 'users' && <Users />}
      {tab === 'sessions' && <Sessions />}
      {tab === 'logins' && <Logins />}
    </>
  );
}

function Users() {
  const { can } = useAuth();
  const { toast, confirm } = useUi();
  const { data, error, reload } = useFetch(() => get<U[]>('/security/users'), []);
  const pol = useFetch(() => get<{ require2fa: boolean; canChange: boolean }>('/security/policy'), []);
  if (error && !data) return <ErrorBox error={error} onRetry={reload} />;
  if (!data || !pol.data) return <Loading />;
  const privileged = data.filter((u) => u.role === 'owner' || u.role === 'admin');
  const cols: Col<U>[] = [
    { key: 'n', header: 'Пользователь', render: (u) => <div><div className="flex items-center gap-2 font-medium">{u.name}{!u.active && <Badge>отключён</Badge>}</div><div className="text-xs text-muted">{u.email}</div></div>, sort: (u) => u.name, csv: (u) => u.name },
    { key: 'r', header: 'Роль', render: (u) => <Badge tone="brand">{u.roleLabel}</Badge>, csv: (u) => u.roleLabel },
    { key: 't', header: '2FA', render: (u) => (u.twofa ? <Badge tone="good"><ShieldCheck size={11} /> включена</Badge> : <Badge tone={u.role === 'owner' || u.role === 'admin' ? 'warn' : 'muted'}>нет</Badge>), sort: (u) => (u.twofa ? 1 : 0), csv: (u) => (u.twofa ? 'да' : 'нет') },
    { key: 's', header: 'Сеансов', align: 'right', render: (u) => u.sessions || '—', sort: (u) => u.sessions, csv: (u) => u.sessions },
    { key: 'l', header: 'Последний вход', render: (u) => <span className="text-xs text-muted">{u.lastLogin ? fmtDateTime(u.lastLogin) : '—'}</span>, sort: (u) => u.lastLogin, hideOnMobile: true, csv: (u) => u.lastLogin },
    { key: 'x', header: '', align: 'right', render: (u) => (u.twofa ? <button className="btn btn-ghost btn-sm" onClick={async () => { if (await confirm({ title: `Сбросить 2FA у «${u.name}»?`, text: 'Пользователь потеряет доступ с приложением, все его сеансы завершатся. Затем он сможет настроить защиту заново.', danger: true, confirmLabel: 'Сбросить' })) { try { await post(`/security/users/${encodeURIComponent(u.key)}/reset-2fa`); toast('ok', 'Защита сброшена'); void reload(); } catch (e) { toast('err', (e as Error).message); } } }}>Сбросить 2FA</button> : null) },
  ];
  return (
    <>
      <section className="card mb-5 flex flex-wrap items-center gap-4 p-4">
        <ShieldAlert size={22} className={pol.data.require2fa ? 'text-good' : 'text-warn'} />
        <div className="min-w-0 flex-1"><div className="font-medium">Обязательная двухфакторная защита для владельца и администраторов</div><div className="text-xs text-muted">Когда включено, администраторы без защиты видят только экран настройки и не могут работать, пока её не включат. Сейчас защита включена у {privileged.filter((u) => u.twofa).length} из {privileged.length}.</div></div>
        <Toggle checked={pol.data.require2fa} disabled={!pol.data.canChange} onChange={async (v) => { try { await put('/security/policy', { require2fa: v }); toast('ok', v ? 'Требование включено' : 'Требование выключено'); void pol.reload(); } catch (e) { toast('err', (e as Error).message); } }} label={pol.data.require2fa ? 'включено' : 'выключено'} />
      </section>
      {!pol.data.canChange && <p className="mb-3 text-xs text-muted">Менять политику может только владелец (право «Права доступа»).</p>}
      <DataTable cols={cols} rows={data} rowKey={(u) => u.key} csvName="security-users" initialSort={{ key: 'r', dir: 'asc' }} />
      {can('staff') && <p className="mt-3 text-xs text-muted">Каждый пользователь включает 2FA сам в своём профиле. Здесь вы видите, у кого она включена, и можете сбросить её, если сотрудник потерял телефон.</p>}
    </>
  );
}

function Sessions() {
  const { toast, confirm } = useUi();
  const { data, error, reload } = useFetch(() => get<S[]>('/security/sessions'), []);
  if (error && !data) return <ErrorBox error={error} onRetry={reload} />;
  if (!data) return <Loading />;
  const cols: Col<S>[] = [
    { key: 'u', header: 'Пользователь', render: (s) => <div><div className="font-medium">{s.userName} {s.current && <Badge tone="good">вы</Badge>}</div><div className="text-xs text-muted">{s.roleLabel}</div></div>, sort: (s) => s.userName, csv: (s) => s.userName },
    { key: 'd', header: 'Устройство', render: (s) => device(s.userAgent), csv: (s) => s.userAgent },
    { key: 'ip', header: 'IP', render: (s) => <span className="font-mono text-xs">{s.ip ?? '—'}</span>, csv: (s) => s.ip, hideOnMobile: true },
    { key: 'c', header: 'Вход', render: (s) => <span className="text-xs text-muted">{fmtDateTime(s.createdAt)}</span>, sort: (s) => s.createdAt, csv: (s) => s.createdAt, hideOnMobile: true },
    { key: 'l', header: 'Активность', render: (s) => <span className="text-xs text-muted">{fmtDateTime(s.lastSeenAt)}</span>, sort: (s) => s.lastSeenAt, csv: (s) => s.lastSeenAt },
    { key: 'x', header: '', align: 'right', render: (s) => (s.current ? null : <button className="btn btn-ghost btn-sm hover:!text-bad" onClick={async () => { if (await confirm({ title: `Завершить сеанс «${s.userName}»?`, text: 'Пользователю придётся войти заново.', danger: true, confirmLabel: 'Завершить' })) { try { await del('/security/sessions/' + s.id); toast('ok', 'Сеанс завершён'); void reload(); } catch (e) { toast('err', (e as Error).message); } } }}><LogOut size={14} /> Завершить</button>) },
  ];
  return <DataTable cols={cols} rows={data} rowKey={(s) => s.id} csvName="sessions" initialSort={{ key: 'l', dir: 'desc' }} empty={<div className="py-10 text-center text-sm text-muted">Активных сеансов нет</div>} />;
}

function Logins() {
  const [q, setQ] = useState('');
  const [view, setView] = useState<'all' | 'fail'>('all');
  const [page, setPage] = useState(0);
  const { data, error, reload } = useFetch(() => get<{ total: number; rows: L[] }>('/security/logins' + qs({ q, ok: view === 'fail' ? 0 : undefined, limit: 50, offset: page * 50 })), [q, view, page]);
  if (error && !data) return <ErrorBox error={error} onRetry={reload} />;
  if (!data) return <Loading />;
  const cols: Col<L>[] = [
    { key: 'at', header: 'Время', render: (l) => <span className="whitespace-nowrap text-muted">{fmtDateTime(l.at)}</span>, csv: (l) => l.at },
    { key: 'ok', header: 'Результат', render: (l) => <Badge tone={l.ok && l.reason === 'login' ? 'good' : l.ok ? 'info' : 'bad'}>{REASON[l.reason ?? ''] ?? (l.ok ? 'успешно' : 'отказ')}</Badge>, csv: (l) => l.reason },
    { key: 'e', header: 'Email', render: (l) => l.email, csv: (l) => l.email },
    { key: 'd', header: 'Устройство', render: (l) => device(l.userAgent), hideOnMobile: true, csv: (l) => l.userAgent },
    { key: 'ip', header: 'IP', render: (l) => <span className="font-mono text-xs">{l.ip ?? '—'}</span>, csv: (l) => l.ip },
  ];
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3"><Chips value={view} onChange={(v) => { setView(v); setPage(0); }} options={[{ id: 'all', label: 'Все' }, { id: 'fail', label: 'Только неудачные' }]} /><SearchBox value={q} onChange={(v) => { setQ(v); setPage(0); }} placeholder="Email или IP…" className="w-56" /></div>
      <DataTable cols={cols} rows={data.rows} rowKey={(l) => l.at + l.email + l.reason} csvName="logins" dense />
      <div className="mt-3 flex items-center justify-between text-sm text-muted"><span>Показано {data.rows.length} из {data.total}</span><div className="flex gap-2"><button className="btn btn-soft btn-sm" disabled={page === 0} onClick={() => setPage(page - 1)}>← Новее</button><button className="btn btn-soft btn-sm" disabled={(page + 1) * 50 >= data.total} onClick={() => setPage(page + 1)}>Старше →</button></div></div>
    </>
  );
}
