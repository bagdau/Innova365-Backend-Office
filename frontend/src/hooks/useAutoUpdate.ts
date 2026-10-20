import { useEffect } from 'react';

/**
 * Auto-actualización silenciosa de la app.
 *
 * Cuando se publica una versión nueva (/version.json cambia) la página se recarga sola,
 * pero solo en un momento seguro para no perder trabajo en curso:
 *   - la pestaña está en segundo plano, o
 *   - no hay ventanas/formularios abiertos y el usuario lleva unos segundos sin interactuar.
 * También se recarga si falla la carga de un módulo antiguo (archivo ya reemplazado en el servidor).
 */
const CHECK_EVERY_MS = 60_000;
const IDLE_MS = 8_000;

async function fetchRemoteVersion(): Promise<string | null> {
  try {
    const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data.version === 'string' ? data.version : null;
  } catch {
    return null; // sin red: reintenta luego
  }
}

function hasOpenDialog(): boolean {
  // Modal propio (fixed inset-0 z-50) o cualquier campo en edición
  if (document.querySelector('.fixed.inset-0.z-50')) return true;
  const el = document.activeElement as HTMLElement | null;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT');
}

export function useAutoUpdate() {
  useEffect(() => {
    if (typeof __APP_VERSION__ === 'undefined') return; // modo dev
    let lastActivity = Date.now();
    let updatePending = false;
    let reloading = false;
    let waitTimer: ReturnType<typeof setInterval> | undefined;

    const markActive = () => { lastActivity = Date.now(); };
    const events = ['pointerdown', 'keydown', 'touchstart'] as const;
    events.forEach((e) => window.addEventListener(e, markActive, { passive: true }));

    const reload = () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    };

    const trySafeReload = () => {
      const idle = Date.now() - lastActivity >= IDLE_MS;
      if (document.hidden || (idle && !hasOpenDialog())) reload();
    };

    const onNewVersion = () => {
      if (updatePending) return;
      updatePending = true;
      trySafeReload();
      waitTimer = setInterval(trySafeReload, 3_000);
    };

    const check = async () => {
      if (updatePending) return;
      const remote = await fetchRemoteVersion();
      if (remote && remote !== __APP_VERSION__) onNewVersion();
    };

    const interval = setInterval(check, CHECK_EVERY_MS);
    const onVisible = () => { if (!document.hidden) check(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', check);
    check();

    // Chunk antiguo eliminado tras un deploy: recargar para tomar el index.html nuevo
    const onPreloadError = (e: Event) => { e.preventDefault(); reload(); };
    window.addEventListener('vite:preloadError', onPreloadError);

    return () => {
      clearInterval(interval);
      if (waitTimer) clearInterval(waitTimer);
      events.forEach((e) => window.removeEventListener(e, markActive));
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', check);
      window.removeEventListener('vite:preloadError', onPreloadError);
    };
  }, []);
}
