import { describe, expect, it } from 'vitest';
import { dislikedHits, dislikedIn, foodNameOf } from '../lib/dislikes';

describe('alimentos que no me gustan', () => {
  it('extrae el nombre del alimento de una línea', () => {
    expect(foodNameOf('2 cucharadas de aceite de oliva (≈ 20 g)')).toBe('aceite de oliva');
    expect(foodNameOf('150 g de pechuga de pollo')).toBe('pechuga de pollo');
    expect(foodNameOf('½ aguacate (≈ 75 g)')).toBe('aguacate');
    expect(foodNameOf('1 plátano')).toBe('plátano');
  });
  it('detecta palabras completas, con plurales, sin falsos positivos', () => {
    expect(dislikedIn('Ensalada de atún con tomate', 'atún')).toBe(true);
    expect(dislikedIn('2 latas de atunes', 'atún')).toBe(true);
    expect(dislikedIn('Ensalada de tomate', 'sal')).toBe(false);
    expect(dislikedIn('Pan integral con jamón', 'pan')).toBe(true);
    expect(dislikedIn('Compañía de pan', 'ña')).toBe(false);
    expect(dislikedIn('Brócoli al vapor', 'brocoli')).toBe(true);
    expect(dislikedHits(['150 g de pollo', 'cilantro fresco'], ['cilantro', 'pollo frito'])).toEqual(['cilantro']);
  });
});

describe('alimentos que el Chef propone añadir', () => {
  it('limpia: cantidades razonables, sin lo que no te gusta, sin repetir lo que ya hay', async () => {
    const { cleanChefAdds } = await import('../lib/gemini');
    const raw = [
      { nombre: 'Yogur natural', cantidad: 125, unidad: 'g' },
      { nombre: 'Cilantro fresco', cantidad: 5, unidad: 'g' },
      { nombre: 'Albóndigas', cantidad: 4, unidad: 'unidades' },
      { nombre: 'Plátano', cantidad: 0, unidad: 'unidades' },
      { nombre: 'Pan', cantidad: 2, unidad: 'rebanadas' },
      { nombre: 'Algo raro', cantidad: 3, unidad: 'xyz' },
    ];
    const out = cleanChefAdds(raw, ['Albóndigas (Mercadona)'], ['cilantro']);
    expect(out.map((o) => o.nombre)).toEqual(['Yogur natural', 'Pan', 'Algo raro']);
    expect(out[2].unidad).toBe('unidades');
    expect(cleanChefAdds('no es lista', [], [])).toEqual([]);
  });
});
