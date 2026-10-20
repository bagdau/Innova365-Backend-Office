import { useRealtime } from '../hooks/useRealtime';
import { useServerEvents } from '../hooks/useServerEvents';
import { useOrderSounds } from '../hooks/useOrderSounds';
import { useAutoUpdate } from '../hooks/useAutoUpdate';

/** Sincronización en vivo y sonidos de pedidos: activo en todas las pantallas autenticadas (incluida cocina y mesero). */
export function LiveSync() {
  useAutoUpdate();
  useServerEvents();
  useOrderSounds();
  useRealtime();
  return null;
}
