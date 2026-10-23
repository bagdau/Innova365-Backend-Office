import { getSettings, Me } from './auth';
import { q, q1 } from './db';
import { loadPerms } from './perms';
import { cogs, payBetween, revenueByDay, soldProducts, sumDays } from './reports';
import { loadModel } from './cost';
import { tgEscape } from './channels';
import { collectReminders } from './routes/reminders';
import { addDays, n, round2, todayIso } from './util';

/**
 * Тексты рассылок: ежедневная и еженедельная сводка, итоги месяца, напоминания, срочные предупреждения.
 * Один и тот же текст уходит в Telegram (HTML) и на почту.
 */
export interface Digest { subject: string; html: string; text: string }

const SYMBOL: Record<string, string> = { KZT: '₸', RUB: '₽', KGS: 'с', UZS: 'сўм', USD: '$', EUR: '€' };
const fmt = (v: number, cur: string) => `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(Math.round(v))} ${SYMBOL[cur] ?? cur}`;
const num = (v: number) => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(v);
const ddmm = (iso: string) => iso.slice(8) + '.' + iso.slice(5, 7);
const delta = (now: number, prev: number) => (prev ? `${now >= prev ? '▲' : '▼'} ${Math.abs(((now - prev) / prev) * 100).toFixed(1)}%` : '—');
const strip = (html: string) => html.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');

function make(subject: string, lines: string[]): Digest { const html = lines.join('\n'); return { subject, html, text: strip(html) }; }

async function cancelled(rid: string, tz: string, from: string, to: string): Promise<{ count: number; amount: number }> {
  const r = await q1<{ c: number; a: string }>(
    `select count(*)::int as c, coalesce(sum((select coalesce(sum(ip.subtotal), 0) from public."ItemPedido" ip where ip."pedidoId" = p.id)), 0) as a from public."Pedido" p
      where p."restauranteId" = $1 and p.estado = 'CANCELADO' and ${payBetween('$3', '$4')}`, [rid, tz, from, to]);
  return { count: r?.c ?? 0, amount: n(r?.a) };
}
const expensesPaid = async (rid: string, from: string, to: string) => n((await q1<{ t: string }>(`select coalesce(sum(amount), 0) as t from office.expense where restaurante_id = $1 and date between $2::date and $3::date`, [rid, from, to]))?.t);

async function top(rid: string, tz: string, from: string, to: string, limit: number) {
  const [sold, model] = await Promise.all([soldProducts(rid, tz, from, to), loadModel(rid)]);
  return sold.map((x) => ({ name: model.productos.get(x.id)?.nombre ?? '—', qty: x.qty, revenue: x.revenue })).sort((a, b) => b.revenue - a.revenue).slice(0, limit);
}

async function owner(rid: string): Promise<Pick<Me, 'rid' | 'role'>> { await loadPerms(rid); return { rid, role: 'owner' }; }

export async function dailyDigest(rid: string): Promise<Digest> {
  const s = await getSettings(rid);
  const y = addDays(todayIso(s.timezone), -1), lw = addDays(y, -7);
  const [d, p, tp, cn, ex, rem] = await Promise.all([revenueByDay(rid, s.timezone, y, y), revenueByDay(rid, s.timezone, lw, lw), top(rid, s.timezone, y, y, 3), cancelled(rid, s.timezone, y, y), expensesPaid(rid, y, y), collectReminders(await owner(rid))]);
  const t = sumDays(d), pt = sumDays(p);
  const c = s.currency;
  const lines = [`<b>📊 Итоги дня ${ddmm(y)} · ${tgEscape(s.company || 'Innova365')}</b>`, '',
    `Выручка: <b>${fmt(t.revenue, c)}</b> (${delta(t.revenue, pt.revenue)} к прошлой неделе)`,
    `Заказов: <b>${num(t.orders)}</b> · средний чек ${fmt(t.orders ? t.revenue / t.orders : 0, c)}`];
  const methods = [['Наличные', t.cash], ['Карта', t.card], ['QR', t.qr], ['Перевод', t.transfer]].filter(([, v]) => (v as number) > 0).map(([k, v]) => `${k} ${fmt(v as number, c)}`);
  if (methods.length) lines.push(`Оплата: ${methods.join(' · ')}`);
  if (tp.length) lines.push('', '<b>Лучшие блюда:</b>', ...tp.map((x, i) => `${i + 1}. ${tgEscape(x.name)} — ${num(x.qty)} шт, ${fmt(x.revenue, c)}`));
  if (cn.count) lines.push('', `⚠️ Отменено заказов: <b>${cn.count}</b> на ${fmt(cn.amount, c)}`);
  if (ex) lines.push(`Расходов за день: ${fmt(ex, c)}`);
  const urgent = rem.filter((r) => r.severity !== 'info');
  if (urgent.length) lines.push('', `🔔 Требует внимания: ${urgent.length} (${urgent.slice(0, 3).map((r) => tgEscape(r.title)).join('; ')}${urgent.length > 3 ? '…' : ''})`);
  if (!t.orders) lines.push('', 'За день не было оплаченных заказов.');
  return make(`Итоги дня ${ddmm(y)}`, lines);
}

export async function weeklyDigest(rid: string): Promise<Digest> {
  const s = await getSettings(rid);
  const today = todayIso(s.timezone), to = addDays(today, -1), from = addDays(today, -7), pTo = addDays(from, -1), pFrom = addDays(from, -7);
  const [d, p, tp, cn, ex, cg] = await Promise.all([revenueByDay(rid, s.timezone, from, to), revenueByDay(rid, s.timezone, pFrom, pTo), top(rid, s.timezone, from, to, 5), cancelled(rid, s.timezone, from, to), expensesPaid(rid, from, to), cogs(rid, s.timezone, from, to)]);
  const t = sumDays(d), pt = sumDays(p), c = s.currency;
  const vat = s.vatEnabled ? round2(t.revenue * s.vat / (100 + s.vat)) : 0;
  const profit = t.revenue - vat - cg.total - ex;
  const best = [...d].sort((a, b) => b.revenue - a.revenue)[0];
  const lines = [`<b>📈 Итоги недели ${ddmm(from)} — ${ddmm(to)} · ${tgEscape(s.company || 'Innova365')}</b>`, '',
    `Выручка: <b>${fmt(t.revenue, c)}</b> (${delta(t.revenue, pt.revenue)} к прошлой неделе)`,
    `Заказов: <b>${num(t.orders)}</b> (${delta(t.orders, pt.orders)}) · средний чек ${fmt(t.orders ? t.revenue / t.orders : 0, c)}`,
    `Себестоимость: ${fmt(cg.total, c)} · расходы: ${fmt(ex, c)}`, `Прибыль (оценка): <b>${fmt(profit, c)}</b>`];
  if (best && best.revenue > 0) lines.push(`Лучший день: ${ddmm(best.date)} — ${fmt(best.revenue, c)}`);
  if (tp.length) lines.push('', '<b>Лучшие блюда:</b>', ...tp.map((x, i) => `${i + 1}. ${tgEscape(x.name)} — ${num(x.qty)} шт, ${fmt(x.revenue, c)}`));
  if (cn.count) lines.push('', `⚠️ Отменено заказов: ${cn.count} на ${fmt(cn.amount, c)}`);
  return make(`Итоги недели ${ddmm(from)} — ${ddmm(to)}`, lines);
}

export async function monthlyDigest(rid: string): Promise<Digest> {
  const s = await getSettings(rid);
  const today = todayIso(s.timezone);
  const first = new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 2, 1)).toISOString().slice(0, 10);
  const last = new Date(Date.UTC(Number(first.slice(0, 4)), Number(first.slice(5, 7)), 0)).toISOString().slice(0, 10);
  const pFirst = new Date(Date.UTC(Number(first.slice(0, 4)), Number(first.slice(5, 7)) - 2, 1)).toISOString().slice(0, 10);
  const pLast = new Date(Date.UTC(Number(pFirst.slice(0, 4)), Number(pFirst.slice(5, 7)), 0)).toISOString().slice(0, 10);
  const [d, p, cg, cats, ex] = await Promise.all([
    revenueByDay(rid, s.timezone, first, last), revenueByDay(rid, s.timezone, pFirst, pLast), cogs(rid, s.timezone, first, last),
    q(`select c.name, sum(e.amount) as total from office.expense e join office.expense_category c on c.id = e.category_id where e.restaurante_id = $1 and e.date between $2::date and $3::date group by c.name order by 2 desc limit 5`, [rid, first, last]),
    expensesPaid(rid, first, last),
  ]);
  const t = sumDays(d), pt = sumDays(p), c = s.currency;
  const vat = s.vatEnabled ? round2(t.revenue * s.vat / (100 + s.vat)) : 0;
  const profit = t.revenue - vat - cg.total - ex;
  const lines = [`<b>🗓 Итоги месяца ${first.slice(0, 7)} · ${tgEscape(s.company || 'Innova365')}</b>`, '',
    `Выручка: <b>${fmt(t.revenue, c)}</b> (${delta(t.revenue, pt.revenue)} к прошлому месяцу)`, `Заказов: ${num(t.orders)} · средний чек ${fmt(t.orders ? t.revenue / t.orders : 0, c)}`,
    s.vatEnabled ? `НДС в выручке: ${fmt(vat, c)}` : '', `Себестоимость: ${fmt(cg.total, c)}`, `Расходы: ${fmt(ex, c)}`, `Прибыль (оценка): <b>${fmt(profit, c)}</b>`].filter(Boolean);
  if (cats.length) lines.push('', '<b>Крупнейшие расходы:</b>', ...cats.map((x) => `${tgEscape(x.name)} — ${fmt(n(x.total), c)}`));
  return make(`Итоги месяца ${first.slice(0, 7)}`, lines);
}

export async function remindersDigest(rid: string): Promise<Digest> {
  const s = await getSettings(rid);
  const rem = await collectReminders(await owner(rid));
  const mark = { bad: '🔴', warn: '🟠', info: '🔵' } as const;
  const lines = [`<b>🔔 Требует внимания · ${tgEscape(s.company || 'Innova365')}</b>`, ''];
  if (!rem.length) lines.push('Всё в порядке — срочных дел нет.');
  for (const r of rem.slice(0, 25)) lines.push(`${mark[r.severity]} <b>${tgEscape(r.title)}</b>`, `    ${tgEscape(r.detail)}`);
  return make('Требует внимания', lines);
}

/** Срочные предупреждения: новые «красные» напоминания (раз в сутки каждое) и всплеск отмен. */
export async function alertItems(rid: string): Promise<{ key: string; html: string }[]> {
  const s = await getSettings(rid);
  const today = todayIso(s.timezone);
  const out: { key: string; html: string }[] = [];
  for (const r of await collectReminders(await owner(rid))) if (r.severity === 'bad') out.push({ key: `rem:${r.id}:${today}`, html: `🔴 <b>${tgEscape(r.title)}</b>\n${tgEscape(r.detail)}` });
  const cn = await cancelled(rid, s.timezone, today, today);
  const total = n((await q1<{ c: number }>(`select count(*)::int as c from public."Pedido" p where p."restauranteId" = $1 and ${payBetween('$3', '$4')} and p.estado in ('PAGADO','CANCELADO')`, [rid, s.timezone, today, today]))?.c);
  if (cn.count >= 5 && total > 0 && cn.count / total >= 0.2) out.push({ key: `cancel:${today}:${Math.floor(cn.count / 5)}`, html: `⚠️ <b>Много отмен сегодня</b>\nОтменено ${cn.count} из ${total} заказов (${fmt(cn.amount, s.currency)}). Откройте «Контроль сотрудников».` });
  return out;
}

export type DigestKind = 'daily' | 'weekly' | 'monthly' | 'reminders';
export async function buildDigest(rid: string, kind: DigestKind): Promise<Digest> {
  return kind === 'daily' ? dailyDigest(rid) : kind === 'weekly' ? weeklyDigest(rid) : kind === 'monthly' ? monthlyDigest(rid) : remindersDigest(rid);
}
