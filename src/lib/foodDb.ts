import { norm } from './utils';

/**
 * Tabla de composición embebida (valores medios por 100 g, fuentes tipo BEDCA / USDA) de los alimentos más habituales.
 * Sirve para calcular en la app el total de un plato en vez de fiarse de la suma de la IA.
 * Formato: palabras clave | kcal | proteína | hidratos | grasa | fibra | gramos por: unidad, loncha, cucharada, cucharadita, rebanada, puñado (0 = no aplica).
 * «M» marca carnes/pescados que están dados en CRUDO (si el texto dice plancha/cocido/asado se ajusta a cocinado).
 */
const RAW = `
huevo|143|12.6|0.7|9.5|0|50|0|0|0|0|0
clara de huevo|52|11|0.7|0.2|0|33|0|0|0|0|0
pechuga de pollo|110|23|0|1.5|0|0|0|0|0|0|0|M
pollo|120|21|0|4|0|0|0|0|0|0|0|M
pechuga de pavo|105|22|0|1.5|0|0|15|0|0|0|0|M
jamon de pavo|105|17|2|2.5|0|0|15|0|0|0|0
pavo|105|17|2|2.5|0|0|15|0|0|0|0
jamon york|105|17|1|3.5|0|0|15|0|0|0|0
jamon cocido|105|17|1|3.5|0|0|15|0|0|0|0
jamon serrano|241|31|0|13|0|0|15|0|0|0|0
salmon ahumado|180|25|0|9|0|0|25|0|0|0|0
chorizo|455|24|2|38|0|0|10|0|0|0|0
salchichon|430|25|1|36|0|0|8|0|0|0|0
fuet|450|26|2|37|0|0|8|0|0|0|0
bacon|300|20|1|24|0|0|8|0|0|0|0
mortadela|310|15|1|27|0|0|15|0|0|0|0
queso curado|390|26|1|32|0|0|20|0|0|0|0
queso light|180|28|3|7|0|0|18|0|0|0|0
queso de cabra|290|19|1|23|0|0|20|0|0|0|0
pechuga de pollo cocida|165|31|0|3.6|0|0|15|0|0|0|0
lomo embuchado|230|50|1|3|0|0|10|0|0|0|0
ternera magra|130|21|0|5|0|0|0|0|0|0|0|M
ternera|150|20|0|8|0|0|0|0|0|0|0|M
lomo de cerdo|145|21|0|6|0|0|0|0|0|0|0|M
cerdo|180|20|0|11|0|0|0|0|0|0|0|M
salmon|200|20|0|13|0|0|0|0|0|0|0|M
merluza|80|17|0|1|0|0|0|0|0|0|0|M
bacalao|82|18|0|0.7|0|0|0|0|0|0|0|M
dorada|100|19|0|2.5|0|0|0|0|0|0|0|M
lubina|97|18|0|2.5|0|0|0|0|0|0|0|M
sardina|190|21|0|11|0|0|0|0|0|0|0|M
caballa|200|19|0|14|0|0|0|0|0|0|0|M
gambas|85|18|1|1|0|0|0|0|0|0|0
atun al natural|100|23|0|1|0|52|0|0|0|0|0
atun en aceite|190|26|0|9|0|52|0|0|0|0|0
atun|100|23|0|1|0|52|0|0|0|0|0
tofu|120|13|2|7|0.5|0|0|0|0|0|0
yogur griego|120|9|4|8|0|125|0|0|0|0|0
yogur proteinas|63|11|4|0.2|0|150|0|0|0|0|0
skyr|63|11|4|0.2|0|150|0|0|0|0|0
yogur natural|60|4|5|3|0|125|0|0|0|0|0
yogur|60|4|5|3|0|125|0|0|0|0|0
queso fresco batido|46|8|4|0.2|0|0|0|0|0|0|0
queso cottage|98|11|3|4|0|0|0|0|0|0|0
queso fresco|100|12|3|4|0|0|0|0|0|0|0
mozzarella|250|18|2|19|0|0|20|0|0|0|0
queso|300|22|2|23|0|0|20|0|0|0|0
leche semidesnatada|46|3.4|4.8|1.6|0|0|0|0|0|0|0
leche|46|3.4|4.8|1.6|0|0|0|0|0|0|0
bebida de avena|40|1|7|1|0.5|0|0|0|0|0|0
bebida de soja|40|3.3|2.5|1.8|0.5|0|0|0|0|0|0
bebida vegetal|40|2|4|1.5|0.5|0|0|0|0|0|0
proteina en polvo|380|78|6|6|0|30|0|30|0|0|0
whey|380|78|6|6|0|30|0|30|0|0|0
arroz crudo|360|7|79|0.6|1.3|0|0|0|0|0|0
arroz en crudo|360|7|79|0.6|1.3|0|0|0|0|0|0
arroz|130|2.7|28|0.3|0.4|0|0|0|0|0|0
pasta cruda|360|13|72|1.5|3|0|0|0|0|0|0
pasta en cruda|360|13|72|1.5|3|0|0|0|0|0|0
pasta|150|5.5|30|1|1.8|0|0|0|0|0|0
espaguetis|150|5.5|30|1|1.8|0|0|0|0|0|0
garbanzos|140|8|20|3|5|0|0|0|0|0|0
lentejas|115|9|20|0.5|8|0|0|0|0|0|0
alubias|120|8|20|0.6|6|0|0|0|0|0|0
judias blancas|120|8|20|0.6|6|0|0|0|0|0|0
legumbres|125|8|20|1.5|6|0|0|0|0|0|0
quinoa|120|4.4|21|1.9|2.8|0|0|0|0|0|0
cuscus|112|3.8|23|0.2|1.4|0|0|0|0|0|0
patata|77|2|17|0.1|2|150|0|0|0|0|0
boniato|86|1.6|20|0.1|3|200|0|0|0|0|0
copos de avena|370|13|60|7|10|0|0|12|4|0|0
avena|370|13|60|7|10|0|0|12|4|0|0
pan integral|250|9|45|3|7|0|0|0|0|30|0
pan|265|9|50|3|3|0|0|0|0|30|0
tostada|265|9|50|3|3|0|0|0|0|30|0
wrap|300|8|50|7|3|60|0|0|0|0|0
tortilla de trigo|300|8|50|7|3|60|0|0|0|0|0
tortita de arroz|380|8|80|3|3|8|0|0|0|0|0
tortita|380|8|80|3|3|8|0|0|0|0|0
cereales|380|8|75|3|7|0|0|0|0|0|0
platano|90|1|20|0.3|2.6|120|0|0|0|0|0
manzana|52|0.3|14|0.2|2.4|180|0|0|0|0|0
pera|57|0.4|15|0.1|3|170|0|0|0|0|0
naranja|47|0.9|12|0.1|2.4|200|0|0|0|0|0
mandarina|45|0.8|11|0.2|1.7|80|0|0|0|0|0
kiwi|61|1.1|15|0.5|3|75|0|0|0|0|0
fresas|33|0.7|8|0.3|2|15|0|0|0|0|0
uvas|69|0.7|18|0.2|0.9|5|0|0|0|0|0
melon|34|0.8|8|0.2|0.9|0|0|0|0|0|0
sandia|30|0.6|8|0.2|0.4|0|0|0|0|0|0
pina|50|0.5|13|0.1|1.4|0|0|0|0|0|0
arandanos|57|0.7|14|0.3|2.4|1.5|0|0|0|0|0
frambuesas|52|1.2|12|0.7|6.5|4|0|0|0|0|0
mango|60|0.8|15|0.4|1.6|0|0|0|0|0|0
melocoton|39|0.9|10|0.3|1.5|150|0|0|0|0|0
cerezas|63|1.1|16|0.2|2.1|8|0|0|0|0|0
datil|280|2.5|75|0.4|8|8|0|0|0|0|0
aguacate|160|2|9|15|6.7|150|0|0|0|0|0
tomate frito|80|1.5|12|3|1.5|0|0|15|0|0|0
tomate|18|0.9|3.9|0.2|1.2|120|0|0|0|0|0
lechuga|15|1.4|2.9|0.2|1.3|0|0|0|0|0|30
rucula|25|2.6|3.7|0.7|1.6|0|0|0|0|0|30
canonigos|21|2|3.6|0.4|1.5|0|0|0|0|0|30
espinacas|23|2.9|3.6|0.4|2.2|0|0|0|0|0|30
brocoli|34|2.8|7|0.4|2.6|0|0|0|0|0|0
zanahoria|41|0.9|10|0.2|2.8|80|0|0|0|0|0
pepino|15|0.7|3.6|0.1|0.5|200|0|0|0|0|0
pimiento|31|1|6|0.3|2|150|0|0|0|0|0
calabacin|17|1.2|3.1|0.3|1|200|0|0|0|0|0
cebolla|40|1.1|9|0.1|1.7|100|0|0|0|0|0
champinones|22|3|3.3|0.3|1|0|0|0|0|0|0
berenjena|25|1|6|0.2|3|0|0|0|0|0|0
judias verdes|31|1.8|7|0.2|2.7|0|0|0|0|0|0
coliflor|25|1.9|5|0.3|2|0|0|0|0|0|0
esparragos|20|2.2|3.9|0.1|2.1|0|0|0|0|0|0
ensalada|20|1.5|3|0.2|1.5|0|0|0|0|0|0
verdura|30|2|5|0.3|2.5|0|0|0|0|0|0
aceite de oliva|884|0|0|100|0|0|0|13|4.5|0|0
aceite|884|0|0|100|0|0|0|13|4.5|0|0
mantequilla|740|0.6|0.1|82|0|0|0|0|5|0|0
almendras|600|21|6|52|12|1.2|0|0|0|0|25
nueces|650|15|7|65|7|4|0|0|0|0|25
cacahuetes|590|26|16|50|8|1|0|0|0|0|25
pistachos|560|20|17|45|10|0.7|0|0|0|0|25
frutos secos|610|20|10|52|9|1.5|0|0|0|0|25
crema de cacahuete|600|25|12|50|6|0|0|16|5|0|0
semillas de chia|490|17|8|31|34|0|0|12|4|0|0
chocolate negro|550|8|35|40|11|5|0|0|0|0|0
chocolate|550|8|35|40|11|5|0|0|0|0|0
ketchup|100|1.2|25|0.1|0.3|0|0|17|6|0|0
mayonesa|700|1|2|75|0|0|0|15|5|0|0
mostaza|66|4|6|4|3|0|0|15|5|0|0
aceitunas|145|1|4|15|3|4|0|0|0|0|0
miel|304|0.3|82|0|0|0|0|21|7|0|0
mermelada|250|0.4|62|0.1|1|0|0|20|7|0|0
hummus|230|8|14|16|6|0|0|15|5|0|0
salsa de soja|60|8|5|0|0.8|0|0|15|5|0|0
cacao|230|20|12|11|33|0|0|8|3|0|0
albondigas|200|13|7|13|0.5|35|0|0|0|0|0
salchichas frankfurt|250|11|3|22|0|50|0|0|0|0|0
salchicha|270|13|2|23|0|60|0|0|0|0|0
hamburguesa de ternera|250|17|1|20|0|100|0|0|0|0|0
hamburguesa de pollo|200|16|8|11|0|90|0|0|0|0|0
carne picada|200|19|0|14|0|0|0|0|0|0|0|M
pavo picado|110|20|0|3|0|0|0|0|0|0|0|M
solomillo de cerdo|120|21|0|4|0|0|0|0|0|0|0|M
conejo|130|21|0|5|0|0|0|0|0|0|0|M
cordero|230|18|0|17|0|0|0|0|0|0|0|M
costillas|290|17|0|24|0|0|0|0|0|0|0|M
sobrasada|480|13|2|46|0|0|0|10|0|0|0
morcilla|400|14|3|37|0|0|0|0|0|0|0
pate|250|10|2|22|0|0|0|0|0|0|0
cecina|200|35|0|6|0|0|15|0|0|0|0
mejillones|80|12|4|2|0|0|0|0|0|0|0
calamares|80|15|1|1.5|0|0|0|0|0|0|0|M
pulpo|80|15|2|1|0|0|0|0|0|0|0
surimi|95|9|10|1|0|0|0|0|0|0|0
langostinos|90|19|0|1|0|0|0|0|0|0|0
trucha|120|19|0|4|0|0|0|0|0|0|0|M
rape|75|15|0|1.5|0|0|0|0|0|0|0|M
lenguado|85|17|0|1.5|0|0|0|0|0|0|0|M
atun fresco|130|24|0|3|0|0|0|0|0|0|0|M
anchoas|210|29|0|10|0|4|0|0|0|0|0
pan de molde|250|8|47|3|3|0|0|0|0|25|0
croissant|400|8|45|21|2|60|0|0|0|0|0
magdalena|440|6|56|21|1|40|0|0|0|0|0
galletas maria|440|7|74|13|2|6|0|0|0|0|0
galletas|450|6|68|17|2|8|0|0|0|0|0
granola|450|9|65|17|6|0|0|0|8|0|0
muesli|360|10|66|6|8|0|0|0|8|0|0
arroz cocido|130|2.7|28|0.3|0.4|0|0|0|0|0|0
arroz basmati|125|3|27|0.4|0.5|0|0|0|0|0|0
arroz basmati crudo|350|8|77|0.8|1|0|0|0|0|0|0
pasta cocida|150|5|30|1|2|0|0|0|0|0|0
pasta integral|125|5.5|26|1|4.5|0|0|0|0|0|0
pasta integral crudo|340|13|66|2.5|7|0|0|0|0|0|0
pasta crudo|360|13|72|1.5|3|0|0|0|0|0|0
espaguetis crudo|360|13|72|1.5|3|0|0|0|0|0|0
macarrones|150|5.5|30|1|1.8|0|0|0|0|0|0
macarrones crudo|360|13|72|1.5|3|0|0|0|0|0|0
tallarines|150|5.5|30|1|1.8|0|0|0|0|0|0
tallarines crudo|360|13|72|1.5|3|0|0|0|0|0|0
fideos|150|5.5|30|1|1.8|0|0|0|0|0|0
fideos crudo|360|13|72|1.5|3|0|0|0|0|0|0
garbanzos crudo|370|20|60|6|16|0|0|0|0|0|0
lentejas crudo|350|24|60|1.1|11|0|0|0|0|0|0
quinoa crudo|368|14|64|6|7|0|0|0|0|0|0
cuscus crudo|365|13|73|0.6|5|0|0|0|0|0|0
noquis|150|3.5|33|0.5|1.5|0|0|0|0|0|0
maiz|86|3.3|19|1.2|2.7|0|0|0|0|0|0
guisantes|80|5|14|0.4|5|0|0|0|0|0|0
edamame|120|11|9|5|5|0|0|0|0|0|0
alubias pintas|120|8|20|0.6|6|0|0|0|0|0|0
alubias pintas crudo|340|21|60|1.5|15|0|0|0|0|0|0
garbanzos cocidos|140|9|20|3|6|0|0|0|0|0|0
lentejas cocidas|115|9|20|0.4|8|0|0|0|0|0|0
setas|25|3|3|0.3|2|0|0|0|0|0|0
alcachofa|50|3|10|0.2|5|100|0|0|0|0|0
puerro|30|2|6|0.3|2|0|0|0|0|0|0
apio|15|1|2|0.2|1.6|0|0|0|0|0|0
remolacha|45|1.7|10|0.1|2.8|0|0|0|0|0|0
calabaza|26|1|6|0.1|0.5|0|0|0|0|0|0
repollo|25|1.3|5|0.1|2.5|0|0|0|0|0|0
ajo|150|6|33|0.5|2|4|0|0|0|0|0
zumo de naranja|45|0.7|10|0.2|0.2|0|0|0|0|0|0
refresco|42|0|10.6|0|0|0|0|0|0|0|0
cerveza|43|0.5|3.6|0|0|0|0|0|0|0|0
vino tinto|85|0.1|2.6|0|0|0|0|0|0|0|0
nata para cocinar|190|2.5|4|18|0|0|0|15|0|0|0
nata|345|2|3|36|0|0|0|15|0|0|0
queso crema|340|6|4|34|0|0|0|15|0|0|0
queso rallado|350|25|2|27|0|0|0|8|0|0|0
parmesano|400|35|0|28|0|0|0|8|0|0|0
feta|265|14|4|21|0|0|20|0|0|0|0
tahini|600|17|21|54|9|0|0|15|0|0|0
aceite de coco|900|0|0|100|0|0|0|13|0|0|0
coco rallado|650|6|7|65|9|0|0|8|0|0|0
semillas de calabaza|560|30|5|47|6|0|0|0|0|0|30
pipas de girasol|580|21|20|51|9|0|0|0|0|0|30
anacardos|600|18|30|48|3|0|0|0|0|0|30
avellanas|630|15|7|61|10|0|0|0|0|0|30
castañas|200|2|42|2|5|0|0|0|0|0|0
pasas|300|3|79|0.5|4|0|0|0|0|0|30
albaricoque|48|1.4|9|0.4|2|40|0|0|0|0|0
granada|83|1.7|19|1.2|4|0|0|0|0|0|0
limon|29|1|9|0.3|2.8|100|0|0|0|0|0
gazpacho|45|1|4|3|1|0|0|0|0|0|0
salmorejo|100|2|7|7|1|0|0|0|0|0|0
crema de verduras|40|1|6|1|1.5|0|0|0|0|0|0
tortilla de patatas|150|5.5|12|9|1|0|0|0|0|0|0
pizza|270|11|33|10|2|0|0|0|0|0|0
croquetas|200|6|20|11|1|30|0|0|0|0|0
lasaña|150|8|13|7|1|0|0|0|0|0|0
paella|150|6|20|5|1|0|0|0|0|0|0
pesto|460|5|4|47|2|0|0|15|0|0|0
salsa barbacoa|120|1|28|0.5|0|0|0|15|0|0|0
azucar|400|0|100|0|0|0|0|12|4|0|0
barrita de proteinas|350|30|35|10|5|60|0|0|0|0|0
helado|207|3.5|24|11|0.5|0|0|0|0|0|0
flan|130|3|20|4|0|100|0|0|0|0|0
natillas|110|3|17|3.5|0|125|0|0|0|0|0
queso en porciones|250|10|6|20|0|18|0|0|0|0|0
`;

export interface FoodRow {
  keys: string[];
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  /** Gramos por unidad, loncha, cucharada, cucharadita, rebanada y puñado (0 = no aplica). */
  u: number;
  l: number;
  cs: number;
  ct: number;
  r: number;
  pu: number;
  /** Carne/pescado dado en crudo. */
  meat: boolean;
}

export const FOODS: FoodRow[] = RAW.trim()
  .split('\n')
  .map((line) => {
    const p = line.split('|');
    const n = (i: number) => Number(p[i]) || 0;
    return { keys: [norm(p[0])], kcal: n(1), protein: n(2), carbs: n(3), fat: n(4), fiber: n(5), u: n(6), l: n(7), cs: n(8), ct: n(9), r: n(10), pu: n(11), meat: p[12] === 'M' };
  });

/** Productos propios (escaneados o de tu foto de la tabla): se suman a la tabla y, a igual nombre, mandan ellos. */
let EXTRA: FoodRow[] = [];
export const setExtraFoods = (products: { name: string; kcal: number; protein: number; carbs: number; fat: number; fiber: number; serving?: number; pack?: number; source?: string }[]): void => {
  EXTRA = products
    .filter((p) => p.source !== 'auto' && p.name.trim() && p.kcal >= 0)
    .map((p) => ({ keys: [norm(p.name.replace(/\(.*?\)/g, ' ')).replace(/\s+/g, ' ').trim()], kcal: p.kcal, protein: p.protein, carbs: p.carbs, fat: p.fat, fiber: p.fiber, u: p.pack || p.serving || 0, l: 0, cs: 0, ct: 0, r: 0, pu: 0, meat: false }))
    .filter((f) => f.keys[0].length >= 3);
};

/** Busca el alimento de la tabla más específico (palabra clave más larga) dentro de un texto. */
export const lookupFood = (text: string): FoodRow | null => {
  const t = ` ${norm(text).replace(/\b(\w+?)(es|s)\b/g, (m, a) => (a.length >= 3 ? a : m))} `;
  const tt = ` ${norm(text)} `;
  let best: FoodRow | null = null;
  let bestLen = 0;
  for (const f of [...EXTRA, ...FOODS]) {
    const k = f.keys[0];
    const ks = k.replace(/\b(\w+?)(es|s)\b/g, (m, a) => (a.length >= 3 ? a : m));
    if ((tt.includes(` ${k} `) || tt.includes(` ${k}s `) || tt.includes(` ${k}es `) || t.includes(` ${ks} `)) && k.length > bestLen) {
      best = f;
      bestLen = k.length;
    }
  }
  return best;
};

const RAW_WORD = /\b(crudo|cruda|crudos|crudas|seco|seca|secos|secas)\b/;

/** Versión «en crudo / seco» de un alimento cuando la tabla la tiene (arroz, pasta, legumbres, quinoa, cuscús). */
const rawVariant = (food: FoodRow): FoodRow | undefined => {
  const k = `${food.keys[0]} crudo`;
  return [...EXTRA, ...FOODS].find((f) => f.keys[0] === k);
};

/** true si el alimento cambia mucho entre crudo y cocinado y la tabla sabe las dos cosas: carne y pescado, arroz, pasta, legumbres… */
export const hasRawVariant = (text: string): boolean => {
  const f = lookupFood(text);
  return !!f && (f.meat || !!rawVariant(f));
};

export interface Resolved {
  grams: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

const NUMWORDS: Record<string, number> = { un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, medio: 0.5, media: 0.5, '½': 0.5 };
const COOKED = /plancha|cocid|asad|hervid|horno|frit|guisad|a la brasa|cocinad/;

/** Calcula una línea de ingrediente con su cantidad («3 lonchas de pavo», «2 huevos», «150 g de arroz»). null si no se puede saber con fiabilidad. */
export const resolveLine = (line: string): Resolved | null => {
  const raw = line.toLowerCase().replace(/\(.*?\)/g, (m) => (/\d+\s*(?:g|gr|ml)\b/.test(m) ? m : ' ')).trim();
  const paren = raw.match(/\(\s*(?:≈|~|aprox\.?|unos|c\.)?\s*(\d+(?:[.,]\d+)?)\s*(?:g|gr|ml)\b/);
  const m = raw.replace(/\(.*?\)/g, ' ').match(/^\s*(\d+(?:[.,]\d+)?(?:\s*\/\s*\d+)?|½|un|una|uno|dos|tres|cuatro|cinco|medio|media)(?![a-záéíóúñ])\s*(.*)$/i);
  if (!m) return null;
  const t = norm(m[2]);
  let qty: number;
  const q = m[1].trim().toLowerCase();
  if (NUMWORDS[q] !== undefined) qty = NUMWORDS[q];
  else if (q.includes('/')) {
    const [x, y] = q.split('/').map((v) => Number(v.trim()));
    qty = y ? x / y : NaN;
  } else qty = Number(q.replace(',', '.'));
  if (!Number.isFinite(qty) || qty <= 0) return null;
  let rest = t;
  const base = lookupFood(rest);
  if (!base) return null;
  const food = RAW_WORD.test(t) ? (rawVariant(base) ?? base) : base; // «150 g de arroz crudo» usa los valores del arroz seco
  const unit = rest.match(/^(g|gr|gramos?|ml|cucharadas?|cucharaditas?|lonchas?|lonchitas?|rebanadas?|rebanadita|puñados?|punados?|tazas?|cucharones?|unidades?|piezas?|latas?|yogures?)\b/)?.[1] ?? '';
  rest = rest.replace(/^(g|gr|gramos?|ml|cucharadas?|cucharaditas?|lonchas?|lonchitas?|rebanadas?|puñados?|punados?|tazas?|cucharones?|unidades?|piezas?)\b\s*(soperas?|de postre|colmadas?|rasas?)?\s*(de\s+)?/, '');
  let grams: number | null = null;
  if (/^(g|gr|gramos?)$/.test(unit) || unit === 'ml') grams = qty;
  else if (/^cucharada/.test(unit)) grams = food.cs ? qty * food.cs : null;
  else if (/^cucharadita/.test(unit)) grams = food.ct ? qty * food.ct : null;
  else if (/^loncha|^lonchita/.test(unit)) grams = food.l ? qty * food.l : null;
  else if (/^rebanada/.test(unit)) grams = food.r ? qty * food.r : null;
  else if (/^pu[ñn]ado/.test(unit)) grams = food.pu ? qty * food.pu : null;
  else if (/^taza/.test(unit)) grams = food.kcal < 70 && food.carbs < 10 && food.fat < 4 ? qty * 200 : null; // solo líquidos
  else if (/^cucharon/.test(unit)) grams = food.protein < 12 && food.kcal < 160 && food.fat < 4 ? qty * 100 : null;
  else if (/^yogur/.test(unit) || /^lata/.test(unit) || /^unidad|^pieza/.test(unit) || unit === '') grams = paren ? Number(paren[1].replace(',', '.')) * (unit === '' || /^unidad|^pieza/.test(unit) ? qty : 1) : food.u ? qty * food.u : null;
  // El peso entre paréntesis («≈ 100 g») es el TOTAL de la línea y manda sobre cualquier medida doméstica.
  if (paren) grams = Number(paren[1].replace(',', '.'));
  if (grams === null || grams <= 0) return null;
  const k = food.meat && COOKED.test(t) ? 1.3 : 1; // cocinado: pierde agua, más concentrado por 100 g
  const f = (v: number) => (v * k * grams!) / 100;
  return { grams, kcal: Math.round(f(food.kcal)), protein: Math.round(f(food.protein) * 10) / 10, carbs: Math.round(f(food.carbs) * 10) / 10, fat: Math.round(f(food.fat) * 10) / 10, fiber: Math.round(f(food.fiber) * 10) / 10 };
};

/** Suma de todas las líneas de un plato; null si alguna no se pudo calcular con la tabla (entonces se conserva la cuenta de la IA). */
export const sumLines = (lines: string[]): { kcal: number; protein: number; carbs: number; fat: number; fiber: number } | null => {
  if (lines.length === 0) return null;
  const tot = { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
  for (const l of lines) {
    const r = resolveLine(l);
    if (!r) return null;
    tot.kcal += r.kcal;
    tot.protein += r.protein;
    tot.carbs += r.carbs;
    tot.fat += r.fat;
    tot.fiber += r.fiber;
  }
  return { kcal: Math.round(tot.kcal), protein: Math.round(tot.protein), carbs: Math.round(tot.carbs), fat: Math.round(tot.fat), fiber: Math.round(tot.fiber) };
};
