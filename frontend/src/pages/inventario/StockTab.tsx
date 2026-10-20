import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Package, SlidersHorizontal, ShoppingCart, Printer } from 'lucide-react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { MetricCard } from '../../components/shared/MetricCard';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { SearchInput } from '../../components/shared/SearchInput';
import { TableWrapper, Tr, Td } from '../../components/shared/TableWrapper';
import { inventarioService } from '../../services/inventario.service';
import { almacenService, uid } from '../../services/almacen.service';
import { reportesService } from '../../services/reportes.service';
import { useInsumoSearch } from '../../search/useSearch';
import { printStock } from '../../lib/documents';
import { fmtQty } from '../../lib/print';
import { cn } from '../../utils/cn';
import { t, apiError } from '../../i18n';
import type { Insumo } from '../../types';

const inputCls = 'w-full bg-muted border border-border rounded-m px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary';

export default function StockTab({ onOrder }: { onOrder: () => void }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Insumo | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [adjusting, setAdjusting] = useState<Insumo | null>(null);
  const [search, setSearch] = useState('');
  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm();

  const { data: insumos = [], isLoading } = useQuery<Insumo[]>({ queryKey: ['inventario'], queryFn: inventarioService.getAll });
  const { data: rest } = useQuery({ queryKey: ['restaurante'], queryFn: reportesService.getRestaurante, staleTime: 300_000 });
  const visible = useInsumoSearch(insumos, search);

  const total = insumos.length;
  const ok = insumos.filter((i) => i.estado === 'OK').length;
  const alertas = insumos.filter((i) => i.estado !== 'OK').length;

  const save = useMutation({
    mutationFn: (data: any) => (editing ? inventarioService.update(editing.id, data) : inventarioService.create(data)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventario'] });
      setShowModal(false); setEditing(null); reset();
      toast.success(editing ? t('Insumo actualizado') : t('Insumo creado'));
    },
    onError: (e) => toast.error(apiError(e, 'Error al guardar')),
  });

  const del = useMutation({
    mutationFn: (id: string) => inventarioService.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['inventario'] }); toast.success(t('Insumo eliminado')); },
    onError: (e) => toast.error(apiError(e, 'Error al eliminar')),
  });

  const openEdit = (ins: Insumo) => {
    setEditing(ins);
    reset({ nombre: ins.nombre, categoria: ins.categoria, unidad: ins.unidad, stockMinimo: Number(ins.stockMinimo), proveedor: ins.proveedor });
    setShowModal(true);
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <MetricCard title={t('Total insumos')} value={total} icon={<Package size={16} className="text-info" />} iconBg="bg-info-bg" />
        <MetricCard title={t('Stock OK')} value={ok} icon={<Package size={16} className="text-success" />} iconBg="bg-success-bg" />
        <MetricCard title={t('Alertas activas')} value={alertas} icon={<Package size={16} className="text-error" />} iconBg="bg-error-bg" alert={alertas > 0} />
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <SearchInput value={search} onChange={setSearch} placeholder={t('Buscar insumo...')} hotkey="/" className="w-72" />
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant="secondary" onClick={() => printStock(visible, rest)}><Printer size={14} /> {t('Imprimir')}</Button>
          {alertas > 0 && (
            <Button size="sm" variant="secondary" onClick={() => { sessionStorage.setItem('innova365-order-low', '1'); onOrder(); }}>
              <ShoppingCart size={14} /> {t('Pedir lo que falta')}
            </Button>
          )}
          <Button size="sm" onClick={() => { setEditing(null); reset({ stockActual: 0 }); setShowModal(true); }}>
            <Plus size={14} /> {t('Nuevo Insumo')}
          </Button>
        </div>
      </div>

      <TableWrapper
        mobileHide={[1, 3, 4]}
        headers={[t('Insumo'), t('Categoría'), t('Stock Actual'), t('Unidad'), t('Stock Mínimo'), t('Estado'), t('Acciones')]}
        isEmpty={visible.length === 0}
        emptyMessage={isLoading ? t('Cargando...') : search ? t('Nada encontrado para «{q}»', { q: search.trim() }) : t('Sin insumos registrados')}
      >
        {visible.map((ins) => (
          <Tr key={ins.id}>
            <Td className="font-medium">{ins.nombre}</Td>
            <Td className="text-muted-foreground hidden md:table-cell">{ins.categoria ?? '—'}</Td>
            <Td className={cn('font-bold', ins.estado === 'CRITICO' ? 'text-error' : ins.estado === 'BAJO' ? 'text-warning' : 'text-foreground')}>
              {fmtQty(Number(ins.stockActual))}<span className="md:hidden text-xs font-normal text-muted-foreground"> {ins.unidad}</span>
            </Td>
            <Td className="text-muted-foreground hidden md:table-cell">{ins.unidad}</Td>
            <Td className="text-muted-foreground hidden md:table-cell">{fmtQty(Number(ins.stockMinimo))}</Td>
            <Td><StatusBadge variant={ins.estado.toLowerCase()} /></Td>
            <Td>
              <div className="flex gap-3">
                <button onClick={() => setAdjusting(ins)} aria-label={t('Ajuste / merma')} title={t('Ajuste / merma')} className="text-muted-foreground hover:text-warning transition-colors"><SlidersHorizontal size={14} /></button>
                <button onClick={() => openEdit(ins)} title={t('Editar')} className="text-muted-foreground hover:text-primary transition-colors"><Pencil size={14} /></button>
                <button onClick={() => { if (confirm(t('¿Eliminar este insumo?'))) del.mutate(ins.id); }} title={t('Eliminar')} className="text-muted-foreground hover:text-error transition-colors"><Trash2 size={14} /></button>
              </div>
            </Td>
          </Tr>
        ))}
      </TableWrapper>

      {/* Создание / редактирование */}
      <Modal open={showModal} onClose={() => { setShowModal(false); setEditing(null); reset(); }} title={editing ? t('Editar Insumo') : t('Nuevo Insumo')}>
        <form onSubmit={handleSubmit((d) => save.mutate(editing ? { ...d, stockActual: undefined } : d))} className="space-y-4">
          {([['nombre', t('Nombre')], ['categoria', t('Categoría')], ['unidad', t('Unidad')], ['proveedor', t('Proveedor')]] as const).map(([field, label]) => (
            <div key={field}>
              <label className="text-sm font-medium text-foreground block mb-1.5">{label}</label>
              <input {...register(field)} className={inputCls} />
            </div>
          ))}
          <div className="grid grid-cols-2 gap-3">
            {!editing && (
              <div>
                <label className="text-sm font-medium text-foreground block mb-1.5">{t('Saldo inicial')}</label>
                <input type="number" step="any" {...register('stockActual', { valueAsNumber: true })} className={inputCls} />
              </div>
            )}
            <div>
              <label className="text-sm font-medium text-foreground block mb-1.5">{t('Stock Mínimo')}</label>
              <input type="number" step="any" {...register('stockMinimo', { valueAsNumber: true })} className={inputCls} />
            </div>
          </div>
          {editing && <p className="text-xs text-muted-foreground">{t('El stock se cambia solo con compras, ajustes o revisión: así queda registro de cada movimiento.')}</p>}
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" type="button" className="flex-1" onClick={() => { setShowModal(false); setEditing(null); reset(); }}>{t('Cancelar')}</Button>
            <Button type="submit" className="flex-1" loading={isSubmitting}>{t('Guardar')}</Button>
          </div>
        </form>
      </Modal>

      <AdjustModal insumo={adjusting} onClose={() => setAdjusting(null)} />
    </div>
  );
}

// ───────── Ajuste / merma ─────────

function AdjustModal({ insumo, onClose }: { insumo: Insumo | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [tipo, setTipo] = useState<'MERMA' | 'AJUSTE'>('MERMA');
  const [cantidad, setCantidad] = useState('');
  const [motivo, setMotivo] = useState('');
  const [clave, setClave] = useState(uid);

  const m = useMutation({
    mutationFn: () => almacenService.ajustar(insumo!.id, { clave, tipo, cantidad: Number(cantidad), motivo: motivo || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventario'] });
      qc.invalidateQueries({ queryKey: ['movimientos'] });
      toast.success(t('Movimiento registrado'));
      setCantidad(''); setMotivo(''); setClave(uid());
      onClose();
    },
    onError: (e) => toast.error(apiError(e, 'Error al guardar')),
  });

  const n = Number(cantidad);
  const valid = Number.isFinite(n) && n !== 0 && (tipo === 'AJUSTE' || n > 0);

  return (
    <Modal open={!!insumo} onClose={onClose} title={insumo ? `${t('Ajuste / merma')} — ${insumo.nombre}` : ''}>
      {insumo && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{t('Stock Actual')}: <b className="text-foreground">{fmtQty(Number(insumo.stockActual))} {insumo.unidad}</b></p>
          <div className="grid grid-cols-2 gap-2">
            {(['MERMA', 'AJUSTE'] as const).map((x) => (
              <button key={x} type="button" onClick={() => setTipo(x)}
                className={cn('px-3 py-2 rounded-m text-sm font-medium border transition-colors', tipo === x ? 'bg-primary text-white border-primary' : 'bg-muted text-muted-foreground border-border')}>
                {x === 'MERMA' ? t('Merma (descarte)') : t('Ajuste (±)')}
              </button>
            ))}
          </div>
          <div>
            <label className="text-sm font-medium text-foreground block mb-1.5">
              {tipo === 'MERMA' ? t('Cuánto se descarta') : t('Cambio (+ suma, − resta)')} ({insumo.unidad})
            </label>
            <input type="number" step="any" autoFocus value={cantidad} onChange={(e) => setCantidad(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground block mb-1.5">{t('Motivo')}</label>
            <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder={t('Ej: producto vencido')} className={inputCls} />
          </div>
          <div className="flex gap-3 pt-1">
            <Button variant="secondary" className="flex-1" onClick={onClose}>{t('Cancelar')}</Button>
            <Button className="flex-1" disabled={!valid} loading={m.isPending} onClick={() => m.mutate()}>{t('Guardar')}</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
