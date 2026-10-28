import { q } from './db';
import { n } from './util';

/**
 * Модель себестоимости: тех-карты и цены сырья из основной системы.
 * Себестоимость порции = Σ (брутто ингредиента × цена за единицу) + доли других блюд (комбо/сеты) рекурсивно.
 */
export interface InsumoRow { id: string; nombre: string; unidad: string; categoria: string | null; costo: number | null; stock: number; minimo: number }
export interface RecetaRow { id: string; productoId: string; rendimiento: number | null; tecnologia: string; items: { id: string; insumoId: string | null; componenteId: string | null; cantidad: number; neto: number | null; coldLossPct: number | null; hotLossPct: number | null }[] }
export interface ProductoRow { id: string; nombre: string; precio: number; categoriaId: string; disponible: boolean; descripcion: string | null }

export interface CostModel {
  insumos: Map<string, InsumoRow>;
  recetas: Map<string, RecetaRow>;
  productos: Map<string, ProductoRow>;
  costOf: (productoId: string) => { costo: number; incompleto: boolean; hasCard: boolean };
  availabilityOf: (productoId: string) => { status: 'none' | 'low' | 'normal' | 'surplus'; porciones: number | null; ingredients: { insumoId: string; nombre: string; unidad: string; porcion: number; stock: number; minimo: number; porciones: number; status: 'low' | 'normal' | 'surplus' }[] };
}

export async function loadModel(rid: string): Promise<CostModel> {
  const [ins, recs, items, prods] = await Promise.all([
    q(`select id, nombre, unidad, categoria, "costoUnitario" as costo, "stockActual" as stock, "stockMinimo" as minimo from public."Insumo" where "restauranteId" = $1`, [rid]),
    q(`select id, "productoId", rendimiento, tecnologia from public."Receta" where "restauranteId" = $1`, [rid]),
    q(`select i.id, i."recetaId", i."insumoId", i."componenteId", i.cantidad, i.neto, i."coldLossPct", i."hotLossPct" from public."RecetaItem" i join public."Receta" r on r.id = i."recetaId" where r."restauranteId" = $1 order by i.id`, [rid]),
    q(`select id, nombre, precio, "categoriaId", disponible, descripcion from public."Producto" where "restauranteId" = $1`, [rid]),
  ]);
  const insumos = new Map<string, InsumoRow>(ins.map((i) => [i.id, { id: i.id, nombre: i.nombre, unidad: i.unidad, categoria: i.categoria, costo: i.costo === null ? null : n(i.costo), stock: n(i.stock), minimo: n(i.minimo) }]));
  const recetas = new Map<string, RecetaRow>(recs.map((r) => [r.productoId, { id: r.id, productoId: r.productoId, rendimiento: r.rendimiento === null ? null : n(r.rendimiento), tecnologia: r.tecnologia ?? '', items: [] }]));
  const byId = new Map(recs.map((r) => [r.id, r.productoId]));
  for (const it of items) recetas.get(byId.get(it.recetaId)!)?.items.push({ id: it.id, insumoId: it.insumoId, componenteId: it.componenteId, cantidad: n(it.cantidad), neto: it.neto === null ? null : n(it.neto), coldLossPct: it.coldLossPct === null ? null : n(it.coldLossPct), hotLossPct: it.hotLossPct === null ? null : n(it.hotLossPct) });
  const productos = new Map<string, ProductoRow>(prods.map((p) => [p.id, { id: p.id, nombre: p.nombre, precio: n(p.precio), categoriaId: p.categoriaId, disponible: p.disponible, descripcion: p.descripcion }]));

  const memo = new Map<string, { costo: number; incompleto: boolean; hasCard: boolean }>();
  const costOf = (id: string, depth = 0, path: string[] = []): { costo: number; incompleto: boolean; hasCard: boolean } => {
    const m = memo.get(id); if (m) return m;
    const r = recetas.get(id);
    if (!r) return { costo: 0, incompleto: false, hasCard: false };
    if (depth > 6 || path.includes(id)) return { costo: 0, incompleto: true, hasCard: true };
    let costo = 0, incompleto = false;
    for (const it of r.items) {
      if (it.insumoId) {
        const i = insumos.get(it.insumoId);
        if (!i || i.costo === null) incompleto = true; else costo += it.cantidad * i.costo;
      } else if (it.componenteId) {
        const c = costOf(it.componenteId, depth + 1, [...path, id]);
        costo += c.costo * it.cantidad; if (c.incompleto || !c.hasCard) incompleto = true;
      }
    }
    const out = { costo, incompleto, hasCard: true };
    memo.set(id, out);
    return out;
  };
  const availabilityOf: CostModel['availabilityOf'] = (productoId) => {
    const needed = new Map<string, number>();
    const expand = (id: string, qty: number, path: string[] = []) => {
      if (path.length > 5 || path.includes(id)) return;
      for (const it of recetas.get(id)?.items ?? []) {
        if (it.insumoId) needed.set(it.insumoId, (needed.get(it.insumoId) ?? 0) + qty * it.cantidad);
        else if (it.componenteId) expand(it.componenteId, qty * it.cantidad, [...path, id]);
      }
    };
    expand(productoId, 1);
    const ingredients = [...needed].filter(([, qty]) => qty > 0).map(([id, qty]) => {
      const item = insumos.get(id);
      const stock = item?.stock ?? 0, minimo = item?.minimo ?? 0;
      const status: 'low' | 'normal' | 'surplus' = !item || stock <= Math.max(minimo, qty * 3) ? 'low' : stock >= Math.max(minimo * 2, qty * 20) ? 'surplus' : 'normal';
      return { insumoId: id, nombre: item?.nombre ?? 'Ингредиент не найден', unidad: item?.unidad ?? '', porcion: qty, stock, minimo, porciones: Math.floor(Math.max(0, stock) / qty), status };
    });
    const status = !ingredients.length ? 'none' : ingredients.some((i) => i.status === 'low') ? 'low' : ingredients.every((i) => i.status === 'surplus') ? 'surplus' : 'normal';
    return { status, porciones: ingredients.length ? Math.min(...ingredients.map((i) => i.porciones)) : null, ingredients };
  };
  return { insumos, recetas, productos, costOf: (id) => costOf(id), availabilityOf };
}

/** Содержит ли развёртка блюда `objetivo` (защита от циклов при сохранении тех-карты). */
export function hasCycle(recetas: Map<string, { items: { componenteId: string | null }[] }>, from: string, target: string, depth = 0): boolean {
  if (from === target) return true;
  if (depth > 6) return true;
  return (recetas.get(from)?.items ?? []).some((i) => i.componenteId && hasCycle(recetas, i.componenteId, target, depth + 1));
}
