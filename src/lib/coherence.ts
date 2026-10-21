import { foodNameOf } from './dislikes';
import { norm } from './utils';

/** Familias de alimentos que no tiene sentido repetir en un mismo plato («pan con pan», «yogur con skyr»). */
const FAMILIES: [string, RegExp][] = [
  ['pan', /^(pan|tostada|rebanada|bagel|baguette|barra de pan|pan de molde|pan integral)\b/],
  ['yogur', /^(yogur|yogurt|skyr|kefir)\b/],
  ['leche', /^(leche|bebida (de )?(avena|soja|almendra|arroz))\b/],
  ['arroz', /^(arroz)\b/],
  ['pasta', /^(pasta|espagueti|macarron|tallarin|fideo|noqui)\w*/],
  ['aceite', /^(aceite)\b/],
  ['avena', /^(avena|copos de avena)\b/],
  ['huevo', /^(huevo|clara)\w*/],
  ['patata', /^(patata|boniato)\b/],
  ['cereales', /^(cereales|muesli|granola)\b/],
];

const BREAD = /^(pan|tostada|rebanada|bagel|baguette|wrap|tortita|tortitas)\b/;
const VEG = /^(pepino|lechuga|zanahoria|pimiento|calabacin|espinaca|rucula|canonigo|cebolla|brocoli|coliflor|berenjena|champinon|seta|esparrago|judia verde|apio|rabano|ensalada|verdura|acelga|col|repollo|puerro|calabaza)/;
/** Cosas que sí hacen «tostada» de verdad (proteína, grasa, untable o dulce clásico). */
const TOPPING = /(queso|jamon|pavo|pollo|atun|salmon|sardina|caballa|anchoa|huevo|tortilla|aguacate|tomate|hummus|crema de cacahuete|mantequilla|mermelada|miel|platano|fresa|chocolate|requeson|lomo|chorizo|sobrasada|paté|pate|aceite|fiambre|ternera|bacalao)/;
const FRUITY = /(manzana|pera|platano|naranja|mandarina|kiwi|fresa|uva|melon|sandia|pina|mango|melocoton|cereza|arandano|frambuesa|ciruela|higo|papaya|granada)/;
const SAVORY = /(huevo|atun|salmon|sardina|caballa|pollo|pavo|ternera|cerdo|jamon|chorizo|embutido|bacon|merluza|bacalao|gambas|tortilla)/;
const SWEET_OK_WITH_FRUIT = /(jamon)/; // jamón con melón es un clásico
const GRAIN = /^(arroz|pasta|espagueti|macarron|fideo|noqui|quinoa|cuscus)/;
const DAIRY = /^(yogur|skyr|kefir|leche|bebida)/;

/** Alimentos que se pueden usar sin tenerlos apuntados en la despensa. */
const BASICS = ['sal', 'pimienta', 'agua', 'especias', 'oregano', 'canela', 'vinagre', 'limon', 'ajo en polvo', 'pimenton', 'cafe', 'te'];

/**
 * Combinaciones que no son un plato con sentido: pan solo con verdura cruda («pan con pepino»), fruta con carne, huevo o pescado,
 * arroz o pasta con fruta, o lácteos con carne o pescado.
 */
export const senseless = (nombre: string, lines: string[]): string | null => {
  const names = (lines.length ? lines.map((l) => norm(foodNameOf(l))) : [norm(nombre)]).filter(Boolean);
  const has = (re: RegExp): boolean => names.some((n) => re.test(n));
  const bread = names.some((n) => BREAD.test(n)) || (lines.length === 0 && /\b(pan|tostada|bocadillo)\b/.test(norm(nombre)));
  const veg = has(VEG) || (lines.length === 0 && /\b(pepino|lechuga|zanahoria|pimiento|calabacin)\b/.test(norm(nombre)));
  const topping = names.some((n) => TOPPING.test(n)) || (lines.length === 0 && TOPPING.test(norm(nombre)));
  if (bread && veg && !topping) return 'pan solo con verdura cruda no es un plato (añade queso, pavo, huevo, aguacate, tomate con aceite…)';
  const fruit = names.some((n) => FRUITY.test(n) && !/(aguacate|tomate|aceituna)/.test(n));
  const savory = names.find((n) => SAVORY.test(n) && !SWEET_OK_WITH_FRUIT.test(n));
  if (fruit && savory) return `fruta con «${savory}» no combina (pon la fruta aparte, de postre)`;
  if (names.some((n) => GRAIN.test(n)) && fruit) return 'arroz o pasta con fruta no combina';
  if (names.some((n) => DAIRY.test(n)) && names.some((n) => /(atun|salmon|sardina|caballa|pollo|pavo|ternera|cerdo|chorizo|bacon|merluza|bacalao|gambas)/.test(n))) return 'lácteo con carne o pescado no combina';
  return null;
};

/** Familia de una línea («2 rebanadas de pan integral (≈ 60 g)» → «pan») o el propio nombre si no pertenece a ninguna. */
export const familyOf = (line: string): string => {
  const n = norm(foodNameOf(line));
  return FAMILIES.find(([, re]) => re.test(n))?.[0] ?? n;
};

/**
 * ¿El plato tiene sentido? Devuelve el motivo si no: repite un ingrediente o una familia (dos panes, dos yogures…) o el nombre
 * dice lo mismo dos veces («pan con pan»). null si está bien.
 */
export const incoherence = (nombre: string, lines: string[]): string | null => {
  const fam = lines.map(familyOf).filter(Boolean);
  const dup = fam.find((f, i) => fam.indexOf(f) !== i);
  if (dup) return `repite «${dup}» en dos ingredientes`;
  const words = norm(nombre).split(/[^a-zñ]+/).filter((w) => w.length >= 3);
  const twice = ['pan', 'yogur', 'leche', 'arroz', 'pasta', 'aceite', 'huevo', 'queso', 'atun', 'pollo', 'pavo', 'jamon'].find((k) => words.filter((w) => w === k || w === `${k}s`).length >= 2);
  if (twice) return `el nombre repite «${twice}»`;
  const m = norm(nombre).match(/\b([a-zñ]{3,})\s+(?:con|y|de|sobre|en)\s+\1\b/);
  if (m) return `el nombre repite «${m[1]}»`;
  return senseless(nombre, lines);
};

const known = (name: string, pantry: string[]): boolean => {
  const n = norm(foodNameOf(name));
  if (!n) return true;
  if (BASICS.some((b) => n === b || n.startsWith(`${b} `))) return true;
  return pantry.some((p) => {
    const q = norm(p);
    return q.length >= 3 && (n.includes(q) || q.includes(n) || n.split(' ').some((w) => w.length >= 4 && q.includes(w.replace(/s$/, ''))));
  });
};

/** Qué ingredientes del plato NO están en tu despensa (ni son básicos): lo que habría que comprar. */
export const missingFromPantry = (lines: string[], pantry: string[]): string[] => (pantry.length === 0 ? [] : lines.filter((l) => !known(l, pantry)).map((l) => foodNameOf(l)));

/** Parte de los ingredientes del plato que ya tienes (0-1). Sin despensa apuntada no se exige nada (1). */
export const pantryCoverage = (lines: string[], pantry: string[]): number => (pantry.length === 0 || lines.length === 0 ? 1 : (lines.length - missingFromPantry(lines, pantry).length) / lines.length);
