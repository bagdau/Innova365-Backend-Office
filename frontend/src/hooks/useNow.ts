import { useEffect, useState } from 'react';

/** Marca de tiempo que se actualiza sola (para contadores de "hace N min" sin esperar nuevos datos). */
export function useNow(everyMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(id);
  }, [everyMs]);
  return now;
}

export function minutesSince(iso: string | undefined | null, now: number): number {
  return iso ? Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000)) : 0;
}
