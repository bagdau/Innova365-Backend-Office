import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import toast from 'react-hot-toast';

/**
 * Suscripción global a cambios en Supabase Realtime.
 * Cuando un pedido o mesa cambia en la BD, invalida el cache de
 * React Query para que todos los componentes se actualicen al instante.
 *
 * Registrar este hook UNA sola vez en AuthLayout (y también en MeseroPage).
 */
export function useRealtime() {
  const qc = useQueryClient();

  useEffect(() => {
    if (!import.meta.env.VITE_SUPABASE_URL) return; // desactivado si no hay config

    // Supabase se carga bajo demanda: sin configuración no pesa en el bundle inicial
    let cancelled = false;
    let channel: RealtimeChannel | null = null;
    let client: SupabaseClient | null = null;

    import('../lib/supabase').then(({ supabase }) => {
      if (cancelled) return;
      client = supabase;
      channel = supabase
      .channel('innova365-realtime')
      // Cambios en tabla Pedido
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'Pedido' }, (payload) => {
        qc.invalidateQueries({ queryKey: ['pedidosActivos'] });
        qc.invalidateQueries({ queryKey: ['pedidos'] });
        qc.invalidateQueries({ queryKey: ['dashboard'] });

        // Notificar al mesero cuando un pedido pasa a LISTO
        const nuevo = payload.new as any;
        const viejo = payload.old as any;
        if (nuevo?.estado === 'LISTO' && viejo?.estado !== 'LISTO') {
          toast('🔔 ¡Pedido listo para servir!', {
            duration: 6000,
            style: {
              background: 'rgb(var(--success))',
              color: '#fff',
              fontWeight: 'bold',
              fontSize: '15px',
            },
            icon: '🍗',
          });
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'Pedido' }, () => {
        qc.invalidateQueries({ queryKey: ['pedidosActivos'] });
        qc.invalidateQueries({ queryKey: ['pedidos'] });
        qc.invalidateQueries({ queryKey: ['dashboard'] });
      })
      // Cambios en tabla Mesa
      .on('postgres_changes', { event: '*', schema: 'public', table: 'Mesa' }, () => {
        qc.invalidateQueries({ queryKey: ['mesas'] });
        qc.invalidateQueries({ queryKey: ['dashboard'] });
      })
      // Cambios en inventario
      .on('postgres_changes', { event: '*', schema: 'public', table: 'Insumo' }, () => {
        qc.invalidateQueries({ queryKey: ['inventario'] });
        qc.invalidateQueries({ queryKey: ['alertasInventario'] });
        qc.invalidateQueries({ queryKey: ['dashboard'] });
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[Realtime] Conectado — actualizaciones en tiempo real activas');
        }
        if (status === 'CHANNEL_ERROR') {
          console.warn('[Realtime] Error de canal — usando polling como fallback');
        }
      });
    });

    return () => {
      cancelled = true;
      if (client && channel) client.removeChannel(channel);
    };
  }, [qc]);
}
