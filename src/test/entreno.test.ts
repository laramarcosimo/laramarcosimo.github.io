import { describe, expect, it } from 'vitest';
import { acsmKcal, parseClock } from '../lib/cardio';
import { liveTip } from '../lib/liveCoach';
import { platesFor } from '../lib/plates';
import { analyzeProgression, repRange } from '../lib/progression';
import { isPaired, normalizePairs, roundSets } from '../lib/workout';
import { at, set, workout } from './fixtures';

const S = (side: 'D' | 'I', type: 'normal' | 'warmup' = 'normal', completed = false) => ({ id: Math.random().toString(36).slice(2, 7), type, side, weight: 10, reps: 8, completed });
const sides = (a: { side?: string; type: string; completed?: boolean }[]) => a.map((x) => (x.type === 'warmup' ? 'W' : '') + x.side + (x.completed ? '✓' : '')).join(' ');

describe('series unilaterales: siempre parejas I, D', () => {
  it('repara dos D en la serie 3 (I I D I D D)', () => {
    const r = normalizePairs([S('I'), S('I'), S('D'), S('I'), S('D'), S('D')]);
    expect(sides(r)).toBe('I D I D I D');
    expect(isPaired(r)).toBe(true);
  });
  it('ordena D I D I a I D I D', () => {
    expect(sides(normalizePairs([S('D'), S('I'), S('D'), S('I')]))).toBe('I D I D');
  });
  it('completa una serie suelta con su pareja sin marcarla como hecha', () => {
    const r = normalizePairs([S('I', 'normal', true), S('D', 'normal', true), S('I', 'normal', true)]);
    expect(sides(r)).toBe('I✓ D✓ I✓ D');
  });
  it('conserva lo ya marcado como hecho', () => {
    expect(sides(normalizePairs([S('I', 'normal', true), S('I'), S('D'), S('D')]))).toBe('I✓ D I D');
  });
  it('deja los calentamientos aparte y no los empareja', () => {
    const r = normalizePairs([S('I', 'warmup'), S('I'), S('D')]);
    expect(isPaired(r)).toBe(true);
    expect(r[0].type).toBe('warmup');
  });
  it('una serie unilateral son exactamente 2 filas (I y D)', () => {
    const sets = normalizePairs([S('I'), S('D'), S('I'), S('D'), S('I'), S('D')]);
    expect(roundSets({ sets, unilateral: true }, 1).map((x) => x.side)).toEqual(['I', 'D']);
  });
});

describe('sobrecarga progresiva', () => {
  const now = at(12);
  it('lee el rango de repeticiones de las notas (10-12) o usa 8-12', () => {
    expect(repRange('3 series · 10-12 reps')).toEqual([10, 12]);
    expect(repRange(undefined)).toEqual([8, 12]);
  });
  it('sube de peso si todas las series llegaron al tope del rango', () => {
    const ws = [workout(now, 1, [{ id: 'ht', sets: [set(60, 12), set(60, 12), set(60, 12)] }])];
    const p = analyzeProgression(ws, 'ht', 'Hip Thrust', '10-12 reps', 2.5);
    expect(p?.kind).toBe('raise');
    expect(p?.weight).toBe(62.5);
  });
  it('no sube si alguna serie no llegó al tope', () => {
    const ws = [workout(now, 1, [{ id: 'ht', sets: [set(60, 12), set(60, 11), set(60, 12)] }])];
    expect(analyzeProgression(ws, 'ht', 'Hip Thrust', '10-12 reps', 2.5)).toBeNull();
  });
  it('no sube si hubo una serie al límite (RPE 10): aconseja bajar para proteger la técnica', () => {
    const ws = [workout(now, 1, [{ id: 'ht', sets: [set(60, 12), set(60, 12), set(60, 12, { rpe: 10 })] }])];
    const p = analyzeProgression(ws, 'ht', 'Hip Thrust', '10-12 reps', 2.5);
    expect(p?.kind).toBe('lower');
    expect(p?.weight).toBe(57.5);
  });
  it('en una máquina sube exactamente un escalón de la máquina', () => {
    const ws = [workout(now, 1, [{ id: 'pp', sets: [set(25, 12), set(25, 12), set(25, 12)] }])];
    const p = analyzeProgression(ws, 'pp', 'Press', '10-12 reps', 2.5, undefined, false, true);
    expect(p?.weight).toBe(27.5);
  });
  it('detecta estancamiento: 3 sesiones sin mejorar durante 10 días o más', () => {
    const mk = (d: number) => workout(now, d, [{ id: 'lp', sets: [set(100, 10), set(100, 10), set(100, 10)] }]);
    const p = analyzeProgression([mk(1), mk(8), mk(15)], 'lp', 'Prensa', '8-12 reps', 2.5);
    expect(p?.kind).toBe('stall');
  });
  it('no hay estancamiento si mejoraste en alguna sesión', () => {
    const mk = (d: number, w: number) => workout(now, d, [{ id: 'lp', sets: [set(w, 10), set(w, 10), set(w, 10)] }]);
    expect(analyzeProgression([mk(1, 105), mk(8, 100), mk(15, 100)], 'lp', 'Prensa', '8-12 reps', 2.5)).toBeNull();
  });
  it('no avisa de estancamiento si pasaron menos de 10 días', () => {
    const mk = (d: number) => workout(now, d, [{ id: 'lp', sets: [set(100, 10), set(100, 10), set(100, 10)] }]);
    expect(analyzeProgression([mk(1), mk(3), mk(5)], 'lp', 'Prensa', '8-12 reps', 2.5)).toBeNull();
  });
});

describe('máquinas: salto de peso', () => {
  const prev = [set(25, 12), set(25, 12)];
  const base = { ex: { muscleGroup: 'Pecho' } as never, prev, location: 'gym' as const, period: false, cap: undefined, step: 2.5, machine: true };
  it('avisa si pasas de 25 a 32,5 kg y propone un solo escalón (27,5)', () => {
    const t = liveTip({ ...base, set: set(32.5, 10) });
    expect(t?.text).toContain('Salto brusco');
    expect(t?.text).toContain('27.5');
  });
  it('no avisa si subes un solo escalón', () => {
    expect(liveTip({ ...base, set: set(27.5, 10) })).toBeNull();
  });
});

describe('calculadora de discos', () => {
  it('60 kg con barra de 20: un disco de 20 por lado', () => {
    expect(platesFor(60, 20)).toEqual({ perSide: [20], total: 60, exact: true });
  });
  it('62,5 kg: 20 + 1,25 por lado', () => {
    expect(platesFor(62.5, 20).perSide).toEqual([20, 1.25]);
  });
  it('con barra de 15 kg', () => {
    expect(platesFor(42.5, 15).perSide).toEqual([10, 2.5, 1.25]);
  });
  it('si no se puede formar el peso exacto, da el más cercano por debajo', () => {
    const p = platesFor(61, 20);
    expect(p.exact).toBe(false);
    expect(p.total).toBe(60);
  });
  it('solo la barra no lleva discos', () => {
    expect(platesFor(20, 20).perSide).toEqual([]);
  });
});

describe('cardio: ecuación ACSM', () => {
  it('4,5 km/h al 7 % durante 8:29 con 55 kg ≈ 48 kcal', () => {
    expect(acsmKcal(4.5, 7, parseClock('08:29'), 55)).toBe(48);
  });
  it('a más pendiente, más gasto', () => {
    expect(acsmKcal(4.5, 7, 10, 55)).toBeGreaterThan(acsmKcal(4.5, 0, 10, 55));
  });
  it('lee tiempos mm:ss y h:mm:ss', () => {
    expect(parseClock('08:30')).toBeCloseTo(8.5);
    expect(parseClock('1:05:00')).toBeCloseTo(65);
  });
});

describe('rango de reps estructurado', () => {
  it('rangeNotes lo convierte al formato que lee la progresión', async () => {
    const { rangeNotes } = await import('../components/ExerciseTargets');
    expect(repRange(rangeNotes({ repMin: 12, repMax: 8, notes: 'lento' }))).toEqual([8, 12]);
    expect(rangeNotes({ notes: 'x' })).toBe('x');
  });
});

describe('abdominales por segundos', () => {
  it('byTimeOf: solo Abdominales, por defecto plancha en segundos y manda la elección', async () => {
    const { byTimeOf } = await import('../components/ExerciseTargets');
    const core = { muscleGroup: 'Abdominales', name: 'Plancha' } as never;
    const crunch = { muscleGroup: 'Abdominales', name: 'Crunch' } as never;
    const leg = { muscleGroup: 'Cuádriceps', name: 'Plancha' } as never;
    expect(byTimeOf({}, core)).toBe(true);
    expect(byTimeOf({}, crunch)).toBe(false);
    expect(byTimeOf({ byTime: true }, crunch)).toBe(true);
    expect(byTimeOf({ byTime: false }, core)).toBe(false);
    expect(byTimeOf({ byTime: true }, leg)).toBe(false);
  });
});

describe('periodo olvidado entre dos sesiones', () => {
  const w = (id: string, day: number, p = false) => ({ id, startTime: new Date(2026, 9, day, 18).toISOString(), isPeriodSession: p || undefined }) as never;
  it('marca la del medio si está entre dos con periodo de la misma semana', async () => {
    const { fillPeriodGaps } = await import('../lib/workout');
    const r = fillPeriodGaps([w('jue', 8, true), w('mie', 7, true), w('mar', 6), w('lun', 5, true)]) as { id: string; isPeriodSession?: boolean; periodAuto?: boolean }[];
    expect(r.find((x) => x.id === 'mar')).toMatchObject({ isPeriodSession: true, periodAuto: true });
    expect(r.find((x) => x.id === 'lun')?.periodAuto).toBeUndefined();
  });
  it('no marca si solo hay periodo de un lado o están muy separadas', async () => {
    const { fillPeriodGaps } = await import('../lib/workout');
    const a = fillPeriodGaps([w('c', 9), w('b', 7, true)]) as { isPeriodSession?: boolean }[];
    expect(a[0].isPeriodSession).toBeUndefined();
    const b = fillPeriodGaps([w('c', 20, true), w('m', 10), w('a', 1, true)]) as { isPeriodSession?: boolean }[];
    expect(b[1].isPeriodSession).toBeUndefined();
    // viernes 9 (periodo), domingo 11 sin marcar, martes 13 (periodo): cambia la semana, no se aplica
    const c = fillPeriodGaps([w('v', 13, true), w('d', 11), w('x', 9, true)]) as { isPeriodSession?: boolean }[];
    expect(c[1].isPeriodSession).toBeUndefined();
  });
});

describe('mancuernas: por mano o total', () => {
  it('perHandOf: por defecto sí con «mancuernas» (plural), no con «mancuerna» ni fuera de mancuernas; manda la elección', async () => {
    const { perHandOf, volumeOf, logVolume } = await import('../lib/workout');
    const par = { equipment: 'Mancuernas', name: 'Curl con mancuernas' } as never;
    const una = { equipment: 'Mancuernas', name: 'Sentadilla sumo con mancuerna' } as never;
    const barra = { equipment: 'Barra', name: 'Press mancuernas' } as never;
    expect(perHandOf({}, par)).toBe(true);
    expect(perHandOf({}, una)).toBe(false);
    expect(perHandOf({ perHand: true }, una)).toBe(true);
    expect(perHandOf({ perHand: true }, barra)).toBe(false);
    expect(volumeOf([set(12, 10)], true)).toBe(240);
    expect(volumeOf([set(12, 10)])).toBe(120);
    expect(logVolume([{ exerciseId: 'x', name: 'x', muscleGroup: 'Bíceps', perHand: true, sets: [set(12, 10)] }])).toBe(240);
  });
});

describe('duración estimada de la sesión', () => {
  it('series × 45 s + descansos + calentamiento; el cardio suma sus minutos', async () => {
    const { estimateMinutes } = await import('../lib/timeOptimizer');
    const ex = (id: string) => ({ id, name: id, muscleGroup: 'Pecho', equipment: 'Barra' }) as never;
    const w = (id: string, n: number): Record<string, unknown> => ({ id, exerciseId: id, sets: Array.from({ length: n }, () => ({ id: 'x', type: 'normal', weight: 10, reps: 10, completed: false })) }) as never;
    // 3 series: 3 × (45 + 120) = 495 s + 180 s de calentamiento = 675 s ≈ 11 min
    expect(estimateMinutes([{ ...w('a', 3), restSec: 120 } as never], ex, 90, false)).toBe(11);
  });
});

describe('duración estimada: descansos tras cada serie', () => {
  it('un lado y luego el otro descansa una vez por pareja; la superserie, una vez por ronda', async () => {
    const { estimateMinutes } = await import('../lib/timeOptimizer');
    const ex = (id: string) => ({ id, name: id, muscleGroup: 'Pecho', equipment: 'Barra' }) as never;
    const sets = (n: number) => Array.from({ length: n }, () => ({ id: 'x', type: 'normal', weight: 10, reps: 10, completed: false }));
    // 4 series de un lado (2 parejas): 4 × 45 + 2 × 120 = 420 s + 180 de calentamiento = 600 s = 10 min
    expect(estimateMinutes([{ id: 'a', exerciseId: 'a', unilateral: true, restSec: 120, sets: sets(4) } as never], ex, 90, false)).toBe(10);
    // superserie de 2 ejercicios × 3 series: 6 × 45 + 3 rondas × 120 = 630 s + 180 = 810 s ≈ 14 min (13,5 → 14)
    expect(estimateMinutes([{ id: 'a', exerciseId: 'a', superset: 's', restSec: 120, sets: sets(3) } as never, { id: 'b', exerciseId: 'b', superset: 's', restSec: 120, sets: sets(3) } as never], ex, 90, false)).toBe(14);
  });
});
