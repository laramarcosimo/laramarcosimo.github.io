import { describe, expect, it } from 'vitest';
import { navPin } from '../lib/navPin';

describe('barra inferior fija en iPhone', () => {
  it('con la página normal no se mueve ni se esconde', () => {
    expect(navPin({ height: 800, offsetTop: 0, scale: 1 }, 800)).toEqual({ dy: 0, hidden: false });
    expect(navPin({ height: 800, offsetTop: 1, scale: 1 }, 800)).toEqual({ dy: 0, hidden: false }); // redondeos
  });

  it('si la ventana de maquetación queda desplazada, la baja hasta el borde visible', () => {
    // La zona visible llega 120 px más abajo que el final de la ventana de maquetación: la barra flota a mitad de pantalla.
    expect(navPin({ height: 800, offsetTop: 120, scale: 1 }, 800)).toEqual({ dy: 120, hidden: false });
  });

  it('si queda por debajo, la sube', () => {
    expect(navPin({ height: 780, offsetTop: 0, scale: 1 }, 800)).toEqual({ dy: -20, hidden: false });
  });

  it('con el teclado abierto la esconde en lugar de dejarla sobre él', () => {
    expect(navPin({ height: 480, offsetTop: 0, scale: 1 }, 800)).toEqual({ dy: 0, hidden: true });
  });

  it('con zoom no toca nada', () => {
    expect(navPin({ height: 500, offsetTop: 40, scale: 1.6 }, 800)).toEqual({ dy: 0, hidden: false });
  });

  it('nunca desplaza más de lo razonable', () => {
    expect(navPin({ height: 800, offsetTop: 400, scale: 1 }, 800).dy).toBe(150);
  });
});
