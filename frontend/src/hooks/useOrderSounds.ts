import { liveInterval } from '../lib/live';
import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { pedidosService } from '../services/pedidos.service';
import { useAuthStore } from '../store/authStore';
import { playSound, type SoundName } from '../sound';
import { t } from '../i18n';
import { isAdminLike } from '../auth/permissions';
import type { Rol } from '../types';

interface PedidoLite { id: string; numero: number; estado: string; mesa?: { numero: number } | null }

const STAFF_SALA = ['SUPERADMIN', 'ADMIN', 'MESERO', 'CAJERO'];

/**
 * Avisos (sonido + notificación en pantalla) cuando cambia el estado de un pedido,
 * comparando los pedidos activos entre consultas:
 *  - COCINERO / ADMIN            → nuevo pedido en cocina
 *  - MESERO / CAJERO / ADMIN     → el pedido empezó a prepararse
 *  - MESERO / CAJERO / ADMIN     → pedido LISTO para servir
 *  - CAJERO / ADMIN              → pedido ENTREGADO por cobrar
 */
export function useOrderSounds() {
  const rol = useAuthStore((s) => s.user?.rol);
  const { data } = useQuery<PedidoLite[]>({
    queryKey: ['pedidosActivos'],
    queryFn: pedidosService.getActivos,
    refetchInterval: liveInterval,
    enabled: !!rol,
  });
  const prev = useRef<Map<string, string> | null>(null);

  useEffect(() => {
    if (!data || !rol) return;
    const cur = new Map(data.map((p) => [p.id, p.estado]));
    const old = prev.current;
    prev.current = cur;
    if (!old) return; // primera carga: sin aviso

    const donde = (p: PedidoLite) => (p.mesa ? t('Mesa {n}', { n: p.mesa.numero }) : t('Para llevar'));
    const sala = STAFF_SALA.includes(rol);
    const cocina = rol === 'COCINERO' || isAdminLike(rol as Rol);
    const avisos: Array<{ sound: SoundName; rank: number; msg: string; icon: string }> = [];

    for (const p of data) {
      const antes = old.get(p.id);
      if (antes === p.estado) continue;
      const lugar = donde(p);
      if (p.estado === 'EN_COCINA' && antes === undefined && cocina) {
        avisos.push({ sound: 'newOrder', rank: 4, icon: '🔔', msg: t('Nuevo pedido #{n} — {lugar}', { n: p.numero, lugar }) });
      } else if (p.estado === 'EN_PREPARACION' && sala) {
        avisos.push({ sound: 'orderPreparing', rank: 1, icon: '👨‍🍳', msg: t('Pedido #{n} ({lugar}) se está preparando', { n: p.numero, lugar }) });
      } else if (p.estado === 'LISTO' && (sala || rol === 'REPARTIDOR')) {
        avisos.push({ sound: 'orderReady', rank: 3, icon: '✅', msg: t('Pedido #{n} ({lugar}) está listo', { n: p.numero, lugar }) });
      } else if (p.estado === 'ENTREGADO' && (rol === 'CAJERO' || isAdminLike(rol as Rol))) {
        avisos.push({ sound: 'payment', rank: 2, icon: '💳', msg: t('Pedido #{n} ({lugar}) espera el pago', { n: p.numero, lugar }) });
      }
    }
    if (!avisos.length) return;

    // Un solo sonido (el más importante) y un aviso visible por cada pedido
    avisos.sort((a, b) => b.rank - a.rank);
    playSound(avisos[0].sound);
    avisos.slice(0, 4).forEach((a) => toast(a.msg, { icon: a.icon, duration: 6000 }));
  }, [data, rol]);
}
