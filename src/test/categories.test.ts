import { describe, expect, it } from 'vitest';
import { categoryOf } from '../lib/categories';

const c = (name: string, category?: string): string => categoryOf({ name, category }).id;

describe('categorías de alimentos', () => {
  it('deduce la categoría por el nombre', () => {
    expect(c('Pechuga de pollo')).toBe('carne');
    expect(c('Huevos camperos')).toBe('lacteos');
    expect(c('Yogur griego')).toBe('lacteos');
    expect(c('Atún al natural')).toBe('pescado');
    expect(c('Plátano de Canarias')).toBe('fruta');
    expect(c('Pepino')).toBe('verdura');
    expect(c('Arroz integral')).toBe('cereales');
    expect(c('Almendras')).toBe('frutos-secos');
    expect(c('Garbanzos cocidos')).toBe('legumbres');
  });
  it('los casos ambiguos caen en la categoría correcta', () => {
    expect(c('Tomate frito')).toBe('salsas');
    expect(c('Tomate de ensalada')).toBe('verdura');
    expect(c('Leche de avena')).toBe('bebidas');
    expect(c('Leche semidesnatada')).toBe('lacteos');
    expect(c('Galletas integrales')).toBe('dulces');
    expect(c('Whey proteína en polvo')).toBe('suplementos');
    expect(c('Cosa rara')).toBe('otros');
  });
  it('la categoría elegida a mano manda', () => {
    expect(c('Pechuga de pollo', 'conservas')).toBe('conservas');
  });
});
