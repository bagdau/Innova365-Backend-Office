import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, PackageCheck, Printer, Truck, X, Check, Ban } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { SearchInput } from '../../components/shared/SearchInput';
import { almacenService, uid } from '../../services/almacen.service';
import { inventarioService } from '../../services/inventario.service';
import { reportesService } from '../../services/reportes.service';
import { useInsumoSearch } from '../../search/useSearch';
import { printCompra } from '../../lib/documents';
import { fmtMoney, fmtQty, fmtDateTime } from '../../lib/print';
import { cn } from '../../utils/cn';
import { Select } from '../../components/ui/Select';
import { DatePicker } from '../../components/ui/DatePicker';
import { t, apiError } from '../../i18n';
import type { Compra, EstadoCompra, Insumo, Proveedor } from '../../types';

const inputCls = 'w-full bg-muted border border-border rounded-m px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary';
const FILTROS: Array<{ id: EstadoCompra | 'ACTIVAS' | 'TODAS'; label: () => string; estados?: string }> = [
  { id: 'ACTIVAS', label: () => t('Esperando entrega'), estados: 'PEDIDA,PARCIAL' },
  { id: 'RECIBIDA', label: () => t('Recibidas'), estados: 'RECIBIDA' },
  { id: 'CANCELADA', label: () => t('Canceladas'), estados: 'CANCELADA' },
  { id: 'TODAS', label: () => t('Todas') },
];

export default function ComprasTab() {
  const qc = useQueryClient();
  const [filtro, setFiltro] = useState<typeof FILTROS[number]['id']>('ACTIVAS');
  const [nueva, setNueva] = useState(false);
  const [prefillLow, setPrefillLow] = useState(false);
  const [recibiendo, setRecibiendo] = useState<Compra | null>(null);
  const estados = FILTROS.find((f) => f.id === filtro)?.estados;

  const { data, isLoading } = useQuery({
    queryKey: ['compras', filtro],
    queryFn: () => almacenService.getCompras({ limit: 50, ...(estados ? { estado: estados } : {}) }),
  });
  const { data: rest } = useQuery({ queryKey: ['restaurante'], queryFn: reportesService.getRestaurante, staleTime: 300_000 });
  const compras = data?.data ?? [];

  // «Pedir lo que falta» desde Остатки
  useEffect(() => {
    if (sessionStorage.getItem('innova365-order-low')) {
      sessionStorage.removeItem('innova365-order-low');
      setPrefillLow(true);
      setNueva(true);
    }
  }, []);

  const cancelar = useMutation({
    mutationFn: (id: string) => almacenService.cancelarCompra(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['compras'] }); toast.success(t('Compra cancelada')); },
    onError: (e) => toast.error(apiError(e, 'Error al guardar')),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-2 flex-wrap">
          {FILTROS.map((f) => (
            <button key={f.id} onClick={() => setFiltro(f.id)}
              className={cn('px-3 py-1.5 rounded-full text-xs font-medium transition-colors', filtro === f.id ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:text-foreground')}>
              {f.label()}
            </button>
          ))}
        </div>
        <Button size="sm" onClick={() => { setPrefillLow(false); setNueva(true); }}><Plus size={14} /> {t('Nueva compra')}</Button>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground py-8 text-center">{t('Cargando...')}</p>}
      {!isLoading && compras.length === 0 && (
        <div className="border border-dashed border-border rounded-l py-14 text-center text-muted-foreground">
          <Truck size={32} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">{t('No hay compras en esta lista')}</p>
        </div>
      )}

      <div className="grid gap-3">
        {compras.map((c) => {
          const pendiente = c.estado === 'PEDIDA' || c.estado === 'PARCIAL';
          const lineasOk = c.items.filter((i) => i.cantidadRecibida >= i.cantidad).length;
          return (
            <div key={c.id} className="bg-card border border-border rounded-l p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-foreground">{t('Compra')} №{c.numero}</span>
                    <StatusBadge variant={c.estado.toLowerCase()} />
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {c.proveedor.nombre} · {fmtDateTime(c.creadoEn)}
                    {c.fechaEsperada && <> · {t('Entrega esperada')}: {fmtDateTime(c.fechaEsperada).slice(0, 10)}</>}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-primary">{fmtMoney(c.total)}</p>
                  <p className="text-xs text-muted-foreground">{t('Recibido: {a} de {b} líneas', { a: lineasOk, b: c.items.length })}</p>
                </div>
              </div>

              <div className="mt-3 grid gap-1 sm:grid-cols-2">
                {c.items.map((i) => {
                  const full = i.cantidadRecibida >= i.cantidad;
                  return (
                    <div key={i.id} className="flex items-center justify-between text-sm bg-muted/40 rounded-m px-3 py-1.5">
                      <span className="text-foreground truncate pr-2">{i.nombre}</span>
                      <span className={cn('whitespace-nowrap font-medium', full ? 'text-success' : i.cantidadRecibida > 0 ? 'text-warning' : 'text-muted-foreground')}>
                        {fmtQty(i.cantidadRecibida)} / {fmtQty(i.cantidad)} {i.unidad}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="flex gap-2 mt-3 flex-wrap">
                {pendiente && <Button size="sm" onClick={() => setRecibiendo(c)}><PackageCheck size={14} /> {t('Recibir')}</Button>}
                <Button size="sm" variant="secondary" onClick={() => printCompra(c, rest)}><Printer size={14} /> {t('Imprimir')}</Button>
                {c.estado === 'PEDIDA' && (
                  <Button size="sm" variant="ghost" onClick={() => { if (confirm(t('¿Cancelar esta compra?'))) cancelar.mutate(c.id); }}><Ban size={14} /> {t('Cancelar')}</Button>
                )}
              </div>
              {c.notas && <p className="text-xs text-muted-foreground mt-2">{c.notas}</p>}
            </div>
          );
        })}
      </div>

      <NuevaCompraModal open={nueva} prefillLow={prefillLow} onClose={() => setNueva(false)} />
      <RecepcionModal compra={recibiendo} onClose={() => setRecibiendo(null)} />
    </div>
  );
}

// ═════════════════════ Nueva compra ═════════════════════

interface Linea { insumoId: string; nombre: string; unidad: string; cantidad: string; costo: string }

function NuevaCompraModal({ open, prefillLow, onClose }: { open: boolean; prefillLow: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: insumos = [] } = useQuery<Insumo[]>({ queryKey: ['inventario'], queryFn: inventarioService.getAll, enabled: open });
  const { data: proveedores = [] } = useQuery<Proveedor[]>({ queryKey: ['proveedores'], queryFn: () => almacenService.getProveedores(), enabled: open });
  const [proveedorId, setProveedorId] = useState('');
  const [fecha, setFecha] = useState('');
  const [notas, setNotas] = useState('');
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [search, setSearch] = useState('');
  const [clave, setClave] = useState(uid);
  const [nuevoProv, setNuevoProv] = useState('');
  const found = useInsumoSearch(insumos, search);

  const costoDe = (i: Insumo) => String((i as Insumo & { costoUnitario?: number | string | null }).costoUnitario ?? '');

  // Нижний остаток → предзаполнение
  useEffect(() => {
    if (!open) return;
    setClave(uid());
    if (prefillLow && insumos.length) {
      setLineas(insumos.filter((i) => i.estado !== 'OK').map((i) => {
        const falta = Math.max(Number(i.stockMinimo) * 2 - Number(i.stockActual), Number(i.stockMinimo));
        return { insumoId: i.id, nombre: i.nombre, unidad: i.unidad, cantidad: String(Math.ceil(falta * 10) / 10), costo: costoDe(i) };
      }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, prefillLow, insumos.length]);

  const reset = () => { setProveedorId(''); setFecha(''); setNotas(''); setLineas([]); setSearch(''); setNuevoProv(''); };

  const addLinea = (i: Insumo) => {
    setLineas((prev) => (prev.some((l) => l.insumoId === i.id) ? prev : [...prev, { insumoId: i.id, nombre: i.nombre, unidad: i.unidad, cantidad: '', costo: costoDe(i) }]));
    setSearch('');
  };
  const setL = (id: string, patch: Partial<Linea>) => setLineas((prev) => prev.map((l) => (l.insumoId === id ? { ...l, ...patch } : l)));

  const total = lineas.reduce((s, l) => s + (Number(l.cantidad) || 0) * (Number(l.costo) || 0), 0);
  const valid = !!proveedorId && lineas.length > 0 && lineas.every((l) => Number(l.cantidad) > 0 && Number(l.costo) >= 0 && l.costo !== '');

  const crearProv = useMutation({
    mutationFn: () => almacenService.createProveedor({ nombre: nuevoProv.trim() }),
    onSuccess: (p) => { qc.invalidateQueries({ queryKey: ['proveedores'] }); setProveedorId(p.id); setNuevoProv(''); },
    onError: (e) => toast.error(apiError(e, 'Error al guardar')),
  });

  const crear = useMutation({
    mutationFn: () => almacenService.createCompra({
      clave, proveedorId, fechaEsperada: fecha || null, notas: notas || null,
      items: lineas.map((l) => ({ insumoId: l.insumoId, cantidad: Number(l.cantidad), costoUnitario: Number(l.costo) })),
    }),
    onSuccess: (c) => {
      qc.invalidateQueries({ queryKey: ['compras'] });
      toast.success(t('Compra №{n} creada', { n: c.numero }));
      reset(); onClose();
    },
    onError: (e) => toast.error(apiError(e, 'Error al guardar')),
  });

  const suggestions = useMemo(() => (search.trim() ? found : insumos.filter((i) => i.estado !== 'OK')).filter((i) => !lineas.some((l) => l.insumoId === i.id)).slice(0, 8), [search, found, insumos, lineas]);

  return (
    <Modal open={open} onClose={() => { reset(); onClose(); }} title={t('Nueva compra')} width="max-w-3xl">
      <div className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium text-foreground block mb-1.5">{t('Proveedor')} *</label>
            <Select value={proveedorId} onChange={setProveedorId}
              options={[{ value: '', label: t('Seleccionar...') }, ...proveedores.map((p) => ({ value: p.id, label: p.nombre }))]} />
            <div className="flex gap-2 mt-2">
              <input value={nuevoProv} onChange={(e) => setNuevoProv(e.target.value)} placeholder={t('Nuevo proveedor...')} className={cn(inputCls, 'py-1.5')} />
              <Button size="sm" variant="secondary" disabled={nuevoProv.trim().length < 2} loading={crearProv.isPending} onClick={() => crearProv.mutate()}><Plus size={13} /></Button>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-foreground block mb-1.5">{t('Entrega esperada')}</label>
            <DatePicker value={fecha} onChange={setFecha} min={new Date().toISOString().slice(0, 10)} />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-foreground block mb-1.5">{t('Agregar insumo')}</label>
          <SearchInput value={search} onChange={setSearch} placeholder={t('Buscar insumo...')} onEnter={() => suggestions[0] && addLinea(suggestions[0])} />
          {suggestions.length > 0 && (
            <div className="flex gap-2 flex-wrap mt-2">
              {!search.trim() && <span className="text-xs text-muted-foreground self-center">{t('Falta:')}</span>}
              {suggestions.map((i) => (
                <button key={i.id} type="button" onClick={() => addLinea(i)}
                  className="px-3 py-1.5 rounded-full text-xs bg-muted text-foreground hover:bg-primary/15 border border-border">
                  + {i.nombre} <span className="text-muted-foreground">({fmtQty(Number(i.stockActual))} {i.unidad})</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {lineas.length > 0 && (
          <div className="border border-border rounded-l overflow-hidden">
            <div className="grid grid-cols-[1fr_90px_100px_90px_28px] gap-2 px-3 py-2 bg-muted/50 text-xs font-semibold text-muted-foreground uppercase">
              <span>{t('Insumo')}</span><span>{t('Cantidad')}</span><span>{t('Precio')}</span><span className="text-right">{t('Suma')}</span><span />
            </div>
            {lineas.map((l) => (
              <div key={l.insumoId} className="grid grid-cols-[1fr_90px_100px_90px_28px] gap-2 px-3 py-2 items-center border-t border-border">
                <span className="text-sm text-foreground truncate">{l.nombre} <span className="text-muted-foreground">({l.unidad})</span></span>
                <input type="number" step="any" min="0" inputMode="decimal" value={l.cantidad} onChange={(e) => setL(l.insumoId, { cantidad: e.target.value })} className={cn(inputCls, 'py-1.5')} />
                <input type="number" step="any" min="0" inputMode="decimal" value={l.costo} onChange={(e) => setL(l.insumoId, { costo: e.target.value })} className={cn(inputCls, 'py-1.5')} />
                <span className="text-sm text-right text-foreground">{fmtMoney((Number(l.cantidad) || 0) * (Number(l.costo) || 0))}</span>
                <button type="button" onClick={() => setLineas((p) => p.filter((x) => x.insumoId !== l.insumoId))} className="text-muted-foreground hover:text-error"><X size={15} /></button>
              </div>
            ))}
            <div className="flex justify-between px-3 py-2.5 border-t border-border bg-muted/30">
              <span className="font-bold text-foreground">{t('TOTAL')}</span>
              <span className="font-bold text-primary">{fmtMoney(total)}</span>
            </div>
          </div>
        )}

        <div>
          <label className="text-sm font-medium text-foreground block mb-1.5">{t('Notas')}</label>
          <input value={notas} onChange={(e) => setNotas(e.target.value)} className={inputCls} />
        </div>

        <div className="flex gap-3 pt-1">
          <Button variant="secondary" className="flex-1" onClick={() => { reset(); onClose(); }}>{t('Cancelar')}</Button>
          <Button className="flex-1" disabled={!valid} loading={crear.isPending} onClick={() => crear.mutate()}><Check size={15} /> {t('Crear compra')}</Button>
        </div>
      </div>
    </Modal>
  );
}

// ═════════════════════ Recepción ═════════════════════

interface RecLinea { itemId: string; cantidad: string; costo: string }

function RecepcionModal({ compra, onClose }: { compra: Compra | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [lineas, setLineas] = useState<Record<string, RecLinea>>({});
  const [cerrar, setCerrar] = useState(false);
  const [notas, setNotas] = useState('');
  const [clave, setClave] = useState(uid);

  useEffect(() => {
    if (!compra) return;
    setClave(uid()); setCerrar(false); setNotas('');
    // по умолчанию: «привезли всё, что осталось»
    setLineas(Object.fromEntries(compra.items.map((i) => [i.id, {
      itemId: i.id, cantidad: String(Math.max(i.cantidad - i.cantidadRecibida, 0)), costo: String(i.costoUnitario),
    }])));
  }, [compra]);

  const mut = useMutation({
    mutationFn: (c: Compra) => almacenService.recibirCompra(c.id, {
      clave, cerrarPendientes: cerrar, notas: notas || null,
      items: c.items.filter((i) => i.cantidad - i.cantidadRecibida > 0).map((i) => ({
        compraItemId: i.id, cantidad: Number(lineas[i.id]?.cantidad) || 0,
        costoUnitario: lineas[i.id]?.costo !== '' ? Number(lineas[i.id]?.costo) : undefined,
      })),
    }),
    // Мгновенный отклик: обновляем кэш сразу, не дожидаясь сервера; при ошибке откатываем
    onMutate: async (c) => {
      await qc.cancelQueries({ queryKey: ['compras'] });
      await qc.cancelQueries({ queryKey: ['inventario'] });
      const prevCompras = qc.getQueriesData<{ data: Compra[]; total: number }>({ queryKey: ['compras'] });
      const prevInv = qc.getQueryData<Insumo[]>(['inventario']);
      const delta = new Map<string, number>();
      const items = c.items.map((i) => {
        const q = Number(lineas[i.id]?.cantidad) || 0;
        delta.set(i.insumoId, (delta.get(i.insumoId) ?? 0) + q);
        return { ...i, cantidadRecibida: i.cantidadRecibida + q };
      });
      const completa = items.every((i) => i.cantidadRecibida >= i.cantidad);
      const alguna = items.some((i) => i.cantidadRecibida > 0);
      const estado: EstadoCompra = completa ? 'RECIBIDA' : cerrar ? (alguna ? 'RECIBIDA' : 'CANCELADA') : alguna ? 'PARCIAL' : 'PEDIDA';
      qc.setQueriesData<{ data: Compra[]; total: number }>({ queryKey: ['compras'] }, (old) => old && ({ ...old, data: old.data.map((x) => (x.id === c.id ? { ...x, items, estado } : x)) }));
      if (prevInv) qc.setQueryData<Insumo[]>(['inventario'], prevInv.map((i) => (delta.get(i.id) ? { ...i, stockActual: Number(i.stockActual) + delta.get(i.id)! } : i)));
      const t0 = performance.now();
      onClose();
      return { prevCompras, prevInv, t0 };
    },
    onError: (e, _c, ctx) => {
      ctx?.prevCompras.forEach(([key, data]) => qc.setQueryData(key, data));
      if (ctx?.prevInv) qc.setQueryData(['inventario'], ctx.prevInv);
      toast.error(apiError(e, 'Error al guardar'));
    },
    onSuccess: (_d, _c, ctx) => {
      toast.success(t('Recepción registrada ({ms} ms)', { ms: Math.round(performance.now() - (ctx?.t0 ?? performance.now())) }));
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['compras'] });
      qc.invalidateQueries({ queryKey: ['inventario'] });
      qc.invalidateQueries({ queryKey: ['movimientos'] });
    },
  });

  if (!compra) return null;
  const pendientes = compra.items.filter((i) => i.cantidad - i.cantidadRecibida > 0);
  const set = (id: string, patch: Partial<RecLinea>) => setLineas((p) => ({ ...p, [id]: { ...p[id], ...patch } }));
  const recibidoTotal = pendientes.reduce((s, i) => s + (Number(lineas[i.id]?.cantidad) || 0) * (Number(lineas[i.id]?.costo) || 0), 0);
  const faltan = pendientes.filter((i) => (Number(lineas[i.id]?.cantidad) || 0) < i.cantidad - i.cantidadRecibida).length;

  return (
    <Modal open onClose={onClose} title={`${t('Recepción')} — ${t('Compra')} №${compra.numero}`} width="max-w-3xl">
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {t('Proveedor')}: <b className="text-foreground">{compra.proveedor.nombre}</b>. {t('Indica lo que realmente llegó. 0 = no trajeron.')}
        </p>

        <div className="border border-border rounded-l overflow-hidden">
          {pendientes.map((i) => {
            const falta = i.cantidad - i.cantidadRecibida;
            const l = lineas[i.id];
            const q = Number(l?.cantidad) || 0;
            return (
              <div key={i.id} className="px-3 py-3 border-b border-border last:border-0">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <p className="font-medium text-foreground">{i.nombre}</p>
                    <p className="text-xs text-muted-foreground">
                      {t('Pedido')}: {fmtQty(i.cantidad)} {i.unidad}{i.cantidadRecibida > 0 && <> · {t('ya recibido')}: {fmtQty(i.cantidadRecibida)}</>} · {t('falta')}: {fmtQty(falta)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => set(i.id, { cantidad: String(falta) })}
                      className={cn('px-2.5 py-1.5 rounded-m text-xs font-medium border', q === falta ? 'bg-success-bg text-success border-success/40' : 'bg-muted text-muted-foreground border-border')}>
                      {t('Llegó todo')}
                    </button>
                    <button type="button" onClick={() => set(i.id, { cantidad: '0' })}
                      className={cn('px-2.5 py-1.5 rounded-m text-xs font-medium border', q === 0 ? 'bg-error-bg text-error border-error/40' : 'bg-muted text-muted-foreground border-border')}>
                      {t('No trajeron')}
                    </button>
                    <input type="number" step="any" min="0" inputMode="decimal" aria-label={t('Cantidad')}
                      value={l?.cantidad ?? ''} onChange={(e) => set(i.id, { cantidad: e.target.value })}
                      className="w-24 bg-muted border border-border rounded-m px-2 py-1.5 text-sm text-right text-foreground focus:outline-none focus:border-primary" />
                    <span className="text-xs text-muted-foreground w-8">{i.unidad}</span>
                    <input type="number" step="any" min="0" inputMode="decimal" aria-label={t('Precio')}
                      value={l?.costo ?? ''} onChange={(e) => set(i.id, { costo: e.target.value })}
                      className="w-24 bg-muted border border-border rounded-m px-2 py-1.5 text-sm text-right text-foreground focus:outline-none focus:border-primary" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{t('Se acepta por un monto de')}</span>
          <span className="font-bold text-primary text-base">{fmtMoney(recibidoTotal)}</span>
        </div>

        {faltan > 0 && (
          <label className="flex items-start gap-2 text-sm text-foreground bg-warning-bg/50 border border-warning/30 rounded-m px-3 py-2.5 cursor-pointer">
            <input type="checkbox" checked={cerrar} onChange={(e) => setCerrar(e.target.checked)} className="mt-0.5" />
            <span>{t('Cerrar la compra: lo que falta ya no llegará')} ({faltan}). <span className="text-muted-foreground">{t('Si no la cierras, quedará esperando la siguiente entrega.')}</span></span>
          </label>
        )}

        <input value={notas} onChange={(e) => setNotas(e.target.value)} placeholder={t('Notas (opcional)')} className={inputCls} />

        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={onClose}>{t('Cancelar')}</Button>
          <Button className="flex-1" loading={mut.isPending} onClick={() => mut.mutate(compra)}><PackageCheck size={15} /> {t('Aceptar')}</Button>
        </div>
      </div>
    </Modal>
  );
}
