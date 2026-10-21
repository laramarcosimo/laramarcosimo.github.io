import { useEffect, useState } from 'react';

export const useOnline = (): boolean => {
  const [on, setOn] = useState(() => navigator.onLine);
  useEffect(() => {
    const up = () => setOn(true);
    const down = () => setOn(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);
  return on;
};

/** Cola simple: si no hay red, espera a que vuelva (hasta 3 min) antes de lanzar la petición. */
export const waitOnline = (signal?: AbortSignal): Promise<void> =>
  navigator.onLine
    ? Promise.resolve()
    : new Promise((resolve, reject) => {
        signal?.addEventListener('abort', () => reject(new DOMException('Cancelado', 'AbortError')), { once: true });
        const t = setTimeout(() => {
          window.removeEventListener('online', ok);
          reject(new Error('Sin conexión. Vuelve a intentarlo cuando tengas internet.'));
        }, 180000);
        const ok = () => {
          clearTimeout(t);
          resolve();
        };
        window.addEventListener('online', ok, { once: true });
      });
