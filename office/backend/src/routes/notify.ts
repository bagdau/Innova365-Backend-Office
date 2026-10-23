import { Router } from 'express';
import { z } from 'zod';
import { audit, auth, getSettings, need } from '../auth';
import { deliver, removeSmtp, removeTelegram, saveSmtp, saveTelegramToken, smtpConfig, telegramBot, telegramChats, telegramToken } from '../channels';
import { q, q1 } from '../db';
import { alertItems, buildDigest, DigestKind } from '../digest';
import { mask } from '../secret';
import { ah, HttpError, parse, todayIso } from '../util';

/**
 * Уведомления и рассылки. Каналы (Telegram, почта) настраивает тот, у кого есть право «Уведомления»;
 * подписки на сводки — тот, у кого есть право «Рассылки по расписанию».
 */
export const router = Router();
router.use('/notify', auth);

export const KINDS: Record<string, string> = { daily: 'Итоги дня', weekly: 'Итоги недели (по понедельникам)', monthly: 'Итоги месяца (1-го числа)', reminders: 'Что требует внимания', alerts: 'Срочные предупреждения' };

router.get('/notify/channels', need('notify', 'rep.schedule'), ah(async (req, res) => {
  const rid = req.me!.rid;
  const [bot, token, smtp] = await Promise.all([telegramBot(rid), telegramToken(rid), smtpConfig(rid)]);
  res.json({
    telegram: { configured: !!token, bot, tokenMask: mask(token) },
    smtp: smtp ? { configured: true, host: smtp.host, port: smtp.port, secure: smtp.secure, user: smtp.user, from: smtp.from, passSet: smtp.passSet } : { configured: false },
  });
}));

router.put('/notify/telegram', need('notify'), ah(async (req, res) => {
  const b = parse(z.object({ token: z.string().trim().regex(/^\d{6,12}:[\w-]{30,60}$/, 'Токен выглядит так: 123456789:AAE… — скопируйте его у @BotFather целиком') }), req.body);
  const bot = await saveTelegramToken(req.me!.rid, b.token);
  await audit(req, 'notify.telegram', 'notify', null, { bot: bot.username });
  res.json({ bot });
}));
router.delete('/notify/telegram', need('notify'), ah(async (req, res) => { await removeTelegram(req.me!.rid); await audit(req, 'notify.telegram.remove', 'notify'); res.json({ ok: true }); }));
router.post('/notify/telegram/chats', need('notify'), ah(async (req, res) => { res.json(await telegramChats(req.me!.rid)); }));

router.put('/notify/smtp', need('notify'), ah(async (req, res) => {
  const b = parse(z.object({
    host: z.string().trim().min(3, 'Укажите сервер').max(120), port: z.number().int().min(1).max(65535), secure: z.boolean(), user: z.string().trim().max(120).default(''),
    pass: z.string().max(200).optional(), from: z.string().trim().min(3, 'Укажите адрес отправителя').max(160),
  }), req.body);
  await saveSmtp(req.me!.rid, { host: b.host, port: b.port, secure: b.secure, user: b.user, from: b.from }, b.pass || undefined);
  await audit(req, 'notify.smtp', 'notify', null, { host: b.host, port: b.port });
  res.json({ ok: true });
}));
router.delete('/notify/smtp', need('notify'), ah(async (req, res) => { await removeSmtp(req.me!.rid); await audit(req, 'notify.smtp.remove', 'notify'); res.json({ ok: true }); }));

const target = (channel: 'telegram' | 'email', t: string): string => {
  const v = t.trim();
  if (channel === 'email') { if (!z.string().email().safeParse(v).success) throw new HttpError(400, 'Некорректный адрес почты'); return v.toLowerCase(); }
  if (!/^(-?\d{5,16}|@[A-Za-z][\w]{3,31})$/.test(v)) throw new HttpError(400, 'Chat ID — число (например 123456789 или -1001234567890) или @имя_канала');
  return v;
};

/** Тестовое сообщение — проверить канал и адресата. */
router.post('/notify/test', need('notify', 'rep.schedule'), ah(async (req, res) => {
  const b = parse(z.object({ channel: z.enum(['telegram', 'email']), target: z.string().min(1) }), req.body);
  const s = await getSettings(req.me!.rid);
  const t = target(b.channel, b.target);
  const text = `Тестовое сообщение Innova Office (${s.company || 'Innova365'}). Если вы его видите — уведомления настроены верно.`;
  try { await deliver(req.me!.rid, b.channel, t, 'Тест Innova Office', `✅ ${text}`, text); } catch (e) { await q('insert into office.notify_log (restaurante_id, kind, channel, target, ok, error) values ($1,$2,$3,$4,false,$5)', [req.me!.rid, 'test', b.channel, t, (e as Error).message.slice(0, 300)]); throw e; }
  await q('insert into office.notify_log (restaurante_id, kind, channel, target, ok) values ($1,$2,$3,$4,true)', [req.me!.rid, 'test', b.channel, t]);
  res.json({ ok: true });
}));

/* ───────── Подписки ───────── */
const subBody = z.object({ kind: z.enum(['daily', 'weekly', 'monthly', 'reminders', 'alerts']), channel: z.enum(['telegram', 'email']), target: z.string().min(1).max(120), label: z.string().trim().max(60).nullish(), sendTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Время в формате ЧЧ:ММ').default('09:00') });

router.get('/notify/subscriptions', need('rep.schedule', 'notify'), ah(async (req, res) => {
  const rows = await q('select id, kind, channel, target, label, send_time, enabled, last_sent_at, created_by_name from office.subscription where restaurante_id = $1 order by created_at', [req.me!.rid]);
  res.json(rows.map((r) => ({ id: r.id, kind: r.kind, kindLabel: KINDS[r.kind], channel: r.channel, target: r.target, label: r.label, sendTime: r.send_time, enabled: r.enabled, lastSentAt: r.last_sent_at, createdBy: r.created_by_name })));
}));

router.post('/notify/subscriptions', need('rep.schedule'), ah(async (req, res) => {
  const b = parse(subBody, req.body);
  const t = target(b.channel, b.target);
  const r = await q1<{ id: string }>(`insert into office.subscription (restaurante_id, kind, channel, target, label, send_time, created_by_name) values ($1,$2,$3,$4,$5,$6,$7) on conflict (restaurante_id, kind, channel, target) do nothing returning id`,
    [req.me!.rid, b.kind, b.channel, t, b.label ?? null, b.sendTime, req.me!.name]);
  if (!r) throw new HttpError(409, 'Такая подписка уже есть');
  await audit(req, 'subscription.create', 'subscription', r.id, { kind: b.kind, channel: b.channel });
  res.status(201).json({ id: r.id });
}));

router.patch('/notify/subscriptions/:id', need('rep.schedule'), ah(async (req, res) => {
  const b = parse(z.object({ enabled: z.boolean().optional(), sendTime: subBody.shape.sendTime.optional(), label: z.string().trim().max(60).nullish() }), req.body);
  const r = await q(`update office.subscription set enabled = coalesce($3, enabled), send_time = coalesce($4, send_time), label = case when $5::boolean then $6 else label end where id = $1 and restaurante_id = $2 returning id`,
    [req.params.id, req.me!.rid, b.enabled ?? null, b.sendTime ?? null, b.label !== undefined, b.label ?? null]);
  if (!r.length) throw new HttpError(404, 'Подписка не найдена');
  await audit(req, 'subscription.update', 'subscription', req.params.id, b);
  res.json({ ok: true });
}));

router.delete('/notify/subscriptions/:id', need('rep.schedule'), ah(async (req, res) => {
  const r = await q('delete from office.subscription where id = $1 and restaurante_id = $2 returning id', [req.params.id, req.me!.rid]);
  if (!r.length) throw new HttpError(404, 'Подписка не найдена');
  await audit(req, 'subscription.delete', 'subscription', req.params.id);
  res.json({ ok: true });
}));

/** Предпросмотр текста сводки без отправки. */
router.get('/notify/preview', need('rep.view', 'rep.schedule', 'notify'), ah(async (req, res) => {
  const kind = z.enum(['daily', 'weekly', 'monthly', 'reminders']).parse(req.query.kind);
  const d = await buildDigest(req.me!.rid, kind as DigestKind);
  res.json({ subject: d.subject, text: d.text });
}));

/** Отправить сводку подписчику прямо сейчас. */
router.post('/notify/subscriptions/:id/send', need('rep.schedule'), ah(async (req, res) => {
  const rid = req.me!.rid;
  const sub = await q1<{ id: string; kind: string; channel: 'telegram' | 'email'; target: string }>('select id, kind, channel, target from office.subscription where id = $1 and restaurante_id = $2', [req.params.id, rid]);
  if (!sub) throw new HttpError(404, 'Подписка не найдена');
  await sendSubscription(rid, sub, true);
  res.json({ ok: true });
}));

/** Проверить срочные предупреждения сейчас (то же, что делает расписание раз в 5 минут); повторы не отправляются. */
router.post('/notify/check-alerts', need('rep.schedule', 'notify'), ah(async (req, res) => {
  const rid = req.me!.rid;
  const subs = await q<{ id: string; kind: string; channel: 'telegram' | 'email'; target: string }>(`select id, kind, channel, target from office.subscription where restaurante_id = $1 and kind = 'alerts' and enabled`, [rid]);
  let sent = 0;
  for (const s of subs) if (await sendSubscription(rid, s)) sent++;
  res.json({ subscriptions: subs.length, sent });
}));

router.get('/notify/log', need('notify', 'rep.schedule'), ah(async (req, res) => {
  const rows = await q('select id, kind, channel, target, ok, error, at from office.notify_log where restaurante_id = $1 order by at desc limit 100', [req.me!.rid]);
  res.json(rows);
}));

/* ───────── Отправка и расписание ───────── */
export async function sendSubscription(rid: string, sub: { id: string; kind: string; channel: 'telegram' | 'email'; target: string }, force = false): Promise<boolean> {
  try {
    if (sub.kind === 'alerts') {
      const items = await alertItems(rid);
      let sent = 0;
      for (const it of items) {
        const key = `${sub.id}:${it.key}`;
        if (!force) { const done = await q1('select 1 from office.notify_sent where restaurante_id = $1 and key = $2', [rid, key]); if (done) continue; }
        await deliver(rid, sub.channel, sub.target, 'Срочно: Innova Office', it.html, it.html.replace(/<[^>]+>/g, ''));
        await q('insert into office.notify_sent (restaurante_id, key) values ($1,$2) on conflict (restaurante_id, key) do update set sent_at = now()', [rid, key]);
        sent++;
      }
      if (force && !sent) await deliver(rid, sub.channel, sub.target, 'Срочные предупреждения', 'Срочных предупреждений нет.', 'Срочных предупреждений нет.');
      if (sent) await q('insert into office.notify_log (restaurante_id, subscription_id, kind, channel, target, ok) values ($1,$2,$3,$4,$5,true)', [rid, sub.id, sub.kind, sub.channel, sub.target]);
      return sent > 0;
    }
    const d = await buildDigest(rid, sub.kind as DigestKind);
    await deliver(rid, sub.channel, sub.target, d.subject, d.html, d.text);
    await q('update office.subscription set last_sent_at = now() where id = $1', [sub.id]);
    await q('insert into office.notify_log (restaurante_id, subscription_id, kind, channel, target, ok) values ($1,$2,$3,$4,$5,true)', [rid, sub.id, sub.kind, sub.channel, sub.target]);
    return true;
  } catch (e) {
    await q('insert into office.notify_log (restaurante_id, subscription_id, kind, channel, target, ok, error) values ($1,$2,$3,$4,$5,false,$6)', [rid, sub.id, sub.kind, sub.channel, sub.target, (e as Error).message.slice(0, 300)]).catch(() => undefined);
    if (force) throw e;
    console.error('[notify]', sub.kind, sub.channel, (e as Error).message);
    return false;
  }
}

let busy = false;
export async function runScheduleTick(now = new Date()): Promise<number> {
  if (busy) return 0;
  busy = true;
  let sent = 0;
  try {
    const subs = await q<{ id: string; restaurante_id: string; kind: string; channel: 'telegram' | 'email'; target: string; send_time: string; last_sent_at: string | null }>(`select id, restaurante_id, kind, channel, target, send_time, last_sent_at from office.subscription where enabled`);
    const tzCache = new Map<string, string>();
    for (const s of subs) {
      const rid = s.restaurante_id;
      if (!tzCache.has(rid)) tzCache.set(rid, (await getSettings(rid)).timezone);
      const tz = tzCache.get(rid)!;
      const today = todayIso(tz);
      const hhmm = new Intl.DateTimeFormat('sv-SE', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(now);
      const dow = new Date(today + 'T00:00:00Z').getUTCDay();   // 1 = понедельник
      if (s.kind !== 'alerts') {
        if (hhmm < s.send_time) continue;
        if (s.kind === 'weekly' && dow !== 1) continue;
        if (s.kind === 'monthly' && today.slice(8) !== '01') continue;
        const lastDay = s.last_sent_at ? new Intl.DateTimeFormat('sv-SE', { timeZone: tz }).format(new Date(s.last_sent_at)) : null;
        if (lastDay === today) continue;
      } else if (now.getMinutes() % 5 !== 0) continue;   // предупреждения проверяем раз в 5 минут
      // после ошибки повторяем не чаще раза в 10 минут
      const fail = await q1(`select 1 from office.notify_log where subscription_id = $1 and not ok and at > $2::timestamptz - interval '10 minutes' limit 1`, [s.id, now.toISOString()]);
      if (fail) continue;
      if (await sendSubscription(rid, s)) sent++;
    }
  } finally { busy = false; }
  return sent;
}

export function startNotifyScheduler(): void {
  setInterval(() => { runScheduleTick().catch((e) => console.error('[notify tick]', e.message)); }, 60_000).unref();
}
