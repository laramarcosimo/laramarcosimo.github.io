import { norm } from './utils';

/** Vida útil orientativa (días desde hoy) por tipo de producto. Solo es una estimación. */
const RULES: [RegExp, number][] = [
  [/carne picada|picada/, 2],
  [/salmon|merluza|bacalao|pescado|gamba|calamar|marisco/, 2],
  [/pollo|pechuga|pavo|ternera|cerdo|lomo|filete|chuleta/, 3],
  [/jamon|embutido|chorizo|salchichon|lonchas|fiambre/, 7],
  [/yogur|skyr|kefir|natillas/, 14],
  [/queso fresco|requeson|mozzarella|burrata|quark/, 10],
  [/queso/, 30],
  [/leche/, 10],
  [/huevo/, 28],
  [/tofu|tempeh/, 10],
  [/pan\b|pan de|bollo|tortilla de trigo|wrap/, 4],
  [/lechuga|espinaca|rucula|canonigo|brocoli|coliflor|calabacin|pepino|champi/, 5],
  [/fresa|frambuesa|arandano|uva|cereza/, 5],
  [/tomate|pimiento|zanahoria|manzana|pera|platano|naranja|mandarina|kiwi|fruta|verdura|aguacate|melon|sandia/, 7],
  [/patata|cebolla|ajo|calabaza|boniato/, 30],
  [/frutos secos|almendra|nuez|anacardo|cacahuete|pistacho/, 180],
  [/atun|sardina|lata|conserva|maiz|garbanzo|lenteja|alubia/, 540],
  [/arroz|pasta|macarron|espagueti|harina|azucar|sal\b|quinoa|cuscus/, 365],
  [/avena|cereal|muesli|galleta/, 240],
  [/aceite|vinagre|salsa|tomate frito|mermelada/, 270],
  [/proteina|whey/, 365],
];

/** Fecha estimada (AAAA-MM-DD) de caducidad para un producto recién comprado, o undefined si no se sabe. */
export const estimateExpiry = (name: string, now = Date.now()): string | undefined => {
  const n = norm(name);
  const days = RULES.find(([re]) => re.test(n))?.[1];
  if (!days) return undefined;
  const d = new Date(now + days * 86400000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
