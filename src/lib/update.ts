import { useEffect, useState } from 'react';

/** Detecta si hay una versión nueva publicada (version.json se genera en cada compilación y pesa unos bytes). */
export function useUpdateAvailable(): boolean {
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    if (import.meta.env.DEV) return;
    let stop = false;
    const check = async () => {
      try {
        const r = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
        if (!r.ok) return;
        const j = (await r.json()) as { id?: string };
        if (!stop && j.id && j.id !== __BUILD_ID__) setAvailable(true);
      } catch {
        /* sin conexión: se vuelve a comprobar luego */
      }
    };
    void check();
    const vis = () => document.visibilityState === 'visible' && void check();
    document.addEventListener('visibilitychange', vis);
    const t = setInterval(() => void check(), 30 * 60 * 1000);
    return () => {
      stop = true;
      document.removeEventListener('visibilitychange', vis);
      clearInterval(t);
    };
  }, []);
  return available;
}
