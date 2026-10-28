import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search, Eye, Clock, UtensilsCrossed, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Modal } from '../../components/ui/Modal';
import { pedidosService } from '../../services/pedidos.service';
import { formatCurrency, formatDate, cn } from '../../utils/cn';
import type { Pedido, PaginatedResponse } from '../../types';
import { payLabel } from '../../lib/payments';
import { t } from '../../i18n';
import { printOrder } from '../../lib/printClient';
import { useAuthStore } from '../../store/authStore';
import { can } from '../../auth/permissions';

const ESTADOS = ['', 'PENDIENTE', 'EN_COCINA', 'EN_PREPARACION', 'LISTO', 'ENTREGADO', 'PAGADO', 'CANCELADO'];

const ESTADO_LABELS: Record<string, string> = {
  PENDIENTE: t('Pendiente'),
  EN_COCINA: t('En cocina'),
  EN_PREPARACION: t('En preparación'),
  LISTO: t('Listo'),
  ENTREGADO: t('Entregado'),
  PAGADO: t('Pagado'),
  CANCELADO: t('Cancelado'),
};

export default function HistorialPage() {
  const navigate = useNavigate();
  const rol = useAuthStore((s) => s.user?.rol);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [estado, setEstado] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Pedido | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => { setQuery(search.trim()); setPage(1); }, 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  const { data, isLoading } = useQuery<PaginatedResponse<Pedido>>({
    queryKey: ['pedidos', estado, page, query],
    queryFn: () => pedidosService.getAll({ ...(estado && { estado }), ...(query && { q: query }), page: String(page), limit: '20' }),
    refetchInterval: 30000, // refresca cada 15s para mostrar datos actualizados
  });

  const pedidos = data?.data ?? [];

  const totalPages = Math.ceil((data?.total ?? 0) / 20);

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('Buscar por mesa o #...')}
            className="w-full bg-muted border border-border rounded-lg pl-8 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
          />
        </div>
        {can(rol, 'pedidosNuevo') && (
          <button onClick={() => navigate('/pedidos/nuevo')}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
            <Plus size={16} /> {t('Nuevo Pedido')}
          </button>
        )}
        <div className="flex gap-2 flex-wrap">
          {ESTADOS.map((e) => (
            <button
              key={e}
              onClick={() => { setEstado(e); setPage(1); }}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap',
                estado === e
                  ? 'bg-primary text-white'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              )}
            >
              {e ? ESTADO_LABELS[e] : t('Todos')}
            </button>
          ))}
        </div>
      </div>

      {/* Cards grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-4 animate-pulse h-36" />
          ))}
        </div>
      ) : pedidos.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <UtensilsCrossed size={40} className="mx-auto mb-3 opacity-20" />
          <p>{t('Sin pedidos')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {pedidos.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelected(p)}
              className="bg-card border border-border rounded-xl p-4 text-left flex flex-col gap-3 hover:border-primary/50 hover:shadow-md transition-all group"
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-bold text-foreground text-base">
                    {p.mesa ? t('Mesa {n}', { n: p.mesa.numero }) : t('Para llevar')}
                  </p>
                  <p className="text-xs text-muted-foreground font-mono">#{p.numero}</p>
                </div>
                <StatusBadge variant={p.estado.toLowerCase()} />
              </div>

              {/* Productos */}
              <div className="flex-1">
                <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                  {p.items.slice(0, 3).map(i => `${i.cantidad}× ${i.producto.nombre}`).join(', ')}
                  {p.items.length > 3 && t('+{n} más', { n: p.items.length - 3 })}
                </p>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between pt-2 border-t border-border/50">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock size={11} />
                  {formatDate(p.creadoEn)}
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-primary text-sm">{formatCurrency(Number(p.total ?? 0))}</span>
                  <Eye size={13} className="text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Paginación */}
      {(data?.total ?? 0) > 20 && (
        <div className="flex items-center gap-2 justify-end text-sm">
          <button
            disabled={page === 1}
            onClick={() => setPage(p => p - 1)}
            aria-label={t('Atrás')}
            className="p-1.5 rounded-lg bg-muted text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-muted-foreground text-xs">
            {t('Pág. {page} de {total}', { page, total: totalPages })}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage(p => p + 1)}
            aria-label={t('Siguiente')}
            className="p-1.5 rounded-lg bg-muted text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      {/* Modal detalle */}
      {selected && (
        <Modal open={!!selected} onClose={() => setSelected(null)} title={t('Pedido #{n}', { n: selected.numero })} width="max-w-lg" footer={
            <div className="flex gap-2">
              <button
                onClick={() => printOrder(selected.pagado || selected.estado === 'PAGADO' ? 'recibo' : 'cuenta', selected)}
                className="flex-1 px-4 py-2.5 bg-muted text-sm text-foreground rounded-lg hover:bg-muted/80 transition-colors"
              >
                {t('Imprimir')}
              </button>
              <button
                onClick={() => setSelected(null)}
                className="flex-1 px-4 py-2.5 bg-primary text-white text-sm rounded-lg hover:bg-primary/90 transition-colors"
              >
                {t('Cerrar')}
              </button>
            </div>
        }>
          <div className="space-y-4">
            {/* Info */}
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-foreground">
                  {selected.mesa ? t('Mesa {n}', { n: selected.mesa.numero }) : t('Para llevar')}
                </p>
                {selected.mesero && <p className="text-xs text-muted-foreground mt-0.5">{t('Pedido registrado por')}: {selected.mesero.nombre}</p>}
                {selected.cocineroNombre && <p className="text-xs text-muted-foreground mt-0.5">{t('Готовность отметил')}: {selected.cocineroNombre}</p>}
                {selected.cajeroNombre && <p className="text-xs text-muted-foreground mt-0.5">{t('Оплату принял')}: {selected.cajeroNombre}</p>}
              </div>
              <StatusBadge variant={selected.estado.toLowerCase()} />
            </div>

            {/* Items */}
            <div className="bg-muted rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-4 py-2.5 text-xs text-muted-foreground uppercase font-medium">{t('Наименование позиции')}</th>
                    <th className="text-center px-3 py-2.5 whitespace-nowrap text-xs text-muted-foreground uppercase font-medium">{t('Cant.')}</th>
                    <th className="text-right px-4 py-2.5 text-xs text-muted-foreground uppercase font-medium">{t('Subtotal')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {selected.items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-2.5 text-foreground">{item.producto.nombre}</td>
                      <td className="px-3 py-2.5 text-center text-muted-foreground">{item.cantidad}</td>
                      <td className="px-4 py-2.5 text-right font-medium text-foreground">
                        {formatCurrency(Number(item.subtotal))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Total */}
            <div className="flex justify-between items-center text-lg font-bold text-foreground border-t border-border pt-3">
              <span>{t('TOTAL')}</span>
              <span className="text-primary text-xl">{formatCurrency(Number(selected.total ?? 0))}</span>
            </div>

            {selected.metodoPago && (
              <p className="text-sm text-muted-foreground">{t('Método de pago:')} {payLabel(selected.metodoPago)}</p>
            )}

          </div>
        </Modal>
      )}
    </div>
  );
}
