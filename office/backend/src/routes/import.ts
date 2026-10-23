import { Router } from 'express';
import { z } from 'zod';
import { audit, auth, hasPerm } from '../auth';
import { q, tx } from '../db';
import type { Perm } from '../perms';
import { ah, HttpError, n, parse } from '../util';

/**
 * Импорт из Excel/CSV: сырьё, цены сырья, поставщики, цены меню. Файл разбирается в браузере, сюда приходят строки.
 * «Проверить» ничего не меняет и показывает, что произойдёт с каждой строкой; «Применить» выполняет всё в одной транзакции.
 */
export const router = Router();
router.use('/import', auth);

type Status = 'create' | 'update' | 'same' | 'error';
interface Result { row: number; name: string; status: Status; changes: string[]; error?: string; warning?: string }
type Raw = Record<string, string | number | null | undefined>;

const MAX_ROWS = 2000;
const clean = (v: unknown, max = 200): string | null => { const s = v === null || v === undefined ? '' : String(v).trim(); return s ? s.slice(0, max) : null; };
function num(v: unknown): number | null | 'bad' {
  if (v === null || v === undefined || String(v).trim() === '') return null;
  const x = Number(String(v).replace(/[\s ]/g, '').replace(',', '.'));
  return Number.isFinite(x) && x >= 0 && x < 1e12 ? x : 'bad';
}
const same = (a: number | null, b: number | null) => (a === null && b === null) || (a !== null && b !== null && Math.abs(a - b) < 0.0005);

const TYPES = {
  ingredients: { perm: 'ing.edit' as Perm, label: 'Сырьё' },
  prices: { perm: 'ing.cost' as Perm, label: 'Цены сырья' },
  suppliers: { perm: 'sup.edit' as Perm, label: 'Поставщики' },
  'menu-prices': { perm: 'menu.edit' as Perm, label: 'Цены меню' },
};
type Kind = keyof typeof TYPES;

type Ctx = { rid: string; me: NonNullable<Express.Request['me']>; apply: boolean; c?: { query: (t: string, v?: unknown[]) => Promise<{ rows: any[] }> } };
const exec = (ctx: Ctx, text: string, values: unknown[]) => (ctx.c ? ctx.c.query(text, values).then((r) => r.rows) : q(text, values));

/* ───────── Сырьё ───────── */
async function ingredients(ctx: Ctx, rows: Raw[]): Promise<Result[]> {
  const existing = await q(`select id, nombre, categoria, unidad, "stockMinimo" as minimo, "costoUnitario" as costo, proveedor from public."Insumo" where "restauranteId" = $1`, [ctx.rid]);
  const byName = new Map(existing.map((e) => [String(e.nombre).toLowerCase(), e]));
  const seen = new Set<string>();
  const canCost = hasPerm(ctx.me, 'ing.cost');
  const out: Result[] = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i], name = clean(r.nombre, 120), res: Result = { row: i + 2, name: name ?? '', status: 'same', changes: [] };
    out.push(res);
    if (!name) { res.status = 'error'; res.error = 'Не указано название'; continue; }
    if (seen.has(name.toLowerCase())) { res.status = 'error'; res.error = 'Повтор названия в файле'; continue; }
    seen.add(name.toLowerCase());
    const unidad = clean(r.unidad, 20), categoria = clean(r.categoria, 60), proveedor = clean(r.proveedor, 80);
    const minimo = num(r.stockMinimo), costo = num(r.costoUnitario), stock = num(r.stock);
    if (minimo === 'bad' || costo === 'bad' || stock === 'bad') { res.status = 'error'; res.error = 'Число указано неверно (минимум, цена или остаток)'; continue; }
    const cur = byName.get(name.toLowerCase());
    if (costo !== null && !canCost) res.warning = 'Цена пропущена: у вас нет права менять цены сырья';
    const useCost = canCost ? costo : null;
    if (!cur) {
      if (!unidad) { res.status = 'error'; res.error = 'Для нового сырья нужна единица измерения'; continue; }
      res.status = 'create'; res.changes = [`единица ${unidad}`, ...(categoria ? [`категория ${categoria}`] : []), ...(useCost !== null ? [`цена ${useCost}`] : []), ...(stock ? [`остаток ${stock}`] : [])];
      if (ctx.apply) {
        const id = (await exec(ctx, `insert into public."Insumo" (id, nombre, categoria, unidad, "stockActual", "stockMinimo", "costoUnitario", proveedor, "restauranteId", "creadoEn", "actualizadoEn")
                                     values ('ins-' || gen_random_uuid()::text, $1,$2,$3,$4,$5,$6,$7,$8,now(),now()) returning id`, [name, categoria, unidad, stock ?? 0, minimo ?? 0, useCost, proveedor, ctx.rid]))[0].id;
        if (stock && stock > 0) await exec(ctx, `insert into public."MovimientoInventario" (id, "restauranteId", "insumoId", tipo, cantidad, saldo, "costoUnitario", motivo, "usuarioId") values ('mov-' || gen_random_uuid()::text, $1,$2,'INICIAL',$3,$3,$4,$5,$6)`,
          [ctx.rid, id, stock, useCost, 'Импорт из файла (Office)', ctx.me.id]);
      }
      continue;
    }
    const ch: string[] = [], set: Record<string, unknown> = {};
    if (unidad && unidad !== cur.unidad) { ch.push(`единица ${cur.unidad} → ${unidad}`); set.unidad = unidad; }
    if (categoria && categoria !== cur.categoria) { ch.push(`категория → ${categoria}`); set.categoria = categoria; }
    if (proveedor && proveedor !== cur.proveedor) { ch.push(`поставщик → ${proveedor}`); set.proveedor = proveedor; }
    if (minimo !== null && !same(minimo, n(cur.minimo))) { ch.push(`минимум ${n(cur.minimo)} → ${minimo}`); set.stockMinimo = minimo; }
    if (useCost !== null && !same(useCost, cur.costo === null ? null : n(cur.costo))) { ch.push(`цена ${cur.costo === null ? '—' : n(cur.costo)} → ${useCost}`); set.costoUnitario = useCost; }
    if (stock) res.warning = (res.warning ? res.warning + '. ' : '') + 'Остаток существующего сырья не меняется (для этого — инвентаризация)';
    if (!ch.length) continue;
    res.status = 'update'; res.changes = ch;
    if (ctx.apply) {
      const cols = Object.keys(set);
      await exec(ctx, `update public."Insumo" set ${cols.map((k, j) => `"${k}" = $${j + 2}`).join(', ')}, "actualizadoEn" = now() where id = $1`, [cur.id, ...cols.map((k) => set[k])]);
    }
  }
  return out;
}

/* ───────── Цены сырья ───────── */
async function prices(ctx: Ctx, rows: Raw[]): Promise<Result[]> {
  const existing = await q(`select id, nombre, "costoUnitario" as costo from public."Insumo" where "restauranteId" = $1`, [ctx.rid]);
  const byName = new Map(existing.map((e) => [String(e.nombre).toLowerCase(), e]));
  const seen = new Set<string>();
  const out: Result[] = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i], name = clean(r.nombre, 120), res: Result = { row: i + 2, name: name ?? '', status: 'same', changes: [] };
    out.push(res);
    if (!name) { res.status = 'error'; res.error = 'Не указано название'; continue; }
    if (seen.has(name.toLowerCase())) { res.status = 'error'; res.error = 'Повтор названия в файле'; continue; }
    seen.add(name.toLowerCase());
    const costo = num(r.costoUnitario);
    if (costo === 'bad' || costo === null) { res.status = 'error'; res.error = 'Цена не указана или указана неверно'; continue; }
    const cur = byName.get(name.toLowerCase());
    if (!cur) { res.status = 'error'; res.error = 'Такого сырья нет в справочнике'; continue; }
    if (cur.costo !== null && same(costo, n(cur.costo))) continue;
    res.status = 'update'; res.changes = [`цена ${cur.costo === null ? '—' : n(cur.costo)} → ${costo}`];
    if (ctx.apply) await exec(ctx, `update public."Insumo" set "costoUnitario" = $2, "actualizadoEn" = now() where id = $1`, [cur.id, costo]);
  }
  return out;
}

/* ───────── Поставщики ───────── */
async function suppliers(ctx: Ctx, rows: Raw[]): Promise<Result[]> {
  const existing = await q(`select p.id, p.nombre, p.contacto, p.telefono, p.email, e.bin, e.address, e.category, e.payment_days from public."Proveedor" p left join office.supplier_ext e on e.proveedor_id = p.id where p."restauranteId" = $1`, [ctx.rid]);
  const byName = new Map(existing.map((e) => [String(e.nombre).toLowerCase(), e]));
  const seen = new Set<string>();
  const out: Result[] = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i], name = clean(r.nombre, 120), res: Result = { row: i + 2, name: name ?? '', status: 'same', changes: [] };
    out.push(res);
    if (!name || name.length < 2) { res.status = 'error'; res.error = 'Не указано название'; continue; }
    if (seen.has(name.toLowerCase())) { res.status = 'error'; res.error = 'Повтор названия в файле'; continue; }
    seen.add(name.toLowerCase());
    const f = { contacto: clean(r.contacto, 120), telefono: clean(r.telefono, 40), email: clean(r.email, 120), bin: clean(r.bin, 20), address: clean(r.address, 200), category: clean(r.category, 60) };
    const days = num(r.paymentDays);
    if (days === 'bad' || (days !== null && (!Number.isInteger(days) || days > 365))) { res.status = 'error'; res.error = 'Отсрочка — целое число дней от 0 до 365'; continue; }
    if (f.email && !z.string().email().safeParse(f.email).success) { res.status = 'error'; res.error = 'Некорректный email'; continue; }
    const cur = byName.get(name.toLowerCase());
    const ch: string[] = [];
    if (!cur) {
      res.status = 'create'; res.changes = Object.entries(f).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`);
      if (ctx.apply) {
        const id = (await exec(ctx, `insert into public."Proveedor" (id, nombre, contacto, telefono, email, activo, "restauranteId") values ('prov-' || gen_random_uuid()::text, $1,$2,$3,$4,true,$5) returning id`, [name, f.contacto, f.telefono, f.email, ctx.rid]))[0].id;
        await exec(ctx, `insert into office.supplier_ext (proveedor_id, restaurante_id, bin, address, payment_days, category) values ($1,$2,$3,$4,$5,$6) on conflict (proveedor_id) do nothing`, [id, ctx.rid, f.bin, f.address, days, f.category]);
      }
      continue;
    }
    const upd: Record<string, [string, unknown]> = {};
    for (const [k, v] of Object.entries(f)) if (v && v !== (cur[k] ?? null)) { ch.push(`${k} → ${v}`); upd[k] = [k, v]; }
    if (days !== null && days !== cur.payment_days) { ch.push(`отсрочка → ${days}`); upd.payment_days = ['payment_days', days]; }
    if (!ch.length) continue;
    res.status = 'update'; res.changes = ch;
    if (ctx.apply) {
      await exec(ctx, `update public."Proveedor" set contacto = coalesce($2, contacto), telefono = coalesce($3, telefono), email = coalesce($4, email) where id = $1`, [cur.id, f.contacto, f.telefono, f.email]);
      await exec(ctx, `insert into office.supplier_ext (proveedor_id, restaurante_id, bin, address, payment_days, category) values ($1,$2,$3,$4,$5,$6)
                       on conflict (proveedor_id) do update set bin = coalesce($3, office.supplier_ext.bin), address = coalesce($4, office.supplier_ext.address), payment_days = coalesce($5, office.supplier_ext.payment_days), category = coalesce($6, office.supplier_ext.category), updated_at = now()`,
        [cur.id, ctx.rid, f.bin, f.address, days, f.category]);
    }
  }
  return out;
}

/* ───────── Цены меню ───────── */
async function menuPrices(ctx: Ctx, rows: Raw[]): Promise<Result[]> {
  const existing = await q(`select id, nombre, precio from public."Producto" where "restauranteId" = $1`, [ctx.rid]);
  const byName = new Map(existing.map((e) => [String(e.nombre).toLowerCase(), e]));
  const seen = new Set<string>();
  const out: Result[] = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i], name = clean(r.nombre, 120), res: Result = { row: i + 2, name: name ?? '', status: 'same', changes: [] };
    out.push(res);
    if (!name) { res.status = 'error'; res.error = 'Не указано название'; continue; }
    if (seen.has(name.toLowerCase())) { res.status = 'error'; res.error = 'Повтор названия в файле'; continue; }
    seen.add(name.toLowerCase());
    const precio = num(r.precio);
    if (precio === 'bad' || precio === null) { res.status = 'error'; res.error = 'Цена не указана или указана неверно'; continue; }
    const cur = byName.get(name.toLowerCase());
    if (!cur) { res.status = 'error'; res.error = 'Такого блюда нет в меню'; continue; }
    if (same(precio, n(cur.precio))) continue;
    res.status = 'update'; res.changes = [`цена ${n(cur.precio)} → ${precio}`];
    if (ctx.apply) {
      await exec(ctx, 'update public."Producto" set precio = $2 where id = $1', [cur.id, precio]);
      await exec(ctx, 'insert into office.price_history (restaurante_id, producto_id, producto_name, old_price, new_price, reason, changed_by, changed_by_name) values ($1,$2,$3,$4,$5,$6,$7,$8)',
        [ctx.rid, cur.id, cur.nombre, n(cur.precio), precio, 'Импорт из файла', ctx.me.id, ctx.me.name]);
    }
  }
  return out;
}

const RUN: Record<Kind, (ctx: Ctx, rows: Raw[]) => Promise<Result[]>> = { ingredients, prices, suppliers, 'menu-prices': menuPrices };

const bodySchema = z.object({ rows: z.array(z.record(z.union([z.string(), z.number(), z.null()]))).min(1, 'В файле нет строк с данными').max(MAX_ROWS, `Не больше ${MAX_ROWS} строк за раз`) });

function kindOf(req: { params: Record<string, string>; me?: NonNullable<Express.Request['me']> }): Kind {
  const k = req.params.type as Kind;
  if (!TYPES[k]) throw new HttpError(404, 'Неизвестный тип импорта');
  if (!hasPerm(req.me!, TYPES[k].perm)) throw new HttpError(403, 'Недостаточно прав для этого импорта');
  return k;
}

router.post('/import/:type/preview', ah(async (req, res) => {
  const k = kindOf(req as never);
  const b = parse(bodySchema, req.body);
  const results = await RUN[k]({ rid: req.me!.rid, me: req.me!, apply: false }, b.rows);
  const cnt = (s: Status) => results.filter((r) => r.status === s).length;
  res.json({ results, summary: { create: cnt('create'), update: cnt('update'), same: cnt('same'), error: cnt('error') } });
}));

router.post('/import/:type/commit', ah(async (req, res) => {
  const k = kindOf(req as never);
  const b = parse(bodySchema, req.body);
  const rid = req.me!.rid, me = req.me!;
  // строки с ошибками пропускаются, остальные применяются одной транзакцией
  const pre = await RUN[k]({ rid, me, apply: false }, b.rows);
  const okRows = b.rows.filter((_, i) => pre[i].status !== 'error');
  const results = await tx((c) => RUN[k]({ rid, me, apply: true, c }, okRows));
  const cnt = (s: Status) => results.filter((r) => r.status === s).length;
  await audit(req, 'import.' + k, 'import', null, { created: cnt('create'), updated: cnt('update'), skippedErrors: pre.length - okRows.length });
  res.json({ summary: { create: cnt('create'), update: cnt('update'), same: cnt('same'), error: pre.length - okRows.length } });
}));
