import { FormEvent, useState } from 'react';
import { AlertCircle, BookOpenCheck, Building2, ChefHat, Eye, EyeOff, Handshake, KeyRound, Loader2, LogIn, Mail } from 'lucide-react';
import { useAuth } from '../auth';
import { LangSwitch } from '../LangSwitch';

export default function Login() {
  const { login, login2fa } = useAuth();
  const [ticket, setTicket] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [email, setEmail] = useState(() => localStorage.getItem('office-email') || '');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setError('');
    try {
      if (ticket) { await login2fa(ticket, code.trim()); localStorage.setItem('office-email', email.trim()); return; }
      const r = await login(email.trim(), password);
      if (r) { setTicket(r.ticket); setCode(''); } else localStorage.setItem('office-email', email.trim());
    }
    catch (err) { setError((err as Error).message); if (ticket && /Время ввода|Слишком много/.test((err as Error).message)) { setTicket(null); setPassword(''); } } finally { setBusy(false); }
  };

  return (
    <div className="grid min-h-full lg:grid-cols-[1.05fr_1fr]">
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-slate-900 via-indigo-950 to-indigo-800 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute -right-24 -top-24 h-[420px] w-[420px] rounded-full bg-indigo-500/25 blur-[90px]" />
        <div className="pointer-events-none absolute -bottom-32 -left-20 h-[380px] w-[380px] rounded-full bg-sky-500/15 blur-[90px]" />
        <div className="relative flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white/12 ring-1 ring-white/20"><Building2 size={23} /></div>
          <div className="text-xl font-semibold tracking-tight">Innova <span className="text-indigo-300">Office</span></div>
        </div>
        <div className="relative max-w-md">
          <h2 className="text-[34px] font-semibold leading-tight tracking-tight">Учёт, который сходится с кассой</h2>
          <p className="mt-3 text-[15px] leading-relaxed text-indigo-100/80">Бэкенд-офис для фудкорта, технологов и бухгалтерии. Работает с той же базой, что и касса Innova365, — цифры всегда актуальны.</p>
          <ul className="mt-8 space-y-4 text-[14px]">
            {[[Handshake, 'Фудкорт', 'точки, аренда, комиссии и взаиморасчёты с арендаторами'], [ChefHat, 'Технологи', 'техкарты, согласование, версии, себестоимость и маржа'], [BookOpenCheck, 'Бухгалтерия', 'выручка, Z-отчёты, расходы, долги поставщикам, ОПУ']].map(([I, t, d]) => {
              const Icon = I as typeof Handshake;
              return <li key={t as string} className="flex gap-3.5"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/10"><Icon size={18} /></div><div><div className="font-medium">{t as string}</div><div className="text-indigo-100/70">{d as string}</div></div></li>;
            })}
          </ul>
        </div>
        <div className="relative text-xs text-indigo-200/60">office.innova365.kz</div>
      </div>

      <div className="relative flex items-center justify-center p-6">
        <div className="absolute right-4 top-4"><LangSwitch /></div>
        <form onSubmit={submit} className="w-full max-w-[400px] animate-pop">
          <div className="mb-8 flex items-center gap-3 lg:hidden"><div className="grid h-10 w-10 place-items-center rounded-xl bg-brand text-brandfg"><Building2 size={21} /></div><div className="text-lg font-semibold">Innova Office</div></div>
          <h1 className="text-2xl font-semibold tracking-tight">{ticket ? 'Код подтверждения' : 'Вход в офис'}</h1>
          <p className="mb-7 mt-1 text-sm text-muted">Владелец и администраторы входят с данными кассовой системы. Остальные — с учётной записью от администратора.</p>

          {!ticket ? (<>
          <label className="label">Электронная почта</label>
          <div className="relative mb-4"><Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><input className="input !h-11 !pl-9" type="email" autoComplete="username" autoFocus required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.kz" /></div>
          <label className="label">Пароль</label>
          <div className="relative mb-5"><KeyRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><input className="input !h-11 !pl-9 !pr-10" type={show ? 'text' : 'password'} autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-muted hover:text-ink" onClick={() => setShow(!show)} aria-label="Показать пароль">{show ? <EyeOff size={16} /> : <Eye size={16} />}</button></div>
          </>) : (
            <div className="mb-5">
              <p className="mb-3 text-sm text-muted">Введите 6-значный код из приложения-аутентификатора (Google Authenticator, Microsoft Authenticator и т. п.) или один из кодов восстановления.</p>
              <label className="label">Код</label>
              <input className="input !h-12 text-center font-mono text-xl tracking-[.3em]" inputMode="numeric" autoComplete="one-time-code" autoFocus value={code} onChange={(e) => setCode(e.target.value)} placeholder="000000" maxLength={12} />
              <button type="button" className="mt-3 text-xs text-muted underline hover:text-ink" onClick={() => { setTicket(null); setCode(''); setError(''); }}>← Назад ко входу</button>
            </div>
          )}
          {error && <div className="mb-4 flex items-start gap-2 rounded-lg border border-bad/40 bg-bad/10 px-3 py-2.5 text-sm text-bad"><AlertCircle size={16} className="mt-0.5 shrink-0" />{error}</div>}
          <button className="btn btn-primary !h-11 w-full text-[15px]" disabled={busy || !email || (!ticket && !password) || (!!ticket && code.trim().length < 6)}>{busy ? <Loader2 size={18} className="animate-spin" /> : <LogIn size={18} />} {ticket ? 'Подтвердить' : 'Войти'}</button>
        </form>
      </div>
    </div>
  );
}
