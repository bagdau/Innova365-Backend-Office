import { FormEvent, useState } from 'react';
import { AlertCircle, Database, Eye, EyeOff, KeyRound, Loader2, LogIn, ShieldCheck, User } from 'lucide-react';
import { post } from '../api';
import type { Session } from '../ctx';

export function Login({ onLogin }: { onLogin: (s: Session) => void }) {
  const [user, setUser] = useState(() => localStorage.getItem('dbs-user') || '');
  const [password, setPassword] = useState('');
  const [db, setDb] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const s = await post<Session>('/auth/login', { user, password, db: db || undefined });
      localStorage.setItem('dbs-user', user);
      onLogin(s);
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  };

  return (
    <div className="dot-bg relative flex min-h-full items-center justify-center overflow-hidden p-4">
      <div className="pointer-events-none absolute -left-40 -top-40 h-[480px] w-[480px] rounded-full bg-accent/10 blur-[110px]" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-[480px] w-[480px] rounded-full bg-info/10 blur-[110px]" />
      <form onSubmit={submit} className="card relative w-full max-w-[410px] animate-pop p-7 shadow-2xl">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-accent to-info text-accentfg shadow-lg shadow-accent/20"><Database size={26} strokeWidth={2.2} /></div>
          <div>
            <div className="text-xl font-semibold leading-tight tracking-tight">Innova <span className="text-accent">DB Studio</span></div>
            <div className="text-xs text-muted">Управление базой данных Innova365</div>
          </div>
        </div>

        <label className="label">Пользователь PostgreSQL</label>
        <div className="relative mb-3.5">
          <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input className="input !pl-9" value={user} onChange={(e) => setUser(e.target.value)} autoComplete="username" autoFocus required placeholder="restaurantos" />
        </div>

        <label className="label">Пароль</label>
        <div className="relative mb-3.5">
          <KeyRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input className="input !pl-9 !pr-10" type={show ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" placeholder="••••••••" />
          <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted hover:text-ink" onClick={() => setShow(!show)} aria-label="Показать пароль">{show ? <EyeOff size={16} /> : <Eye size={16} />}</button>
        </div>

        <label className="label">База данных <span className="font-normal text-muted/70">(необязательно)</span></label>
        <input className="input mb-5" value={db} onChange={(e) => setDb(e.target.value)} placeholder="по умолчанию — база системы" />

        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2.5 text-sm text-danger"><AlertCircle size={16} className="mt-0.5 shrink-0" /><span>{error}</span></div>
        )}
        <button className="btn btn-primary w-full !h-11 text-[15px]" disabled={busy || !user}>
          {busy ? <Loader2 size={18} className="spin" /> : <LogIn size={18} />} Войти
        </button>
        <div className="mt-5 flex items-start gap-2 text-xs leading-relaxed text-muted">
          <ShieldCheck size={15} className="mt-0.5 shrink-0 text-ok" />
          Вход под учётной записью PostgreSQL. Пароль хранится только в памяти сервиса, сессия закрывается после 30 минут бездействия. После входа включён режим «Только чтение».
        </div>
      </form>
    </div>
  );
}
