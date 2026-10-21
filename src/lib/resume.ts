import { useEffect } from 'react';

/**
 * Los temporizadores se calculan con instantes reales (hora de fin − ahora), no contando ticks: aunque iOS congele la página con la
 * pantalla bloqueada, al volver solo hay que releer la hora. Este gancho lo hace al instante al volver a la app (visibilidad, foco
 * o recuperación desde la caché de página), sin esperar al siguiente tick.
 */
export function useResume(refresh: () => void): void {
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', refresh);
    window.addEventListener('pageshow', refresh);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('pageshow', refresh);
    };
  }, [refresh]);
}
