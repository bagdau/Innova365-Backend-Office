import { Router } from 'express';
import { z } from 'zod';
import { audit, auth, getSettings, hasPerm, need } from '../auth';
import { q, q1, tx } from '../db';
import { ah, HttpError, isoDate, n, parse, periodOf, round2 } from '../util';

/**
 * Склад в Office: остатки с рекомендациями к закупке, журнал движения, инвентаризации и списания.
 * Остатки живут в таблицах основной системы (Insumo, MovimientoInventario) — те же, что видит касса,
 * поэтому каждая операция оставляет строку в общем журнале движения и сразу видна на кассе.
 */
export const router = Router();
router.use('/inv', auth);

export const WRITEOFF_REASONS: Record<string, string> = {
  spoilage: 'Порча', expired: 'Истёк срок годности', breakage: 'Бой / поломка', staff_meal: 'Питание персонала',
  tasting: 'Проба / дегустация', return: 'Возврат поставщику', other: 'Прочее',
};

const r6 = (v: number) => Math.round(v * 1e6) / 1e6;
const canCost = (me: Parameters<typeof hasPerm>[0]) => hasPerm(me, 'acc.view') || hasPerm(me, 'ing.cost') || hasPerm(me, 'inv.approve');

/* ───────── Остатки и рекомендации к закупке ───────── */
router.get('/inv/stock', need('inv.view'), ah(async (req, res) => {
  const rid = req.me!.rid;
  const cost = canCost(req.me!);
  const rows = await q(
    `select i.id, i.nombre, i.categoria, i.unidad, i."stockActual" as stock, i."stockMinimo" as minimo, i."costoUnitario" as costo, i.proveedor,
            coalesce((select -sum(m.cantidad) from public."MovimientoInventario" m where m."insumoId" = i.id and m.tipo = 'CONSUMO' and m."creadoEn" > now() - interval '30 days'), 0) as used30,
            (select max(m."creadoEn") from public."MovimientoInventario" m where m."insumoId" = i.id) as last_move
       from public."Insumo" i where i."restauranteId" = $1 order by lower(i.nombre)`, [rid]);
  const items = rows.map((r) => {
    const stock = n(r.stock), minimo = n(r.minimo), perDay = Math.max(0, n(r.used30)) / 30;
    const daysLeft = perDay > 0 ? Math.round((stock / perDay) * 10) / 10 : null;
    // рекомендуем довезти до запаса на 7 дней расхода (но не меньше двух минимальных остатков)
    const target = Math.max(minimo * 2, perDay * 7);
    const suggest = stock <= minimo || (daysLeft !== null && daysLeft < 3) ? Math.max(0, Math.ceil((target - stock) * 100) / 100) : 0;
    const status = stock <= 0 ? 'out' : stock <= minimo ? 'low' : daysLeft !== null && daysLeft < 3 ? 'soon' : 'ok';
    return { id: r.id, nombre: r.nombre, categoria: r.categoria, unidad: r.unidad, stock, minimo, perDay: Math.round(perDay * 1000) / 1000, daysLeft, suggest, status,
      costo: cost && r.costo !== null ? n(r.costo) : null, value: cost && r.costo !== null ? round2(stock * n(r.costo)) : null, proveedor: r.proveedor, lastMove: r.last_move };
  });
  res.json({ items, canCost: cost, totals: { count: items.length, out: items.filter((i) => i.status === 'out').length, low: items.filter((i) => i.status === 'low').length, soon: items.filter((i) => i.status === 'soon').length, value: cost ? round2(items.reduce((a, i) => a + (i.value ?? 0), 0)) : null } });
}));

/* ───────── Журнал движения ───────── */
router.get('/inv/movements', need('inv.view'), ah(async (req, res) => {
  const rid = req.me!.rid;
  const s = await getSettings(rid);
  const { from, to } = periodOf(req, s.timezone);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
  const offset = Math.max(0, Number(req.query.offset) || 0);
  const tipos = typeof req.query.tipo === 'string' && req.query.tipo ? req.query.tipo.split(',').filter((t) => ['INICIAL', 'COMPRA', 'AJUSTE', 'MERMA', 'REVISION', 'CONSUMO', 'DEVOLUCION'].includes(t)) : null;
  const insumo = typeof req.query.insumoId === 'string' && req.query.insumoId ? req.query.insumoId : null;
  const cost = canCost(req.me!);
  // Сначала выбираем операции, затем их строки: страницы не разрывают один заказ или документ.
  const rows = await q(
    `with movement as materialized (
       select m.id, m.tipo::text as tipo, m.cantidad, m.saldo, m."costoUnitario" as costo, m.motivo,
              m."creadoEn", m."insumoId", i.nombre, i.unidad, coalesce(u.nombre, st.nombre) as who,
              p.numero as pedido_numero, c.numero as compra_numero,
              case
                when m."pedidoId" is not null then m.tipo::text || ':pedido:' || m."pedidoId"
                when m."recepcionId" is not null then 'recepcion:' || m."recepcionId"
                when m."compraId" is not null then 'compra:' || m."compraId"
                when m.tipo::text in ('CONSUMO', 'DEVOLUCION') and m.motivo ~ '^№[0-9]+$' then m.tipo::text || ':legacy-pedido:' || m.motivo
                when m.tipo::text = 'MERMA' and m.motivo like 'Списание №% (Office):%' then 'office-writeoff:' || split_part(split_part(m.motivo, ' (Office)', 1), '№', 2)
                when m.tipo::text = 'REVISION' and m.motivo like 'Инвентаризация №% (Office):%' then 'office-stocktake:' || split_part(split_part(m.motivo, ' (Office)', 1), '№', 2)
                else 'movement:' || m.id
              end as group_key
         from public."MovimientoInventario" m
         join public."Insumo" i on i.id = m."insumoId"
         left join public."Usuario" u on u.id = m."usuarioId"
         left join office.staff st on st.id = m."usuarioId"
         left join public."Pedido" p on p.id = m."pedidoId" and p."restauranteId" = $1
         left join public."Compra" c on c.id = m."compraId" and c."restauranteId" = $1
        where m."restauranteId" = $1
          and m."creadoEn" >= (($2::date)::timestamp at time zone $5) at time zone 'UTC'
          and m."creadoEn" < (($3::date + 1)::timestamp at time zone $5) at time zone 'UTC'
          and ($4::text[] is null or m.tipo::text = any($4))
          and ($6::text is null or m."insumoId" = $6)
     ), grouped as (
       select group_key, max("creadoEn") as at, count(*)::int as line_count,
              bool_and(costo is not null) as cost_complete,
              sum(abs(cantidad) * costo) as amount
         from movement group by group_key
     ), page as (
       select *, count(*) over() as total from grouped
        order by at desc, group_key desc limit $7 offset $8
     )
     select page.group_key, (page.at at time zone 'UTC') as group_at, page.line_count, page.cost_complete, page.amount, page.total,
            m.id, m.tipo, m.cantidad, m.saldo, m.costo, m.motivo,
            (m."creadoEn" at time zone 'UTC') as line_at, m."insumoId" as insumo_id,
            m.nombre, m.unidad, m.who, m.pedido_numero, m.compra_numero
       from page join movement m on m.group_key = page.group_key
      order by page.at desc, page.group_key desc, m."creadoEn" desc, m.id desc`,
    [rid, from, to, tipos, s.timezone, insumo, limit, offset]);
  const groups = new Map<string, { key: string; at: string; tipo: string; motivo: string | null; who: string | null; pedidoNumero: number | null; compraNumero: number | null; lineCount: number; amount: number | null; lines: unknown[] }>();
  for (const r of rows) {
    let group = groups.get(r.group_key);
    if (!group) {
      group = { key: r.group_key, at: r.group_at.toISOString(), tipo: r.tipo, motivo: r.motivo, who: r.who,
        pedidoNumero: r.pedido_numero, compraNumero: r.compra_numero, lineCount: Number(r.line_count),
        amount: cost && r.cost_complete ? round2(n(r.amount)) : null, lines: [] };
      groups.set(r.group_key, group);
    }
    group.lines.push({ id: r.id, nombre: r.nombre, unidad: r.unidad, cantidad: n(r.cantidad), saldo: n(r.saldo),
      costo: cost && r.costo !== null ? n(r.costo) : null, at: r.line_at.toISOString(), motivo: r.motivo });
  }
  res.json({ from, to, timezone: s.timezone, total: rows[0] ? Number(rows[0].total) : 0, canCost: cost, groups: [...groups.values()] });
}));

/* ───────── Инвентаризация ───────── */
router.get('/inv/stocktakes', need('inv.view'), ah(async (req, res) => {
  const rows = await q(
    `select s.id, s.number, s.title, s.status, s.scope, s.created_by_name, s.created_at, s.closed_at, s.closed_by_name, s.shortage_value, s.surplus_value,
            (select count(*)::int from office.stocktake_line l where l.stocktake_id = s.id) as total,
            (select count(*)::int from office.stocktake_line l where l.stocktake_id = s.id and l.actual_qty is not null) as counted,
            (select count(*)::int from office.stocktake_line l where l.stocktake_id = s.id and l.actual_qty is not null and l.actual_qty <> l.book_qty) as diffs
       from office.stocktake s where s.restaurante_id = $1 order by s.created_at desc limit 300`, [req.me!.rid]);
  const cost = canCost(req.me!);
  res.json(rows.map((r) => ({ ...r, shortage_value: cost && r.shortage_value !== null ? n(r.shortage_value) : null, surplus_value: cost && r.surplus_value !== null ? n(r.surplus_value) : null })));
}));

router.post('/inv/stocktakes', need('inv.edit'), ah(async (req, res) => {
  const b = parse(z.object({ title: z.string().trim().min(2, 'Укажите название').max(120), note: z.string().trim().max(500).nullish(), category: z.string().trim().max(80).nullish() }), req.body);
  const rid = req.me!.rid;
  const open = await q1('select number from office.stocktake where restaurante_id = $1 and status = \'draft\' limit 1', [rid]);
  if (open) throw new HttpError(409, `Уже есть незавершённая инвентаризация №${open.number} — закройте или отмените её`);
  const id = await tx(async (c) => {
    const st = (await c.query(`insert into office.stocktake (restaurante_id, title, note, scope, created_by, created_by_name) values ($1,$2,$3,$4,$5,$6) returning id`, [rid, b.title, b.note ?? null, b.category ?? null, req.me!.id, req.me!.name])).rows[0];
    const ins = await c.query(
      `insert into office.stocktake_line (stocktake_id, insumo_id, nombre, unidad, categoria, book_qty, cost)
       select $1, i.id, i.nombre, i.unidad, i.categoria, i."stockActual", i."costoUnitario" from public."Insumo" i
        where i."restauranteId" = $2 and ($3::text is null or i.categoria = $3)`, [st.id, rid, b.category ?? null]);
    if (!ins.rowCount) throw new HttpError(400, 'Нет позиций сырья для инвентаризации');
    return st.id as string;
  });
  await audit(req, 'stocktake.create', 'stocktake', id, { title: b.title, scope: b.category ?? null });
  res.status(201).json({ id });
}));

async function loadStocktake(rid: string, id: string, me: Parameters<typeof hasPerm>[0]) {
  const st = await q1('select * from office.stocktake where id = $1 and restaurante_id = $2', [id, rid]);
  if (!st) throw new HttpError(404, 'Инвентаризация не найдена');
  const cost = canCost(me);
  const lines = await q('select insumo_id, nombre, unidad, categoria, book_qty, actual_qty, cost, applied_delta from office.stocktake_line where stocktake_id = $1 order by lower(categoria), lower(nombre)', [id]);
  return {
    ...st, shortage_value: cost && st.shortage_value !== null ? n(st.shortage_value) : null, surplus_value: cost && st.surplus_value !== null ? n(st.surplus_value) : null, canCost: cost,
    lines: lines.map((l) => ({ insumoId: l.insumo_id, nombre: l.nombre, unidad: l.unidad, categoria: l.categoria, book: n(l.book_qty), actual: l.actual_qty === null ? null : n(l.actual_qty), cost: cost && l.cost !== null ? n(l.cost) : null, applied: l.applied_delta === null ? null : n(l.applied_delta) })),
  };
}

router.get('/inv/stocktakes/:id', need('inv.view'), ah(async (req, res) => { res.json(await loadStocktake(req.me!.rid, req.params.id, req.me!)); }));

router.put('/inv/stocktakes/:id/lines', need('inv.edit'), ah(async (req, res) => {
  const b = parse(z.object({ lines: z.array(z.object({ insumoId: z.string().min(1), actual: z.number().min(0, 'Остаток не может быть отрицательным').max(1e9).nullable() })).min(1).max(2000) }), req.body);
  const st = await q1<{ status: string }>('select status from office.stocktake where id = $1 and restaurante_id = $2', [req.params.id, req.me!.rid]);
  if (!st) throw new HttpError(404, 'Инвентаризация не найдена');
  if (st.status !== 'draft') throw new HttpError(409, 'Инвентаризация уже закрыта');
  await tx(async (c) => {
    for (const l of b.lines) await c.query('update office.stocktake_line set actual_qty = $3 where stocktake_id = $1 and insumo_id = $2', [req.params.id, l.insumoId, l.actual === null ? null : r6(l.actual)]);
  });
  res.json({ ok: true });
}));

router.post('/inv/stocktakes/:id/close', need('inv.approve'), ah(async (req, res) => {
  const rid = req.me!.rid;
  const out = await tx(async (c) => {
    const st = (await c.query('select * from office.stocktake where id = $1 and restaurante_id = $2 for update', [req.params.id, rid])).rows[0];
    if (!st) throw new HttpError(404, 'Инвентаризация не найдена');
    if (st.status !== 'draft') throw new HttpError(409, 'Инвентаризация уже закрыта');
    const lines = (await c.query('select * from office.stocktake_line where stocktake_id = $1 and actual_qty is not null order by insumo_id', [st.id])).rows;
    let shortage = 0, surplus = 0, applied = 0;
    for (const l of lines) {
      const delta = r6(n(l.actual_qty) - n(l.book_qty));   // разница относительно остатка на начало подсчёта
      if (delta === 0) { await c.query('update office.stocktake_line set applied_delta = 0 where stocktake_id = $1 and insumo_id = $2', [st.id, l.insumo_id]); continue; }
      const cost = l.cost === null ? 0 : n(l.cost);
      if (delta < 0) shortage += -delta * cost; else surplus += delta * cost;
      // дельта прибавляется к ТЕКУЩЕМУ остатку: продажи за время подсчёта не затираются
      const cur = (await c.query('select "stockActual" as s, "costoUnitario" as cost from public."Insumo" where id = $1 and "restauranteId" = $2 for update', [l.insumo_id, rid])).rows[0];
      if (!cur) continue;
      const next = Math.max(0, r6(n(cur.s) + delta));
      const real = r6(next - n(cur.s));
      await c.query('update public."Insumo" set "stockActual" = $2, "actualizadoEn" = now() where id = $1', [l.insumo_id, next]);
      if (real !== 0) {
        await c.query(`insert into public."MovimientoInventario" (id, "restauranteId", "insumoId", tipo, cantidad, saldo, "costoUnitario", motivo, "usuarioId") values ('mov-' || gen_random_uuid()::text, $1, $2, 'REVISION', $3, $4, $5, $6, $7)`,
          [rid, l.insumo_id, real, next, cur.cost, `Инвентаризация №${st.number} (Office): ${st.title}`, req.me!.id]);
      }
      await c.query('update office.stocktake_line set applied_delta = $3 where stocktake_id = $1 and insumo_id = $2', [st.id, l.insumo_id, real]);
      applied++;
    }
    await c.query(`update office.stocktake set status = 'closed', closed_at = now(), closed_by_name = $2, shortage_value = $3, surplus_value = $4, lines_applied = $5 where id = $1`, [st.id, req.me!.name, round2(shortage), round2(surplus), applied]);
    return { applied, shortage: round2(shortage), surplus: round2(surplus), counted: lines.length };
  });
  await audit(req, 'stocktake.close', 'stocktake', req.params.id, out);
  res.json(out);
}));

router.post('/inv/stocktakes/:id/cancel', need('inv.edit'), ah(async (req, res) => {
  const r = await q('update office.stocktake set status = \'cancelled\' where id = $1 and restaurante_id = $2 and status = \'draft\' returning id', [req.params.id, req.me!.rid]);
  if (!r.length) throw new HttpError(409, 'Отменить можно только незавершённую инвентаризацию');
  await audit(req, 'stocktake.cancel', 'stocktake', req.params.id);
  res.json({ ok: true });
}));

/* ───────── Списания ───────── */
const lineSchema = z.object({ insumoId: z.string().min(1), qty: z.number().positive('Количество должно быть больше нуля').max(1e9) });
const writeoffBody = z.object({
  date: isoDate, reason: z.enum(['spoilage', 'expired', 'breakage', 'staff_meal', 'tasting', 'return', 'other']), note: z.string().trim().max(500).nullish(),
  lines: z.array(lineSchema).min(1, 'Добавьте хотя бы одну позицию').max(300), approve: z.boolean().optional(),
});

router.get('/inv/writeoffs', need('inv.view'), ah(async (req, res) => {
  const s = await getSettings(req.me!.rid);
  const { from, to } = periodOf(req, s.timezone);
  const cost = canCost(req.me!);
  const rows = await q(
    `select w.id, w.number, w.date, w.reason, w.note, w.status, w.total_cost, w.created_by_name, w.approved_by_name, w.approved_at,
            (select count(*)::int from office.writeoff_line l where l.writeoff_id = w.id) as lines
       from office.writeoff w where w.restaurante_id = $1 and w.date between $2::date and $3::date order by w.date desc, w.number desc`, [req.me!.rid, from, to]);
  const list = rows.map((r) => ({ ...r, reasonLabel: WRITEOFF_REASONS[r.reason], total_cost: cost ? n(r.total_cost) : null }));
  const byReason = new Map<string, number>();
  for (const r of list) if (r.status === 'approved') byReason.set(r.reason, (byReason.get(r.reason) ?? 0) + n(r.total_cost));
  res.json({ from, to, canCost: cost, rows: list, total: cost ? round2(list.filter((r) => r.status === 'approved').reduce((a, r) => a + n(r.total_cost), 0)) : null,
    byReason: cost ? [...byReason].map(([reason, total]) => ({ reason, label: WRITEOFF_REASONS[reason], total: round2(total) })).sort((a, b) => b.total - a.total) : [] });
}));

async function loadWriteoff(rid: string, id: string, me: Parameters<typeof hasPerm>[0]) {
  const w = await q1('select * from office.writeoff where id = $1 and restaurante_id = $2', [id, rid]);
  if (!w) throw new HttpError(404, 'Списание не найдено');
  const cost = canCost(me);
  const lines = await q(`select l.id, l.insumo_id, l.nombre, l.unidad, l.qty, coalesce(l.cost, i."costoUnitario") as cost, i."stockActual" as stock
                           from office.writeoff_line l left join public."Insumo" i on i.id = l.insumo_id where l.writeoff_id = $1 order by lower(l.nombre)`, [id]);
  return { ...w, reasonLabel: WRITEOFF_REASONS[w.reason], total_cost: cost ? n(w.total_cost) : null, canCost: cost,
    lines: lines.map((l) => ({ id: l.id, insumoId: l.insumo_id, nombre: l.nombre, unidad: l.unidad, qty: n(l.qty), cost: cost && l.cost !== null ? n(l.cost) : null, stock: l.stock === null ? null : n(l.stock) })) };
}

router.get('/inv/writeoffs/:id', need('inv.view'), ah(async (req, res) => { res.json(await loadWriteoff(req.me!.rid, req.params.id, req.me!)); }));

async function saveLines(c: { query: (t: string, v?: unknown[]) => Promise<{ rows: any[] }> }, rid: string, wid: string, lines: z.infer<typeof lineSchema>[]) {
  await c.query('delete from office.writeoff_line where writeoff_id = $1', [wid]);
  const merged = new Map<string, number>();
  for (const l of lines) merged.set(l.insumoId, (merged.get(l.insumoId) ?? 0) + l.qty);
  for (const [insumoId, qty] of merged) {
    const i = (await c.query('select nombre, unidad, "costoUnitario" as cost from public."Insumo" where id = $1 and "restauranteId" = $2', [insumoId, rid])).rows[0];
    if (!i) throw new HttpError(400, 'Позиция сырья не найдена');
    await c.query('insert into office.writeoff_line (writeoff_id, insumo_id, nombre, unidad, qty, cost) values ($1,$2,$3,$4,$5,$6)', [wid, insumoId, i.nombre, i.unidad, r6(qty), i.cost]);
  }
}

/** Проведение: уменьшает остатки на складе и пишет в общий журнал строки MERMA. Всё или ничего. */
async function approveWriteoff(c: { query: (t: string, v?: unknown[]) => Promise<{ rows: any[] }> }, rid: string, wid: string, me: { id: string; name: string }) {
  const w = (await c.query('select * from office.writeoff where id = $1 and restaurante_id = $2 for update', [wid, rid])).rows[0];
  if (!w) throw new HttpError(404, 'Списание не найдено');
  if (w.status !== 'draft') throw new HttpError(409, 'Списание уже проведено или отменено');
  const lines = (await c.query('select * from office.writeoff_line where writeoff_id = $1 order by insumo_id', [wid])).rows;
  if (!lines.length) throw new HttpError(400, 'В списании нет позиций');
  let total = 0;
  const short: string[] = [];
  for (const l of lines) {
    const r = (await c.query(
      `update public."Insumo" set "stockActual" = "stockActual" - $3::numeric, "actualizadoEn" = now()
        where id = $1 and "restauranteId" = $2 and "stockActual" - $3::numeric >= 0 returning "stockActual" as saldo, "costoUnitario" as cost`, [l.insumo_id, rid, l.qty])).rows[0];
    if (!r) { short.push(l.nombre); continue; }
    total += n(l.qty) * (r.cost === null ? 0 : n(r.cost));
    await c.query(`insert into public."MovimientoInventario" (id, "restauranteId", "insumoId", tipo, cantidad, saldo, "costoUnitario", motivo, "usuarioId") values ('mov-' || gen_random_uuid()::text, $1, $2, 'MERMA', $3, $4, $5, $6, $7)`,
      [rid, l.insumo_id, -n(l.qty), r.saldo, r.cost, `Списание №${w.number} (Office): ${WRITEOFF_REASONS[w.reason]}${w.note ? ' — ' + w.note : ''}`, me.id]);
    await c.query('update office.writeoff_line set cost = $2 where id = $1', [l.id, r.cost]);
  }
  if (short.length) throw new HttpError(409, `Недостаточно остатка: ${short.join(', ')}`);
  await c.query(`update office.writeoff set status = 'approved', approved_at = now(), approved_by_name = $2, total_cost = $3 where id = $1`, [wid, me.name, round2(total)]);
  return { total: round2(total), number: w.number };
}

router.post('/inv/writeoffs', need('inv.edit'), ah(async (req, res) => {
  const b = parse(writeoffBody, req.body);
  const rid = req.me!.rid;
  if (b.approve && !hasPerm(req.me!, 'inv.approve')) throw new HttpError(403, 'Проводить списания может только утверждающий');
  const out = await tx(async (c) => {
    const w = (await c.query('insert into office.writeoff (restaurante_id, date, reason, note, created_by, created_by_name) values ($1,$2,$3,$4,$5,$6) returning id, number', [rid, b.date, b.reason, b.note ?? null, req.me!.id, req.me!.name])).rows[0];
    await saveLines(c, rid, w.id, b.lines);
    if (b.approve) await approveWriteoff(c, rid, w.id, req.me!);
    return w;
  });
  await audit(req, b.approve ? 'writeoff.approve' : 'writeoff.create', 'writeoff', out.id, { reason: b.reason, lines: b.lines.length });
  res.status(201).json({ id: out.id, number: out.number });
}));

router.put('/inv/writeoffs/:id', need('inv.edit'), ah(async (req, res) => {
  const b = parse(writeoffBody.omit({ approve: true }), req.body);
  await tx(async (c) => {
    const w = (await c.query('select status from office.writeoff where id = $1 and restaurante_id = $2 for update', [req.params.id, req.me!.rid])).rows[0];
    if (!w) throw new HttpError(404, 'Списание не найдено');
    if (w.status !== 'draft') throw new HttpError(409, 'Проведённое списание изменить нельзя');
    await c.query('update office.writeoff set date = $2, reason = $3, note = $4 where id = $1', [req.params.id, b.date, b.reason, b.note ?? null]);
    await saveLines(c, req.me!.rid, req.params.id, b.lines);
  });
  await audit(req, 'writeoff.update', 'writeoff', req.params.id);
  res.json({ ok: true });
}));

router.post('/inv/writeoffs/:id/approve', need('inv.approve'), ah(async (req, res) => {
  const out = await tx((c) => approveWriteoff(c, req.me!.rid, req.params.id, req.me!));
  await audit(req, 'writeoff.approve', 'writeoff', req.params.id, out);
  res.json(out);
}));

router.post('/inv/writeoffs/:id/cancel', need('inv.edit'), ah(async (req, res) => {
  const r = await q('update office.writeoff set status = \'cancelled\' where id = $1 and restaurante_id = $2 and status = \'draft\' returning id', [req.params.id, req.me!.rid]);
  if (!r.length) throw new HttpError(409, 'Отменить можно только непроведённое списание');
  await audit(req, 'writeoff.cancel', 'writeoff', req.params.id);
  res.json({ ok: true });
}));
