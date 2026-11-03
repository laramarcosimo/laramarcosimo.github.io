/**
 * Barra de navegación fija en iPhone.
 * Una barra `position: fixed; bottom: 0` se coloca respecto a la ventana «de maquetación», y en iOS esa ventana puede quedar
 * desplazada respecto a lo que realmente se ve (al abrir y cerrar el teclado, al hacer scroll con rebote…). Entonces la barra
 * se queda flotando a mitad de pantalla. Aquí se calcula cuánto hay que moverla para que vuelva a quedar pegada al borde
 * inferior de lo visible, y si debe esconderse porque el teclado está abierto.
 */
export interface VisibleViewport {
  height: number;
  offsetTop: number;
  scale?: number;
}

export interface NavPin {
  /** Píxeles que hay que bajar (+) o subir (−) la barra. */
  dy: number;
  /** Teclado abierto: la barra se esconde en lugar de flotar sobre él. */
  hidden: boolean;
}

/** Un teclado de iPhone mide bastante más que esto; menos se considera ruido (barra de direcciones, redondeos). */
export const KEYBOARD_MIN = 150;

export function navPin(vv: VisibleViewport, layoutHeight: number): NavPin {
  // Con zoom no se puede colocar con precisión: se deja la barra como está.
  if ((vv.scale ?? 1) > 1.01) return { dy: 0, hidden: false };
  if (layoutHeight - vv.height > KEYBOARD_MIN) return { dy: 0, hidden: true };
  const dy = Math.round(vv.offsetTop + vv.height - layoutHeight);
  if (Math.abs(dy) < 2) return { dy: 0, hidden: false };
  return { dy: Math.max(-KEYBOARD_MIN, Math.min(KEYBOARD_MIN, dy)), hidden: false };
}
