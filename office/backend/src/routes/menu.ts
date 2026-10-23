import { Router } from 'express';
import { z } from 'zod';
import { audit, auth, getSettings, hasPerm, need } from '../auth';
import { loadModel } from '../cost';
import { q, q1, tx } from '../db';
import { soldProducts } from '../reports';
import { ah, HttpError, n, parse, periodOf, round2 } from '../util';

/**
 * Меню и цены. Блюда и категории — таблицы основной системы (Producto, Categoria): изменения сразу видны на кассе.
 * Каждое изменение цены пишется в историю. Маржинальность — по методу «меню-инжиниринг»:
 * популярность блюда × вклад в прибыль → звёзды, рабочие лошадки, загадки, балласт.
 */
export const router = Router();
router.use('/mn', auth);

const canCost = (me: Parameters<typeof hasPerm>[0]) => hasPerm(me, 'ing.cost') || hasPerm(me, 'tc.edit') || hasPerm(me, 'acc.view');

export const CLASS_LABEL: Record<string, string> = { star: 'Звезда', horse: 'Рабочая лошадка', puzzle: 'Загадка', dog: 'Балласт', no_card: 'Нет техкарты', no_sales: 'Нет продаж' };

/* ───────── Блюда с себестоимостью, продажами и классом ───────── */
router.get('/mn/items', need('menu.view'), ah(async (req, res) => {
  const rid = req.me!.rid;
  const s = await getSettings(rid);
  const { from, to } = periodOf(req, s.timezone);
  const cost = canCost(req.me!);
  const [model, sold, cats] = await Promise.all([
    loadModel(rid), soldProducts(rid, s.timezone, from, to),
    q('select id, nombre from public."Categoria" where "restauranteId" = $1 order by lower(nombre)', [rid]),
  ]);
  const soldBy = new Map(sold.map((x) => [x.id, x]));
  const catName = new Map(cats.map((c) => [c.id as string, c.nombre as string]));
  const base = [...model.productos.values()].map((p) => {
    const c = model.costOf(p.id);
    const sl = soldBy.get(p.id);
    const unitCost = c.hasCard ? c.costo : null;
    return { id: p.id, nombre: p.nombre, categoriaId: p.categoriaId, categoria: catName.get(p.categoriaId) ?? '—', precio: p.precio, disponible: p.disponible, descripcion: p.descripcion,
      hasCard: c.hasCard, incompleto: c.incompleto, unitCost, qty: sl?.qty ?? 0, revenue: round2(sl?.revenue ?? 0) };
  });
  // меню-инжиниринг: порог популярности = 70% от равной доли; средний вклад — взвешенный по продажам
  const withData = base.filter((b) => b.hasCard && b.qty > 0);
  const totalQty = withData.reduce((a, b) => a + b.qty, 0);
  const popThr = withData.length ? (1 / withData.length) * 0.7 : 0;
  const avgCm = totalQty ? withData.reduce((a, b) => a + (b.precio - (b.unitCost ?? 0)) * b.qty, 0) / totalQty : 0;
  const items = base.map((b) => {
    const cm = b.unitCost === null ? null : round2(b.precio - b.unitCost);
    const marginPct = b.unitCost === null || b.precio <= 0 ? null : round2((1 - b.unitCost / b.precio) * 100);
    let cls: string;
    if (!b.hasCard) cls = 'no_card'; else if (b.qty === 0) cls = 'no_sales';
    else { const pop = totalQty ? b.qty / totalQty : 0; const hiPop = pop >= popThr, hiCm = (cm ?? 0) >= avgCm; cls = hiPop && hiCm ? 'star' : hiPop ? 'horse' : hiCm ? 'puzzle' : 'dog'; }
    return { ...b, unitCost: cost ? b.unitCost : null, cm: cost ? cm : null, marginPct: cost ? marginPct : null, share: totalQty && b.hasCard ? round2((b.qty / totalQty) * 100) : 0, class: cls, classLabel: CLASS_LABEL[cls] };
  }).sort((a, b) => a.categoria.localeCompare(b.categoria, 'ru') || a.nombre.localeCompare(b.nombre, 'ru'));
  res.json({ from, to, canCost: cost, canEdit: hasPerm(req.me!, 'menu.edit'), items, categories: cats, avgCm: cost ? round2(avgCm) : null, popThreshold: round2(popThr * 100) });
}));

/* ───────── Изменение блюда ───────── */
const priceSchema = z.number({ invalid_type_error: 'Цена должна быть числом' }).min(0, 'Цена не может быть отрицательной').max(1e8, 'Слишком большая цена');

async function recordPrice(c: { query: (t: string, v?: unknown[]) => Promise<{ rows: any[] }> }, req: { me?: { id: string; name: string; rid: string } }, prod: { id: string; nombre: string }, oldP: number | null, newP: number, reason: string | null) {
  await c.query('insert into office.price_history (restaurante_id, producto_id, producto_name, old_price, new_price, reason, changed_by, changed_by_name) values ($1,$2,$3,$4,$5,$6,$7,$8)',
    [req.me!.rid, prod.id, prod.nombre, oldP, newP, reason, req.me!.id, req.me!.name]);
}

router.patch('/mn/items/:id', need('menu.edit'), ah(async (req, res) => {
  const b = parse(z.object({
    precio: priceSchema.optional(), disponible: z.boolean().optional(), nombre: z.string().trim().min(1, 'Укажите название').max(120).optional(),
    descripcion: z.string().trim().max(500).nullish(), categoriaId: z.string().min(1).optional(), reason: z.string().trim().max(200).nullish(),
  }), req.body);
  const rid = req.me!.rid;
  const out = await tx(async (c) => {
    const cur = (await c.query('select id, nombre, precio, disponible, "categoriaId" from public."Producto" where id = $1 and "restauranteId" = $2 for update', [req.params.id, rid])).rows[0];
    if (!cur) throw new HttpError(404, 'Блюдо не найдено');
    if (b.categoriaId) { const k = (await c.query('select 1 from public."Categoria" where id = $1 and "restauranteId" = $2', [b.categoriaId, rid])).rows[0]; if (!k) throw new HttpError(400, 'Категория не найдена'); }
    if (b.nombre && b.nombre.toLowerCase() !== String(cur.nombre).toLowerCase()) {
      const dup = (await c.query('select 1 from public."Producto" where "restauranteId" = $1 and lower(nombre) = lower($2) and id <> $3', [rid, b.nombre, cur.id])).rows[0];
      if (dup) throw new HttpError(409, 'Блюдо с таким названием уже есть');
    }
    await c.query('update public."Producto" set nombre = coalesce($2, nombre), precio = coalesce($3, precio), disponible = coalesce($4, disponible), descripcion = case when $5::boolean then $6 else descripcion end, "categoriaId" = coalesce($7, "categoriaId") where id = $1',
      [cur.id, b.nombre ?? null, b.precio ?? null, b.disponible ?? null, b.descripcion !== undefined, b.descripcion ?? null, b.categoriaId ?? null]);
    if (b.precio !== undefined && Math.abs(b.precio - n(cur.precio)) > 0.004) await recordPrice(c, req, { id: cur.id, nombre: b.nombre ?? cur.nombre }, n(cur.precio), b.precio, b.reason ?? null);
    return cur;
  });
  let warning: string | null = null;
  if (b.precio !== undefined) {
    const model = await loadModel(rid);
    const cst = model.costOf(req.params.id);
    if (cst.hasCard && b.precio < cst.costo) warning = `Цена ниже себестоимости (${round2(cst.costo)})`;
  }
  await audit(req, 'menu.update', 'product', req.params.id, { ...b, was: n(out.precio) });
  res.json({ ok: true, warning });
}));

router.post('/mn/items', need('menu.edit'), ah(async (req, res) => {
  const b = parse(z.object({ nombre: z.string().trim().min(1, 'Укажите название').max(120), precio: priceSchema, categoriaId: z.string().min(1, 'Выберите категорию'), descripcion: z.string().trim().max(500).nullish(), requiereCocina: z.boolean().optional() }), req.body);
  const rid = req.me!.rid;
  const k = await q1('select 1 from public."Categoria" where id = $1 and "restauranteId" = $2', [b.categoriaId, rid]);
  if (!k) throw new HttpError(400, 'Категория не найдена');
  const dup = await q1('select 1 from public."Producto" where "restauranteId" = $1 and lower(nombre) = lower($2)', [rid, b.nombre]);
  if (dup) throw new HttpError(409, 'Блюдо с таким названием уже есть');
  const id = await tx(async (c) => {
    const r = (await c.query(`insert into public."Producto" (id, nombre, descripcion, precio, disponible, "requiereCocina", "categoriaId", "restauranteId") values ('prod-' || gen_random_uuid()::text, $1,$2,$3,true,$4,$5,$6) returning id`, [b.nombre, b.descripcion ?? null, b.precio, b.requiereCocina ?? true, b.categoriaId, rid])).rows[0];
    await recordPrice(c, req, { id: r.id, nombre: b.nombre }, null, b.precio, 'Новое блюдо');
    return r.id as string;
  });
  await audit(req, 'menu.create', 'product', id, { nombre: b.nombre, precio: b.precio });
  res.status(201).json({ id });
}));

/** Массовое изменение цен и доступности. mode: percent (+/−%), add (+/− сумма), set (новая цена), availability. */
router.post('/mn/items/bulk', need('menu.edit'), ah(async (req, res) => {
  const b = parse(z.object({
    ids: z.array(z.string()).min(1, 'Выберите блюда').max(500),
    mode: z.enum(['percent', 'add', 'set', 'availability']), value: z.number().min(-1e8).max(1e8).optional(), available: z.boolean().optional(),
    roundTo: z.number().refine((v) => [0, 1, 5, 10, 50, 100, 500].includes(v), 'Шаг округления: 1, 5, 10, 50, 100 или 500').optional(), reason: z.string().trim().max(200).nullish(),
  }), req.body);
  const rid = req.me!.rid;
  if (b.mode === 'availability' && b.available === undefined) throw new HttpError(400, 'Укажите, включить или выключить блюда');
  if (b.mode !== 'availability' && b.value === undefined) throw new HttpError(400, 'Укажите значение');
  const res2 = await tx(async (c) => {
    const rows = (await c.query('select id, nombre, precio from public."Producto" where id = any($1::text[]) and "restauranteId" = $2 for update', [b.ids, rid])).rows;
    if (rows.length !== new Set(b.ids).size) throw new HttpError(404, 'Часть блюд не найдена');
    let changed = 0;
    const preview: { id: string; nombre: string; from: number; to: number }[] = [];
    for (const r of rows) {
      if (b.mode === 'availability') { await c.query('update public."Producto" set disponible = $2 where id = $1', [r.id, b.available]); changed++; continue; }
      const old = n(r.precio);
      let np = b.mode === 'percent' ? old * (1 + b.value! / 100) : b.mode === 'add' ? old + b.value! : b.value!;
      if (b.roundTo) np = Math.round(np / b.roundTo) * b.roundTo; else np = round2(np);
      if (np < 0) throw new HttpError(400, `Цена «${r.nombre}» стала бы отрицательной`);
      if (Math.abs(np - old) < 0.004) continue;
      await c.query('update public."Producto" set precio = $2 where id = $1', [r.id, np]);
      await recordPrice(c, req, { id: r.id, nombre: r.nombre }, old, np, b.reason ?? `Массовое изменение (${b.mode})`);
      preview.push({ id: r.id, nombre: r.nombre, from: old, to: np });
      changed++;
    }
    return { changed, preview };
  });
  await audit(req, 'menu.bulk', 'product', null, { mode: b.mode, value: b.value, count: res2.changed });
  res.json(res2);
}));

/* ───────── Категории ───────── */
router.get('/mn/categories', need('menu.view'), ah(async (req, res) => {
  res.json(await q('select c.id, c.nombre, (select count(*)::int from public."Producto" p where p."categoriaId" = c.id) as items from public."Categoria" c where c."restauranteId" = $1 order by lower(c.nombre)', [req.me!.rid]));
}));
const catName = z.object({ nombre: z.string().trim().min(1, 'Укажите название').max(60) });
router.post('/mn/categories', need('menu.edit'), ah(async (req, res) => {
  const b = parse(catName, req.body);
  const dup = await q1('select 1 from public."Categoria" where "restauranteId" = $1 and lower(nombre) = lower($2)', [req.me!.rid, b.nombre]);
  if (dup) throw new HttpError(409, 'Такая категория уже есть');
  const r = await q1<{ id: string }>(`insert into public."Categoria" (id, nombre, "restauranteId") values ('cat-' || gen_random_uuid()::text, $1, $2) returning id`, [b.nombre, req.me!.rid]);
  await audit(req, 'category.create', 'category', r!.id, b);
  res.status(201).json({ id: r!.id });
}));
router.patch('/mn/categories/:id', need('menu.edit'), ah(async (req, res) => {
  const b = parse(catName, req.body);
  const dup = await q1('select 1 from public."Categoria" where "restauranteId" = $1 and lower(nombre) = lower($2) and id <> $3', [req.me!.rid, b.nombre, req.params.id]);
  if (dup) throw new HttpError(409, 'Такая категория уже есть');
  const r = await q('update public."Categoria" set nombre = $3 where id = $1 and "restauranteId" = $2 returning id', [req.params.id, req.me!.rid, b.nombre]);
  if (!r.length) throw new HttpError(404, 'Категория не найдена');
  await audit(req, 'category.update', 'category', req.params.id, b);
  res.json({ ok: true });
}));
router.delete('/mn/categories/:id', need('menu.edit'), ah(async (req, res) => {
  const used = await q1<{ c: number }>('select count(*)::int as c from public."Producto" where "categoriaId" = $1', [req.params.id]);
  if (used && used.c > 0) throw new HttpError(409, `В категории есть блюда (${used.c}) — сначала перенесите их`);
  const r = await q('delete from public."Categoria" where id = $1 and "restauranteId" = $2 returning id', [req.params.id, req.me!.rid]);
  if (!r.length) throw new HttpError(404, 'Категория не найдена');
  await audit(req, 'category.delete', 'category', req.params.id);
  res.json({ ok: true });
}));

/* ───────── История цен ───────── */
router.get('/mn/history', need('menu.view'), ah(async (req, res) => {
  const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 100));
  const prod = typeof req.query.productoId === 'string' && req.query.productoId ? req.query.productoId : null;
  const rows = await q('select id, producto_id, producto_name, old_price, new_price, reason, changed_by_name, at from office.price_history where restaurante_id = $1 and ($2::text is null or producto_id = $2) order by at desc limit $3', [req.me!.rid, prod, limit]);
  res.json(rows.map((r) => ({ id: r.id, productoId: r.producto_id, nombre: r.producto_name, from: r.old_price === null ? null : n(r.old_price), to: n(r.new_price), reason: r.reason, who: r.changed_by_name, at: r.at })));
}));
