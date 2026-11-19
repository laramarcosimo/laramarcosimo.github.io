import { describe, expect, it } from 'vitest';
import { catalogCategory, gramsFor, macrosOf, type CatalogItem } from '../lib/catalog';

const yog = { id: 't', name: 'Yogur', store: 'mercadona', cat: 'lacteos', kcal: 60, protein: 4, carbs: 5, fat: 2, fiber: 0, units: { unidad: 120, loncha: 15 }, source: 'mio' } as unknown as CatalogItem;

describe('catálogo', () => {
  it('yogur de 120 g: solo calcula las kcal', () => {
    const g = gramsFor(yog, 1, 'unidad');
    expect(g).toBe(120);
    expect(macrosOf(yog, g ?? 0).kcal).toBe(72);
  });
  it('lonchas suman', () => expect(gramsFor(yog, 2, 'loncha')).toBe(30));
  it('unidad desconocida devuelve null', () => expect(gramsFor(yog, 1, 'cucharada')).toBeNull());
  it('clasifica', () => {
    expect(catalogCategory('Jamón cocido')).toBe('embutidos');
    expect(catalogCategory('Pan integral')).toBe('panes');
  });
});
