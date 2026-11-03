import { useEffect, useState } from 'react';
import { navPin, type NavPin } from './navPin';

const REST: NavPin = { dy: 0, hidden: false };

/** Mantiene la barra inferior pegada al borde de lo visible (ver `navPin`). Solo actúa si el navegador mide la zona visible. */
export function useNavPin(enabled = true): NavPin {
  const [pin, setPin] = useState<NavPin>(REST);
  useEffect(() => {
    const vv = typeof window !== 'undefined' ? window.visualViewport : null;
    if (!enabled || !vv) return;
    let raf = 0;
    const calc = (): void => {
      raf = 0;
      const next = navPin(vv, document.documentElement.clientHeight);
      setPin((p) => (p.dy === next.dy && p.hidden === next.hidden ? p : next));
    };
    const queue = (): void => {
      if (!raf) raf = window.requestAnimationFrame(calc);
    };
    // Al cerrar el teclado iOS puede dejar la página desplazada: se vuelve a sincronizar.
    let timer = 0;
    const onOut = (): void => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        window.scrollTo(window.scrollX, window.scrollY);
        queue();
      }, 350);
    };
    queue();
    vv.addEventListener('resize', queue);
    vv.addEventListener('scroll', queue);
    window.addEventListener('scroll', queue, { passive: true });
    window.addEventListener('orientationchange', queue);
    document.addEventListener('focusout', onOut);
    return () => {
      if (raf) window.cancelAnimationFrame(raf);
      window.clearTimeout(timer);
      vv.removeEventListener('resize', queue);
      vv.removeEventListener('scroll', queue);
      window.removeEventListener('scroll', queue);
      window.removeEventListener('orientationchange', queue);
      document.removeEventListener('focusout', onOut);
    };
  }, [enabled]);
  return enabled ? pin : REST;
}
