import { categoryOf } from './categories';
import { FOODS } from './foodDb';
import type { SavedProduct } from './types';
import { norm } from './utils';

/** Medidas caseras que el catálogo sabe convertir a gramos. */
export type UnitKey = 'unidad' | 'loncha' | 'rebanada' | 'cucharada' | 'cucharadita' | 'puñado' | 'ración';
export type UnitMap = Partial<Record<UnitKey, number>>;
export type FoodUnits = Record<string, UnitMap>;

export const UNIT_LABEL: Record<UnitKey, { one: string; many: string }> = {
  unidad: { one: 'unidad', many: 'unidades' },
  loncha: { one: 'loncha', many: 'lonchas' },
  rebanada: { one: 'rebanada', many: 'rebanadas' },
  cucharada: { one: 'cucharada sopera llena', many: 'cucharadas soperas llenas' },
  cucharadita: { one: 'cucharadita', many: 'cucharaditas' },
  puñado: { one: 'puñado', many: 'puñados' },
  ración: { one: 'ración', many: 'raciones' },
};
export const UNIT_KEYS = Object.keys(UNIT_LABEL) as UnitKey[];

export interface CatalogItem {
  id: string;
  name: string;
  brand?: string;
  /** «Mercadona», «HiperDino» o «Genérico» (valores medios de tabla). */
  store: string;
  cat: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  units: UnitMap;
  source: 'tabla' | 'mio' | 'online';
  code?: string;
  image?: string;
  /** Peso del envase (g), si se conoce. */
  pack?: number;
}

export const CAT_LIST: { id: string; label: string }[] = [
  { id: 'embutidos', label: 'Embutidos y fiambres' },
  { id: 'carne', label: 'Carnes' },
  { id: 'pescado', label: 'Pescado y marisco' },
  { id: 'lacteos', label: 'Lácteos y huevos' },
  { id: 'quesos', label: 'Quesos' },
  { id: 'panes', label: 'Panes y tortitas' },
  { id: 'cereales', label: 'Arroz, pasta y cereales' },
  { id: 'legumbres', label: 'Legumbres y proteína vegetal' },
  { id: 'fruta', label: 'Fruta' },
  { id: 'verdura', label: 'Verduras' },
  { id: 'salsas', label: 'Salsas y aceites' },
  { id: 'frutos-secos', label: 'Frutos secos' },
  { id: 'dulces', label: 'Dulces y snacks' },
  { id: 'bebidas', label: 'Bebidas' },
  { id: 'conservas', label: 'Conservas' },
  { id: 'suplementos', label: 'Suplementos' },
  { id: 'otros', label: 'Otros' },
];

const EMBUTIDO = /jamon|chorizo|salchichon|fuet|bacon|beicon|mortadela|lomo embuchado|fiambre|embutido|sobrasada|morcilla|pate|cecina|salchicha|chopped|pechuga de pavo|pavo en lonchas|york|longaniza|butifarra/;
const QUESO = /queso|mozzarella|parmesano|feta|cottage|requeson|burgos|cheddar/;
const PAN = /\bpan\b|pan de|tostada|wrap|tortilla de trigo|tortita|croissant|biscote|bocadillo|barra de|picos|colines/;

/** Categoría del catálogo (más fina que la de la despensa: embutidos, quesos y panes van aparte). */
export const catalogCategory = (name: string): string => {
  const n = norm(name);
  if (/queso (en )?lonchas|lonchas de queso/.test(n)) return 'quesos';
  if (EMBUTIDO.test(n) && !/queso/.test(n)) return 'embutidos';
  if (QUESO.test(n)) return 'quesos';
  if (PAN.test(n)) return 'panes';
  if (/salsa|aceite|mayonesa|ketchup|mostaza|tomate frito|vinagre|pesto|tahini/.test(n)) return 'salsas';
  const id = categoryOf({ name }).id;
  return CAT_LIST.some((c) => c.id === id) ? id : 'otros';
};

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

const toUnits = (r: { u: number; l: number; r: number; cs: number; ct: number; pu: number }, cat: string): UnitMap => {
  const m: UnitMap = {};
  if (r.u > 0) m.unidad = r.u;
  if (r.l > 0) m.loncha = r.l;
  else if (cat === 'embutidos') m.loncha = 15;
  else if (cat === 'quesos') m.loncha = 20;
  if (r.r > 0) m.rebanada = r.r;
  if (r.cs > 0) m.cucharada = r.cs;
  else if (cat === 'salsas') m.cucharada = 15;
  if (r.ct > 0) m.cucharadita = r.ct;
  else if (cat === 'salsas' && m.cucharada) m.cucharadita = 5;
  if (r.pu > 0) m.puñado = r.pu;
  return m;
};

let builtin: CatalogItem[] | null = null;
/** Alimentos de la tabla de composición de la app (valores medios por 100 g y peso de cada medida). */
export const builtinItems = (): CatalogItem[] => {
  if (builtin) return builtin;
  builtin = FOODS.map((f) => {
    const key = f.keys[0];
    const cat = catalogCategory(key);
    return { id: `b:${key}`, name: cap(key), store: 'Genérico', cat, kcal: f.kcal, protein: f.protein, carbs: f.carbs, fat: f.fat, fiber: f.fiber, units: toUnits(f, cat), source: 'tabla' as const };
  });
  return builtin;
};

/** Un producto tuyo (escaneado, de foto o guardado desde una búsqueda) como elemento del catálogo. */
export const savedToItem = (p: SavedProduct): CatalogItem => {
  const name = p.brand && !norm(p.name).includes(norm(p.brand)) ? `${p.name} (${p.brand})` : p.name;
  const units: UnitMap = {};
  if (p.pack || p.serving) units.unidad = p.pack || p.serving;
  if (p.serving) units.ración = p.serving;
  return { id: `s:${p.id}`, name, brand: p.brand, store: p.store || 'Mío', cat: catalogCategory(p.name), kcal: p.kcal, protein: p.protein, carbs: p.carbs, fat: p.fat, fiber: p.fiber, units, source: 'mio', code: p.code, image: p.image, pack: p.pack };
};

/** Aplica las medidas que has corregido a mano (p. ej. «1 loncha de este jamón = 12 g»). */
export const withUnits = (item: CatalogItem, foodUnits: FoodUnits | undefined): CatalogItem => {
  const o = foodUnits?.[item.id];
  return o ? { ...item, units: { ...item.units, ...o } } : item;
};

/** Gramos de una cantidad con su medida, o null si esa medida no está definida para este alimento. */
export const gramsFor = (item: CatalogItem, qty: number, unit: 'g' | UnitKey): number | null => {
  if (!(qty > 0)) return null;
  if (unit === 'g') return qty;
  const g = item.units[unit];
  return g && g > 0 ? Math.round(qty * g * 10) / 10 : null;
};

export interface MacroTotals {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}
/** Macros de una cantidad en gramos (valores por 100 g × gramos / 100): todo se calcula aquí, sin IA. */
export const macrosOf = (item: CatalogItem, grams: number): MacroTotals => {
  const r1 = (v: number) => Math.round(v * 10) / 10;
  return { kcal: Math.round((item.kcal * grams) / 100), protein: r1((item.protein * grams) / 100), carbs: r1((item.carbs * grams) / 100), fat: r1((item.fat * grams) / 100) };
};

/** Línea de detalle del plato: la app la entiende al editar la comida («2 lonchas de Jamón cocido (≈ 30 g)»). */
export const detailLine = (item: CatalogItem, qty: number, unit: 'g' | UnitKey, grams: number): string => {
  const q = Number.isInteger(qty) ? String(qty) : String(Math.round(qty * 100) / 100).replace('.', ',');
  if (unit === 'g') return `${q} g de ${item.name.toLowerCase()}`;
  const w = qty === 1 ? UNIT_LABEL[unit].one : UNIT_LABEL[unit].many;
  return `${q} ${w} de ${item.name.toLowerCase()} (≈ ${Math.round(grams)} g)`;
};

/** Busca por todas las palabras escritas (sin tildes ni mayúsculas) en nombre, marca y supermercado. */
export const searchItems = (items: CatalogItem[], q: string): CatalogItem[] => {
  const toks = norm(q).split(' ').filter(Boolean);
  if (!toks.length) return items;
  const hit = items.filter((i) => {
    const hay = ` ${norm(`${i.name} ${i.brand ?? ''} ${i.store}`)} `;
    return toks.every((t) => hay.includes(t));
  });
  const first = norm(q);
  return hit.sort((a, b) => Number(norm(b.name).startsWith(first)) - Number(norm(a.name).startsWith(first)) || a.name.length - b.name.length);
};

// ---------- Búsqueda en Open Food Facts (productos de Mercadona / HiperDino) ----------

export type StoreFilter = 'Mercadona' | 'HiperDino' | 'todas';

export const offSearchUrl = (query: string, store: StoreFilter): string => {
  const p = new URLSearchParams({
    search_terms: query.trim(),
    search_simple: '1',
    action: 'process',
    json: '1',
    page_size: '30',
    fields: 'code,product_name,product_name_es,brands,stores,nutriments,serving_quantity,product_quantity,image_front_small_url',
    tagtype_0: 'countries',
    tag_contains_0: 'contains',
    tag_0: 'es',
  });
  if (store !== 'todas') {
    p.set('tagtype_1', 'stores');
    p.set('tag_contains_1', 'contains');
    p.set('tag_1', store.toLowerCase());
  }
  return `https://world.openfoodfacts.org/cgi/search.pl?${p.toString()}`;
};

const WHITE_BRANDS: [RegExp, string][] = [
  [/hacendado|deliplus|bosque verde|compy|mercadona/, 'Mercadona'],
  [/hiperdino|hiper dino|dino\b|dinosol/, 'HiperDino'],
];
const storeOfProduct = (brands: string, stores: string): string => {
  const t = norm(`${stores} ${brands}`);
  return WHITE_BRANDS.find(([re]) => re.test(t))?.[1] ?? (stores.split(',')[0]?.trim() || 'Otra marca');
};

/** Convierte la respuesta de Open Food Facts en elementos del catálogo (solo los que traen calorías por 100 g). */
export const parseOff = (json: unknown): CatalogItem[] => {
  const list = (json as { products?: Record<string, unknown>[] } | null)?.products;
  if (!Array.isArray(list)) return [];
  const out: CatalogItem[] = [];
  for (const p of list) {
    const n = (p.nutriments ?? {}) as Record<string, number | undefined>;
    const kcal = Math.round(Number(n['energy-kcal_100g']) || (Number(n['energy_100g']) || 0) / 4.184);
    const name = String(p.product_name_es || p.product_name || '').trim();
    const code = String(p.code ?? '').replace(/\D/g, '');
    if (!name || !code || !(kcal > 0)) continue;
    const r1 = (v: number | undefined) => Math.round((Number(v) || 0) * 10) / 10;
    const brand = String(p.brands ?? '').split(',')[0].trim();
    const serving = Math.round(Number(p.serving_quantity) || 0);
    const pack = Math.round(Number(p.product_quantity) || 0);
    const units: UnitMap = {};
    if (pack || serving) units.unidad = pack || serving;
    if (serving) units.ración = serving;
    out.push({ id: `o:${code}`, name, brand: brand || undefined, store: storeOfProduct(brand, String(p.stores ?? '')), cat: catalogCategory(name), kcal, protein: r1(n.proteins_100g), carbs: r1(n.carbohydrates_100g), fat: r1(n.fat_100g), fiber: r1(n.fiber_100g), units, source: 'online', code, image: String(p.image_front_small_url ?? '') || undefined, pack: pack || undefined });
  }
  return out;
};

export async function searchOnline(query: string, store: StoreFilter, signal?: AbortSignal): Promise<CatalogItem[]> {
  const r = await fetch(offSearchUrl(query, store), { signal });
  if (!r.ok) throw new Error(`Open Food Facts respondió ${r.status}`);
  return parseOff(await r.json());
}

/** Producto del catálogo listo para guardarlo en «mis productos» (así se encuentra sin conexión y manda sobre la tabla genérica). */
export const itemToSaved = (i: CatalogItem): Omit<SavedProduct, 'id' | 'usedAt'> => ({
  name: i.name,
  brand: i.brand,
  code: i.code,
  image: i.image,
  store: i.store,
  kcal: i.kcal,
  protein: i.protein,
  carbs: i.carbs,
  fat: i.fat,
  sugars: 0,
  satFat: 0,
  fiber: i.fiber,
  salt: 0,
  serving: i.units.ración,
  pack: i.pack,
});
