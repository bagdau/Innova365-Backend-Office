import { q } from './db';
import { n } from './util';

/**
 * Модель себестоимости: тех-карты и цены сырья из основной системы.
 * Себестоимость порции = Σ (брутто ингредиента × цена за единицу) + доли других блюд (комбо/сеты) рекурсивно.
 */
export interface InsumoRow { id: string; nombre: string; unidad: string; categoria: string | null; costo: number | null; stock: number; minimo: number }
export interface RecetaRow { id: string; productoId: string; rendimiento: number | null; tecnologia: string; items: { id: string; insumoId: string | null; componenteId: string | null; cantidad: number; neto: number | null }[] }
export interface ProductoRow { id: string; nombre: string; precio: number; categoriaId: string; disponible: boolean; descripcion: string | null }

export interface CostModel {
  insumos: Map<string, InsumoRow>;
  recetas: Map<string, RecetaRow>;
  productos: Map<string, ProductoRow>;
  costOf: (productoId: string) => { costo: number; incompleto: boolean; hasCard: boolean };
}

export async function loadModel(rid: string): Promise<CostModel> {
  const [ins, recs, items, prods] = await Promise.all([
    q(`select id, nombre, unidad, categoria, "costoUnitario" as costo, "stockActual" as stock, "stockMinimo" as minimo from public."Insumo" where "restauranteId" = $1`, [rid]),
    q(`select id, "productoId", rendimiento, tecnologia from public."Receta" where "restauranteId" = $1`, [rid]),
    q(`select i.id, i."recetaId", i."insumoId", i."componenteId", i.cantidad, i.neto from public."RecetaItem" i join public."Receta" r on r.id = i."recetaId" where r."restauranteId" = $1 order by i.id`, [rid]),
    q(`select id, nombre, precio, "categoriaId", disponible, descripcion from public."Producto" where "restauranteId" = $1`, [rid]),
  ]);
  const insumos = new Map<string, InsumoRow>(ins.map((i) => [i.id, { id: i.id, nombre: i.nombre, unidad: i.unidad, categoria: i.categoria, costo: i.costo === null ? null : n(i.costo), stock: n(i.stock), minimo: n(i.minimo) }]));
  const recetas = new Map<string, RecetaRow>(recs.map((r) => [r.productoId, { id: r.id, productoId: r.productoId, rendimiento: r.rendimiento === null ? null : n(r.rendimiento), tecnologia: r.tecnologia ?? '', items: [] }]));
  const byId = new Map(recs.map((r) => [r.id, r.productoId]));
  for (const it of items) recetas.get(byId.get(it.recetaId)!)?.items.push({ id: it.id, insumoId: it.insumoId, componenteId: it.componenteId, cantidad: n(it.cantidad), neto: it.neto === null ? null : n(it.neto) });
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
  return { insumos, recetas, productos, costOf: (id) => costOf(id) };
}

/** Содержит ли развёртка блюда `objetivo` (защита от циклов при сохранении тех-карты). */
export function hasCycle(recetas: Map<string, { items: { componenteId: string | null }[] }>, from: string, target: string, depth = 0): boolean {
  if (from === target) return true;
  if (depth > 6) return true;
  return (recetas.get(from)?.items ?? []).some((i) => i.componenteId && hasCycle(recetas, i.componenteId, target, depth + 1));
}
