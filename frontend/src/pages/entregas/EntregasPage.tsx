import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bike, CheckCheck, ChefHat, CreditCard, PackageCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { pedidosService } from '../../services/pedidos.service';
import { liveInterval } from '../../lib/live';
import { formatCurrency, timeAgo } from '../../utils/cn';
import type { Pedido } from '../../types';
import { t } from '../../i18n';

/** Страница доставщика: готовые заказы «с собой» — забрал и отметил «Доставлено». Оплату принимает кассир. */
export default function EntregasPage() {
  const qc = useQueryClient();
  const { data: pedidos = [], isLoading } = useQuery<Pedido[]>({ queryKey: ['pedidosActivos'], queryFn: pedidosService.getActivos, refetchInterval: liveInterval });

  const entregar = useMutation({
    mutationFn: (id: string) => pedidosService.updateEstado(id, 'ENTREGADO'),
    onSuccess: () => { toast.success(t('Pedido entregado')); void qc.invalidateQueries({ queryKey: ['pedidosActivos'] }); },
    onError: () => toast.error(t('Error al marcar la entrega')),
  });

  const llevar = pedidos.filter((p) => p.tipo === 'PARA_LLEVAR');
  const listos = llevar.filter((p) => p.estado === 'LISTO');
  const cocina = llevar.filter((p) => ['PENDIENTE', 'EN_COCINA', 'EN_PREPARACION'].includes(p.estado));
  const esperan = llevar.filter((p) => p.estado === 'ENTREGADO');

  const lineas = (p: Pedido) => p.items.map((i) => `${i.cantidad}× ${i.producto?.nombre ?? ''}`).join(', ');

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Bike size={14} /> {t('Solo pedidos para llevar')}</p>

      <section>
        <h2 className="flex items-center gap-2 text-base font-semibold text-foreground mb-3"><PackageCheck size={18} className="text-success" />{t('Listos para entregar')} <span className="text-muted-foreground font-normal">({listos.length})</span></h2>
        {listos.length === 0 ? (
          <div className="bg-card border border-border rounded-l p-8 text-center text-sm text-muted-foreground">{isLoading ? t('Cargando...') : t('No hay pedidos listos para entregar')}</div>
        ) : (
          <div className="space-y-3">
            {listos.map((p) => (
              <div key={p.id} className="bg-card border-2 border-success/40 rounded-l p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-lg font-bold text-foreground">{t('Pedido #{n}', { n: p.numero })}</div>
                    <div className="text-xs text-muted-foreground">{p.tiempoListo ? timeAgo(p.tiempoListo) : ''}{p.mesero?.nombre ? ` · ${p.mesero.nombre}` : ''}</div>
                  </div>
                  <div className="text-lg font-bold text-primary flex-shrink-0">{p.total !== undefined && p.total !== null ? formatCurrency(Number(p.total)) : ''}</div>
                </div>
                <p className="mt-2 text-sm text-muted-foreground leading-snug">{lineas(p)}</p>
                <button onClick={() => entregar.mutate(p.id)} disabled={entregar.isPending}
                  className="mt-4 w-full h-12 rounded-m bg-success text-background font-semibold text-base flex items-center justify-center gap-2 active:scale-[.98] transition disabled:opacity-60">
                  <CheckCheck size={20} /> {t('Entregar')}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {cocina.length > 0 && (
        <section>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground mb-2"><ChefHat size={16} />{t('Se preparan en cocina')} ({cocina.length})</h2>
          <div className="space-y-2">{cocina.map((p) => (
            <div key={p.id} className="bg-card border border-border rounded-m px-4 py-3 flex items-center justify-between gap-3 text-sm">
              <span className="font-medium text-foreground">{t('Pedido #{n}', { n: p.numero })}</span><span className="text-muted-foreground truncate">{lineas(p)}</span>
            </div>))}</div>
        </section>
      )}

      {esperan.length > 0 && (
        <section>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground mb-2"><CreditCard size={16} />{t('Entregados, esperan el pago')} ({esperan.length})</h2>
          <div className="space-y-2">{esperan.map((p) => (
            <div key={p.id} className="bg-card border border-border rounded-m px-4 py-3 flex items-center justify-between gap-3 text-sm opacity-80">
              <span className="font-medium text-foreground">{t('Pedido #{n}', { n: p.numero })}</span><span className="text-muted-foreground">{p.total !== undefined && p.total !== null ? formatCurrency(Number(p.total)) : ''}</span>
            </div>))}</div>
        </section>
      )}
    </div>
  );
}
