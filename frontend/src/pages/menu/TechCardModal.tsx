import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Printer, ChefHat } from 'lucide-react';
import toast from 'react-hot-toast';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { recetasService, type Receta } from '../../services/recetas.service';
import { inventarioService } from '../../services/inventario.service';
import { menuService } from '../../services/menu.service';
import { reportesService } from '../../services/reportes.service';
import { printTechCard } from '../../lib/documents';
import { formatCurrency, cn } from '../../utils/cn';
import { t, apiError } from '../../i18n';
import type { Insumo, Producto } from '../../types';

interface Row { k: string; ref: string; cant: string; neto: string }   // ref: 'i:<insumoId>' | 'p:<productoId>'

/** Единицы ввода: на кухне граммы и миллилитры, на складе — кг и литры. */
const UNITS = (unidad: string) => (unidad === 'кг' ? { mult: 1000, label: 'г' } : unidad === 'л' ? { mult: 1000, label: 'мл' } : { mult: 1, label: unidad });
const inputCls = 'bg-muted border border-border rounded-m px-2.5 py-2 text-sm text-foreground focus:outline-none focus:border-primary';
let seq = 0;
const newKey = () => `r${++seq}`;
const round = (n: number, d = 3) => Math.round(n * 10 ** d) / 10 ** d;

/** Тех-карта (технологическая карта / тех-паспорт) блюда: состав на 1 порцию, себестоимость, технология. */
export function TechCardModal({ producto, open, onClose }: { producto: Producto | null; open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const id = producto?.id ?? '';
  const { data: card, isLoading } = useQuery<Receta>({ queryKey: ['receta', id], queryFn: () => recetasService.get(id), enabled: open && !!id });
  const { data: insumos = [] } = useQuery<Insumo[]>({ queryKey: ['inventario'], queryFn: inventarioService.getAll, enabled: open });
  const { data: productos = [] } = useQuery<Producto[]>({ queryKey: ['productos'], queryFn: () => menuService.getProductos(), enabled: open });
  const { data: resumen = [] } = useQuery({ queryKey: ['recetas'], queryFn: recetasService.list, enabled: open });
  const { data: rest } = useQuery({ queryKey: ['restaurante'], queryFn: reportesService.getRestaurante, staleTime: 300_000, enabled: open });

  const [rows, setRows] = useState<Row[]>([]);
  const [rend, setRend] = useState('');
  const [tec, setTec] = useState('');
  const [dirty, setDirty] = useState(false);

  const insMap = useMemo(() => new Map(insumos.map((i) => [i.id, i as Insumo & { costoUnitario?: string | number | null }])), [insumos]);
  const prodMap = useMemo(() => new Map(productos.map((p) => [p.id, p])), [productos]);
  const costoPlato = useMemo(() => new Map(resumen.map((r) => [r.productoId, r.costo])), [resumen]);

  // загрузка карточки в форму
  useEffect(() => {
    if (!card || !open) return;
    setRows(card.items.map((i) => {
      const u = i.tipo === 'insumo' ? UNITS(i.unidad) : { mult: 1, label: '' };
      return { k: newKey(), ref: i.tipo === 'insumo' ? `i:${i.insumoId}` : `p:${i.componenteId}`, cant: String(round(i.cantidad * u.mult)), neto: i.neto === null ? '' : String(round(i.neto * u.mult)) };
    }));
    setRend(card.rendimiento === null ? '' : String(card.rendimiento));
    setTec(card.tecnologia ?? '');
    setDirty(false);
  }, [card, open]);

  const lineInfo = (r: Row) => {
    const isIns = r.ref.startsWith('i:'); const rid = r.ref.slice(2);
    if (isIns) {
      const x = insMap.get(rid);
      const u = UNITS(x?.unidad ?? '');
      const c = Number(r.cant) / u.mult;
      const cost = x?.costoUnitario === null || x?.costoUnitario === undefined ? null : c * Number(x.costoUnitario);
      return { name: x?.nombre ?? '—', unit: u.label, mult: u.mult, cost: Number.isFinite(cost as number) ? cost : null, isIns };
    }
    const p = prodMap.get(rid);
    const per = costoPlato.get(rid) ?? 0;
    return { name: p?.nombre ?? '—', unit: t('porc.'), mult: 1, cost: per * (Number(r.cant) || 0), isIns };
  };

  const total = rows.reduce((s, r) => s + (lineInfo(r).cost ?? 0), 0);
  const incompleto = rows.some((r) => lineInfo(r).cost === null);
  const precio = Number(producto?.precio ?? 0);
  const margen = precio > 0 ? (1 - total / precio) * 100 : null;
  const usados = new Set(rows.map((r) => r.ref));

  const options = [
    ...insumos.map((i) => ({ value: `i:${i.id}`, label: i.nombre, hint: i.unidad, text: i.nombre })),
    ...productos.filter((p) => p.id !== id).map((p) => ({ value: `p:${p.id}`, label: `🍽 ${p.nombre}`, hint: t('plato'), text: p.nombre })),
  ];

  const patch = (k: string, p: Partial<Row>) => { setRows((rs) => rs.map((r) => (r.k === k ? { ...r, ...p } : r))); setDirty(true); };
  const add = () => { setRows((rs) => [...rs, { k: newKey(), ref: '', cant: '', neto: '' }]); setDirty(true); };
  const del = (k: string) => { setRows((rs) => rs.filter((r) => r.k !== k)); setDirty(true); };

  const save = useMutation({
    mutationFn: () => {
      const items = rows.filter((r) => r.ref && Number(r.cant) > 0).map((r) => {
        const inf = lineInfo(r);
        const neto = r.neto && Number(r.neto) > 0 ? Number(r.neto) / inf.mult : null;
        return inf.isIns ? { insumoId: r.ref.slice(2), cantidad: Number(r.cant) / inf.mult, neto } : { componenteId: r.ref.slice(2), cantidad: Number(r.cant) };
      });
      return recetasService.save(id, { rendimiento: rend ? Number(rend) : null, tecnologia: tec.trim() || null, items });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['receta', id] });
      qc.invalidateQueries({ queryKey: ['recetas'] });
      toast.success(t('Ficha técnica guardada'));
      setDirty(false);
      onClose();
    },
    onError: (e) => toast.error(apiError(e, 'Error al guardar')),
  });

  const missing = rows.some((r) => !r.ref || !(Number(r.cant) > 0));

  return (
    <Modal open={open} onClose={onClose} title={`${t('Ficha técnica')} — ${producto?.nombre ?? ''}`} width="max-w-4xl">
      {isLoading ? <p className="py-10 text-center text-sm text-muted-foreground">{t('Cargando...')}</p> : (
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground flex items-start gap-1.5"><ChefHat size={14} className="mt-0.5 flex-shrink-0" />
            {t('Composición de UNA porción. Al vender el plato, estos productos se descuentan del almacén solos. Para combos agrega otros platos.')}</p>

          <div className="space-y-2">
            <div className="hidden sm:grid grid-cols-[minmax(0,1fr)_110px_110px_100px_36px] gap-2 text-xs font-semibold uppercase text-muted-foreground px-1">
              <span>{t('Ingrediente / plato')}</span><span>{t('Bruto')}</span><span>{t('Neto')}</span><span className="text-right">{t('Costo')}</span><span />
            </div>
            {rows.length === 0 && <p className="text-sm text-muted-foreground bg-muted rounded-m p-4 text-center">{t('La ficha está vacía: agrega los ingredientes del plato')}</p>}
            {rows.map((r) => {
              const inf = lineInfo(r);
              return (
                <div key={r.k} className="grid grid-cols-[minmax(0,1fr)_88px_88px_36px] sm:grid-cols-[minmax(0,1fr)_110px_110px_100px_36px] gap-2 items-center">
                  <div className="col-span-4 sm:col-span-1">
                    <Select value={r.ref} onChange={(v) => patch(r.k, { ref: v })} placeholder={t('Seleccionar...')} searchable
                      options={options.filter((o) => o.value === r.ref || !usados.has(o.value))} />
                  </div>
                  <div className="relative">
                    <input type="number" inputMode="decimal" min="0" step="any" value={r.cant} onChange={(e) => patch(r.k, { cant: e.target.value })} className={cn(inputCls, 'w-full pr-9')} aria-label={t('Bruto')} />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">{r.ref ? inf.unit : ''}</span>
                  </div>
                  <div className="relative">
                    <input type="number" inputMode="decimal" min="0" step="any" value={r.neto} onChange={(e) => patch(r.k, { neto: e.target.value })} disabled={!inf.isIns} className={cn(inputCls, 'w-full pr-9 disabled:opacity-40')} aria-label={t('Neto')} />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">{r.ref && inf.isIns ? inf.unit : ''}</span>
                  </div>
                  <span className="hidden sm:block text-right text-sm tabular-nums text-foreground">{inf.cost === null ? <span className="text-warning" title={t('Sin precio de compra')}>—</span> : formatCurrency(inf.cost)}</span>
                  <button type="button" onClick={() => del(r.k)} aria-label={t('Eliminar')} title={t('Eliminar')} className="p-2 rounded-m text-muted-foreground hover:text-error hover:bg-error/10"><Trash2 size={15} /></button>
                </div>
              );
            })}
            <Button type="button" variant="secondary" size="sm" onClick={add}><Plus size={14} /> {t('Agregar ingrediente')}</Button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-muted rounded-l p-3"><p className="text-xs text-muted-foreground">{t('Costo de la porción')}</p><p className="text-lg font-bold text-foreground">{formatCurrency(total)}</p>{incompleto && <p className="text-[11px] text-warning">{t('Faltan precios de compra')}</p>}</div>
            <div className="bg-muted rounded-l p-3"><p className="text-xs text-muted-foreground">{t('Precio')}</p><p className="text-lg font-bold text-foreground">{formatCurrency(precio)}</p></div>
            <div className="bg-muted rounded-l p-3"><p className="text-xs text-muted-foreground">{t('Margen')}</p><p className={cn('text-lg font-bold', margen !== null && margen < 50 ? 'text-warning' : 'text-success')}>{margen === null ? '—' : `${margen.toFixed(0)}%`}</p></div>
            <div className="bg-muted rounded-l p-3"><p className="text-xs text-muted-foreground">{t('Alcanza para')}</p><p className="text-lg font-bold text-foreground">{card?.porciones === null || card?.porciones === undefined || dirty ? '—' : t('{n} porc.', { n: card.porciones })}</p></div>
          </div>

          <div className="grid sm:grid-cols-[160px_1fr] gap-3">
            <div>
              <label className="text-sm font-medium text-foreground block mb-1.5">{t('Rendimiento, g')}</label>
              <input type="number" inputMode="decimal" min="0" step="any" value={rend} onChange={(e) => { setRend(e.target.value); setDirty(true); }} className={cn(inputCls, 'w-full')} placeholder="350" />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground block mb-1.5">{t('Tecnología de preparación')}</label>
              <textarea value={tec} onChange={(e) => { setTec(e.target.value); setDirty(true); }} rows={3} maxLength={4000} className={cn(inputCls, 'w-full resize-none')} />
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <Button type="button" variant="secondary" onClick={() => card && printTechCard({ ...card, items: rows.map((r) => { const inf = lineInfo(r); return { nombre: inf.name, unidad: inf.unit, bruto: Number(r.cant) || 0, neto: r.neto ? Number(r.neto) : null, costo: inf.cost }; }), rendimiento: rend ? Number(rend) : null, tecnologia: tec, costo: total, margen }, rest)} disabled={!card || rows.length === 0}>
              <Printer size={14} /> {t('Imprimir ficha')}
            </Button>
            <div className="flex-1" />
            <Button type="button" variant="secondary" onClick={onClose}>{t('Cancelar')}</Button>
            <Button type="button" loading={save.isPending} disabled={missing || !dirty && !!card?.tieneReceta} onClick={() => save.mutate()}>{t('Guardar')}</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
