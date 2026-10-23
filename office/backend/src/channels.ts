import nodemailer from 'nodemailer';
import { q } from './db';
import { open, seal } from './secret';
import { HttpError } from './util';

/**
 * Каналы доставки: Telegram-бот и электронная почта (SMTP). Настройки лежат в office.setting;
 * токен бота и пароль почты — в зашифрованном виде. Адрес Telegram API можно переопределить (TELEGRAM_API) — например, для прокси.
 */
const TG_API = (process.env.TELEGRAM_API || 'https://api.telegram.org').replace(/\/$/, '');

async function getSetting(rid: string, key: string): Promise<any> {
  const r = await q<{ value: unknown }>('select value from office.setting where restaurante_id = $1 and key = $2', [rid, key]);
  return r[0]?.value ?? null;
}
async function putSetting(rid: string, key: string, value: unknown): Promise<void> {
  await q(`insert into office.setting (restaurante_id, key, value) values ($1,$2,$3) on conflict (restaurante_id, key) do update set value = excluded.value, updated_at = now()`, [rid, key, JSON.stringify(value)]);
}
async function delSetting(rid: string, key: string): Promise<void> { await q('delete from office.setting where restaurante_id = $1 and key = $2', [rid, key]); }

/* ───────── Telegram ───────── */
export async function telegramToken(rid: string): Promise<string | null> { return open(await getSetting(rid, 'notify.telegram.token')); }

async function tg(token: string, method: string, body?: unknown): Promise<any> {
  let res: Response;
  try {
    res = await fetch(`${TG_API}/bot${token}/${method}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body ?? {}), signal: AbortSignal.timeout(15_000) });
  } catch { throw new HttpError(502, 'Не удалось связаться с Telegram (проверьте доступ сервера в интернет)'); }
  const j: any = await res.json().catch(() => null);
  if (!res.ok || !j?.ok) throw new HttpError(res.status === 401 ? 400 : 502, j?.description ? `Telegram: ${j.description}` : `Telegram: ошибка ${res.status}`);
  return j.result;
}

export async function saveTelegramToken(rid: string, token: string): Promise<{ username: string; name: string }> {
  const me = await tg(token, 'getMe');
  await putSetting(rid, 'notify.telegram.token', seal(token));
  await putSetting(rid, 'notify.telegram.bot', { username: me.username, name: me.first_name });
  return { username: me.username, name: me.first_name };
}
export async function removeTelegram(rid: string): Promise<void> { await delSetting(rid, 'notify.telegram.token'); await delSetting(rid, 'notify.telegram.bot'); }
export const telegramBot = (rid: string) => getSetting(rid, 'notify.telegram.bot') as Promise<{ username: string; name: string } | null>;

/** Чаты, которые недавно писали боту (нужно отправить боту /start): помогает узнать chat id. */
export async function telegramChats(rid: string): Promise<{ id: string; title: string; type: string }[]> {
  const token = await telegramToken(rid);
  if (!token) throw new HttpError(409, 'Сначала сохраните токен бота');
  const upd = (await tg(token, 'getUpdates', { limit: 100, timeout: 0 })) as any[];
  const m = new Map<string, { id: string; title: string; type: string }>();
  for (const u of upd) {
    const c = (u.message ?? u.channel_post ?? u.my_chat_member)?.chat;
    if (c) m.set(String(c.id), { id: String(c.id), title: c.title || [c.first_name, c.last_name].filter(Boolean).join(' ') || c.username || String(c.id), type: c.type });
  }
  return [...m.values()];
}

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export const tgEscape = escapeHtml;

export async function sendTelegram(rid: string, chatId: string, html: string): Promise<void> {
  const token = await telegramToken(rid);
  if (!token) throw new HttpError(409, 'Telegram не настроен: сохраните токен бота');
  // сообщение Telegram ограничено 4096 символами — режем по строкам
  const parts: string[] = [];
  let cur = '';
  for (const line of html.split('\n')) { if ((cur + '\n' + line).length > 3800) { parts.push(cur); cur = line; } else cur = cur ? cur + '\n' + line : line; }
  if (cur) parts.push(cur);
  for (const p of parts) await tg(token, 'sendMessage', { chat_id: chatId, text: p, parse_mode: 'HTML', disable_web_page_preview: true });
}

/* ───────── Почта ───────── */
export interface SmtpCfg { host: string; port: number; secure: boolean; user: string; from: string }
export const smtpConfig = async (rid: string): Promise<(SmtpCfg & { passSet: boolean }) | null> => {
  const c = (await getSetting(rid, 'notify.smtp')) as SmtpCfg | null;
  if (!c) return null;
  return { ...c, passSet: !!(await getSetting(rid, 'notify.smtp.pass')) };
};

async function transport(rid: string) {
  const c = (await getSetting(rid, 'notify.smtp')) as SmtpCfg | null;
  if (!c) throw new HttpError(409, 'Почта не настроена: заполните параметры SMTP');
  const pass = open(await getSetting(rid, 'notify.smtp.pass'));
  return { c, t: nodemailer.createTransport({ host: c.host, port: c.port, secure: c.secure, auth: c.user ? { user: c.user, pass: pass ?? '' } : undefined, connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 20_000, tls: { rejectUnauthorized: process.env.SMTP_INSECURE_TLS !== '1' } }) };
}

export async function saveSmtp(rid: string, cfg: SmtpCfg, pass: string | undefined): Promise<void> {
  const prev = open(await getSetting(rid, 'notify.smtp.pass'));
  const t = nodemailer.createTransport({ host: cfg.host, port: cfg.port, secure: cfg.secure, auth: cfg.user ? { user: cfg.user, pass: pass ?? prev ?? '' } : undefined, connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 15_000, tls: { rejectUnauthorized: process.env.SMTP_INSECURE_TLS !== '1' } });
  try { await t.verify(); } catch (e) { throw new HttpError(400, `Не удалось подключиться к почтовому серверу: ${(e as Error).message}`); }
  await putSetting(rid, 'notify.smtp', cfg);
  if (pass) await putSetting(rid, 'notify.smtp.pass', seal(pass));
}
export async function removeSmtp(rid: string): Promise<void> { await delSetting(rid, 'notify.smtp'); await delSetting(rid, 'notify.smtp.pass'); }

export async function sendEmail(rid: string, to: string, subject: string, html: string, text: string): Promise<void> {
  const { c, t } = await transport(rid);
  try { await t.sendMail({ from: c.from, to, subject, html, text }); } catch (e) { throw new HttpError(502, `Почта: ${(e as Error).message}`); }
}

/** Отправка по подписке. */
export async function deliver(rid: string, channel: 'telegram' | 'email', target: string, subject: string, html: string, text: string): Promise<void> {
  if (channel === 'telegram') await sendTelegram(rid, target, html);
  else await sendEmail(rid, target, subject, `<div style="font-family:system-ui,Segoe UI,Arial,sans-serif;font-size:14px;line-height:1.5;color:#0f172a">${html.replace(/\n/g, '<br>')}</div>`, text);
}
