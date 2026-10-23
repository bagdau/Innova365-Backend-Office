import { useState } from 'react';
import { Copy, KeyRound, LogOut, Monitor, Printer, ShieldCheck, ShieldOff, Smartphone } from 'lucide-react';
import qrcode from 'qrcode-generator';
import { del, get, post, put } from '../api';
import { useAuth } from '../auth';
import { fmtDateTime } from '../format';
import { Badge, ErrorBox, Field, Loading, Modal, PageHeader, useFetch, useUi } from '../ui';

export const device = (ua: string | null): string => {
  const u = ua ?? '';
  const os = /Windows/.test(u) ? 'Windows' : /Android/.test(u) ? 'Android' : /iPhone|iPad/.test(u) ? 'iOS' : /Mac OS/.test(u) ? 'macOS' : /Linux/.test(u) ? 'Linux' : 'устройство';
  const br = /Edg\//.test(u) ? 'Edge' : /OPR\//.test(u) ? 'Opera' : /Chrome\//.test(u) ? 'Chrome' : /Firefox\//.test(u) ? 'Firefox' : /Safari\//.test(u) ? 'Safari' : 'браузер';
  return `${br} · ${os}`;
};
const REASON: Record<string, string> = { login: 'вход', bad_credentials: 'неверный пароль', bad_2fa: 'неверный код', password_ok_2fa_pending: 'пароль верен, ждали код', too_many_attempts: 'слишком много попыток' };

export default function Profile() {
  const { me } = useAuth();
  const { toast } = useUi();
  const [f, setF] = useState({ current: '', next: '', repeat: '' });
  const [busy, setBusy] = useState(false);
  const staff = me!.role !== 'owner' && me!.role !== 'admin';
  const save = async () => {
    if (f.next !== f.repeat) { toast('err', 'Пароли не совпадают'); return; }
    setBusy(true);
    try { const r = await put<{ endedSessions: number }>('/me/password', { current: f.current, next: f.next }); toast('ok', r.endedSessions ? `Пароль изменён. Завершены другие сеансы: ${r.endedSessions}` : 'Пароль изменён'); setF({ current: '', next: '', repeat: '' }); } catch (e) { toast('err', (e as Error).message); } finally { setBusy(false); }
  };
  return (
    <>
      <PageHeader title="Профиль" />
      <div className="grid max-w-5xl gap-5 lg:grid-cols-2">
        <section className="card p-5"><div className="mb-3 text-lg font-semibold">{me!.name}</div><dl className="space-y-2 text-sm"><div className="flex justify-between"><dt className="text-muted">Email</dt><dd>{me!.email}</dd></div><div className="flex justify-between"><dt className="text-muted">Роль</dt><dd><Badge tone="brand">{me!.roleLabel}</Badge></dd></div></dl></section>
        <section className="card space-y-3 p-5"><h2 className="flex items-center gap-2 font-semibold"><KeyRound size={16} className="text-brand" />Смена пароля</h2>
          {staff ? (<>
            <Field label="Текущий пароль"><input className="input" type="password" autoComplete="current-password" value={f.current} onChange={(e) => setF({ ...f, current: e.target.value })} /></Field>
            <Field label="Новый пароль (минимум 8 символов)"><input className="input" type="password" autoComplete="new-password" value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })} /></Field>
            <Field label="Повторите новый пароль"><input className="input" type="password" autoComplete="new-password" value={f.repeat} onChange={(e) => setF({ ...f, repeat: e.target.value })} /></Field>
            <button className="btn btn-primary" disabled={busy || !f.current || f.next.length < 8} onClick={() => void save()}>Сменить пароль</button></>)
            : <p className="text-sm text-muted">Пароль владельца и администраторов меняется в кассовой системе: Профиль → Смена пароля.</p>}
        </section>
        <TwoFactor />
        <Sessions />
      </div>
    </>
  );
}

/* ───────── Двухфакторная защита ───────── */
export function TwoFactor({ mustSetup }: { mustSetup?: boolean }) {
  const { reload } = useAuth();
  const { toast } = useUi();
  const { data, error, reload: reloadSt } = useFetch(() => get<{ enabled: boolean; recoveryLeft: number }>('/me/2fa'), [], { live: false });
  const [setup, setSetup] = useState<{ secret: string; uri: string } | null>(null);
  const [code, setCode] = useState('');
  const [codes, setCodes] = useState<string[] | null>(null);
  const [off, setOff] = useState(false);
  if (error && !data) return <ErrorBox error={error} onRetry={reloadSt} />;
  if (!data) return <section className="card p-5"><Loading /></section>;
  const act = async (fn: () => Promise<void>) => { try { await fn(); } catch (e) { toast('err', (e as Error).message); } };
  const start = () => act(async () => { setSetup(await post('/me/2fa/setup')); setCode(''); });
  const enable = () => act(async () => { const r = await post<{ recoveryCodes: string[] }>('/me/2fa/enable', { code }); setSetup(null); setCode(''); setCodes(r.recoveryCodes); await reloadSt(); await reload(); });
  const svg = setup ? (() => { const q = qrcode(0, 'M'); q.addData(setup.uri); q.make(); return q.createSvgTag({ cellSize: 4, margin: 2, scalable: true }); })() : '';
  return (
    <section className="card space-y-3 p-5 lg:col-span-1">
      <h2 className="flex items-center gap-2 font-semibold">{data.enabled ? <ShieldCheck size={16} className="text-good" /> : <ShieldOff size={16} className="text-muted" />}Двухфакторная защита {data.enabled && <Badge tone="good">включена</Badge>}</h2>
      {mustSetup && !data.enabled && <p className="rounded-lg bg-warn/10 p-3 text-sm text-warn">Администратор требует двухфакторную защиту для всех владельцев и администраторов. Включите её, чтобы продолжить работу.</p>}
      {!data.enabled && !setup && (<>
        <p className="text-sm text-muted">При входе, кроме пароля, нужен одноразовый код из приложения на телефоне. Даже если пароль украдут, зайти в систему не получится.</p>
        <button className="btn btn-primary" onClick={() => void start()}><Smartphone size={15} /> Включить защиту</button></>)}
      {setup && (
        <div className="space-y-3">
          <ol className="list-decimal space-y-1 pl-5 text-[13px] text-muted"><li>Установите приложение-аутентификатор (Google Authenticator, Microsoft Authenticator, Authy).</li><li>Отсканируйте QR-код или введите ключ вручную.</li><li>Введите 6 цифр из приложения.</li></ol>
          <div className="flex flex-col items-center gap-2 rounded-lg border border-line bg-white p-3 sm:flex-row sm:items-start"><div className="h-40 w-40 shrink-0 [&_svg]:h-full [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
            <div className="min-w-0 text-xs text-gray-600"><div className="mb-1 font-medium text-gray-800">Ключ для ручного ввода</div><code className="break-all font-mono text-[12px] tracking-wider text-black">{setup.secret.replace(/(.{4})/g, '$1 ')}</code></div></div>
          <div className="flex gap-2"><input className="input !w-40 text-center font-mono text-lg tracking-[.25em]" inputMode="numeric" autoComplete="one-time-code" placeholder="000000" maxLength={7} value={code} onChange={(e) => setCode(e.target.value)} /><button className="btn btn-primary" disabled={code.replace(/\s/g, '').length !== 6} onClick={() => void enable()}>Подтвердить</button><button className="btn btn-ghost" onClick={() => setSetup(null)}>Отмена</button></div>
        </div>
      )}
      {data.enabled && (<>
        <p className="text-sm text-muted">Кодов восстановления осталось: <b className="text-ink">{data.recoveryLeft}</b>. Они нужны, если потеряете телефон.</p>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-soft btn-sm" onClick={async () => { const c = window.prompt('Введите код из приложения, чтобы выпустить новые коды восстановления (старые перестанут работать):'); if (c) void act(async () => { const r = await post<{ recoveryCodes: string[] }>('/me/2fa/recovery', { code: c }); setCodes(r.recoveryCodes); await reloadSt(); }); }}>Новые коды восстановления</button>
          <button className="btn btn-ghost btn-sm hover:!text-bad" onClick={() => setOff(true)}>Отключить</button></div></>)}
      {codes && <Modal open onClose={() => setCodes(null)} title="Коды восстановления" width={460} footer={<><button className="btn btn-soft" onClick={() => { void navigator.clipboard?.writeText(codes.join('\n')); toast('ok', 'Скопировано'); }}><Copy size={15} /> Копировать</button><button className="btn btn-soft" onClick={() => window.print()}><Printer size={15} /> Печать</button><button className="btn btn-primary" onClick={() => setCodes(null)}>Я сохранил(а)</button></>}>
        <p className="mb-3 text-sm text-warn">Сохраните эти коды в надёжном месте — больше они показаны не будут. Каждый код работает один раз.</p>
        <div className="grid grid-cols-2 gap-2 font-mono text-[15px]">{codes.map((c) => <div key={c} className="rounded-lg bg-surface2 px-3 py-2 text-center tracking-wider">{c}</div>)}</div></Modal>}
      {off && <Modal open onClose={() => setOff(false)} title="Отключить защиту" width={420} footer={<><button className="btn btn-soft" onClick={() => setOff(false)}>Отмена</button><button className="btn btn-danger" disabled={code.trim().length < 6} onClick={() => void act(async () => { await post('/me/2fa/disable', { code }); setOff(false); setCode(''); toast('ok', 'Защита отключена'); await reloadSt(); await reload(); })}>Отключить</button></>}>
        <p className="mb-3 text-sm text-muted">Введите текущий код из приложения (или код восстановления).</p><input className="input text-center font-mono text-lg tracking-[.25em]" autoFocus inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value)} placeholder="000000" /></Modal>}
    </section>
  );
}

/* ───────── Сеансы и входы ───────── */
function Sessions() {
  const { logout } = useAuth();
  const { toast, confirm } = useUi();
  const ses = useFetch(() => get<{ id: string; ip: string | null; userAgent: string | null; createdAt: string; lastSeenAt: string; current: boolean }[]>('/me/sessions'), [], { live: false });
  const logins = useFetch(() => get<{ ok: boolean; reason: string | null; ip: string | null; userAgent: string | null; at: string }[]>('/me/logins'), [], { live: false });
  if (!ses.data) return <section className="card p-5"><Loading /></section>;
  const end = async (id: string, current: boolean) => { try { await del('/me/sessions/' + id); if (current) await logout(); else { toast('ok', 'Сеанс завершён'); void ses.reload(); } } catch (e) { toast('err', (e as Error).message); } };
  return (
    <section className="card p-5 lg:col-span-2">
      <div className="mb-3 flex items-center justify-between gap-2"><h2 className="flex items-center gap-2 font-semibold"><Monitor size={16} className="text-brand" />Где выполнен вход</h2>
        {ses.data.length > 1 && <button className="btn btn-soft btn-sm" onClick={async () => { if (await confirm({ title: 'Завершить все остальные сеансы?', text: 'На других устройствах придётся войти заново.', danger: true, confirmLabel: 'Завершить' })) { try { const r = await post<{ revoked: number }>('/me/sessions/revoke-others'); toast('ok', `Завершено: ${r.revoked}`); void ses.reload(); } catch (e) { toast('err', (e as Error).message); } } }}><LogOut size={14} /> Завершить остальные</button>}</div>
      <ul className="divide-y divide-line/70">{ses.data.map((s) => (
        <li key={s.id} className="flex flex-wrap items-center gap-3 py-2.5 text-[13.5px]"><div className="min-w-0 flex-1"><div className="font-medium">{device(s.userAgent)} {s.current && <Badge tone="good">это устройство</Badge>}</div><div className="text-xs text-muted">{s.ip ?? '—'} · вход {fmtDateTime(s.createdAt)} · активность {fmtDateTime(s.lastSeenAt)}</div></div>
          <button className="btn btn-ghost btn-sm" onClick={() => void end(s.id, s.current)}>{s.current ? 'Выйти' : 'Завершить'}</button></li>))}</ul>
      {logins.data && logins.data.length > 0 && (<details className="mt-4"><summary className="cursor-pointer text-sm font-medium text-muted hover:text-ink">Последние попытки входа</summary>
        <ul className="mt-2 divide-y divide-line/60 text-[12.5px]">{logins.data.map((l, i) => <li key={i} className="flex flex-wrap items-center gap-2 py-1.5"><Badge tone={l.ok ? 'good' : 'bad'}>{l.ok ? 'успешно' : 'отказ'}</Badge><span>{REASON[l.reason ?? ''] ?? l.reason ?? ''}</span><span className="text-muted">{device(l.userAgent)} · {l.ip ?? '—'}</span><span className="ml-auto text-muted">{fmtDateTime(l.at)}</span></li>)}</ul></details>)}
    </section>
  );
}
