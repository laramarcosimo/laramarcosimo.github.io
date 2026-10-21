import type { PantryItem } from './types';
import { norm } from './utils';

export interface FoodPortion {
  re: RegExp;
  portion: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

/** Valores orientativos por ración habitual, para sugerir cómo completar la proteína del día con tu despensa. */
export const FOODS: FoodPortion[] = [
  { re: /huevo/, portion: '2 huevos duros', kcal: 155, protein: 13, carbs: 1, fat: 11 },
  { re: /yogur.*griego|griego/, portion: '1 yogur griego (125 g)', kcal: 120, protein: 10, carbs: 5, fat: 7 },
  { re: /queso fresco|batido|requeson|skyr|quark/, portion: '1 tarrina de queso fresco batido 0 % (125 g)', kcal: 55, protein: 9, carbs: 4, fat: 0 },
  { re: /atun/, portion: '1 lata de atún al natural', kcal: 90, protein: 20, carbs: 0, fat: 1 },
  { re: /pechuga|pollo/, portion: '100 g de pechuga de pollo', kcal: 165, protein: 31, carbs: 0, fat: 4 },
  { re: /pavo/, portion: '4 lonchas de pavo', kcal: 80, protein: 14, carbs: 2, fat: 2 },
  { re: /jamon cocido|jamon york/, portion: '4 lonchas de jamón cocido', kcal: 90, protein: 14, carbs: 2, fat: 3 },
  { re: /salmon/, portion: '100 g de salmón', kcal: 200, protein: 22, carbs: 0, fat: 12 },
  { re: /merluza|bacalao|pescado blanco/, portion: '120 g de pescado blanco', kcal: 100, protein: 22, carbs: 0, fat: 1 },
  { re: /tofu/, portion: '100 g de tofu', kcal: 120, protein: 13, carbs: 2, fat: 7 },
  { re: /garbanzo|lenteja|alubia/, portion: '1 ración de legumbres cocidas (150 g)', kcal: 200, protein: 13, carbs: 30, fat: 3 },
  { re: /leche/, portion: '1 vaso de leche (200 ml)', kcal: 95, protein: 6.5, carbs: 10, fat: 3.5 },
  { re: /proteina|whey/, portion: '1 cacito de proteína en polvo', kcal: 120, protein: 24, carbs: 3, fat: 2 },
  { re: /almendra|nuez|frutos secos/, portion: '25 g de frutos secos', kcal: 150, protein: 5, carbs: 4, fat: 13 },
  { re: /avena/, portion: '40 g de avena', kcal: 150, protein: 5, carbs: 26, fat: 3 },
];

export interface FoodMatch extends FoodPortion {
  item: PantryItem;
}

/** Alimentos de tu despensa de los que se conoce una ración (con unidades disponibles). */
export const pantryFoods = (pantry: PantryItem[]): FoodMatch[] => {
  const out: FoodMatch[] = [];
  for (const p of pantry) {
    if (p.qty <= 0) continue;
    const f = FOODS.find((x) => x.re.test(norm(p.name)));
    if (f) out.push({ ...f, item: p });
  }
  return out;
};

/** Propone las 2 mejores opciones de la despensa para cubrir la proteína que falta sin pasarse de calorías. */
export const completeProtein = (pantry: PantryItem[], protein: number, kcal: number): FoodMatch[] => {
  if (protein < 8) return [];
  return pantryFoods(pantry)
    .filter((f) => f.protein >= 5 && f.kcal <= Math.max(kcal, 0) + 30)
    .sort((a, b) => Math.abs(a.protein - protein) - Math.abs(b.protein - protein) || a.kcal - b.kcal)
    .slice(0, 2);
};
