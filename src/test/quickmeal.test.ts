import { describe, expect, it } from 'vitest';
import { parseQuick } from '../lib/quickMeal';

describe('texto rápido', () => {
  it('sandwich sin unidades', () => {
    const r = parseQuick('sandwich: 2 queso, 2 pan, 1 jamón');
    expect(r.map((x) => [x.nombre, x.cantidad, x.unidad])).toEqual([['queso', 2, 'lonchas'], ['pan', 2, 'rebanadas'], ['jamón', 1, 'lonchas']]);
  });
  it('gramos y cucharadas', () => {
    const r = parseQuick('150 g de arroz y 2 cucharadas mayonesa');
    expect(r[0]).toMatchObject({ nombre: 'arroz', cantidad: 150, unidad: 'g' });
    expect(r[1]).toMatchObject({ nombre: 'mayonesa', cantidad: 2, unidad: 'cucharadas' });
  });
  it('sin número cuenta como 1', () => expect(parseQuick('yogur')[0]).toMatchObject({ cantidad: 1 }));
});

import { routineStreak } from '../lib/streaks';
import { dayKey } from '../lib/utils';

describe('racha de pelvis', () => {
  it('cuenta días seguidos y sigue viva desde ayer', () => {
    const now = new Date(2026, 10, 19, 12).getTime();
    const d = (n: number) => dayKey(now - n * 86400000);
    expect(routineStreak({ [d(1)]: { pelvis: true }, [d(2)]: { pelvis: true } }, 'pelvis', now)).toBe(2);
    expect(routineStreak({ [d(0)]: { pelvis: true } }, 'pelvis', now)).toBe(1);
    expect(routineStreak({ [d(3)]: { pelvis: true } }, 'pelvis', now)).toBe(0);
  });
});
