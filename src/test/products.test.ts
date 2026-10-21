import { describe, expect, it } from 'vitest';
import { findProducts, gramsOf, macrosFor, saveProduct } from '../lib/products';
import type { AppState, SavedProduct } from '../lib/types';

const base = { name: 'Mayonesa', brand: 'Hacendado', kcal: 700, protein: 1, carbs: 2, fat: 75, sugars: 1, satFat: 6, fiber: 0, salt: 1.2 };
const empty = { products: [] } as unknown as AppState;

describe('productos guardados', () => {
  it('no duplica el mismo producto y actualiza sus valores', () => {
    const a = saveProduct(empty, { ...base, code: '123' });
    const b = saveProduct(a, { ...base, code: '123', kcal: 650 });
    expect(b.products).toHaveLength(1);
    expect(b.products![0].kcal).toBe(650);
  });
  it('encuentra «mayonesa» y ordena por uso reciente', () => {
    const list: SavedProduct[] = [
      { ...base, id: '1', usedAt: 1 },
      { ...base, id: '2', brand: 'Heinz', usedAt: 5 },
      { ...base, id: '3', name: 'Atún', usedAt: 9 },
    ];
    expect(findProducts(list, 'mayonesa').map((p) => p.id)).toEqual(['2', '1']);
    expect(findProducts(list, '')).toEqual([]);
  });
  it('convierte cantidades a gramos y calcula macros', () => {
    const p: SavedProduct = { ...base, id: '1', usedAt: 1, serving: 15 };
    expect(gramsOf(p, 30, 'g')).toBe(30);
    expect(gramsOf(p, 2, 'raciones')).toBe(30);
    expect(gramsOf(p, 2, 'cucharadas')).toBe(30);
    expect(gramsOf(p, 2, 'unidades')).toBeNull();
    expect(macrosFor(p, 30).calorias).toBe(210);
  });
});
