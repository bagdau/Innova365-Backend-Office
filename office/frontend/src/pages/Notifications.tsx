import { useState } from 'react';
import { BellRing, Eye, Mail, Plus, Send, Trash2 } from 'lucide-react';
import { del, get, patch, post, put } from '../api';
import { useAuth } from '../auth';
import { fmtDateTime } from '../format';
import { Badge, ErrorBox, Field, Loading, Modal, PageHeader, Tabs, Toggle, useFetch, useUi } from '../ui';

interface Channels { telegram: { configured: boolean; bot: { username: string; name: string } | null; tokenMask: string }; smtp: { configured: boolean; host?: string; port?: number; secure?: boolean; user?: string; from?: string; passSet?: boolean } }
interface Sub { id: string; kind: string; kindLabel: string; channel: 'telegram' | 'email'; target: string; label: string | null; sendTime: string; enabled: boolean; lastSentAt: string | null; createdBy: string | null }
interface Log { id: number; kind: string; channel: string; target: string; ok: boolean; error: string | null; at: string }

const KINDS: [string, string, string][] = [
  ['daily', 'Итоги дня', 'выручка за вчера, заказы, средний чек, лучшие блюда, отмены'], ['weekly', 'Итоги недели', 'по понедельникам: неделя к неделе, прибыль, топ блюд'],
  ['monthly', 'Итоги месяца', '1-го числа: выручка, себестоимость, расходы, прибыль'], ['reminders', 'Что требует внимания', 'долги, просрочки, остатки, согласования'], ['alerts', 'Срочные предупреждения', 'сразу при появлении: просрочки, всплеск отмен'],
];

/** Уведомления: подключение Telegram и почты, подписки на сводки, журнал отправок. */
export default function Notifications() {
  const { can } = useAuth();
  const [tab, setTab] = useState<'subs' | 'channels' | 'log'>('subs');
  const tabs = [{ id: 'subs' as const, label: 'Рассылки' }, ...(can('notify') ? [{ id: 'channels' as const, label: 'Каналы связи' }] : []), { id: 'log' as const, label: 'Журнал' }];
  return (
    <>
      <PageHeader title="Уведомления" subtitle="Сводки и предупреждения в Telegram и на почту — по расписанию, без входа в систему" />
      <Tabs value={tab} onChange={setTab} tabs={tabs} />
      {tab === 'subs' && <Subs />}
      {tab === 'channels' && <ChannelsTab />}
      {tab === 'log' && <LogTab />}
    </>
  );
}

function Subs() {
  const { can } = useAuth();
  const { toast, confirm } = useUi();
  const { data, error, reload } = useFetch(() => get<Sub[]>('/notify/subscriptions'), []);
  const ch = useFetch(() => get<Channels>('/notify/channels'), []);
  const [adding, setAdding] = useState(false);
  const [preview, setPreview] = useState<{ title: string; text: string } | null>(null);
  if (error && !data) return <ErrorBox error={error} onRetry={reload} />;
  if (!data || !ch.data) return <Loading />;
  const write = can('rep.schedule');
  const none = !ch.data.telegram.configured && !ch.data.smtp.configured;
  const act = async (fn: () => Promise<unknown>, ok: string) => { try { await fn(); toast('ok', ok); void reload(); } catch (e) { toast('err', (e as Error).message); } };
  const show = async (kind: string) => { try { const r = await get<{ subject: string; text: string }>('/notify/preview?kind=' + kind); setPreview({ title: r.subject, text: r.text }); } catch (e) { toast('err', (e as Error).message); } };
  return (
    <>
      {none && <p className="mb-4 rounded-lg bg-info/10 p-3 text-sm text-info">Каналы связи ещё не подключены. {can('notify') ? 'Откройте вкладку «Каналы связи» — понадобится бот Telegram или почтовый сервер.' : 'Попросите владельца или администратора подключить Telegram или почту.'}</p>}
      <div className="mb-4 flex flex-wrap items-center gap-2"><span className="text-sm text-muted">Предпросмотр сводки:</span>{(['daily', 'weekly', 'monthly', 'reminders'] as const).map((k) => <button key={k} className="btn btn-soft btn-sm" onClick={() => void show(k)}><Eye size={13} /> {KINDS.find((x) => x[0] === k)![1]}</button>)}
        {write && <><button className="btn btn-soft btn-sm" onClick={async () => { try { const r = await post<{ sent: number }>('/notify/check-alerts'); toast('ok', r.sent ? `Отправлено предупреждений: ${r.sent}` : 'Новых срочных предупреждений нет'); void reload(); } catch (e) { toast('err', (e as Error).message); } }}><BellRing size={13} /> Проверить срочное сейчас</button><button className="btn btn-primary btn-sm ml-auto" onClick={() => setAdding(true)}><Plus size={14} /> Добавить рассылку</button></>}</div>
      {!data.length ? <div className="card p-10 text-center text-sm text-muted"><Mail size={30} className="mx-auto mb-2 opacity-40" />Рассылок пока нет. Добавьте, например, «Итоги дня» в Telegram — они будут приходить каждое утро.</div> : (
        <div className="card divide-y divide-line/70">
          {data.map((s) => (
            <div key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1"><div className="flex items-center gap-2 font-medium">{s.kindLabel}{!s.enabled && <Badge>выключена</Badge>}</div>
                <div className="text-xs text-muted">{s.channel === 'telegram' ? 'Telegram' : 'Почта'} · {s.target}{s.label ? ` · ${s.label}` : ''}{s.kind !== 'alerts' ? ` · в ${s.sendTime}` : ' · проверка каждые 5 минут'}{s.lastSentAt ? ` · последняя отправка ${fmtDateTime(s.lastSentAt)}` : ''}</div></div>
              {write && <>
                {s.kind !== 'alerts' && <input type="time" className="input !h-8 !w-[110px] text-[13px]" defaultValue={s.sendTime} onBlur={(e) => { if (e.target.value && e.target.value !== s.sendTime) void act(() => patch('/notify/subscriptions/' + s.id, { sendTime: e.target.value }), 'Время сохранено'); }} />}
                <button className="btn btn-soft btn-sm" onClick={() => void act(() => post(`/notify/subscriptions/${s.id}/send`), 'Отправлено')}><Send size={13} /> Сейчас</button>
                <Toggle checked={s.enabled} onChange={(v) => void act(() => patch('/notify/subscriptions/' + s.id, { enabled: v }), v ? 'Включена' : 'Выключена')} />
                <button className="btn btn-ghost btn-sm !px-1.5 hover:!text-bad" onClick={async () => { if (await confirm({ title: 'Удалить рассылку?', text: `${s.kindLabel} → ${s.target}`, danger: true, confirmLabel: 'Удалить' })) void act(() => del('/notify/subscriptions/' + s.id), 'Удалена'); }}><Trash2 size={14} /></button></>}
            </div>
          ))}
        </div>
      )}
      {adding && <AddModal channels={ch.data} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); void reload(); }} />}
      {preview && <Modal open onClose={() => setPreview(null)} title={preview.title} width={560} footer={<button className="btn btn-primary" onClick={() => setPreview(null)}>Закрыть</button>}><pre className="whitespace-pre-wrap rounded-lg bg-surface2 p-4 font-sans text-[13.5px] leading-relaxed">{preview.text}</pre><p className="mt-2 text-xs text-muted">Так сообщение придёт получателю (данные — на сейчас).</p></Modal>}
    </>
  );
}

function AddModal({ channels, onClose, onSaved }: { channels: Channels; onClose: () => void; onSaved: () => void }) {
  const { toast } = useUi();
  const [f, setF] = useState({ kind: 'daily', channel: (channels.telegram.configured ? 'telegram' : 'email') as 'telegram' | 'email', target: '', label: '', sendTime: '09:00' });
  const [chats, setChats] = useState<{ id: string; title: string }[] | null>(null);
  const [busy, setBusy] = useState(false);
  const save = async () => { setBusy(true); try { await post('/notify/subscriptions', { ...f, label: f.label || null }); toast('ok', 'Рассылка добавлена'); onSaved(); } catch (e) { toast('err', (e as Error).message); setBusy(false); } };
  return (
    <Modal open onClose={onClose} title="Новая рассылка" width={560} footer={<><button className="btn btn-soft" onClick={onClose}>Отмена</button><button className="btn btn-primary" disabled={busy || !f.target.trim()} onClick={() => void save()}>Добавить</button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Что отправлять" className="sm:col-span-2" hint={KINDS.find((k) => k[0] === f.kind)?.[2]}><select className="input" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>{KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
        <Field label="Куда"><select className="input" value={f.channel} onChange={(e) => setF({ ...f, channel: e.target.value as 'telegram' | 'email', target: '' })}><option value="telegram" disabled={!channels.telegram.configured}>Telegram{channels.telegram.configured ? '' : ' (не подключён)'}</option><option value="email" disabled={!channels.smtp.configured}>Почта{channels.smtp.configured ? '' : ' (не подключена)'}</option></select></Field>
        {f.kind !== 'alerts' && <Field label="Время отправки"><input type="time" className="input" value={f.sendTime} onChange={(e) => setF({ ...f, sendTime: e.target.value })} /></Field>}
        <Field label={f.channel === 'telegram' ? 'Chat ID' : 'Адрес почты'} className="sm:col-span-2" hint={f.channel === 'telegram' ? 'Получатель должен написать боту /start. Затем нажмите «Найти мои чаты».' : undefined}>
          <div className="flex gap-2"><input className="input" value={f.target} onChange={(e) => setF({ ...f, target: e.target.value })} placeholder={f.channel === 'telegram' ? '123456789' : 'owner@restaurant.kz'} />
            {f.channel === 'telegram' && can_discover(channels) && <button type="button" className="btn btn-soft shrink-0" onClick={async () => { try { setChats(await post('/notify/telegram/chats')); } catch (e) { toast('err', (e as Error).message); } }}>Найти мои чаты</button>}</div></Field>
        {chats && <div className="sm:col-span-2">{chats.length ? <div className="flex flex-wrap gap-1.5">{chats.map((c) => <button key={c.id} type="button" className={`rounded-md border px-2.5 py-1 text-[12.5px] ${f.target === c.id ? 'border-brand bg-brand/10 text-brand' : 'border-line text-muted hover:text-ink'}`} onClick={() => setF({ ...f, target: c.id, label: f.label || c.title })}>{c.title} · {c.id}</button>)}</div> : <p className="text-xs text-warn">Чатов не найдено. Откройте бота в Telegram и отправьте ему /start (для группы — добавьте бота и напишите в группе), затем повторите.</p>}</div>}
        <Field label="Подпись" className="sm:col-span-2" hint="для себя: «Владелец», «Бухгалтер»"><input className="input" value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}
const can_discover = (c: Channels) => c.telegram.configured;

function ChannelsTab() {
  const { toast, confirm } = useUi();
  const { data, error, reload } = useFetch(() => get<Channels>('/notify/channels'), []);
  const [token, setToken] = useState('');
  const [smtp, setSmtp] = useState({ host: '', port: '587', secure: false, user: '', pass: '', from: '' });
  const [loaded, setLoaded] = useState(false);
  const [testTo, setTestTo] = useState({ telegram: '', email: '' });
  if (error && !data) return <ErrorBox error={error} onRetry={reload} />;
  if (!data) return <Loading />;
  if (!loaded) { setLoaded(true); if (data.smtp.configured) setSmtp({ host: data.smtp.host ?? '', port: String(data.smtp.port ?? 587), secure: !!data.smtp.secure, user: data.smtp.user ?? '', pass: '', from: data.smtp.from ?? '' }); }
  const act = async (fn: () => Promise<unknown>, ok: string) => { try { await fn(); toast('ok', ok); void reload(); } catch (e) { toast('err', (e as Error).message); } };
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <section className="card p-5">
        <h2 className="mb-1 flex items-center gap-2 font-semibold"><Send size={17} className="text-info" />Telegram {data.telegram.configured && <Badge tone="good">подключён</Badge>}</h2>
        {data.telegram.configured ? (
          <>
            <p className="mb-3 text-sm text-muted">Бот <b className="text-ink">@{data.telegram.bot?.username}</b> · токен {data.telegram.tokenMask}</p>
            <div className="mb-3 flex gap-2"><input className="input" placeholder="Chat ID для проверки" value={testTo.telegram} onChange={(e) => setTestTo({ ...testTo, telegram: e.target.value })} /><button className="btn btn-soft shrink-0" disabled={!testTo.telegram} onClick={() => void act(() => post('/notify/test', { channel: 'telegram', target: testTo.telegram }), 'Тестовое сообщение отправлено')}>Проверить</button></div>
            <button className="btn btn-ghost btn-sm hover:!text-bad" onClick={async () => { if (await confirm({ title: 'Отключить Telegram?', text: 'Рассылки в Telegram перестанут отправляться.', danger: true, confirmLabel: 'Отключить' })) void act(() => del('/notify/telegram'), 'Telegram отключён'); }}>Отключить</button>
          </>
        ) : (
          <>
            <ol className="mb-3 list-decimal space-y-1 pl-5 text-[13px] leading-relaxed text-muted"><li>В Telegram откройте <b className="text-ink">@BotFather</b> и создайте бота командой /newbot.</li><li>Скопируйте выданный токен и вставьте ниже.</li><li>Откройте своего бота и отправьте ему /start — потом в «Рассылках» нажмите «Найти мои чаты».</li></ol>
            <Field label="Токен бота"><input className="input font-mono" autoComplete="off" value={token} onChange={(e) => setToken(e.target.value)} placeholder="123456789:AAE…" /></Field>
            <button className="btn btn-primary mt-3" disabled={!token.trim()} onClick={() => void act(() => put('/notify/telegram', { token: token.trim() }).then(() => setToken('')), 'Бот подключён')}>Подключить</button>
          </>
        )}
        <p className="mt-3 text-xs text-muted">Токен хранится в базе в зашифрованном виде. Серверу нужен выход в интернет к api.telegram.org.</p>
      </section>
      <section className="card p-5">
        <h2 className="mb-3 flex items-center gap-2 font-semibold"><Mail size={17} className="text-info" />Почта (SMTP) {data.smtp.configured && <Badge tone="good">подключена</Badge>}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Сервер"><input className="input" value={smtp.host} onChange={(e) => setSmtp({ ...smtp, host: e.target.value })} placeholder="smtp.gmail.com" /></Field>
          <Field label="Порт"><input className="input tnum" inputMode="numeric" value={smtp.port} onChange={(e) => setSmtp({ ...smtp, port: e.target.value })} /></Field>
          <Field label="Логин"><input className="input" autoComplete="off" value={smtp.user} onChange={(e) => setSmtp({ ...smtp, user: e.target.value })} /></Field>
          <Field label={data.smtp.passSet ? 'Пароль (оставьте пустым, чтобы не менять)' : 'Пароль'}><input className="input" type="password" autoComplete="new-password" value={smtp.pass} onChange={(e) => setSmtp({ ...smtp, pass: e.target.value })} /></Field>
          <Field label="От кого" className="sm:col-span-2"><input className="input" value={smtp.from} onChange={(e) => setSmtp({ ...smtp, from: e.target.value })} placeholder="Innova Office <office@restaurant.kz>" /></Field>
          <div className="sm:col-span-2"><Toggle checked={smtp.secure} onChange={(v) => setSmtp({ ...smtp, secure: v })} label="Защищённое соединение сразу (SSL, обычно порт 465)" /></div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2"><button className="btn btn-primary" disabled={!smtp.host || !smtp.from} onClick={() => void act(() => put('/notify/smtp', { host: smtp.host, port: Number(smtp.port) || 587, secure: smtp.secure, user: smtp.user, pass: smtp.pass || undefined, from: smtp.from }).then(() => setSmtp({ ...smtp, pass: '' })), 'Почта подключена')}>Сохранить и проверить связь</button>
          {data.smtp.configured && <button className="btn btn-ghost hover:!text-bad" onClick={async () => { if (await confirm({ title: 'Отключить почту?', danger: true, confirmLabel: 'Отключить' })) void act(() => del('/notify/smtp'), 'Почта отключена'); }}>Отключить</button>}</div>
        {data.smtp.configured && <div className="mt-4 flex gap-2"><input className="input" type="email" placeholder="Адрес для проверки" value={testTo.email} onChange={(e) => setTestTo({ ...testTo, email: e.target.value })} /><button className="btn btn-soft shrink-0" disabled={!testTo.email} onClick={() => void act(() => post('/notify/test', { channel: 'email', target: testTo.email }), 'Тестовое письмо отправлено')}>Проверить</button></div>}
        <p className="mt-3 text-xs text-muted">Для Gmail нужен «пароль приложения». Пароль хранится в зашифрованном виде.</p>
      </section>
    </div>
  );
}

function LogTab() {
  const { data, error, reload } = useFetch(() => get<Log[]>('/notify/log'), []);
  if (error && !data) return <ErrorBox error={error} onRetry={reload} />;
  if (!data) return <Loading />;
  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-[13px]"><thead><tr><th className="th">Время</th><th className="th">Что</th><th className="th">Куда</th><th className="th">Результат</th></tr></thead>
        <tbody>{data.map((r) => <tr key={r.id}><td className="td whitespace-nowrap text-muted">{fmtDateTime(r.at)}</td><td className="td">{r.kind}</td><td className="td">{r.channel === 'telegram' ? 'Telegram' : 'Почта'} · {r.target}</td><td className="td">{r.ok ? <Badge tone="good">доставлено</Badge> : <span className="text-bad">{r.error}</span>}</td></tr>)}
          {!data.length && <tr><td className="td py-10 text-center text-muted" colSpan={4}>Отправок ещё не было</td></tr>}</tbody></table>
    </div>
  );
}
