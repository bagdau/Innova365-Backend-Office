import { useEffect } from 'react';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../store/authStore';
import { api } from '../services/api';
import { setLive } from '../lib/live';

/**
 * Conexión SSE con el backend (/api/events): cuando alguien crea o cambia un pedido,
 * mesa, producto o insumo, el servidor avisa y aquí se refrescan al instante
 * las consultas afectadas (cocina, caja, meseros) en lugar de esperar al sondeo.
 */
const KEYS: Record<string, string[][]> = {
  pedidos:    [['pedidosActivos'], ['pedidos'], ['ventas'], ['topProductos'], ['productividad']],
  mesas:      [['mesas']],
  inventario: [['inventario'], ['alertasInventario'], ['movimientos'], ['consumo'], ['recetas']],
  compras:    [['compras'], ['proveedores']],
  menu:       [['productos'], ['categorias'], ['recetas'], ['receta']],
  usuarios:   [['usuarios'], ['restaurante']],
  dashboard:  [['dashboard']],
  presencia:  [['enLinea']],
  auditoria:  [['auditoria']],
};

function invalidateChannels(qc: QueryClient, canales: string[]) {
  const seen = new Set<string>();
  for (const c of canales) {
    for (const key of KEYS[c] ?? []) {
      const id = key.join('/');
      if (seen.has(id)) continue;
      seen.add(id);
      qc.invalidateQueries({ queryKey: key });
    }
  }
}

export function useServerEvents() {
  const qc = useQueryClient();
  const loggedIn = useAuthStore((s) => !!s.accessToken && !!s.user);

  useEffect(() => {
    if (!loggedIn) return;
    const ctrl = new AbortController();
    let conn: AbortController | null = null;
    let lastData = Date.now();
    let retry = 1000;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let pending: Set<string> = new Set();
    let flushTimer: ReturnType<typeof setTimeout> | undefined;

    // Agrupa ráfagas de eventos en una sola invalidación
    const queue = (canales: string[]) => {
      canales.forEach((c) => pending.add(c));
      if (flushTimer) return;
      flushTimer = setTimeout(() => {
        flushTimer = undefined;
        const batch = [...pending];
        pending = new Set();
        invalidateChannels(qc, batch);
      }, 80);
    };

    const handle = (block: string) => {
      let event = 'message';
      let data = '';
      for (const line of block.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        else if (line.startsWith('data:')) data += line.slice(5).trim();
      }
      if (event === 'cambio') {
        try { queue(JSON.parse(data)); } catch { /* ignore */ }
      } else if (event === 'ready') {
        retry = 1000;
        setLive(true);
      }
    };

    const connect = async () => {
      if (ctrl.signal.aborted) return;
      try {
        const token = useAuthStore.getState().accessToken;
        conn = new AbortController();
        const onAbort = () => conn?.abort();
        ctrl.signal.addEventListener('abort', onAbort, { once: true });
        lastData = Date.now();
        const res = await fetch('/api/events', {
          headers: { Authorization: `Bearer ${token}`, Accept: 'text/event-stream' },
          signal: conn.signal,
        });
        if (res.status === 401) {
          // Token vencido: una petición normal dispara el refresh automático
          await api.get('/perfil').catch(() => undefined);
          throw new Error('unauthorized');
        }
        if (!res.ok || !res.body) throw new Error(`SSE ${res.status}`);

        // Al (re)conectar, refresca todo por si se perdió algún evento
        invalidateChannels(qc, Object.keys(KEYS));

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = '';
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          lastData = Date.now();
          buf += decoder.decode(value, { stream: true });
          let idx: number;
          while ((idx = buf.indexOf('\n\n')) !== -1) {
            handle(buf.slice(0, idx));
            buf = buf.slice(idx + 2);
          }
        }
      } catch {
        /* se reintenta abajo */
      }
      setLive(false);
      invalidateChannels(qc, ['pedidos', 'mesas']); // сразу обновляем и пересчитываем интервал опроса
      // — экраны переходят на частый опрос, пока не переподключимся
      if (ctrl.signal.aborted) return;
      timer = setTimeout(connect, retry);
      retry = Math.min(retry * 2, 15000);
    };

    connect();

    // El servidor envía un latido cada 20 s: si pasan 45 s sin nada, la conexión está muerta → reconectar
    const watchdog = setInterval(() => {
      if (Date.now() - lastData > 45_000) conn?.abort();
    }, 10_000);
    // Al volver a la pestaña o recuperar la red, refresca todo por si se perdió algo
    const refreshAll = () => {
      if (document.hidden) return;
      invalidateChannels(qc, Object.keys(KEYS));
      if (Date.now() - lastData > 25_000) conn?.abort();
    };
    document.addEventListener('visibilitychange', refreshAll);
    window.addEventListener('online', refreshAll);

    return () => {
      setLive(false);
      clearInterval(watchdog);
      document.removeEventListener('visibilitychange', refreshAll);
      window.removeEventListener('online', refreshAll);
      ctrl.abort();
      if (timer) clearTimeout(timer);
      if (flushTimer) clearTimeout(flushTimer);
    };
  }, [loggedIn, qc]);
}
