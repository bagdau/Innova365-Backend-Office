import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ChefHat, Users, Wallet, Smartphone, Flame, Clock, CheckCircle2, HandPlatter, Ban } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { pedidosService } from '../../services/pedidos.service';
import { api } from '../../services/api';
import { useNow, minutesSince } from '../../hooks/useNow';
import { formatCurrency, rolColor, rolLabel, cn } from '../../utils/cn';
import { t, apiError, locale } from '../../i18n';
import type { Pedido } from '../../types';

interface EnLinea { usuarioId: string; nombre: string; rol: string; desde: number }

const hhmm = (iso?: string | null) => (iso ? new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(new Date(iso)) : null);

/** Цвет «возраста» заказа на кухне: вовремя / внимание / просрочен */
const ageTone = (min: number) => (min >= 20 ? 'text-error' : min >= 10 ? 'text-warning' : 'text-success');

export default function MonitorPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const now = useNow(15_000);

  const { data: pedidos = [] } = useQuery<Pedido[]>({ queryKey: ['pedidosActivos'], queryFn: pedidosService.getActivos, refetchInterval: 30_000 });
  const { data: enLinea = [] } = useQuery<EnLinea[]>({ queryKey: ['enLinea'], queryFn: () => api.get('/en-linea').then((r) => r.data), refetchInterval: 30_000 });

  const cambiar = useMutation({
    mutationFn: ({ id, estado }: { id: string; estado: string }) => pedidosService.updateEstado(id, estado),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pedidosActivos'] }),
    onError: (e) => toast.error(apiError(e, 'Error al actualizar estado')),
  });

  const grupos = useMemo(() => {
    const g = { cocina: [] as Pedido[], preparando: [] as Pedido[], listo: [] as Pedido[], pago: [] as Pedido[] };
    for (const p of pedidos) {
      if (p.estado === 'EN_COCINA' || p.estado === 'PENDIENTE') g.cocina.push(p);
      else if (p.estado === 'EN_PREPARACION') g.preparando.push(p);
      else if (p.estado === 'LISTO') g.listo.push(p);
      else if (p.estado === 'ENTREGADO') g.pago.push(p);
    }
    return g;
  }, [pedidos]);

  const enCocina = [...grupos.cocina, ...grupos.preparando].filter((p) => p.items.some((i) => i.producto.requiereCocina));
  const masViejo = enCocina.reduce((m, p) => Math.max(m, minutesSince(p.creadoEn, now)), 0);
  const donde = (p: Pedido) => (p.mesa ? t('Mesa {n}', { n: p.mesa.numero }) : t('Para llevar'));

  const tiles = [
    { label: t('En cocina'), n: grupos.cocina.length, icon: ChefHat, tone: 'text-warning bg-warning-bg' },
    { label: t('Se prepara'), n: grupos.preparando.length, icon: Flame, tone: 'text-info bg-info-bg' },
    { label: t('Listo para servir'), n: grupos.listo.length, icon: HandPlatter, tone: 'text-success bg-success-bg' },
    { label: t('Esperan el pago'), n: grupos.pago.length, icon: Wallet, tone: 'text-primary bg-primary-soft' },
  ];

  return (
    <div className="space-y-5">
      {/* Быстрый переход «как у сотрудников» */}
      <div className="flex gap-2 flex-wrap items-center">
        <span className="text-xs text-muted-foreground mr-1">{t('Abrir pantalla de:')}</span>
        <Button size="sm" variant="secondary" onClick={() => navigate('/cocina')}><ChefHat size={14} /> {t('Cocina')}</Button>
        <Button size="sm" variant="secondary" onClick={() => navigate('/mesero')}><Smartphone size={14} /> {t('Mesero')}</Button>
        <Button size="sm" variant="secondary" onClick={() => navigate('/caja')}><Wallet size={14} /> {t('Caja')}</Button>
      </div>

      {/* Счётчики по этапам */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {tiles.map((x) => (
          <div key={x.label} className="bg-card border border-border rounded-l p-4 flex items-center gap-3">
            <div className={cn('w-10 h-10 rounded-m flex items-center justify-center', x.tone)}><x.icon size={18} /></div>
            <div><p className="text-2xl font-bold text-foreground leading-none">{x.n}</p><p className="text-xs text-muted-foreground mt-1">{x.label}</p></div>
          </div>
        ))}
      </div>

      {/* Кто в системе */}
      <div className="bg-card border border-border rounded-l p-4">
        <p className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3"><Users size={15} className="text-primary" /> {t('Ahora en el sistema')} <span className="text-muted-foreground font-normal">({enLinea.length})</span></p>
        {enLinea.length === 0 ? <p className="text-sm text-muted-foreground">{t('Nadie conectado')}</p> : (
          <div className="flex gap-2 flex-wrap">
            {enLinea.map((u) => (
              <span key={u.usuarioId} className="inline-flex items-center gap-2 bg-muted/50 border border-border rounded-full pl-2 pr-3 py-1 text-sm text-foreground">
                <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
                {u.nombre}
                <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded', rolColor(u.rol))}>{rolLabel(u.rol)}</span>
                <span className="text-[11px] text-muted-foreground">{hhmm(new Date(u.desde).toISOString())}</span>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Кухня в реальном времени */}
      <div className="bg-card border border-border rounded-l p-4">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <p className="text-sm font-semibold text-foreground flex items-center gap-2"><ChefHat size={15} className="text-primary" /> {t('Cocina en tiempo real')}</p>
          {enCocina.length > 0 && <span className={cn('text-xs font-medium flex items-center gap-1', ageTone(masViejo))}><Clock size={12} /> {t('El más antiguo: {n} min', { n: masViejo })}</span>}
        </div>
        {enCocina.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">{t('En la cocina no hay pedidos')}</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {enCocina.map((p) => {
              const min = minutesSince(p.creadoEn, now);
              const prep = p.estado === 'EN_PREPARACION';
              return (
                <div key={p.id} className={cn('border-2 rounded-l overflow-hidden', prep ? 'border-info' : 'border-warning')}>
                  <div className={cn('px-3 py-2 flex items-center justify-between', prep ? 'bg-info/10' : 'bg-warning/10')}>
                    <div>
                      <p className="font-bold text-foreground leading-tight">{donde(p)}</p>
                      <p className="text-[11px] text-muted-foreground">№{p.numero}{p.mesero ? ` · ${p.mesero.nombre}` : ''}</p>
                    </div>
                    <div className="text-right">
                      <p className={cn('text-lg font-black leading-none', ageTone(min))}>{min}<span className="text-xs font-medium"> {t('min')}</span></p>
                      <p className="text-[10px] text-muted-foreground">{prep ? t('PREPARANDO') : t('NUEVO')}</p>
                    </div>
                  </div>
                  <div className="p-3 space-y-1">
                    {p.items.map((i) => (
                      <div key={i.id} className={cn('flex justify-between text-sm', i.producto.requiereCocina ? 'text-foreground font-medium' : 'text-muted-foreground')}>
                        <span className="truncate pr-2">{i.producto.nombre}</span><span>×{i.cantidad}</span>
                      </div>
                    ))}
                  </div>
                  <div className="px-3 pb-3 flex gap-2">
                    {!prep && <Button size="sm" variant="secondary" loading={cambiar.isPending} onClick={() => cambiar.mutate({ id: p.id, estado: 'EN_PREPARACION' })}><Flame size={13} /> {t('Se prepara')}</Button>}
                    <Button size="sm" loading={cambiar.isPending} onClick={() => cambiar.mutate({ id: p.id, estado: 'LISTO' })}><CheckCircle2 size={13} /> {t('Listo')}</Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Все активные заказы: ход по этапам */}
      <div className="bg-card border border-border rounded-l overflow-hidden">
        <p className="text-sm font-semibold text-foreground px-4 py-3 border-b border-border">{t('Todos los pedidos activos')} ({pedidos.length})</p>
        {pedidos.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">{t('No hay pedidos activos')}</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <th className="text-left px-4 py-2.5">№</th><th className="text-left px-4 py-2.5">{t('Mesa')}</th><th className="text-left px-4 py-2.5">{t('Mesero')}</th>
                <th className="text-left px-4 py-2.5">{t('Progreso')}</th><th className="text-left px-4 py-2.5">{t('Estado')}</th><th className="text-right px-4 py-2.5">{t('Total')}</th><th className="px-4 py-2.5" />
              </tr></thead>
              <tbody>
                {pedidos.map((p) => (
                  <tr key={p.id} className="border-t border-border">
                    <td className="px-4 py-2.5 font-semibold">{p.numero}</td>
                    <td className="px-4 py-2.5">{donde(p)}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{p.mesero?.nombre ?? '—'}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground whitespace-nowrap">
                        <span title={t('Creado')}>{hhmm(p.creadoEn)}</span>
                        <span>→</span>
                        <span className={p.tiempoInicio ? 'text-info font-medium' : ''} title={t('Se prepara')}>{hhmm(p.tiempoInicio) ?? '··'}</span>
                        <span>→</span>
                        <span className={p.tiempoListo ? 'text-success font-medium' : ''} title={t('Listo')}>{hhmm(p.tiempoListo) ?? '··'}</span>
                        <span className="ml-1">({minutesSince(p.creadoEn, now)} {t('min')})</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5"><StatusBadge variant={p.estado} /></td>
                    <td className="px-4 py-2.5 text-right font-medium">{formatCurrency(Number(p.total ?? 0))}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex gap-1.5 justify-end">
                        {(p.estado === 'EN_COCINA' || p.estado === 'PENDIENTE' || p.estado === 'EN_PREPARACION') && (
                          <Button size="sm" variant="secondary" onClick={() => cambiar.mutate({ id: p.id, estado: 'LISTO' })}>{t('Listo')}</Button>
                        )}
                        {p.estado === 'LISTO' && <Button size="sm" onClick={() => cambiar.mutate({ id: p.id, estado: 'ENTREGADO' })}>{t('Entregar')}</Button>}
                        {p.estado === 'ENTREGADO' && <Button size="sm" variant="secondary" onClick={() => navigate('/caja')}>{t('Caja')}</Button>}
                        {p.estado !== 'ENTREGADO' && (
                          <button title={t('Cancelar pedido')} className="p-1.5 text-muted-foreground hover:text-error"
                            onClick={() => { if (confirm(t('¿Cancelar el pedido №{n}?', { n: p.numero }))) cambiar.mutate({ id: p.id, estado: 'CANCELADO' }); }}>
                            <Ban size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
