import { useEffect, useRef, useState, type FocusEvent } from 'react';

const TEXT_INPUT = /^(text|search|number|tel|email|url|password|date|time)?$/i;

/**
 * Teclado en iPhone: tapa la parte baja de la pantalla sin avisar a la página, así que una hoja anclada ABAJO queda detrás de él.
 * Mientras escribes (en un móvil/tablet táctil) la hoja se ancla ARRIBA y se limita a la mitad superior de la pantalla: así lo que
 * buscas y los resultados siempre quedan encima del teclado, sin depender de medir el teclado.
 * El cambio de posición espera a que termine el toque (si no, el «clic» caería fuera de la hoja y la cerraría) y,
 * por seguridad, `justFocused()` permite ignorar un clic en el fondo que llegue justo después de enfocar un campo.
 */
export function useKeyboardPin(): {
  typing: boolean;
  justFocused: () => boolean;
  handlers: { onFocusCapture: (e: FocusEvent) => void; onBlurCapture: () => void };
} {
  const [typing, setTyping] = useState(false);
  const timer = useRef<number>();
  const showTimer = useRef<number>();
  const focusedAt = useRef(0);
  const coarse = typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
  return {
    typing,
    justFocused: () => Date.now() - focusedAt.current < 900,
    handlers: {
      onFocusCapture: (e) => {
        if (!coarse) return;
        const t = e.target as HTMLInputElement;
        const isText = t.tagName === 'TEXTAREA' || (t.tagName === 'INPUT' && TEXT_INPUT.test(t.type ?? ''));
        if (!isText) return;
        focusedAt.current = Date.now();
        window.clearTimeout(timer.current);
        window.clearTimeout(showTimer.current);
        showTimer.current = window.setTimeout(() => {
          setTyping(true);
          window.setTimeout(() => (t.closest('[data-keyrow]') ?? t).scrollIntoView({ block: 'center', behavior: 'smooth' }), 250); // la fila entera (campo + sugerencias)
        }, 400);
      },
      onBlurCapture: () => {
        window.clearTimeout(showTimer.current);
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => {
          focusedAt.current = Date.now();
          setTyping(false);
        }, 250);
      },
    },
  };
}

/** Zona realmente visible (por encima del teclado en iPhone), o null si el navegador no la mide. */
export function useVisibleArea(active: boolean): { top: number; height: number } | null {
  const [area, setArea] = useState<{ top: number; height: number } | null>(null);
  useEffect(() => {
    const w = typeof window !== 'undefined' ? window.visualViewport : null;
    if (!active || !w) {
      setArea(null);
      return;
    }
    const f = () => setArea({ top: w.offsetTop, height: w.height });
    f();
    w.addEventListener('resize', f);
    w.addEventListener('scroll', f);
    return () => {
      w.removeEventListener('resize', f);
      w.removeEventListener('scroll', f);
    };
  }, [active]);
  return area;
}
