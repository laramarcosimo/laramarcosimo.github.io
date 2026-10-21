import { describe, expect, it } from 'vitest';
import { missingInBackup, summarizeBackup } from '../lib/backupCheck';
import { searchSettings } from '../lib/settingsIndex';
import { mkState } from './fixtures';

describe('buscador de Ajustes', () => {
  it('encuentra sin tildes ni mayúsculas y por sinónimos', () => {
    expect(searchSettings('FOTO')[0].section).toBe('avisos');
    expect(searchSettings('vacaciones')[0].label).toBe('Modo vacaciones');
    expect(searchSettings('contraseña').some((e) => e.label.includes('Cifrado'))).toBe(true);
    expect(searchSettings('modo oscuro')[0].section).toBe('apariencia');
  });
  it('exige todas las palabras y no devuelve nada con texto vacío o corto', () => {
    expect(searchSettings('')).toEqual([]);
    expect(searchSettings('a')).toEqual([]);
    expect(searchSettings('cifrado zzzz')).toEqual([]);
  });
});

describe('comprobación de la copia', () => {
  it('resume una copia válida y rechaza una inválida', () => {
    const s = mkState({ workouts: [{} as never, {} as never], meals: [{} as never] });
    expect(summarizeBackup(s)).toMatchObject({ workouts: 2, meals: 1, templates: 0 });
    expect(summarizeBackup({} as never)).toBeNull();
    expect(summarizeBackup(null)).toBeNull();
  });
  it('dice qué falta en la copia respecto al móvil', () => {
    const cloud = { workouts: 10, meals: 50, templates: 3, measurements: 4, pantry: 0, products: 0 };
    const local = { workouts: 12, meals: 50, templates: 3, measurements: 5, pantry: 0, products: 0 };
    expect(missingInBackup(cloud, local)).toEqual(['2 entrenos', '1 medidas']);
    expect(missingInBackup(local, local)).toEqual([]);
  });
});
