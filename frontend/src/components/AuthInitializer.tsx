import { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuthStore } from '../store/authStore';
import { Logo } from './shared/Logo';
import { t } from '../i18n';

/**
 * Una sola vez al montar la app:
 *   - Si ya hay accessToken en memoria  → seguimos
 *   - Si hay user persistido pero no token (caso F5)
 *       → llamamos /auth/refresh, hidratamos token + user fresco
 *   - Si refresh falla              → logout silencioso
 *   - Si no hay user                → continuamos (mostrará login)
 *
 * Mientras tanto, mostramos un spinner para no dejar que las páginas
 * hagan fetches a /api antes de tener el token.
 */
export function AuthInitializer({ children }: { children: React.ReactNode }) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const user        = useAuthStore((s) => s.user);
  const setAuth     = useAuthStore((s) => s.setAuth);
  const setToken    = useAuthStore((s) => s.setToken);
  const logout      = useAuthStore((s) => s.logout);

  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      if (accessToken) { if (!cancelled) setReady(true); return; }

      // No token, pero hay user persistido → intentamos refresh silencioso.
      // Importante: incluso si NO hay user, intentamos refresh por si la cookie
      // vive y el localStorage fue limpiado (ej. otro tab hizo logout y luego
      // cancelamos, o sesión existente en otro dispositivo).
      try {
        const { data } = await axios.post(
          '/api/auth/refresh',
          {},
          { withCredentials: true, timeout: 8000 },
        );
        if (cancelled) return;
        if (data.user) setAuth(data.user, data.accessToken);
        else           setToken(data.accessToken);
      } catch {
        if (cancelled) return;
        // Solo limpiamos si había user — si no había nada, no rompemos nada
        if (user) logout();
      } finally {
        if (!cancelled) setReady(true);
      }
    }

    init();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!ready) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Logo size={48} />
          <div className="w-12 h-12 border-[3px] border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">{t('Iniciando sesión…')}</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
