import { describe, expect, it } from 'vitest';
import { FIXED_PLAN, dayBalance, kcalRange, planText } from '../lib/metabolic';
import { isFruit, placeOf } from '../lib/pantry';
import { at, keyOf, mkState, workout, set } from './fixtures';

describe('rangos de kcal por tipo de día', () => {
  it('por defecto: entreno 1.600-1.800 y descanso 1.700-1.800', () => {
    const s = mkState();
    expect(kcalRange(s.settings, true)).toEqual({ min: 1600, max: 1800 });
    expect(kcalRange(s.settings, false)).toEqual({ min: 1700, max: 1800 });
  });
  it('usa los rangos de Ajustes y ordena mínimo y máximo si están al revés', () => {
    const s = mkState({ settings: { kcalRest: { min: 1600, max: 1450 }, kcalTrain: { min: 1500, max: 1900 } } });
    expect(kcalRange(s.settings, false)).toEqual({ min: 1450, max: 1600 });
    expect(kcalRange(s.settings, true)).toEqual({ min: 1500, max: 1900 });
  });
  it('el texto para Gemini incluye los dos rangos y el reparto de macros', () => {
    const t = planText(mkState({ settings: { kcalRest: { min: 1450, max: 1600 } } }).settings);
    expect(t).toContain('1450-1600');
    expect(t).toContain('1600-1800');
    expect(t).toContain('100-120 g de proteína');
  });
});

describe('balance del día', () => {
  const key = keyOf(at(12));
  const wd = new Date(at(12)).getDay();
  it('macros fijos: 100 g de proteína, 60 g de grasa y 220 g de carbohidratos en día de entreno', () => {
    const b = dayBalance(mkState({ settings: { trainDays: [wd] } }), key);
    expect(b.trainingDay).toBe(true);
    expect(b.proteinTarget).toBe(100);
    expect(b.fatTarget).toBe(FIXED_PLAN.fat);
    expect(b.carbsTarget).toBe(220);
    expect([b.kcalMin, b.kcalMax]).toEqual([1600, 1800]);
    expect(b.target).toBe(1700);
  });
  it('día de descanso: 1.700-1.800 kcal y 195-220 g de carbohidratos', () => {
    const b = dayBalance(mkState({ settings: { trainDays: [(wd + 1) % 7] } }), key);
    expect(b.trainingDay).toBe(false);
    expect([b.kcalMin, b.kcalMax]).toEqual([1700, 1800]);
    expect(b.carbsMin).toBe(195);
    expect(b.target).toBe(1750);
  });
  it('si marcaste el día como descanso, un entreno registrado ese día sigue contando como descanso', () => {
    const now = at(20);
    const s = mkState({ settings: { trainDays: [(wd + 1) % 7] }, workouts: [workout(now, 0, [{ id: 'x', sets: [set(50, 10)] }])] });
    expect(dayBalance(s, key).trainingDay).toBe(false);
  });
  it('sin días marcados, el entreno registrado hace que sea día de entreno', () => {
    const now = at(20);
    const s = mkState({ workouts: [workout(now, 0, [{ id: 'x', sets: [set(50, 10)] }])] });
    expect(dayBalance(s, key).trainingDay).toBe(true);
  });
  it('las calorías restantes salen de la meta menos lo comido', () => {
    const s = mkState({ settings: { trainDays: [wd] }, meals: [{ id: 'm', ts: at(13), slot: 'comida', plato: 'x', calorias: 600, proteinas: 30, carbs: 50, grasas: 20 }] as never });
    const b = dayBalance(s, key);
    expect(b.remaining).toBe(1100);
    expect(b.proteinRemaining).toBe(70);
  });
  it('un rango personalizado cambia la meta de ese tipo de día', () => {
    const b = dayBalance(mkState({ settings: { trainDays: [(wd + 1) % 7], kcalRest: { min: 1450, max: 1600 } } }), key);
    expect([b.kcalMin, b.kcalMax, b.target]).toEqual([1450, 1600, 1525]);
  });
});

describe('ubicación de la despensa', () => {
  it('deduce nevera, congelador y despensa por el nombre', () => {
    expect(placeOf({ name: 'Yogur griego' })).toBe('nevera');
    expect(placeOf({ name: 'Guisantes congelados' })).toBe('congelador');
    expect(placeOf({ name: 'Hielo' })).toBe('congelador');
    expect(placeOf({ name: 'Arroz' })).toBe('despensa');
  });
  it('despensa: envasados, conservas y secos (aunque lleven nombre de fresco)', () => {
    for (const n of ['Tomate frito', 'Lata de atún', 'Ketchup', 'Aceite de oliva', 'Pasta integral', 'Plátanos', 'Patatas', 'Leche UHT', 'Leche de avena', 'Garbanzos cocidos', 'Crema de cacahuete']) expect(placeOf({ name: n })).toBe('despensa');
  });
  it('nevera: lácteos, huevos, embutidos, carne, pescado fresco, verdura y fruta delicada', () => {
    for (const n of ['Huevos', 'Pavo en lonchas', 'Jamón cocido', 'Pechuga de pollo', 'Salmón fresco', 'Lechuga', 'Tomates', 'Fresas', 'Uvas verdes', 'Queso fresco', 'Yogur natural', 'Tofu', 'Hummus']) expect(placeOf({ name: n })).toBe('nevera');
  });
  it('congelador: lo congelado y lo que lo es por naturaleza', () => {
    for (const n of ['Guisantes congelados', 'Merluza congelada', 'Croquetas', 'Pizza', 'Helado de vainilla', 'Hielo', 'Frutos del bosque congelados']) expect(placeOf({ name: n })).toBe('congelador');
  });
  it('detecta la fruta para el objetivo de 2 piezas al día', () => {
    for (const n of ['Manzana', 'Plátano', 'Uvas verdes', 'Fresas', 'Kiwi', 'Mandarinas']) expect(isFruit(n)).toBe(true);
    for (const n of ['Yogur griego', 'Pan', 'Arroz']) expect(isFruit(n)).toBe(false);
  });
  it('respeta la ubicación elegida a mano', () => {
    expect(placeOf({ name: 'Arroz', place: 'congelador' })).toBe('congelador');
  });
});

import { kcalStatus } from '../lib/metabolic';
describe('rango de calorías: mínimo obligatorio, máximo opcional', () => {
  it('por debajo del mínimo falta llegar; dentro del rango es óptimo; solo pasarse del máximo es exceso', () => {
    expect(kcalStatus(1200, 1600, 1800)).toEqual({ state: 'below', delta: 400, headroom: 600 });
    expect(kcalStatus(1600, 1600, 1800).state).toBe('ok');
    expect(kcalStatus(1750, 1600, 1800)).toEqual({ state: 'ok', delta: 0, headroom: 50 });
    expect(kcalStatus(1800, 1600, 1800).state).toBe('ok');
    expect(kcalStatus(1850, 1600, 1800)).toEqual({ state: 'over', delta: 50, headroom: 0 });
  });
});

describe('rango de proteína', () => {
  it('por defecto mínimo 100 y techo 120; usa Ajustes y ordena si está al revés', () => {
    const key = keyOf(at(12));
    const d = dayBalance(mkState(), key);
    expect([d.proteinTarget, d.proteinMax]).toEqual([100, 120]);
    const c = dayBalance(mkState({ settings: { proteinRange: { min: 130, max: 110 } } }), key);
    expect([c.proteinTarget, c.proteinMax, c.proteinMid]).toEqual([110, 130, 120]);
    expect(planText(mkState({ settings: { proteinRange: { min: 110, max: 130 } } }).settings)).toContain('110-130 g de proteína');
  });
});

describe('resumen semanal de proteína', () => {
  it('cuenta los días que llegas al mínimo', async () => {
    const { weekSummary } = await import('../lib/weekly');
    const w = weekSummary(mkState());
    expect(w.proteinDays).toBe(0);
  });
});

describe('baremo de grasas y carbohidratos', () => {
  it('por defecto: grasa 50-60, carbohidratos 200-220 (entreno) y 195-220 (sin entreno)', () => {
    const key = keyOf(at(12));
    const wd = new Date(at(12)).getDay();
    const t = dayBalance(mkState({ settings: { trainDays: [wd] } }), key);
    expect([t.fatMin, t.fatTarget, t.carbsMin, t.carbsTarget]).toEqual([50, 60, 200, 220]);
    const r = dayBalance(mkState({ settings: { trainDays: [(wd + 1) % 7] } }), key);
    expect([r.carbsMin, r.carbsTarget]).toEqual([195, 220]);
  });
  it('usa el baremo de Ajustes, con carbohidratos distintos en días sin entreno', () => {
    const key = keyOf(at(12));
    const wd = new Date(at(12)).getDay();
    const settings = { fatRange: { min: 55, max: 70 }, carbsRange: { min: 210, max: 250 }, carbsRestRange: { min: 120, max: 150 } };
    const t = dayBalance(mkState({ settings: { ...settings, trainDays: [wd] } }), key);
    expect([t.fatMin, t.fatTarget, t.carbsMin, t.carbsTarget]).toEqual([55, 70, 210, 250]);
    const r = dayBalance(mkState({ settings: { ...settings, trainDays: [(wd + 1) % 7] } }), key);
    expect([r.carbsMin, r.carbsTarget]).toEqual([120, 150]);
    const txt = planText(mkState({ settings }).settings);
    expect(txt).toContain('55-70 g de grasa y 210-250 g de carbohidratos');
    expect(txt).toContain('120-150 g de carbohidratos');
  });
  it('lee los valores sueltos de la versión anterior como máximo', () => {
    const r = dayBalance(mkState({ settings: { fatTarget: 70, carbsTarget: 180, trainDays: [] } }), keyOf(at(12)));
    expect([r.fatTarget, r.carbsTarget]).toEqual([70, 180]);
  });
});

describe('resumen por semanas naturales', () => {
  it('etiqueta lunes–domingo y cuenta solo los entrenos de esa semana', async () => {
    const { weekLabel, weekMonday, weekSummary } = await import('../lib/weekly');
    const now = new Date(2026, 9, 8, 12).getTime(); // jueves 8 oct
    expect(weekLabel(weekMonday(now))).toBe('5–11 oct');
    expect(weekLabel(weekMonday(now, 1))).toBe('28 sept – 4 oct');
    const s = mkState({ workouts: [workout(now, 1, [{ id: 'x', sets: [set(50, 10)] }]), workout(now, 8, [{ id: 'x', sets: [set(50, 10)] }])] });
    expect(weekSummary(s, now, 0).workouts).toBe(1); // miércoles 7
    expect(weekSummary(s, now, 1).workouts).toBe(1); // miércoles 30 sep
    expect(weekSummary(s, now, 2).workouts).toBe(0);
    expect(weekSummary(s, now, 1).dayVolume.map((d) => d.label).join('')).toBe('LMXJVSD');
  });
});

describe('precisión de macros en las propuestas de la IA', () => {
  it('descarta lo que supera el máximo de carbohidratos o grasa y ordena por cercanía a lo que le toca', async () => {
    const { fitsMacroCaps, macroPenalty } = await import('../lib/gemini');
    const ctx = { kcal: 500, proteina: 35, restoCarbs: 60, restoGrasa: 20, carbsSlot: 45, grasaSlot: 15 };
    const buena = { calorias: 500, proteinas: 35, carbs: 45, grasas: 15 };
    const pasadaCarbs = { calorias: 500, proteinas: 35, carbs: 90, grasas: 15 };
    const pasadaGrasa = { calorias: 500, proteinas: 35, carbs: 45, grasas: 35 };
    expect(fitsMacroCaps(buena, ctx)).toBe(true);
    expect(fitsMacroCaps(pasadaCarbs, ctx)).toBe(false);
    expect(fitsMacroCaps(pasadaGrasa, ctx)).toBe(false);
    expect(macroPenalty(buena, ctx)).toBeLessThan(macroPenalty({ ...buena, carbs: 70, grasas: 25 }, ctx));
    expect(macroPenalty(buena, ctx)).toBe(0);
  });
});

describe('alimentación de la semana frente al baremo', () => {
  it('resume media y días en rango de kcal, proteína, carbohidratos y grasas', async () => {
    const { weekSummary } = await import('../lib/weekly');
    const now = new Date(2026, 9, 8, 12).getTime(); // jueves 8 oct (semana 5–11)
    const meal = (id: string, d: number, k: number, p: number, c: number, g: number) => ({ id, ts: new Date(2026, 9, d, 13).getTime(), plato: 'x', calorias: k, proteinas: p, carbs: c, grasas: g }) as never;
    const s = mkState({ meals: [meal('a', 5, 1750, 110, 210, 55), meal('b', 6, 2300, 60, 300, 90)] });
    const w = weekSummary(s, now, 0);
    const byLabel = Object.fromEntries(w.nutri.map((r) => [r.label, r]));
    expect(w.nutri.map((r) => r.label)).toEqual(['Calorías', 'Proteína', 'Carbohidratos', 'Grasas']);
    expect(byLabel['Calorías']).toMatchObject({ days: 2, ok: 1 });
    expect(byLabel['Proteína'].ok).toBe(1);
    expect(byLabel['Carbohidratos'].ok).toBe(1);
    expect(byLabel['Grasas']).toMatchObject({ ok: 1, avg: 73 });
    expect(weekSummary(s, now, 1).nutri).toEqual([]);
  });
});

describe('resumen de objetivos para los PDF', () => {
  it('valora entrenos, nutrición y cuerpo según el objetivo', async () => {
    const { goalSummary, wrapText } = await import('../lib/goalSummary');
    const from = new Date(2026, 9, 1).getTime();
    const to = new Date(2026, 9, 14, 23).getTime();
    const wo = (d: number) => workout(new Date(2026, 9, d, 19).getTime() + 3600000, 0, [{ id: 'x', sets: [set(50, 10)] }]);
    const meal = (id: string, d: number, k: number, p: number, c: number, g: number) => ({ id, ts: new Date(2026, 9, d, 13).getTime(), plato: 'x', calorias: k, proteinas: p, carbs: c, grasas: g }) as never;
    const meals = [1, 2, 3, 4].map((d) => meal('m' + d, d, 1750, 110, 210, 55));
    const s = mkState({ workouts: [1, 3, 5, 8, 10, 12].map(wo), meals, measurements: [{ id: 'a', ts: from + 3600000, weight: 70, waist: 80 }, { id: 'b', ts: to - 3600000, weight: 69, waist: 78 }], settings: { weeklyGoal: 3, trainDays: [] } });
    const g = goalSummary(s, from, to, to + 1000);
    expect(g.verdict).toBe('good');
    expect(g.text).toContain('recomposición');
    expect(g.checks.find((c) => c.label === 'cuerpo')?.ok).toBe(true);
    const bad = goalSummary(mkState({ meals: [1, 2, 3].map((d) => meal('x' + d, d, 3000, 40, 400, 120)) }), from, to, to + 1000);
    expect(['bad', 'mixed']).toContain(bad.verdict);
    expect(goalSummary(mkState(), from, to, to + 1000).verdict).toBe('bad');
    expect(wrapText({ getTextWidth: (t: string) => t.length }, 'uno dos tres cuatro cinco', 10)).toEqual(['uno dos', 'tres', 'cuatro', 'cinco']);
  });
});

describe('objetivos numéricos de cada toma', () => {
  const key = keyOf(at(12));
  const meal = (id: string, h: number, k: number, p: number, c: number, g: number) => ({ id, ts: new Date(new Date(at(12)).setHours(h, 0, 0, 0)).getTime(), plato: 'x', calorias: k, proteinas: p, carbs: c, grasas: g }) as never;

  it('con la proteína cubierta, la toma pide poca proteína y las calorías que faltan', async () => {
    const { slotTarget } = await import('../lib/slotTargets');
    const b = dayBalance(mkState({ meals: [meal('a', 9, 500, 40, 60, 15), meal('b', 14, 600, 80, 80, 20)] }), key); // 1100 kcal, 120 g de proteína
    const t = slotTarget(b, { kcal: 0, prot: 0, carbs: 0, fat: 0 }, 0.15 / 0.4);
    expect(t.covered).toBe(true);
    expect(t.prot).toBe(0);
    expect(t.protCap).toBe(10);
    expect(t.kcal).toBeGreaterThanOrEqual(230);
    expect(t.kcal).toBeLessThanOrEqual(260);
    expect(t.kcalToMin).toBe(600); // 1700 − 1100
    // si es la última toma, se lleva todo lo que falta para el mínimo
    const last = slotTarget(b, { kcal: 0, prot: 0, carbs: 0, fat: 0 }, 1);
    expect(last.kcal).toBeGreaterThanOrEqual(640);
    expect(last.kcal).toBeLessThanOrEqual(700);
  });

  it('sin cubrir la proteína, reparte lo que falta para el mínimo', async () => {
    const { slotTarget } = await import('../lib/slotTargets');
    const b = dayBalance(mkState({ meals: [meal('a', 9, 400, 20, 50, 10)] }), key);
    const t = slotTarget(b, { kcal: 0, prot: 0, carbs: 0, fat: 0 }, 0.5);
    expect(t.covered).toBe(false);
    expect(t.prot).toBe(40); // (100 − 20) × 0,5
    expect(t.protCap).toBe(48);
    expect(slotTarget(b, { kcal: 0, prot: 0, carbs: 0, fat: 0 }, 0).kcal).toBeLessThanOrEqual(180); // toma opcional
  });

  it('fitsSlot descarta lo que no cumple calorías o proteína', async () => {
    const { fitsSlot } = await import('../lib/gemini');
    const c = { kcal: 250, proteina: 0, restoCarbs: 100, restoGrasa: 30, kcalMin: 215, kcalMax: 295, proteinaMax: 10, carbsSlot: 35, grasaSlot: 8 };
    expect(fitsSlot({ calorias: 260, proteinas: 6, carbs: 40, grasas: 8 }, c)).toBe(true);
    expect(fitsSlot({ calorias: 120, proteinas: 6, carbs: 20, grasas: 4 }, c)).toBe(false); // se queda corta
    expect(fitsSlot({ calorias: 260, proteinas: 28, carbs: 20, grasas: 8 }, c)).toBe(false); // demasiada proteína
  });

  it('el prompt dice que la proteína está cubierta y el rango de calorías', async () => {
    const { suggestForSlot } = await import('../lib/gemini');
    let sent = '';
    const of = globalThis.fetch;
    const nav = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    Object.defineProperty(globalThis, 'navigator', { value: { onLine: true }, configurable: true });
    (globalThis as { fetch: unknown }).fetch = async (_u: unknown, o: { body?: string }) => {
      sent = String(o?.body ?? '');
      return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: '{"opciones":[]}' }] } }] }) };
    };
    try {
      await suggestForSlot({ geminiKey: 'k', geminiModel: 'm', aiGraceSec: 0 } as never, { slot: 'merienda', kcal: 300, proteina: 0, restoKcal: 700, restoProteina: 0, restoCarbs: 90, restoGrasa: 25, inventario: { nevera: [], despensa: [], congelador: [] }, noLeGusta: [], planDia: '', evitar: [], frutaPendiente: 0, frutasDespensa: [], variante: 0, kcalMin: 260, kcalMax: 350, proteinaMax: 10, proteinaCubierta: true, kcalFaltanMin: 600 } as never, [], '').catch((e) => { sent = sent || `ERR ${String(e)} ${(e as Error).stack?.split("\n").slice(1, 4).join(" | ")}`; });
    } finally {
      (globalThis as { fetch: unknown }).fetch = of;
      if (nav) Object.defineProperty(globalThis, 'navigator', nav);
    }
    expect(sent).toContain('YA ESTÁ CUBIERTA');
    expect(sent).toContain('entre 260 y 350 kcal');
    expect(sent).toContain('MERIENDA SUSTANCIOSA');
    expect(sent).toContain('Aún faltan 600 kcal');
  }, 20_000);
});

describe('la IA no recibe instrucciones contradictorias', () => {
  const key2 = keyOf(at(12));
  it('con la proteína cubierta, los contextos lo dicen y no piden «proteína alta» ni gramos por kilo', async () => {
    const { goalContext, recipeContext } = await import('../lib/coach');
    const meals = [{ id: 'a', ts: new Date(new Date(at(12)).setHours(10, 0, 0, 0)).getTime(), plato: 'x', calorias: 1100, proteinas: 125, carbs: 100, grasas: 30 }] as never;
    const s = mkState({ meals, dislikes: ['cilantro'] });
    const b = dayBalance(s, key2);
    for (const txt of [goalContext(s, b), recipeContext(s, b)]) {
      expect(txt).toContain('YA ESTÁ CUBIERTA');
      expect(txt).toContain('MÍNIMO de calorías');
      expect(txt).toContain('cilantro');
      expect(txt).not.toMatch(/1,8|2,0 g por kg|proteína alta \(/);
      expect(txt).not.toContain('(recomposición). Día');
    }
  });

  it('suggestForSlot descarta opciones con alimentos que no te gustan', async () => {
    const { suggestForSlot } = await import('../lib/gemini');
    const of = globalThis.fetch;
    const nav = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    Object.defineProperty(globalThis, 'navigator', { value: { onLine: true }, configurable: true });
    const opciones = [
      { nombre: 'Tostada con cilantro', detalle: ['2 rebanadas de pan (≈ 60 g)', '1 cucharada de cilantro (≈ 5 g)'], calorias: 200, proteinas: 6, carbs: 35, grasas: 3, usa: [] },
      { nombre: 'Tostada con aguacate', detalle: ['2 rebanadas de pan (≈ 60 g)', '½ aguacate (≈ 75 g)'], calorias: 290, proteinas: 7, carbs: 31, grasas: 15, usa: [] },
    ];
    (globalThis as { fetch: unknown }).fetch = async () => ({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ opciones }) }] } }] }) });
    try {
      const out = await suggestForSlot({ geminiKey: 'k', geminiModel: 'm', aiGraceSec: 0 } as never, { slot: 'merienda', kcal: 280, proteina: 0, restoKcal: 700, restoProteina: 0, restoCarbs: 120, restoGrasa: 40, inventario: { nevera: [], despensa: [], congelador: [] }, noLeGusta: ['cilantro'], planDia: '', evitar: [], frutaPendiente: 0, frutasDespensa: [], variante: 0 } as never, [], '');
      expect(out.map((o) => o.nombre)).toEqual(['Tostada con aguacate']);
    } finally {
      (globalThis as { fetch: unknown }).fetch = of;
      if (nav) Object.defineProperty(globalThis, 'navigator', nav);
    }
  });
});

describe('invariantes de los objetivos por toma (muchos días al azar)', () => {
  it('nunca supera el máximo del día, reparte lo que falta y respeta la proteína cubierta', async () => {
    const { slotTarget } = await import('../lib/slotTargets');
    let seed = 12345;
    const rnd = (n: number): number => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return Math.floor((seed / 2147483648) * n);
    };
    const key3 = keyOf(at(12));
    for (let i = 0; i < 300; i++) {
      const kcal = rnd(2300);
      const prot = rnd(160);
      const meals = [{ id: 'm', ts: new Date(new Date(at(12)).setHours(10, 0, 0, 0)).getTime(), plato: 'x', calorias: kcal, proteinas: prot, carbs: rnd(300), grasas: rnd(100) }] as never;
      const b = dayBalance(mkState({ meals }), key3);
      const free = [0.25, 0.35, 0.15, 0.25].slice(rnd(3));
      const wsum = free.reduce((a, w) => a + w, 0);
      const none = { kcal: 0, prot: 0, carbs: 0, fat: 0 };
      const ts = free.map((w) => slotTarget(b, none, w / wsum));
      const room = Math.max(0, b.kcalMax - b.eaten);
      const toMin = Math.max(0, b.kcalMin - b.eaten);
      for (const t of ts) {
        expect(t.kcal).toBeGreaterThanOrEqual(0);
        expect(t.kcal).toBeLessThanOrEqual(room);
        expect(t.kcalHigh).toBeLessThanOrEqual(room);
        expect(t.kcalLow).toBeLessThanOrEqual(t.kcal);
        expect(t.prot).toBeGreaterThanOrEqual(0);
        if (b.proteinEaten >= b.proteinTarget) {
          expect(t.covered).toBe(true);
          expect(t.prot).toBe(0);
          expect(t.protCap).toBe(10);
        } else expect(t.protCap).toBeGreaterThanOrEqual(t.prot);
      }
      // entre todas las tomas libres se reparte (aprox., por el redondeo a 10 kcal) lo necesario para llegar al mínimo, sin pasar del máximo
      const sum = ts.reduce((a, t) => a + t.kcal, 0);
      expect(sum).toBeLessThanOrEqual(room + 5 * ts.length);
      if (room > 0) expect(sum + 5 * ts.length).toBeGreaterThanOrEqual(Math.min(toMin, room));
    }
  });
});

describe('la IA se ciñe a tu despensa, a lo que no te gusta y a la coherencia', () => {
  it('descarta «pan con pan» y platos que casi no usan la despensa, y avisa de lo que hay que comprar', async () => {
    const { suggestForSlot } = await import('../lib/gemini');
    const of = globalThis.fetch;
    const nav = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    Object.defineProperty(globalThis, 'navigator', { value: { onLine: true }, configurable: true });
    let calls = 0;
    const malas = [
      { nombre: 'Tostada de pan con pan', detalle: ['2 rebanadas de pan (≈ 60 g)', '1 rebanada de pan integral (≈ 30 g)'], calorias: 260, proteinas: 8, carbs: 50, grasas: 3, usa: [] },
      { nombre: 'Bol de quinoa y salmón', detalle: ['80 g de quinoa', '100 g de salmón', '½ aguacate (≈ 75 g)'], calorias: 700, proteinas: 35, carbs: 60, grasas: 30, usa: [] },
    ];
    const buenas = [{ nombre: 'Tostada con aguacate', detalle: ['2 rebanadas de pan (≈ 60 g)', '½ aguacate (≈ 75 g)'], calorias: 260, proteinas: 7, carbs: 31, grasas: 15, usa: [] }];
    (globalThis as { fetch: unknown }).fetch = async () => {
      calls++;
      return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ opciones: calls === 1 ? malas : buenas }) }] } }] }) };
    };
    try {
      const out = await suggestForSlot({ geminiKey: 'k', geminiModel: 'm', aiGraceSec: 0 } as never, { slot: 'merienda', kcal: 260, proteina: 0, restoKcal: 700, restoProteina: 0, restoCarbs: 120, restoGrasa: 40, kcalMin: 230, kcalMax: 300, proteinaMax: 10, proteinaCubierta: true, inventario: { nevera: ['Aguacate'], despensa: ['Pan integral', 'Huevos'], congelador: [] }, noLeGusta: [], planDia: '', evitar: [], frutaPendiente: 0, frutasDespensa: [], variante: 0 } as never, [], '');
      expect(out.map((o) => o.nombre)).toEqual(['Tostada con aguacate']);
      expect(calls).toBe(2); // la primera pasada no servía: se pidió otra con la corrección
    } finally {
      (globalThis as { fetch: unknown }).fetch = of;
      if (nav) Object.defineProperty(globalThis, 'navigator', nav);
    }
  });
});
