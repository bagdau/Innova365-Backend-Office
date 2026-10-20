import { useMemo } from 'react';
import { SearchIndex, type SearchHit } from './engine';
import { MENU_SYNONYMS } from './synonyms';
import type { Producto, Insumo } from '../types';

/** Индекс блюд: название (вес 3), категория (1.5), описание (1). Пересобирается только при смене меню. */
export function useProductIndex(productos: Producto[]) {
  return useMemo(
    () => new SearchIndex<Producto>(productos, [
      { get: (p) => p.nombre, weight: 3 },
      { get: (p) => p.categoria?.nombre, weight: 1.5 },
      { get: (p) => p.descripcion, weight: 1 },
    ], MENU_SYNONYMS),
    [productos],
  );
}

export interface ProductSearchResult {
  /** Блюда в порядке релевантности (или исходный список, если запрос пустой) */
  items: Producto[];
  /** Подсветка: id блюда → диапазоны в названии */
  ranges: Map<string, Array<[number, number]>>;
  searching: boolean;
}

/** Поиск блюд по запросу: синхронно и мгновенно. */
export function useProductSearch(
  productos: Producto[], query: string, filter?: (p: Producto) => boolean, opts: { immediate?: boolean } = {},
): ProductSearchResult {
  const index = useProductIndex(productos);
  // Поиск синхронный (доли миллисекунды), поэтому отложенное значение не используем:
  // оно давало бы кадр со старым списком. `opts.immediate` оставлен для совместимости.
  void opts;
  const deferred = query;
  return useMemo(() => {
    const ranges = new Map<string, Array<[number, number]>>();
    const q = deferred.trim();
    if (!q) return { items: filter ? productos.filter(filter) : productos, ranges, searching: false };
    const hits: SearchHit<Producto>[] = index.search(q, { limit: 200 });
    const items: Producto[] = [];
    for (const h of hits) {
      if (filter && !filter(h.item)) continue;
      items.push(h.item);
      ranges.set(h.item.id, h.ranges);
    }
    return { items, ranges, searching: true };
  }, [deferred, index, productos, filter]);
}

/** Поиск по складу (название, категория, поставщик). */
export function useInsumoSearch(insumos: Insumo[], query: string): Insumo[] {
  const index = useMemo(
    () => new SearchIndex<Insumo>(insumos, [
      { get: (i) => i.nombre, weight: 3 },
      { get: (i) => i.categoria, weight: 1.5 },
      { get: (i) => i.proveedor, weight: 1 },
    ], MENU_SYNONYMS),
    [insumos],
  );
  const deferred = query;
  return useMemo(() => (deferred.trim() ? index.search(deferred, { limit: 200 }).map((h) => h.item) : insumos), [deferred, index, insumos]);
}
