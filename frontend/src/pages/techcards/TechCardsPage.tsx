import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ChefHat, Package, Search } from 'lucide-react';
import { recetasService, type RecetaResumen, type StockStatus } from '../../services/recetas.service';
import { menuService } from '../../services/menu.service';
import { useAuthStore } from '../../store/authStore';
import { can } from '../../auth/permissions';
import type { Producto } from '../../types';

const LABEL: Record<StockStatus, string> = { none: 'Нет техкарты', low: 'Заканчивается', normal: 'В норме', surplus: 'В избытке' };
const TONE: Record<StockStatus, string> = { none: 'bg-muted text-muted-foreground', low: 'bg-error/10 text-error', normal: 'bg-success/10 text-success', surplus: 'bg-info/10 text-info' };
const qty = (value: number) => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 3 }).format(value);
const MOVEMENT: Record<string, string> = { INICIAL: 'Начальный остаток', COMPRA: 'Пополнение', AJUSTE: 'Корректировка', MERMA: 'Списание', REVISION: 'Инвентаризация', CONSUMO: 'Расход по заказу', DEVOLUCION: 'Возврат после отмены' };

function Status({ value }: { value: StockStatus }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${TONE[value]}`}>{LABEL[value]}</span>;
}

export default function TechCardsPage() {
  const { id } = useParams();
  const { user } = useAuthStore();
  const [search, setSearch] = useState('');
  const [portions, setPortions] = useState(2);
  const products = useQuery<Producto[]>({ queryKey: ['productos'], queryFn: menuService.getProductos });
  const cards = useQuery<RecetaResumen[]>({ queryKey: ['recetas'], queryFn: recetasService.list, refetchInterval: 15_000 });
  const stock = useQuery({ queryKey: ['recetaStock', id], queryFn: () => recetasService.stock(id!), enabled: !!id, refetchInterval: 15_000 });
  const productMap = useMemo(() => new Map((products.data ?? []).map((p) => [p.id, p])), [products.data]);
  const rows = useMemo(() => (cards.data ?? []).map((r) => ({ ...r, name: productMap.get(r.productoId)?.nombre ?? 'Блюдо удалено' }))
    .filter((r) => r.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name, 'ru')), [cards.data, productMap, search]);

  if (id) {
    const data = stock.data;
    return <div className="space-y-5">
      <Link to="/techcards" className="inline-flex items-center gap-2 text-sm text-primary"><ArrowLeft size={16} /> Все блюда</Link>
      {stock.isLoading ? <p className="text-muted-foreground">Загрузка остатков…</p> : stock.isError ? <p className="text-error">Не удалось загрузить остатки блюда.</p> : data && <>
        <div className="flex flex-wrap items-center gap-3"><h2 className="text-2xl font-semibold">{data.nombre}</h2><Status value={data.status} /></div>
        <p className="text-sm text-muted-foreground">По текущим остаткам можно приготовить {data.porciones === null ? '—' : data.porciones} порций. Склад списывает брутто техкарты при создании заказа; при отмене расход возвращается.</p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm">Проверить порций <input className="ml-2 w-20 rounded-md border border-border bg-card px-2 py-1.5" type="number" min="1" max="1000" value={portions} onChange={(e) => setPortions(Math.max(1, Math.min(1000, Number(e.target.value) || 1)))} /></label>
          {can(user?.rol, 'inventario') && <Link to="/inventario" className="rounded-md border border-border px-3 py-1.5 text-sm">Открыть склад</Link>}
        </div>
        <div className="overflow-x-auto rounded-xl border border-border bg-card"><table className="w-full min-w-[680px] text-sm">
          <thead className="bg-muted/50 text-left"><tr><th className="p-3">Ингредиент</th><th className="p-3 text-right">На 1 порцию</th><th className="p-3 text-right">На {portions} порц.</th><th className="p-3 text-right">Сейчас / минимум</th><th className="p-3 text-right">Хватит на</th><th className="p-3">Состояние</th></tr></thead>
          <tbody>{data.ingredients.map((item) => <tr key={item.insumoId} className="border-t border-border"><td className="p-3 font-medium">{item.nombre}</td><td className="p-3 text-right">{qty(item.porcion)} {item.unidad}</td><td className="p-3 text-right">{qty(item.porcion * portions)} {item.unidad}</td><td className="p-3 text-right">{qty(item.stock)} / {qty(item.minimo)} {item.unidad}</td><td className="p-3 text-right">{item.porciones}</td><td className="p-3"><Status value={item.status} /></td></tr>)}</tbody>
        </table>{!data.ingredients.length && <p className="p-5 text-sm text-muted-foreground">У блюда нет состава техкарты. Списание сырья для него не настроено.</p>}</div>
        <section className="rounded-xl border border-border bg-card p-4"><h3 className="mb-3 font-semibold">Последние движения ингредиентов</h3>
          {data.movements.length ? <div className="space-y-2">{data.movements.map((m) => <div key={m.id} className="flex flex-wrap justify-between gap-2 border-b border-border/60 py-2 text-sm"><span>{data.ingredients.find((i) => i.insumoId === m.insumoId)?.nombre ?? 'Ингредиент'} · {MOVEMENT[m.tipo] ?? m.tipo}{m.motivo ? ` · ${m.motivo}` : ''}</span><span className="tabular-nums">{m.cantidad > 0 ? '+' : ''}{qty(m.cantidad)} · остаток {qty(m.saldo)} · {new Date(m.creadoEn).toLocaleString('ru-RU')}</span></div>)}</div> : <p className="text-sm text-muted-foreground">Движений пока нет.</p>}
        </section>
      </>}
    </div>;
  }

  return <div className="space-y-5">
    <div><h2 className="flex items-center gap-2 text-2xl font-semibold"><ChefHat /> Техкарты и остатки</h2><p className="mt-1 text-sm text-muted-foreground">Состояние блюд рассчитано по всем ингредиентам, включая состав блюд-компонентов.</p></div>
    <label className="flex max-w-md items-center gap-2 rounded-md border border-border bg-card px-3"><Search size={17} className="text-muted-foreground" /><input className="w-full bg-transparent py-2 outline-none" placeholder="Поиск блюда" value={search} onChange={(e) => setSearch(e.target.value)} /></label>
    {(cards.isLoading || products.isLoading) ? <p>Загрузка…</p> : (cards.isError || products.isError) ? <p className="text-error">Не удалось загрузить блюда.</p> : <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{rows.map((r) => <Link to={`/techcards/${r.productoId}`} key={r.productoId} className="rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary"><div className="mb-3 flex items-start justify-between gap-2"><span className="font-semibold">{r.name}</span><Package size={17} className="text-muted-foreground" /></div><div className="flex items-center justify-between gap-2"><Status value={r.stockStatus ?? 'none'} /><span className="text-sm text-muted-foreground">{r.porciones === null ? '—' : `${r.porciones} порц.`}</span></div></Link>)}</div>}
  </div>;
}
