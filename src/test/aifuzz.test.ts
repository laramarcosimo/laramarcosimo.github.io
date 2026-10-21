import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as G from '../lib/gemini';
import type { Settings } from '../lib/types';

const settings = { geminiKey: 'k', geminiModel: 'modelo-x', aiGraceSec: 0 } as unknown as Settings;
const PAYLOADS = ['{}', '[]', 'null', '{"x":1}', '"texto"', '123', '{"items":null,"opciones":null,"ingredientes":null}', '[null,1,"a",{}]', '{"opciones":[{}],"alimentos":[{}],"items":[{}],"dias":[{}]}'];
const inv = { nevera: ['a'], despensa: ['b'], congelador: [] as string[] };

const calls: [string, () => Promise<unknown>][] = [
  ['analyzeMeal', () => G.analyzeMeal(settings, 'x', [], [], '', '')],
  ['scanPantry', () => G.scanPantry(settings, 'x', [], '')],
  ['generateRecipes', () => G.generateRecipes(settings, ['a'], [], [], 500, 30)],
  ['readWorkoutScreenshot', () => G.readWorkoutScreenshot(settings, 'x')],
  ['readTreadmill', () => G.readTreadmill(settings, 'x')],
  ['adaptRoutineWithAI', () => G.adaptRoutineWithAI(settings, [{ nombre: 'a', series: 3, reps: 10 }], [])],
  ['askCoach', () => G.askCoach(settings, 'hola', null, '', [], '', false, [])],
  ['suggestExtras', () => G.suggestExtras(settings, { sesion: [], minutosRestantes: 10, ultimos14dias: {}, kneeSafe: false, home: false }, [{ id: 'a', name: 'A', muscle: 'Pecho', equipment: 'Barra' }])],
  ['perfectRoutine', () => G.perfectRoutine(settings, [{ i: 0, nombre: 'a', musculo: 'Pecho', equipo: 'Barra', series: 3, reps: '10', descanso: 60 }], { home: false, kneeSafe: false, titulo: 't', limiteMin: null, minActuales: 40, catalogo: [], datos: '' })],
  ['askLiveCoach', () => G.askLiveCoach(settings, 'hola', 'ctx', [])],
  ['estimateItems', () => G.estimateItems(settings, [{ nombre: 'arroz', cantidad: 100, unidad: 'g' } as never], [], '', null)],
  ['suggestForSlot', () => G.suggestForSlot(settings, { slot: 'comida', kcal: 500, proteina: 30, restoKcal: 800, restoProteina: 60, restoCarbs: 100, restoGrasa: 30, inventario: inv, noLeGusta: [], planDia: '', evitar: [], frutaPendiente: 0, frutasDespensa: [], variante: 0 } as never, [], '')],
  ['suggestRemaining', () => G.suggestRemaining(settings, { yaPrevisto: [], limiteKcal: 800, objetivoKcal: 1700, proteinaRestante: 40, carbsRestantes: 100, grasaRestante: 20, tomas: [], despensa: inv, noLeGusta: [], planDia: '', evitar: [], frutaPendiente: 0, frutasDespensa: [], variante: 0 } as never, [], '')],
  ['swapIngredient', () => G.swapIngredient(settings, { slot: 'comida', nombre: 'x', detalle: ['100 g arroz'], indice: 0, reemplazo: 'pasta', kcal: 500, proteina: 30, restoKcal: 800, noLeGusta: [] }, [], '')],
  ['estimateDish', () => G.estimateDish(settings, 'lentejas', 2, null, [], '')],
  ['extractShoppingList', () => G.extractShoppingList(settings, ['x'])],
  ['readBarcode', () => G.readBarcode(settings, 'x')],
  ['generateWeekMenu', () => G.generateWeekMenu(settings, ['a'], [], 500, 30, [], [])],
  ['readLabel', () => G.readLabel(settings, 'x')],
  ['readNutritionLabel', () => G.readNutritionLabel(settings, 'x')],
  ['rateProduct', () => G.rateProduct(settings, { nombre: 'a', marca: 'b', kcal: 1, protein: 1, carbs: 1, sugars: 1, fat: 1, satFat: 1, fiber: 1, salt: 1 }, [], '')],
  ['readExpiry', () => G.readExpiry(settings, 'x')],
  ['suggestAlternatives', () => G.suggestAlternatives(settings, { nombre: 'a', musculo: 'Pecho', equipo: 'Barra' }, [{ id: 'b', name: 'B', equipment: 'Barra' }], { home: false, gear: [], kneeSafe: false, reason: '' })],
  ['auditRoutineAI', () => G.auditRoutineAI(settings, [{ i: 0, nombre: 'a', musculo: 'Pecho', equipo: 'Barra', series: 3 }], { home: false, gear: [], kneeSafe: false, local: [] })],
  ['analyzeForm', () => G.analyzeForm(settings, ['x'], { nombre: 'a', musculo: 'Pecho', equipo: 'Barra' }, { home: false, kneeSafe: false })],
  ['weeklyCoach', () => G.weeklyCoach(settings, 'datos')],
  ['suggestShoppingIdeas', () => G.suggestShoppingIdeas(settings, { despensa: [], lista: [], ultimasComidas: [], noLeGusta: [], descartadas: [], semana: '' }, [], '')],
  ['organizeSupplements', () => G.organizeSupplements(settings, { items: [{ nombre: 'a', dosis: '1' }], horaEntreno: null, diasEntreno: '' })],
  ['askChef', () => G.askChef(settings, 'hola', { contexto: 'c', plato: [{ nombre: 'a', cantidad: 1, unidad: 'unidades' }] }, [])],
  ['analyzeMenu', () => G.analyzeMenu(settings, 'x', '')],
];

describe('la IA devuelve JSON raro: nunca debe romper con un TypeError', () => {
  let payload = '{}';
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('navigator', { onLine: true });
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: payload }] } }] }) })));
  });
  afterEach(() => vi.unstubAllGlobals());
  for (const [name, fn] of calls) {
    it(name, async () => {
      const bad: string[] = [];
      // Las que reintentan solos esperan 1,2 s por intento: con un único caso raro basta.
      for (const p of name === 'suggestForSlot' || name === 'suggestRemaining' ? ['{"opciones":[{"nombre":1,"detalle":null,"calorias":"x","pasos":5}]}'] : PAYLOADS) {
        payload = p;
        localStorage.clear();
        try {
          await fn();
        } catch (e) {
          if (e instanceof TypeError || e instanceof ReferenceError || (e instanceof Error && /Cannot read|undefined|not iterable|is not a function|is not an object/.test(e.message))) bad.push(`${p} -> ${(e as Error).message}`);
        }
      }
      expect(bad).toEqual([]);
    }, 90_000);
  }
});
