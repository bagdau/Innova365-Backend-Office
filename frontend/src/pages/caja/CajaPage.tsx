import { liveInterval } from '../../lib/live';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle, CreditCard, Banknote, QrCode, ChevronLeft, ArrowLeftRight } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { pedidosService } from '../../services/pedidos.service';
import { formatCurrency } from '../../utils/cn';
import type { Pedido } from '../../types';
import toast from 'react-hot-toast';
import { cn } from '../../utils/cn';
import { t } from '../../i18n';
import { currencySymbol } from '../../lib/currency';
import { PayQr } from '../../components/shared/PayQr';
import { printOrder, printDayClosing, printAfterPayment } from '../../lib/printClient';
import { DevicePrinter } from '../../components/shared/DevicePrinter';
import { Printer, FileText } from 'lucide-react';
import { useNow, minutesSince } from '../../hooks/useNow';

const METODOS = [
  { key: 'Efectivo', label: t('Efectivo'), icon: Banknote },
  { key: 'Tarjeta', label: t('Tarjeta'), icon: CreditCard },
  { key: 'QR', label: t('QR'), icon: QrCode },
  { key: 'Transferencia', label: t('Transferencia'), icon: ArrowLeftRight },
];

export default function CajaPage() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Pedido | null>(null);
  const [metodo, setMetodo] = useState('Efectivo');
  const [montoRecibido, setMontoRecibido] = useState('');

  const { data: pedidos = [] } = useQuery<Pedido[]>({
    queryKey: ['pedidosActivos'],
    queryFn: pedidosService.getActivos,
    refetchInterval: liveInterval,
  });

  const now = useNow();
  const pendientesPago = pedidos.filter((p) => p.estado === 'ENTREGADO');
  const enProceso = pedidos.filter((p) => ['EN_COCINA', 'EN_PREPARACION', 'LISTO'].includes(p.estado));

  const pagar = useMutation({
    mutationFn: () => pedidosService.registrarPago(selected!.id, metodo),
    onSuccess: (resp) => {
      const ped = selected;
      qc.invalidateQueries({ queryKey: ['pedidosActivos'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      setSelected(null);
      setMontoRecibido('');
      toast.success(t('Pago registrado correctamente'));
      if (ped) void printAfterPayment(ped, metodo, resp);   // чек сразу после оплаты
    },
    onError: () => toast.error(t('Error al registrar pago')),
  });

  const total = Number(selected?.total ?? 0);
  const recibido = parseFloat(montoRecibido) || 0;
  const vuelto = recibido - total;

  return (
    <div className="flex flex-col lg:flex-row gap-4 lg:gap-5 h-full">
      {/* Pending List (на телефоне скрывается, когда выбран заказ) */}
      <div className={cn('w-full lg:w-80 lg:flex-shrink-0 flex-col bg-card border border-border rounded-l', selected ? 'hidden lg:flex' : 'flex')}>
        <div className="px-4 pt-3"><DevicePrinter /></div>
        <div className="px-4 py-4 border-b border-border flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">{t('Pendientes de pago')}</h3>
          <div className="flex items-center gap-2">
            <button onClick={() => printDayClosing()} title={t('Resumen del día')} aria-label={t('Resumen del día')}
              className="p-1.5 rounded-m text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"><Printer size={15} /></button>
            <span className="text-xs bg-primary text-white px-2 py-0.5 rounded-pill font-bold">{pendientesPago.length}</span>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-border/50">
          {pendientesPago.length === 0 ? (
            <p className="text-center py-8 text-sm text-muted-foreground">{t('Sin pedidos pendientes')}</p>
          ) : pendientesPago.map((p) => (
            <button
              key={p.id}
              onClick={() => { setSelected(p); setMontoRecibido(''); }}
              className={cn(
                'w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors',
                selected?.id === p.id && 'bg-muted/70 border-l-2 border-primary'
              )}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-semibold text-foreground">
                  {p.mesa ? t('Mesa {n}', { n: p.mesa.numero }) : t('Para llevar')}
                </span>
                <span className="text-sm font-bold text-primary">{formatCurrency(Number(p.total ?? 0))}</span>
              </div>
              <div className="text-xs text-muted-foreground">
                {p.mesero?.nombre ?? ''} · {p.items.length} {t('items')}
              </div>
            </button>
          ))}

          {/* Pedidos aún en cocina / sala: el cajero ve el avance real */}
          <div className="px-4 py-2 bg-muted/40 flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{t('En proceso')}</span>
            <span className="text-xs font-bold text-muted-foreground">{enProceso.length}</span>
          </div>
          {enProceso.length === 0 ? (
            <p className="text-center py-5 text-xs text-muted-foreground">{t('Sin pedidos en proceso')}</p>
          ) : enProceso.map((p) => (
            <div key={p.id} className="px-4 py-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-semibold text-foreground">
                  {p.mesa ? t('Mesa {n}', { n: p.mesa.numero }) : t('Para llevar')} · #{p.numero}
                </span>
                <StatusBadge variant={p.estado} />
              </div>
              <div className="text-xs text-muted-foreground">
                {p.estado === 'EN_PREPARACION'
                  ? t('👨‍🍳 Preparando · {n} min', { n: minutesSince(p.tiempoInicio, now) })
                  : `${p.mesero?.nombre ?? ''} · ${p.items.length} ${t('items')}`}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Payment Panel */}
      <div className={cn('flex-1 min-w-0 flex-col bg-card border border-border rounded-l', selected ? 'flex' : 'hidden lg:flex')}>
        {!selected ? (
          <div className="flex-1 flex items-center justify-center flex-col gap-3 text-muted-foreground">
            <CheckCircle size={48} className="opacity-20" />
            <p>{t('Selecciona un pedido para cobrar')}</p>
          </div>
        ) : (
          <>
            <div className="px-4 sm:px-6 py-4 border-b border-border flex items-center justify-between gap-2">
              <button onClick={() => setSelected(null)} className="lg:hidden -ml-1 p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted" aria-label={t('Atrás')}><ChevronLeft size={20} /></button>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-semibold text-foreground">
                  {t('Cuenta')} — {selected.mesa ? t('Mesa {n}', { n: selected.mesa.numero }) : t('Para llevar')}
                </h3>
              </div>
              <StatusBadge variant={selected.estado.toLowerCase()} />
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Items */}
              <div className="space-y-2">
                {selected.items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between text-sm">
                    <span className="text-foreground">
                      {item.cantidad}x {item.producto.nombre}
                    </span>
                    <span className="text-muted-foreground">{formatCurrency(Number(item.subtotal))}</span>
                  </div>
                ))}
              </div>

              <div className="border-t border-border pt-4">
                <div className="flex justify-between text-2xl font-bold text-foreground">
                  <span>{t('TOTAL A PAGAR')}</span>
                  <span className="text-primary">{formatCurrency(total)}</span>
                </div>
              </div>

              {/* Método de Pago */}
              <div>
                <p className="text-sm font-medium text-foreground mb-3">{t('Método de pago')}</p>
                <div className="grid grid-cols-2 min-[420px]:grid-cols-4 gap-2 sm:gap-3">
                  {METODOS.map(({ key, label, icon: Icon }) => (
                    <button
                      key={key}
                      onClick={() => setMetodo(key)}
                      className={cn(
                        'flex flex-col items-center gap-2 p-3 rounded-l border-2 transition-colors',
                        metodo === key ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-muted text-muted-foreground hover:text-foreground'
                      )}
                    >
                      <Icon size={20} />
                      <span className="text-xs font-medium">{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {metodo === 'QR' && <PayQr total={total} numero={selected.numero} />}

              {/* Efectivo */}
              {metodo === 'Efectivo' && (
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-foreground block mb-1.5">{t('Monto recibido ({c})', { c: currencySymbol() })}</label>
                    <input
                      type="number"
                      step="0.50"
                      value={montoRecibido}
                      onChange={(e) => setMontoRecibido(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-muted border border-border rounded-m px-3 py-2 text-lg font-bold text-foreground focus:outline-none focus:border-primary"
                    />
                  </div>
                  {recibido > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{t('Vuelto')}</span>
                      <span className={cn('font-bold', vuelto >= 0 ? 'text-success' : 'text-error')}>
                        {formatCurrency(Math.abs(vuelto))}
                        {vuelto < 0 ? t(' (falta)') : ''}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="p-6 border-t border-border space-y-3">
              <Button
                className="w-full"
                size="lg"
                loading={pagar.isPending}
                disabled={metodo === 'Efectivo' && recibido < total}
                onClick={() => pagar.mutate()}
              >
                <CheckCircle size={16} /> {t('Registrar pago')}
              </Button>
              <div className="grid grid-cols-2 gap-2">
                <Button size="sm" variant="secondary" onClick={() => printOrder('cuenta', selected!)}><FileText size={14} /> {t('Cuenta previa')}</Button>
                <Button size="sm" variant="secondary" onClick={() => printOrder('recibo', selected!)}><Printer size={14} /> {t('Imprimir recibo')}</Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
