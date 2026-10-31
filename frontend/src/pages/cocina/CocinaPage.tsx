import { liveInterval } from '../../lib/live';
import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Utensils, ChefHat, LogOut, CheckCircle2, ClipboardList } from 'lucide-react';
import { pedidosService } from '../../services/pedidos.service';
import { cn } from '../../utils/cn';
import toast from 'react-hot-toast';
import type { Pedido, ItemPedido } from '../../types';
import { t, locale } from '../../i18n';
import { useAuthStore } from '../../store/authStore';
import { isAdminLike } from '../../auth/permissions';
import { authService } from '../../services/auth.service';

// Готовые позиции помечаются как servido на сервере, поэтому не скрываем их в блоке «Готово».
function itemsCocina(items: ItemPedido[], pendientes = false) {
  return items.filter((i) => i.producto.requiereCocina !== false && (!pendientes || !i.servido));
}

export default function CocinaPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [time, setTime] = useState(new Date().toLocaleTimeString(locale));

  useEffect(() => {
    const id = setInterval(() => setTime(new Date().toLocaleTimeString(locale)), 1000);
    return () => clearInterval(id);
  }, []);

  const { data: pedidos = [] } = useQuery<Pedido[]>({
    queryKey: ['pedidosActivos'],
    queryFn: pedidosService.getActivos,
    refetchInterval: liveInterval,
  });

  // ADMIN vuelve al panel; el cocinero no tiene panel, así que "Salir" cierra la sesión
  const salir = async () => {
    if (isAdminLike(user?.rol)) { navigate('/monitor'); return; }
    try { await authService.logout(); } catch { /* ignore */ }
    logout();
    navigate('/login');
  };

  const iniciar = useMutation({
    mutationFn: (id: string) => pedidosService.updateEstado(id, 'EN_PREPARACION'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pedidosActivos'] }),
    onError: () => toast.error(t('Error al actualizar estado')),
  });

  const marcarListo = useMutation({
    mutationFn: (id: string) => pedidosService.updateEstado(id, 'LISTO'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pedidosActivos'] }),
    onError: () => toast.error(t('Error al actualizar estado')),
  });

  // Pendientes: en cocina o preparación (lo que aún no está listo)
  const pendientes = pedidos.filter((p) =>
    ['PENDIENTE', 'EN_COCINA', 'EN_PREPARACION'].includes(p.estado) &&
    itemsCocina(p.items, true).length > 0
  );

  // Listos: ya marcados, esperando que el mesero los recoja
  const listos = pedidos.filter((p) =>
    p.estado === 'LISTO' && itemsCocina(p.items).length > 0
  );

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-sidebar-bg border-b border-border flex items-center justify-between px-3 sm:px-4 py-3 gap-2 sm:gap-3">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            onClick={salir}
            className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground text-sm transition-colors"
          >
            <LogOut size={15} className="rotate-180" />
            <span className="hidden sm:inline">{t('Salir')}</span>
          </button>
          <span className="text-border hidden sm:inline">|</span>
          <ChefHat size={18} className="text-primary flex-shrink-0" />
          <span className="font-bold text-foreground truncate">{t('Cocina')}</span>
          {pendientes.length > 0 && (
            <span className="bg-warning text-background text-xs font-black px-2 py-0.5 rounded-full animate-pulse">
              {t('Pendientes: {n}', { n: pendientes.length })}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          <button
            onClick={() => navigate('/pedidos')}
            aria-label={t('Pedidos')}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-muted text-muted-foreground hover:text-foreground text-sm transition-colors"
          >
            <ClipboardList size={15} />
            <span className="hidden sm:inline">{t('Pedidos')}</span>
          </button>
          <span className="text-xs sm:text-sm font-mono text-muted-foreground">{time}</span>
        </div>
      </header>

      <main className="flex-1 p-4 space-y-6">

        {/* ── Pendientes ── */}
        {pendientes.length === 0 && listos.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <ChefHat size={48} className="mb-4 opacity-20" />
            <p className="text-lg font-medium">{t('Sin pedidos en cocina')}</p>
            <p className="text-sm mt-1">{t('Los nuevos pedidos aparecerán aquí automáticamente')}</p>
          </div>
        ) : (
          <>
            {pendientes.length > 0 && (
              <section>
                <h2 className="text-xs font-bold text-warning uppercase tracking-widest mb-3">
                  {t('Por preparar ({n})', { n: pendientes.length })}
                </h2>
                <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {pendientes.map((pedido) => {
                    const items = itemsCocina(pedido.items, true);
                    const enPrep = pedido.estado === 'EN_PREPARACION';
                    const minPrep = pedido.tiempoInicio ? Math.max(0, Math.floor((Date.now() - new Date(pedido.tiempoInicio).getTime()) / 60000)) : 0;
                    return (
                      <div
                        key={pedido.id}
                        className={cn('bg-card border-2 rounded-xl flex flex-col overflow-hidden', enPrep ? 'border-info' : 'border-warning')}
                      >
                        {/* Cabecera */}
                        <div className={cn('px-4 py-3 flex items-center justify-between', enPrep ? 'bg-info/10' : 'bg-warning/10')}>
                          <div>
                            <p className="font-black text-foreground text-xl leading-tight">
                              {pedido.mesa ? t('Mesa {n}', { n: pedido.mesa.numero }) : t('🥡 Para llevar')}
                            </p>
                            <p className="text-xs text-muted-foreground">{t('Pedido #')}{pedido.numero}</p>
                          </div>
                          {enPrep ? (
                            <span className="text-xs bg-info text-background font-bold px-2 py-1 rounded-lg animate-pulse">
                              {t('PREPARANDO')} · {t('{n} min', { n: minPrep })}
                            </span>
                          ) : (
                            <span className="text-xs bg-warning text-background font-bold px-2 py-1 rounded-lg">
                              {t('NUEVO')}
                            </span>
                          )}
                        </div>

                        {/* Items */}
                        <div className="flex-1 p-3 space-y-2">
                          {items.map((item) => (
                            <div key={item.id} className="flex items-center gap-3 bg-muted/40 rounded-lg p-2">
                              {item.producto.imagen ? (
                                <img
                                  src={item.producto.imagen}
                                  alt={item.producto.nombre}
                                  className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                                />
                              ) : (
                                <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                                  <Utensils size={18} className="text-muted-foreground" />
                                </div>
                              )}
                              <p className="flex-1 font-semibold text-foreground text-sm leading-tight">
                                {item.producto.nombre}
                              </p>
                              <span className="text-2xl font-black text-foreground bg-background rounded-lg px-3 py-1 flex-shrink-0">
                                ×{item.cantidad}
                              </span>
                            </div>
                          ))}
                        </div>

                        {/* Acciones: 1) empezar a preparar  2) pedido listo */}
                        <div className="p-3 pt-0 space-y-2">
                          {!enPrep && (
                            <button
                              disabled={iniciar.isPending}
                              onClick={() => iniciar.mutate(pedido.id)}
                              className={cn(
                                'w-full py-4 rounded-xl font-black text-lg transition-all active:scale-95',
                                'bg-info text-background hover:bg-info/90',
                                iniciar.isPending && 'opacity-50 cursor-not-allowed'
                              )}
                            >
                              {iniciar.isPending ? '...' : t('👨‍🍳 Pedido en preparación')}
                            </button>
                          )}
                          <button
                            disabled={marcarListo.isPending}
                            onClick={() => marcarListo.mutate(pedido.id)}
                            className={cn(
                              'w-full rounded-xl font-black transition-all active:scale-95',
                              enPrep ? 'py-4 text-lg bg-success text-white hover:bg-success/90'
                                     : 'py-2 text-sm border border-success text-success hover:bg-success/10',
                              marcarListo.isPending && 'opacity-50 cursor-not-allowed'
                            )}
                          >
                            {marcarListo.isPending ? '...' : t('✓ Pedido listo')}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* ── Listos esperando mesero ── */}
            {listos.length > 0 && (
              <section>
                <h2 className="text-xs font-bold text-success uppercase tracking-widest mb-3">
                  {t('Listos — esperando mesero ({n})', { n: listos.length })}
                </h2>
                <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {listos.map((pedido) => (
                    <div
                      key={pedido.id}
                      className="bg-card border-2 border-success/50 rounded-xl p-4 flex flex-col items-center gap-2 text-center"
                    >
                      <CheckCircle2 size={28} className="text-success" />
                      <p className="font-black text-foreground text-lg">
                        {pedido.mesa ? t('Mesa {n}', { n: pedido.mesa.numero }) : t('Llevar')}
                      </p>
                      <p className="text-xs text-muted-foreground">#{pedido.numero}</p>
                      <p className="text-xs text-success font-semibold">
                        {t('Ítems: {n}', { n: itemsCocina(pedido.items).length })}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
