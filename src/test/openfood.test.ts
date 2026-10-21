import { describe, expect, it } from 'vitest';
import { pickBestImage } from '../lib/openfood';

const c = (product_name: string, brands = '', img = 'https://img/' + product_name) => ({ product_name, brands, image_front_small_url: img });

describe('foto del producto', () => {
  it('«plátano» no se queda con el puré o el yogur de plátano', () => {
    const list = [c('Puré de plátano y manzana bolsita'), c('Yogur sabor plátano'), c('Plátano de Canarias')];
    expect(pickBestImage('Plátano', undefined, list)).toBe('https://img/Plátano de Canarias');
    expect(pickBestImage('Plátano', undefined, [c('Puré de plátano y manzana bolsita'), c('Batido de plátano')])).toBe('');
  });
  it('una búsqueda concreta sí admite productos elaborados', () => {
    const list = [c('Yogur griego natural Hacendado', 'Hacendado')];
    expect(pickBestImage('Yogur griego natural', undefined, list)).toContain('Yogur griego');
  });
  it('sin coincidencia fiable devuelve vacío (se usa el icono)', () => {
    expect(pickBestImage('Pepino', undefined, [c('Cereales de chocolate')])).toBe('');
  });
});
