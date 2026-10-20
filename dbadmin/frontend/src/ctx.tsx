import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { get, post, setCurrentDb } from './api';

export interface Session { user: string; isSuper: boolean; version: string; db: string; readOnly: boolean; host?: string }
export interface TreeItem { schema: string; name: string; kind: string; rows: number; size: number }

/* ───────── Маршрутизация на hash ───────── */
export type Route =
  | { page: 'overview' }
  | { page: 'table'; schema: string; name: string; tab: string }
  | { page: 'sql' }
  | { page: 'routines'; oid?: number }
  | { page: 'roles'; name?: string }
  | { page: 'backup' };

export function parseHash(h: string): Route {
  const p = h.replace(/^#\/?/, '').split('?')[0].split('/').map(decodeURIComponent);
  switch (p[0]) {
    case 'table': return p[1] && p[2] ? { page: 'table', schema: p[1], name: p[2], tab: p[3] || 'data' } : { page: 'overview' };
    case 'sql': return { page: 'sql' };
    case 'routines': return { page: 'routines', oid: p[1] ? Number(p[1]) : undefined };
    case 'roles': return { page: 'roles', name: p[1] };
    case 'backup': return { page: 'backup' };
    default: return { page: 'overview' };
  }
}
export const go = (path: string) => { window.location.hash = '#/' + path.replace(/^\/+/, ''); };
export const tableLink = (schema: string, name: string, tab = 'data') => `#/table/${encodeURIComponent(schema)}/${encodeURIComponent(name)}/${tab}`;

/* ───────── Контекст приложения ───────── */
interface AppCtx {
  session: Session; setSession: (s: Session | null) => void;
  db: string; changeDb: (db: string) => void;
  tree: TreeItem[]; treeLoading: boolean; refreshTree: () => Promise<void>;
  route: Route;
  setReadOnly: (ro: boolean) => Promise<void>;
  theme: 'dark' | 'light'; toggleTheme: () => void;
  bump: number; refreshAll: () => void;
}
const Ctx = createContext<AppCtx>(null as unknown as AppCtx);
export const useApp = () => useContext(Ctx);

export function AppProvider({ session, setSession, children }: { session: Session; setSession: (s: Session | null) => void; children: ReactNode }) {
  const [db, setDb] = useState(session.db);
  const [tree, setTree] = useState<TreeItem[]>([]);
  const [treeLoading, setTreeLoading] = useState(true);
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));
  const [bump, setBump] = useState(0);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => (localStorage.getItem('dbs-theme') === 'light' ? 'light' : 'dark'));

  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem('dbs-theme', theme); }, [theme]);
  useEffect(() => {
    const h = () => setRoute(parseHash(window.location.hash));
    window.addEventListener('hashchange', h);
    return () => window.removeEventListener('hashchange', h);
  }, []);

  setCurrentDb(db);
  const refreshTree = useCallback(async () => {
    setTreeLoading(true);
    try { setTree(await get<TreeItem[]>('/tree')); } catch { setTree([]); } finally { setTreeLoading(false); }
  }, []);
  useEffect(() => { setCurrentDb(db); void refreshTree(); }, [db, refreshTree]);

  const changeDb = useCallback((name: string) => { setCurrentDb(name); setDb(name); setBump((b) => b + 1); go(''); }, []);
  const setReadOnly = useCallback(async (ro: boolean) => {
    const r = await post<{ readOnly: boolean }>('/auth/mode', { readOnly: ro });
    setSession({ ...session, readOnly: r.readOnly });
  }, [session, setSession]);

  const value = useMemo<AppCtx>(() => ({
    session, setSession, db, changeDb, tree, treeLoading, refreshTree, route, setReadOnly, theme,
    toggleTheme: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')),
    bump, refreshAll: () => setBump((b) => b + 1),
  }), [session, setSession, db, changeDb, tree, treeLoading, refreshTree, route, setReadOnly, theme, bump]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
