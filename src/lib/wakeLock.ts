import { useEffect, useRef } from 'react';

/** Mantiene la pantalla encendida mientras `active` sea true (Wake Lock API; se vuelve a pedir al volver a la app). */
export function useWakeLock(active: boolean): void {
  const lock = useRef<WakeLockSentinel | null>(null);
  useEffect(() => {
    if (!active) return;
    let stop = false;
    const acquire = async () => {
      try {
        const l = (await navigator.wakeLock?.request('screen')) ?? null;
        if (stop) void l?.release().catch(() => undefined);
        else lock.current = l;
      } catch {
        /* sin Wake Lock (o permiso denegado): los cronómetros usan marcas de tiempo y siguen siendo exactos */
      }
    };
    const vis = () => document.visibilityState === 'visible' && void acquire();
    void acquire();
    document.addEventListener('visibilitychange', vis);
    return () => {
      stop = true;
      document.removeEventListener('visibilitychange', vis);
      void lock.current?.release().catch(() => undefined);
      lock.current = null;
    };
  }, [active]);
}
