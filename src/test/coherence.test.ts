import { describe, expect, it } from 'vitest';
import { incoherence, missingFromPantry, pantryCoverage } from '../lib/coherence';

describe('coherencia de un plato', () => {
  it('detecta «pan con pan» y repeticiones de la misma familia', () => {
    expect(incoherence('Tostada de pan con pan', [])).toContain('pan');
    expect(incoherence('Bocadillo', ['2 rebanadas de pan (≈ 60 g)', '1 rebanada de pan integral (≈ 30 g)'])).toContain('pan');
    expect(incoherence('Bol', ['1 yogur natural (≈ 125 g)', '1 skyr (≈ 150 g)'])).toContain('yogur');
    expect(incoherence('Arroz con arroz', [])).toBeTruthy();
    expect(incoherence('Yogur con yogur', [])).toBeTruthy();
  });
  it('no marca platos normales', () => {
    expect(incoherence('Tostada con aguacate y huevo', ['2 rebanadas de pan (≈ 60 g)', '½ aguacate (≈ 75 g)', '1 huevo (≈ 55 g)'])).toBeNull();
    expect(incoherence('Yogur con avena y fruta', ['1 yogur natural (≈ 125 g)', '30 g de avena', '1 plátano (≈ 120 g)'])).toBeNull();
    expect(incoherence('Pasta con tomate y atún', ['80 g de pasta', '100 g de tomate frito', '1 lata de atún (≈ 52 g)'])).toBeNull();
  });
  it('compara con la despensa y deja pasar los básicos', () => {
    const pantry = ['Pan integral', 'Huevos', 'Aguacate'];
    expect(missingFromPantry(['2 rebanadas de pan (≈ 60 g)', '1 huevo (≈ 55 g)', '½ aguacate (≈ 75 g)', '1 pizca de sal', '40 g de salmón ahumado'], pantry)).toEqual(['salmón ahumado']);
    expect(pantryCoverage(['1 huevo', '40 g de salmón ahumado'], pantry)).toBe(0.5);
    expect(pantryCoverage(['1 huevo'], [])).toBe(1);
  });
});

describe('combinaciones sin sentido', () => {
  it('«pan con pepino» no es un plato; con queso o tomate y aceite sí', () => {
    expect(incoherence('Pan con pepino', ['2 rebanadas de pan (≈ 60 g)', '½ pepino mediano (≈ 100 g)'])).toContain('pan solo con verdura');
    expect(incoherence('Tostada de pepino', ['1 rebanada de pan (≈ 30 g)', '100 g de pepino'])).toBeTruthy();
    expect(incoherence('Pan con pepino y queso fresco', ['2 rebanadas de pan (≈ 60 g)', '½ pepino (≈ 100 g)', '60 g de queso fresco'])).toBeNull();
    expect(incoherence('Pan con tomate y aceite', ['2 rebanadas de pan', '1 tomate (≈ 120 g)', '1 cucharada de aceite de oliva'])).toBeNull();
    expect(incoherence('Pan con pepino', [])).toBeTruthy();
  });
  it('fruta con carne o pescado, arroz con fruta y lácteos con pescado no combinan', () => {
    expect(incoherence('Huevo con plátano', ['2 huevos', '1 plátano'])).toContain('fruta');
    expect(incoherence('Arroz con manzana', ['60 g de arroz', '1 manzana'])).toBeTruthy();
    expect(incoherence('Yogur con atún', ['1 yogur', '1 lata de atún'])).toBeTruthy();
    expect(incoherence('Jamón con melón', ['3 lonchas de jamón serrano', '150 g de melón'])).toBeNull();
    expect(incoherence('Yogur con fruta y avena', ['1 yogur natural', '1 plátano', '30 g de avena'])).toBeNull();
    expect(incoherence('Tostada con aguacate', ['2 rebanadas de pan', '½ aguacate'])).toBeNull();
  });
});
