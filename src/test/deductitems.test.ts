import { describe, expect, it } from 'vitest';
import { deductItems, expiryOf } from '../lib/pantry';

const mk = (o: object) => ({ id: 'a', name: 'Queso en lonchas', qty: 1, ...o }) as never;

describe('descontar lo escrito', () => {
  it('2 lonchas se restan de un envase contado por lonchas', () => {
    const r = deductItems([mk({ unitsPerPack: 10, units: 10, unitLabel: 'lonchas' })], [{ nombre: 'queso', cantidad: 2, unidad: 'lonchas' }]);
    expect((r.pantry[0] as unknown as { units: number }).units).toBe(8);
    expect(r.skipped).toEqual([]);
  });
  it('gramos no se descuentan y se avisa', () => {
    const r = deductItems([mk({})], [{ nombre: 'queso', cantidad: 50, unidad: 'g' }]);
    expect(r.skipped.length).toBe(1);
    expect(r.pantry.length).toBe(1);
  });
  it('lo que no está en la despensa se ignora', () => expect(deductItems([mk({})], [{ nombre: 'atún', cantidad: 1, unidad: 'unidades' }]).pantry.length).toBe(1));
  it('congelados sin caducidad', () => expect(expiryOf(mk({ place: 'congelador', expires: '2026-12-01' }))).toBeUndefined());
});
