import { describe, expect, it } from 'vitest';
import { goneProducts, rememberPantry } from '../lib/pantry';
import type { PantryItem } from '../lib/types';

const item = (name: string, extra: Partial<PantryItem> = {}): PantryItem => ({ id: name, name, qty: 1, ...extra });

describe('productos agotados recordados', () => {
  it('recuerda lo que entra en la despensa y no duplica', () => {
    const a = rememberPantry(undefined, [item('Pan de molde integral'), item('Skyr natural')]);
    expect(a?.map((m) => m.name)).toEqual(['Pan de molde integral', 'Skyr natural']);
    const b = rememberPantry(a, [item('Pan de molde integral')]);
    expect(b).toBe(a); // misma referencia: no hay nada nuevo
  });

  it('conserva el producto aunque se agote y desaparezca de la despensa', () => {
    const hist = rememberPantry(undefined, [item('Skyr natural', { store: 'Mercadona', place: 'nevera' })]);
    const after = rememberPantry(hist, []);
    expect(after).toBe(hist);
    const gone = goneProducts(after, [], 'skyr');
    expect(gone).toHaveLength(1);
    expect(gone[0]).toMatchObject({ name: 'Skyr natural', store: 'Mercadona', place: 'nevera' });
  });

  it('no sugiere lo que sigue en la despensa y busca sin acentos ni mayúsculas', () => {
    const hist = rememberPantry(undefined, [item('Plátanos'), item('Jamón serrano')]);
    expect(goneProducts(hist, [item('Plátanos')], 'platan')).toEqual([]);
    expect(goneProducts(hist, [item('Plátanos')], 'JAMON').map((m) => m.name)).toEqual(['Jamón serrano']);
  });

  it('sin búsqueda no sugiere nada y actualiza datos cambiados', () => {
    const hist = rememberPantry(undefined, [item('Arroz')]);
    expect(goneProducts(hist, [], '')).toEqual([]);
    const upd = rememberPantry(hist, [item('Arroz', { store: 'Lidl' })]);
    expect(upd).not.toBe(hist);
    expect(upd?.[0].store).toBe('Lidl');
  });
});
