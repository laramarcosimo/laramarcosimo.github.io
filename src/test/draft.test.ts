import { beforeEach, describe, expect, it } from 'vitest';
import { addToDraft, clearDraft, draftCount, getDraft, setDraft } from '../lib/composeDraft';

beforeEach(() => localStorage.clear());

describe('borrador de alimentos', () => {
  it('guarda, suma alimentos repetidos y recuerda lo usado de la despensa', () => {
    addToDraft('k', [{ nombre: 'Huevos', cantidad: 2, unidad: 'unidades' }], ['Huevos']);
    addToDraft('k', [{ nombre: 'huevos', cantidad: 1, unidad: 'unidades' }, { nombre: 'Pan', cantidad: 2, unidad: 'rebanadas' }], ['Pan']);
    expect(getDraft('k').items).toEqual([{ nombre: 'Huevos', cantidad: 3, unidad: 'unidades' }, { nombre: 'Pan', cantidad: 2, unidad: 'rebanadas' }]);
    expect(getDraft('k').used).toEqual(['Huevos', 'Pan']);
    expect(draftCount('k')).toBe(2);
  });
  it('un borrador solo con filas vacías se borra, y cada clave es independiente', () => {
    setDraft('a', [{ nombre: 'Queso', cantidad: 2, unidad: 'lonchas' }]);
    setDraft('b', [{ nombre: 'Pepino', cantidad: 1, unidad: 'unidades' }]);
    setDraft('a', [{ nombre: ' ', cantidad: 1, unidad: 'unidades' }]);
    expect(draftCount('a')).toBe(0);
    expect(draftCount('b')).toBe(1);
    clearDraft('b');
    expect(draftCount('b')).toBe(0);
  });
});
