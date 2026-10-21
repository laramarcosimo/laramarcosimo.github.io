import { useEffect } from 'react';

let count = 0;
let savedY = 0;
let prev = { position: '', top: '', width: '', overflow: '' };

/**
 * Bloquea el desplazamiento de la página que queda DEBAJO de una hoja, modal o pantalla completa.
 * En iPhone `overflow: hidden` en el body no basta (la página de atrás se mueve al hacer scroll): se fija el body
 * en su posición y, al cerrar, se devuelve la página exactamente al mismo punto. Admite varias capas a la vez.
 */
export function lockScroll(): () => void {
  const b = document.body;
  if (count++ === 0) {
    savedY = window.scrollY;
    prev = { position: b.style.position, top: b.style.top, width: b.style.width, overflow: b.style.overflow };
    b.style.position = 'fixed';
    b.style.top = `-${savedY}px`;
    b.style.width = '100%';
    b.style.overflow = 'hidden';
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (--count === 0) {
      b.style.position = prev.position;
      b.style.top = prev.top;
      b.style.width = prev.width;
      b.style.overflow = prev.overflow;
      window.scrollTo(0, savedY);
    }
  };
}

export function useScrollLock(active = true): void {
  useEffect(() => {
    if (!active) return;
    return lockScroll();
  }, [active]);
}
