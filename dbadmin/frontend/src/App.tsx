import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { ChevronDown, Code2, Database, DatabaseBackup, FunctionSquare, LayoutDashboard, Lock, LogOut, Menu, Moon, Pencil, RefreshCw, Search, Sun, Table2, Users, Eye, X, Unlock } from 'lucide-react';
import { get, post, setUnauthorizedHandler } from './api';
import { AppProvider, go, Session, tableLink, useApp } from './ctx';
import { fmtNum, Loading, UiProvider, useUi } from './ui';
import { Login } from './views/Login';
import { Boundary } from './boundary';

const Overview = lazy(() => import('./views/Overview'));
const TableView = lazy(() => import('./views/TableView'));
const SqlConsole = lazy(() => import('./views/SqlConsole'));
const Routines = lazy(() => import('./views/Routines'));
const Roles = lazy(() => import('./views/Roles'));
const Backup = lazy(() => import('./views/Backup'));

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    setUnauthorizedHandler(() => setSession(null));
    get<Session>('/auth/me').then(setSession).catch(() => setSession(null));
  }, []);

  if (session === undefined) return <div className="grid h-full place-items-center"><Loading text="Подключение…" /></div>;
  return (
    <UiProvider>
      {session === null ? <Login onLogin={setSession} /> : <AppProvider session={session} setSession={setSession}><Shell /></AppProvider>}
    </UiProvider>
  );
}

/* ───────── Каркас: боковая панель + шапка ───────── */
function Shell() {
  const { route, session, setSession, setReadOnly, theme, toggleTheme, db, bump } = useApp();
  const { toast, confirm } = useUi();
  const [menu, setMenu] = useState(false);

  useEffect(() => { setMenu(false); }, [route]);

  const logout = async () => { try { await post('/auth/logout'); } catch { /* ignore */ } setSession(null); };
  const toggleMode = async () => {
    try {
      if (session.readOnly) {
        const ok = await confirm({ title: 'Включить режим записи?', text: 'Запросы смогут изменять данные и структуру базы. Все изменения применяются сразу и записываются в журнал сервиса.', confirmLabel: 'Включить запись', danger: true });
        if (!ok) return;
        await setReadOnly(false); toast('info', 'Режим записи включён');
      } else { await setReadOnly(true); toast('ok', 'Режим «Только чтение»'); }
    } catch (e) { toast('err', (e as Error).message); }
  };

  const title = route.page === 'table' ? `${route.schema === 'public' ? '' : route.schema + '.'}${route.name}`
    : { overview: 'Обзор сервера', sql: 'SQL-консоль', routines: 'Процедуры и функции', roles: 'Пользователи и права', backup: 'Экспорт и импорт' }[route.page];

  return (
    <div className="flex h-full">
      {/* затемнение под мобильным меню */}
      {menu && <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden animate-fade" onClick={() => setMenu(false)} />}
      <aside className={clsx('fixed inset-y-0 left-0 z-50 flex w-[290px] max-w-[86vw] flex-col border-r border-line bg-surface transition-transform lg:static lg:z-auto lg:translate-x-0', menu ? 'translate-x-0 animate-slideIn' : '-translate-x-full')}>
        <Sidebar onClose={() => setMenu(false)} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-line bg-surface/80 px-3 backdrop-blur sm:px-5">
          <button className="btn btn-ghost !px-2 lg:hidden" onClick={() => setMenu(true)} aria-label="Меню"><Menu size={20} /></button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-[11px] text-muted"><Database size={11} /><span className="truncate">{db}</span></div>
            <h1 className="truncate text-[15px] font-semibold leading-tight">{title}</h1>
          </div>
          <button onClick={toggleMode} title={session.readOnly ? 'Нажмите, чтобы разрешить запись' : 'Нажмите, чтобы вернуться в режим чтения'}
            className={clsx('btn btn-sm gap-2 border', session.readOnly ? 'border-line bg-surface2 text-muted hover:text-ink' : 'border-warn/50 bg-warn/15 text-warn hover:bg-warn/25')}>
            {session.readOnly ? <Lock size={14} /> : <Unlock size={14} />}
            <span className="hidden sm:inline">{session.readOnly ? 'Только чтение' : 'Режим записи'}</span>
          </button>
          <button className="btn btn-ghost btn-sm !px-2" onClick={toggleTheme} aria-label="Тема">{theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}</button>
          <div className="hidden items-center gap-2 border-l border-line pl-3 text-xs sm:flex">
            <div className="text-right leading-tight"><div className="font-medium">{session.user}</div><div className="text-[10px] text-muted">{session.isSuper ? 'суперпользователь' : 'пользователь'}</div></div>
          </div>
          <button className="btn btn-ghost btn-sm !px-2" onClick={logout} title="Выйти"><LogOut size={17} /></button>
        </header>

        {!session.readOnly && (
          <div className="flex items-center gap-2 border-b border-warn/30 bg-warn/10 px-4 py-1.5 text-xs text-warn"><Pencil size={13} /> Режим записи: изменения применяются сразу.</div>
        )}

        <main key={db + bump} className="min-h-0 flex-1 overflow-auto">
          <Boundary resetKey={JSON.stringify(route)}><Suspense fallback={<Loading />}>
            {route.page === 'overview' && <Overview />}
            {route.page === 'table' && <TableView key={route.schema + '.' + route.name} schema={route.schema} name={route.name} tab={route.tab} />}
            {route.page === 'sql' && <SqlConsole />}
            {route.page === 'routines' && <Routines oid={route.oid} />}
            {route.page === 'roles' && <Roles selected={route.name} />}
            {route.page === 'backup' && <Backup />}
          </Suspense></Boundary>
        </main>
      </div>
    </div>
  );
}

/* ───────── Боковая панель ───────── */
function Sidebar({ onClose }: { onClose: () => void }) {
  const { route, tree, treeLoading, refreshTree, db, changeDb } = useApp();
  const [q, setQ] = useState('');
  const [dbs, setDbs] = useState<{ name: string; can_connect: boolean; size: number }[]>([]);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  useEffect(() => { get('/databases').then(setDbs).catch(() => setDbs([])); }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? tree.filter((t) => t.name.toLowerCase().includes(s)) : tree;
  }, [tree, q]);
  const groups = useMemo(() => {
    const m = new Map<string, typeof tree>();
    for (const t of filtered) (m.get(t.schema) ?? m.set(t.schema, []).get(t.schema)!).push(t);
    return [...m.entries()];
  }, [filtered]);

  const nav = [
    { page: 'overview', label: 'Обзор', icon: LayoutDashboard, href: '#/' },
    { page: 'sql', label: 'SQL-консоль', icon: Code2, href: '#/sql' },
    { page: 'routines', label: 'Процедуры', icon: FunctionSquare, href: '#/routines' },
    { page: 'roles', label: 'Пользователи', icon: Users, href: '#/roles' },
    { page: 'backup', label: 'Экспорт / импорт', icon: DatabaseBackup, href: '#/backup' },
  ];
  const activeTable = route.page === 'table' ? `${route.schema}.${route.name}` : '';

  return (
    <>
      <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-line px-4">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-accent to-info text-accentfg"><Database size={19} strokeWidth={2.3} /></div>
        <div className="leading-tight"><div className="text-[15px] font-semibold tracking-tight">Innova <span className="text-accent">DB</span></div><div className="text-[10px] uppercase tracking-widest text-muted">Studio</div></div>
        <button className="btn btn-ghost btn-sm ml-auto !px-2 lg:hidden" onClick={onClose}><X size={18} /></button>
      </div>

      <div className="space-y-3 p-3">
        <div className="relative">
          <Database size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-accent" />
          <select className="input appearance-none !pl-9 !pr-8 font-medium" value={db} onChange={(e) => changeDb(e.target.value)}>
            {dbs.some((d) => d.name === db) ? null : <option value={db}>{db}</option>}
            {dbs.filter((d) => d.can_connect).map((d) => <option key={d.name} value={d.name}>{d.name}</option>)}
          </select>
          <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted" />
        </div>
        <nav className="space-y-0.5">
          {nav.map((n) => (
            <a key={n.page} href={n.href} className={clsx('flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13.5px] font-medium transition',
              route.page === n.page ? 'bg-accent/15 text-accent' : 'text-muted hover:bg-surface2 hover:text-ink')}>
              <n.icon size={16} />{n.label}
            </a>
          ))}
        </nav>
      </div>

      <div className="flex items-center gap-2 border-t border-line px-3 pt-3">
        <div className="relative flex-1">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input className="input !h-8 !pl-8 text-[13px]" placeholder="Поиск таблиц…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <button className="btn btn-ghost btn-sm !px-2" onClick={() => void refreshTree()} title="Обновить список"><RefreshCw size={14} className={treeLoading ? 'spin' : ''} /></button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {treeLoading && !tree.length && <Loading text="" />}
        {groups.map(([schema, items]) => (
          <div key={schema} className="mb-1">
            <button className="flex w-full items-center gap-1.5 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted hover:text-ink" onClick={() => setCollapsed((c) => ({ ...c, [schema]: !c[schema] }))}>
              <ChevronDown size={12} className={clsx('transition', collapsed[schema] && '-rotate-90')} />{schema}<span className="ml-auto font-normal text-muted/60">{items.length}</span>
            </button>
            {!collapsed[schema] && items.map((t) => {
              const active = activeTable === `${t.schema}.${t.name}`;
              const view = t.kind === 'v' || t.kind === 'm';
              return (
                <a key={t.name} href={tableLink(t.schema, t.name)} className={clsx('group flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13px] transition', active ? 'bg-accent/15 text-accent' : 'text-ink/85 hover:bg-surface2')}>
                  {view ? <Eye size={14} className="shrink-0 text-info" /> : <Table2 size={14} className={clsx('shrink-0', active ? 'text-accent' : 'text-muted')} />}
                  <span className="min-w-0 flex-1 truncate">{t.name}</span>
                  <span className="shrink-0 text-[10.5px] tabular-nums text-muted/70">{fmtNum(t.rows)}</span>
                </a>
              );
            })}
          </div>
        ))}
        {!treeLoading && !groups.length && <div className="px-3 py-6 text-center text-xs text-muted">{q ? 'Ничего не найдено' : 'В базе нет таблиц'}</div>}
      </div>
      <div className="border-t border-line px-4 py-2.5 text-[10.5px] text-muted">PostgreSQL · {tree.length} объектов</div>
    </>
  );
}
