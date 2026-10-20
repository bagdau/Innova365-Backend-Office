import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL  as string;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON as string;

if (!SUPABASE_URL || !SUPABASE_ANON) {
  console.warn('[Supabase] Variables de entorno no configuradas — realtime desactivado');
}

/**
 * Cliente público de Supabase.
 * Usamos SOLO el canal Realtime (no Auth ni Storage).
 * Toda la lógica de negocio sigue pasando por el backend Express.
 */
export const supabase = createClient(SUPABASE_URL || 'http://localhost', SUPABASE_ANON || 'disabled', {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { params: { eventsPerSecond: 10 } },
});
