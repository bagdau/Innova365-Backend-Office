import { Router } from 'express';
import { PoolClient } from 'pg';
import { z } from 'zod';
import { audit, auth, hasPerm, need } from '../auth';
import { q, q1, tx } from '../db';
import { CostModel, hasCycle, loadModel } from '../cost';
import { ah, HttpError, n, parse, round2 } from '../util';

export const router = Router();
router.use('/tc', auth);

const STATUS_LABEL: Record<string, string> = { none: 'Нет карты', draft: 'Черновик', review: 'На согласовании', approved: 'Утверждена', rejected: 'Возвращена' };

interface ItemIn { insumoId?: string | null; componenteId?: string | null; cantidad: number; neto?: number | null }
const itemSchema = z.object({
  insumoId: z.string().min(1).nullish(), componenteId: z.string().min(1).nullish(),
  cantidad: z.number({ invalid_type_error: 'Количество должно быть числом' }).positive('Количество должно быть больше нуля').max(1_000_000),
  neto: z.number().min(0).max(1_000_000).nullish(),
});
const recipeSchema = z.object({
  rendimiento: z.number().min(0).max(1_000_000).nullish(),
  tecnologia: z.string().max(6000).nullish(),
  items: z.array(itemSchema).max(60),
  comment: z.string().trim().max(300).nullish(),
});

const marginOf = (cost: number, price: number) => (price > 0 ? Math.round((1 - cost / price) * 1000) / 10 : null);

/* ───────── Список карт ───────── */
router.get('/tc/cards', need('tc.view'), ah(async (req, res) => {
  const rid = req.me!.rid;
  const [model, states, cats] = await Promise.all([
    loadModel(rid),
    q('select * from office.tc_state where restaurante_id = $1', [rid]),
    q('select id, nombre from public."Categoria" where "restauranteId" = $1', [rid]),
  ]);
  const st = new Map(states.map((s) => [s.producto_id, s]));
  const cat = new Map(cats.map((c) => [c.id, c.nombre as string]));
  const rows = [...model.productos.values()].map((p) => {
    const r = model.recetas.get(p.id);
    const c = model.costOf(p.id);
    const s = st.get(p.id);
    const status = r ? (s?.status ?? 'draft') : 'none';
    return {
      productoId: p.id, nombre: p.nombre, categoria: cat.get(p.categoriaId) ?? '', categoriaId: p.categoriaId, precio: p.precio, disponible: p.disponible,
      hasCard: !!r, items: r?.items.length ?? 0, costo: round2(c.costo), incompleto: c.incompleto, margen: r ? marginOf(c.costo, p.precio) : null,
      status, statusLabel: STATUS_LABEL[status], version: s?.version ?? null, updatedAt: s?.updated_at ?? null, updatedBy: s?.updated_by ?? null, comment: s?.comment ?? null,
    };
  }).sort((a, b) => a.categoria.localeCompare(b.categoria, 'ru') || a.nombre.localeCompare(b.nombre, 'ru'));
  const summary = { total: rows.length, none: 0, draft: 0, review: 0, approved: 0, rejected: 0 } as Record<string, number>;
  for (const r of rows) summary[r.status] += 1;
  res.json({ summary, rows });
}));

/* ───────── Одна карта ───────── */
async function card(rid: string, productoId: string, model?: CostModel) {
  const m = model ?? await loadModel(rid);
  const p = m.productos.get(productoId);
  if (!p) throw new HttpError(404, 'Блюдо не найдено');
  const r = m.recetas.get(productoId);
  const [state, versions, cat] = await Promise.all([
    q1('select * from office.tc_state where producto_id = $1', [productoId]),
    q('select version, action, comment, user_name, created_at from office.tc_version where producto_id = $1 order by version desc, id desc limit 100', [productoId]),
    q1('select nombre from public."Categoria" where id = $1', [p.categoriaId]),
  ]);
  const items = (r?.items ?? []).map((it) => {
    if (it.insumoId) {
      const i = m.insumos.get(it.insumoId);
      return { id: it.id, tipo: 'insumo' as const, insumoId: it.insumoId, componenteId: null, nombre: i?.nombre ?? '—', unidad: i?.unidad ?? '', cantidad: it.cantidad, neto: it.neto, precioUnit: i?.costo ?? null, costo: i && i.costo !== null ? round2(it.cantidad * i.costo) : null };
    }
    const comp = m.productos.get(it.componenteId!);
    const cc = m.costOf(it.componenteId!);
    return { id: it.id, tipo: 'plato' as const, insumoId: null, componenteId: it.componenteId, nombre: comp?.nombre ?? '—', unidad: 'порц.', cantidad: it.cantidad, neto: null, precioUnit: round2(cc.costo), costo: round2(cc.costo * it.cantidad) };
  });
  const c = m.costOf(productoId);
  const status = r ? (state?.status ?? 'draft') : 'none';
  return {
    productoId, nombre: p.nombre, descripcion: p.descripcion, categoria: cat?.nombre ?? '', precio: p.precio, hasCard: !!r,
    rendimiento: r?.rendimiento ?? null, tecnologia: r?.tecnologia ?? '', items, costo: round2(c.costo), incompleto: c.incompleto, margen: r ? marginOf(c.costo, p.precio) : null,
    state: { status, statusLabel: STATUS_LABEL[status], version: state?.version ?? null, comment: state?.comment ?? null, updatedBy: state?.updated_by ?? null, updatedAt: state?.updated_at ?? null, approvedBy: state?.approved_by ?? null, approvedAt: state?.approved_at ?? null },
    versions,
  };
}

router.get('/tc/cards/:id', need('tc.view'), ah(async (req, res) => { res.json(await card(req.me!.rid, req.params.id)); }));

/** Справочник для редактора: сырьё и блюда, которые можно добавить в состав. */
router.get('/tc/options', need('tc.view'), ah(async (req, res) => {
  const m = await loadModel(req.me!.rid);
  res.json({
    insumos: [...m.insumos.values()].map((i) => ({ id: i.id, nombre: i.nombre, unidad: i.unidad, costo: i.costo })).sort((a, b) => a.nombre.localeCompare(b.nombre, 'ru')),
    platos: [...m.productos.values()].map((p) => ({ id: p.id, nombre: p.nombre, costo: round2(m.costOf(p.id).costo) })).sort((a, b) => a.nombre.localeCompare(b.nombre, 'ru')),
  });
}));

/* ───────── Сохранение ───────── */
const snapshotOf = (b: { rendimiento?: number | null; tecnologia?: string | null; items: ItemIn[] }) => ({
  rendimiento: b.rendimiento ?? null, tecnologia: b.tecnologia?.trim() ?? '',
  items: b.items.map((i) => ({ insumoId: i.insumoId ?? null, componenteId: i.componenteId ?? null, cantidad: i.cantidad, neto: i.neto ?? null })),
});

async function applyRecipe(c: PoolClient, rid: string, productoId: string, snap: ReturnType<typeof snapshotOf>, model: CostModel, who: string, action: string, status: string, comment: string | null) {
  // проверки состава
  const ins = snap.items.map((i) => i.insumoId).filter(Boolean) as string[];
  const comps = snap.items.map((i) => i.componenteId).filter(Boolean) as string[];
  if (snap.items.some((i) => !!i.insumoId === !!i.componenteId)) throw new HttpError(400, 'Каждая строка — либо ингредиент, либо блюдо');
  if (new Set(ins).size !== ins.length || new Set(comps).size !== comps.length) throw new HttpError(400, 'Ингредиент или блюдо повторяется в составе');
  if (ins.some((id) => !model.insumos.has(id))) throw new HttpError(400, 'Ингредиент не найден');
  if (comps.some((id) => !model.productos.has(id))) throw new HttpError(400, 'Блюдо-компонент не найдено');
  const map = new Map(model.recetas);
  map.set(productoId, { items: snap.items } as any);
  if (comps.some((id) => hasCycle(map as any, id, productoId))) throw new HttpError(400, 'Цикл в составе: блюдо не может входить в собственный состав');

  const rec = `rec-${productoId}`;
  if (!snap.items.length) {
    await c.query('delete from public."Receta" where "productoId" = $1', [productoId]);
    await c.query('delete from office.tc_state where producto_id = $1', [productoId]);
    await c.query(`insert into office.tc_version (producto_id, restaurante_id, version, action, comment, user_name, snapshot)
                   values ($1,$2,coalesce((select max(version) from office.tc_version where producto_id = $1), 0) + 1,'delete',$3,$4,$5)`, [productoId, rid, comment, who, JSON.stringify(snap)]);
    return;
  }
  await c.query(`insert into public."Receta" (id, "productoId", "restauranteId", rendimiento, tecnologia, "actualizadoEn") values ($1,$2,$3,$4,$5,now())
                 on conflict ("productoId") do update set rendimiento = excluded.rendimiento, tecnologia = excluded.tecnologia, "actualizadoEn" = now()`,
    [rec, productoId, rid, snap.rendimiento, snap.tecnologia || null]);
  const rid2 = (await c.query('select id from public."Receta" where "productoId" = $1', [productoId])).rows[0].id as string;
  await c.query('delete from public."RecetaItem" where "recetaId" = $1', [rid2]);
  let k = 0;
  for (const it of snap.items) {
    k += 1;
    await c.query(`insert into public."RecetaItem" (id, "recetaId", "insumoId", "componenteId", cantidad, neto) values ($1,$2,$3,$4,$5,$6)`,
      [`ri-${productoId}-${String(k).padStart(2, '0')}`, rid2, it.insumoId, it.componenteId, it.cantidad, it.neto]);
  }
  const v = (await c.query(
    `insert into office.tc_state (producto_id, restaurante_id, status, version, comment, updated_by, updated_at) values ($1,$2,$3,1,$4,$5,now())
     on conflict (producto_id) do update set status = $3, version = office.tc_state.version + 1, comment = $4, updated_by = $5, updated_at = now(), approved_by = null, approved_at = null
     returning version`, [productoId, rid, status, comment, who])).rows[0].version as number;
  await c.query(`insert into office.tc_version (producto_id, restaurante_id, version, action, comment, user_name, snapshot) values ($1,$2,$3,$4,$5,$6,$7)`,
    [productoId, rid, v, action, comment, who, JSON.stringify(snap)]);
}

router.put('/tc/cards/:id', need('tc.edit'), ah(async (req, res) => {
  const b = parse(recipeSchema.extend({ submit: z.boolean().optional() }), req.body);
  const rid = req.me!.rid;
  const model = await loadModel(rid);
  if (!model.productos.has(req.params.id)) throw new HttpError(404, 'Блюдо не найдено');
  await tx((c) => applyRecipe(c, rid, req.params.id, snapshotOf(b), model, req.me!.name, b.submit ? 'submit' : 'save', b.submit ? 'review' : 'draft', b.comment ?? null));
  await audit(req, b.submit ? 'techcard.submit' : 'techcard.save', 'techcard', req.params.id, { items: b.items.length });
  res.json(await card(rid, req.params.id));
}));

/* ───────── Согласование ───────── */
router.post('/tc/cards/:id/status', ah(async (req, res) => {
  const b = parse(z.object({ action: z.enum(['submit', 'approve', 'reject', 'reopen']), comment: z.string().trim().max(300).nullish() }), req.body);
  const me = req.me!;
  const need_ = b.action === 'approve' || b.action === 'reject' ? 'tc.approve' : 'tc.edit';
  if (!hasPerm(me, need_)) throw new HttpError(403, 'Недостаточно прав для этого действия');
  const s = await q1('select * from office.tc_state where producto_id = $1 and restaurante_id = $2', [req.params.id, me.rid]);
  if (!s) throw new HttpError(404, 'У блюда нет тех-карты');
  const from = s.status as string;
  const next = { submit: 'review', approve: 'approved', reject: 'rejected', reopen: 'draft' }[b.action];
  const allowed: Record<string, string[]> = { submit: ['draft', 'rejected'], approve: ['review', 'draft'], reject: ['review'], reopen: ['approved', 'rejected'] };
  if (!allowed[b.action].includes(from)) throw new HttpError(409, `Действие недоступно для статуса «${STATUS_LABEL[from]}»`);
  if (b.action === 'reject' && !b.comment) throw new HttpError(400, 'Укажите причину возврата');
  await q(`update office.tc_state set status = $2, comment = $3, updated_by = $4, updated_at = now(),
             approved_by = case when $2 = 'approved' then $4 else null end, approved_at = case when $2 = 'approved' then now() else null end where producto_id = $1`,
    [req.params.id, next, b.comment ?? null, me.name]);
  await q(`insert into office.tc_version (producto_id, restaurante_id, version, action, comment, user_name, snapshot)
           select $1::text, $2::text, $3::int, $4::text, $5::text, $6::text, snapshot from office.tc_version where producto_id = $1 order by id desc limit 1`, [req.params.id, me.rid, s.version, b.action, b.comment ?? null, me.name]);
  await audit(req, 'techcard.' + b.action, 'techcard', req.params.id, { comment: b.comment });
  res.json(await card(me.rid, req.params.id));
}));

/* ───────── История версий ───────── */
router.get('/tc/cards/:id/versions/:version', need('tc.view'), ah(async (req, res) => {
  const v = await q1('select * from office.tc_version where producto_id = $1 and restaurante_id = $2 and version = $3 and snapshot is not null order by id desc limit 1', [req.params.id, req.me!.rid, Number(req.params.version)]);
  if (!v) throw new HttpError(404, 'Версия не найдена');
  const m = await loadModel(req.me!.rid);
  const snap = v.snapshot as ReturnType<typeof snapshotOf>;
  res.json({
    version: v.version, action: v.action, comment: v.comment, user: v.user_name, createdAt: v.created_at,
    rendimiento: snap.rendimiento, tecnologia: snap.tecnologia,
    items: snap.items.map((i) => ({ ...i, nombre: i.insumoId ? m.insumos.get(i.insumoId)?.nombre ?? '—' : m.productos.get(i.componenteId!)?.nombre ?? '—', unidad: i.insumoId ? m.insumos.get(i.insumoId)?.unidad ?? '' : 'порц.' })),
  });
}));

router.post('/tc/cards/:id/restore', need('tc.edit'), ah(async (req, res) => {
  const b = parse(z.object({ version: z.number().int().positive() }), req.body);
  const rid = req.me!.rid;
  const v = await q1(`select snapshot from office.tc_version where producto_id = $1 and restaurante_id = $2 and version = $3 and action in ('save','submit','import','restore','delete') order by id desc limit 1`, [req.params.id, rid, b.version]);
  if (!v) throw new HttpError(404, 'Версия не найдена');
  const snap = v.snapshot as ReturnType<typeof snapshotOf>;
  if (!snap.items.length) throw new HttpError(400, 'В этой версии тех-карты не было состава');
  const model = await loadModel(rid);
  const ok = snap.items.every((i) => (i.insumoId ? model.insumos.has(i.insumoId) : model.productos.has(i.componenteId!)));
  if (!ok) throw new HttpError(409, 'Часть ингредиентов этой версии уже удалена — восстановить нельзя');
  await tx((c) => applyRecipe(c, rid, req.params.id, snap, model, req.me!.name, 'restore', 'draft', `Восстановлена версия ${b.version}`));
  await audit(req, 'techcard.restore', 'techcard', req.params.id, { version: b.version });
  res.json(await card(rid, req.params.id));
}));

/* ───────── Сырьё ───────── */
router.get('/tc/ingredients', need('tc.view'), ah(async (req, res) => {
  const rid = req.me!.rid;
  const showCost = hasPerm(req.me!, 'ing.cost') || hasPerm(req.me!, 'tc.edit');
  const rows = await q(
    `select i.id, i.nombre, i.categoria, i.unidad, i."costoUnitario" as costo, i."stockActual" as stock, i."stockMinimo" as minimo,
            (select count(distinct r."productoId")::int from public."RecetaItem" ri join public."Receta" r on r.id = ri."recetaId" where ri."insumoId" = i.id) as used
       from public."Insumo" i where i."restauranteId" = $1 order by i.categoria nulls last, lower(i.nombre)`, [rid]);
  res.json(rows.map((r) => ({ id: r.id, nombre: r.nombre, categoria: r.categoria, unidad: r.unidad, costo: showCost && r.costo !== null ? n(r.costo) : null, stock: n(r.stock), minimo: n(r.minimo), used: r.used })));
}));

router.post('/tc/ingredients', need('ing.edit'), ah(async (req, res) => {
  const b = parse(z.object({ nombre: z.string().trim().min(1, 'Укажите название').max(120), categoria: z.string().trim().max(60).nullish(), unidad: z.string().trim().min(1, 'Укажите единицу').max(20), costo: z.number().min(0).max(1e9).nullish() }), req.body);
  const rid = req.me!.rid;
  const dup = await q1('select 1 from public."Insumo" where "restauranteId" = $1 and lower(nombre) = lower($2)', [rid, b.nombre]);
  if (dup) throw new HttpError(409, 'Ингредиент с таким названием уже есть');
  const cost = hasPerm(req.me!, 'ing.cost') ? b.costo ?? null : null;
  const r = await q1(`insert into public."Insumo" (id, nombre, categoria, unidad, "stockActual", "stockMinimo", "costoUnitario", "restauranteId", "creadoEn", "actualizadoEn")
                      values ('ins-' || gen_random_uuid()::text, $1,$2,$3,0,0,$4,$5,now(),now()) returning id`, [b.nombre, b.categoria ?? null, b.unidad, cost, rid]);
  await audit(req, 'ingredient.create', 'ingredient', r!.id, { nombre: b.nombre });
  res.status(201).json({ id: r!.id });
}));

router.patch('/tc/ingredients/:id', ah(async (req, res) => {
  const me = req.me!;
  const b = parse(z.object({ nombre: z.string().trim().min(1).max(120).optional(), categoria: z.string().trim().max(60).nullish(), costo: z.number().min(0).max(1e9).nullable().optional() }), req.body);
  if ((b.nombre !== undefined || b.categoria !== undefined) && !hasPerm(me, 'ing.edit')) throw new HttpError(403, 'Недостаточно прав для этого действия');
  if (b.costo !== undefined && !hasPerm(me, 'ing.cost')) throw new HttpError(403, 'Цену сырья меняет бухгалтер, администратор или владелец');
  const cur = await q1(`select nombre, "costoUnitario" as costo from public."Insumo" where id = $1 and "restauranteId" = $2`, [req.params.id, me.rid]);
  if (!cur) throw new HttpError(404, 'Ингредиент не найден');
  if (b.nombre) {
    const dup = await q1('select 1 from public."Insumo" where "restauranteId" = $1 and lower(nombre) = lower($2) and id <> $3', [me.rid, b.nombre, req.params.id]);
    if (dup) throw new HttpError(409, 'Ингредиент с таким названием уже есть');
  }
  await q(`update public."Insumo" set nombre = coalesce($2, nombre), categoria = case when $3::boolean then $4 else categoria end,
             "costoUnitario" = case when $5::boolean then $6 else "costoUnitario" end, "actualizadoEn" = now() where id = $1`,
    [req.params.id, b.nombre ?? null, b.categoria !== undefined, b.categoria ?? null, b.costo !== undefined, b.costo ?? null]);
  await audit(req, 'ingredient.update', 'ingredient', req.params.id, { before: { nombre: cur.nombre, costo: cur.costo }, after: b });
  res.json({ ok: true });
}));

/** «Что если цена сырья изменится»: на какие блюда повлияет и как изменится себестоимость и маржа. */
router.get('/tc/impact', need('tc.view'), ah(async (req, res) => {
  const insumoId = String(req.query.insumoId || '');
  const newCost = Number(req.query.cost);
  if (!Number.isFinite(newCost) || newCost < 0) throw new HttpError(400, 'Укажите новую цену');
  const rid = req.me!.rid;
  const base = await loadModel(rid);
  const ins = base.insumos.get(insumoId);
  if (!ins) throw new HttpError(404, 'Ингредиент не найден');
  const changed = await loadModel(rid);
  changed.insumos.get(insumoId)!.costo = newCost;
  // costOf запомнил значения для базовой модели — для изменённой считаем заново (модель новая, кэш пуст)
  const rows = [...base.productos.values()].filter((p) => base.recetas.has(p.id)).map((p) => {
    const a = base.costOf(p.id), b2 = changed.costOf(p.id);
    return { productoId: p.id, nombre: p.nombre, precio: p.precio, costoBefore: round2(a.costo), costoAfter: round2(b2.costo), delta: round2(b2.costo - a.costo), margenBefore: marginOf(a.costo, p.precio), margenAfter: marginOf(b2.costo, p.precio) };
  }).filter((r) => Math.abs(r.delta) > 0.004).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  res.json({ ingrediente: ins.nombre, unidad: ins.unidad, costoActual: ins.costo, costoNuevo: newCost, afectados: rows });
}));
