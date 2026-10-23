import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { get, post, setUnauthorizedHandler } from './api';
import { setCurrency } from './format';
import { startLive } from './live';

export type Perm = 'dashboard' | 'fc.view' | 'fc.edit' | 'fc.settle' | 'tc.view' | 'tc.edit' | 'tc.approve' | 'ing.edit' | 'ing.cost' | 'acc.view' | 'acc.write'
  | 'inv.view' | 'inv.edit' | 'inv.approve' | 'sup.view' | 'sup.edit' | 'menu.view' | 'menu.edit' | 'ctl.view' | 'fin.view' | 'fin.write' | 'hr.view' | 'hr.write'
  | 'rep.view' | 'rep.schedule' | 'notify' | 'files' | 'sys.view' | 'sys.backup' | 'staff' | 'audit' | 'settings' | 'roles' | 'tenant';
export interface Me {
  id: string; name: string; email: string; role: string; roleLabel: string; outletId: string | null; perms: Perm[]; sessionId: string | null; twofa: { enabled: boolean; must: boolean };
  settings: { currency: string; company: string; vat: number; vatEnabled: boolean; timezone: string };
}

interface Ctx { me: Me | null; loading: boolean; can: (p: Perm) => boolean; login: (email: string, password: string) => Promise<{ ticket: string } | null>; login2fa: (ticket: string, code: string) => Promise<void>; logout: () => Promise<void>; reload: () => Promise<void> }
const AuthCtx = createContext<Ctx>(null as unknown as Ctx);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  const apply = (m: Me | null) => { if (m) setCurrency(m.settings.currency); setMe(m); };
  const reload = useCallback(async () => { try { apply(await get<Me>('/me')); } catch { apply(null); } }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => setMe(null));
    reload().finally(() => setLoading(false));
  }, [reload]);

  // пока пользователь вошёл — держим поток живых обновлений
  useEffect(() => (me ? startLive() : undefined), [!!me]); // eslint-disable-line react-hooks/exhaustive-deps

  const login = async (email: string, password: string): Promise<{ ticket: string } | null> => {
    const r = await post<Me | { needs2fa: true; ticket: string }>('/auth/login', { email, password });
    if ('needs2fa' in r) return { ticket: r.ticket };
    apply(r); return null;
  };
  const login2fa = async (ticket: string, code: string) => { apply(await post<Me>('/auth/2fa', { ticket, code })); };
  const logout = async () => { try { await post('/auth/logout'); } catch { /* ignore */ } setMe(null); };
  const can = (p: Perm) => !!me?.perms.includes(p);
  return <AuthCtx.Provider value={{ me, loading, can, login, login2fa, logout, reload }}>{children}</AuthCtx.Provider>;
}
