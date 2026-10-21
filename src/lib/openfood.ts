import { norm } from './utils';
import { whiteBrand } from './stores';

const CACHE_KEY = 'apex-off-cache-v3'; // v3: coincidencias más estrictas (no mezclar «plátano» con puré de plátano)
type Cache = Record<string, string>; // '' = sin imagen fiable
const pending = new Map<string, Promise<string>>();

/** Open Food Facts limita la búsqueda (~10/min): las consultas se encolan con separación. */
const GAP_MS = 6500;
let chain: Promise<unknown> = Promise.resolve();
const enqueue = <T,>(job: () => Promise<T>): Promise<T> => {
  const run = chain.then(job, job);
  chain = run.then(() => new Promise((r) => setTimeout(r, GAP_MS)), () => new Promise((r) => setTimeout(r, GAP_MS)));
  return run;
};

const readCache = (): Cache => {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}') as Cache;
  } catch {
    return {};
  }
};

const writeCache = (key: string, url: string): void => {
  try {
    const c = readCache();
    c[key] = url;
    localStorage.setItem(CACHE_KEY, JSON.stringify(c));
  } catch {
    /* sin almacenamiento */
  }
};

export const forgetCachedImage = (name: string): void => {
  try {
    const c = readCache();
    delete c[productKey(name)];
    localStorage.setItem(CACHE_KEY, JSON.stringify(c));
  } catch {
    /* noop */
  }
};

const STOP = new Set(['de', 'la', 'el', 'los', 'las', 'con', 'sin', 'en', 'y', 'a', 'al', 'del', 'natural', 'unidad', 'lata', 'pack', 'u']);
const stem = (t: string): string => t.replace(/(es|s)$/, '');
const tokens = (s: string): string[] => norm(s).split(' ').filter((t) => t && !STOP.has(t)).map(stem);

const parenthesis = (name: string): string => name.match(/\((.*?)\)/g)?.join(' ') ?? '';
export const cleanName = (name: string): string => name.replace(/\(.*?\)/g, ' ').replace(/\s+/g, ' ').trim();

/** Clave estable de producto: "Huevos" y "huevo (HiperDino)" comparten foto. No depende del supermercado. */
export const productKey = (name: string): string => tokens(cleanName(name)).slice(0, 4).join(' ');

interface Candidate {
  product_name?: string;
  brands?: string;
  image_front_small_url?: string;
  image_small_url?: string;
}

/** Palabras de productos elaborados: si el candidato las lleva y tú no las pediste, no es el alimento fresco que buscas (p. ej. «plátano» ≠ «puré de plátano»). */
const PROCESSED = /pure|puree|bolsita|pouch|compota|zumo|bebida|batido|yogur|yogurt|galleta|snack|chips|mermelada|barrita|cereal|sabor|aroma|infantil|bebe|tarta|helado|crema|mousse|gelatina|polvo|deshidrat|confitad|liofiliz|smoothie|nectar|jarabe|conserva|congelad/;

/** Elige el candidato cuyo nombre realmente se parece (y cuya marca coincide); si ninguno encaja, '' (se usa icono). */
export function pickBestImage(name: string, store: string | undefined, list: Candidate[]): string {
  const q = tokens(cleanName(name)).slice(0, 4);
  if (q.length === 0) return '';
  const wanted = new Set(tokens(`${whiteBrand(store)} ${parenthesis(name)}`));
  let best = '';
  let bestScore = 0;
  for (const c of list) {
    const img = c.image_front_small_url || c.image_small_url;
    if (!img || !c.product_name) continue;
    const ct = tokens(c.product_name);
    const hit = (t: string) => ct.some((x) => x === t || (x.length >= 4 && t.length >= 4 && (x.startsWith(t) || t.startsWith(x))));
    const mainHit = hit(q[0]);
    const ratio = q.filter(hit).length / q.length;
    if (!mainHit || ratio < 0.6) continue;
    // Búsqueda genérica (1-2 palabras: «plátano», «huevos»): nada de productos elaborados ni de nombres con muchas palabras de más.
    if (q.length <= 2) {
      const extra = ct.filter((x) => !q.some((t) => x === t || x.startsWith(t) || t.startsWith(x)));
      if (ratio < 1 || extra.length > 2) continue;
      if (extra.some((x) => PROCESSED.test(x)) && !q.some((t) => PROCESSED.test(t))) continue;
    }
    const brandBonus = tokens(c.brands ?? '').some((b) => wanted.has(b)) ? 0.25 : 0;
    const score = ratio + brandBonus - 0.04 * Math.max(0, ct.length - q.length);
    if (score > bestScore) {
      bestScore = score;
      best = img;
    }
  }
  return best;
}

/** Busca la foto del producto en Open Food Facts. '' si no hay una coincidencia fiable. */
export function findProductImage(name: string, store?: string): Promise<string> {
  const key = productKey(name);
  if (!key) return Promise.resolve('');
  const hit = readCache()[key];
  if (hit !== undefined) return Promise.resolve(hit);
  const inflight = pending.get(key);
  if (inflight) return inflight;

  const p = enqueue(async () => {
    const again = readCache()[key];
    if (again !== undefined) return again;
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 10000);
    try {
      const terms = [cleanName(name), whiteBrand(store)].filter(Boolean).join(' ');
      const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(terms)}&search_simple=1&action=process&json=1&page_size=24&lc=es&cc=es&fields=product_name,brands,image_front_small_url,image_small_url`;
      const res = await fetch(url, { signal: ctl.signal });
      if (!res.ok) return '';
      const data = (await res.json()) as { products?: Candidate[] };
      const img = pickBestImage(name, store, data.products ?? []);
      writeCache(key, img);
      return img;
    } catch {
      return ''; // sin red o tiempo agotado: no se cachea para reintentar más tarde
    } finally {
      clearTimeout(timer);
      pending.delete(key);
    }
  });
  pending.set(key, p);
  return p;
}

export interface ImageCandidate {
  url: string;
  label: string;
}

/** Búsqueda manual de alternativas (acción del usuario: sin cola ni filtro estricto). */
export async function searchImageCandidates(query: string): Promise<ImageCandidate[]> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 12000);
  try {
    const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=40&lc=es&cc=es&fields=product_name,brands,image_front_small_url,image_small_url`;
    const res = await fetch(url, { signal: ctl.signal });
    if (!res.ok) throw new Error(`Open Food Facts respondió ${res.status}`);
    const data = (await res.json()) as { products?: Candidate[] };
    const seen = new Set<string>();
    const out: ImageCandidate[] = [];
    for (const c of data.products ?? []) {
      const img = c.image_front_small_url || c.image_small_url;
      if (!img || seen.has(img)) continue;
      seen.add(img);
      out.push({ url: img, label: [c.product_name, c.brands].filter(Boolean).join(' · ') });
      if (out.length >= 12) break;
    }
    return out;
  } finally {
    clearTimeout(timer);
  }
}

export interface BarcodeProduct {
  code: string;
  name: string;
  brand: string;
  image: string;
  /** Valores por 100 g/ml. */
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  /** Ración indicada en el envase en gramos, si se sabe. */
  serving: number;
  /** Peso/volumen del envase en g/ml, si se sabe. */
  pack: number;
  /** Resto de valores por 100 g/ml (g): azúcares, grasas saturadas, fibra y sal. */
  sugars: number;
  satFat: number;
  fiber: number;
  salt: number;
}

/** Busca un producto por código de barras en Open Food Facts (gratis, sin clave). null si no existe. */
export async function lookupBarcode(code: string): Promise<BarcodeProduct | null> {
  const c = code.replace(/\D/g, '');
  if (c.length < 8) return null;
  const r = await fetch(`https://world.openfoodfacts.org/api/v2/product/${c}.json?fields=product_name,product_name_es,brands,nutriments,serving_quantity,product_quantity,image_front_small_url`);
  if (!r.ok) return null;
  const j = (await r.json()) as { status?: number; product?: Record<string, unknown> };
  const p = j.product;
  if (!p || j.status === 0) return null;
  const n = (p.nutriments ?? {}) as Record<string, number | undefined>;
  const name = String(p.product_name_es || p.product_name || '').trim();
  if (!name) return null;
  const num = (v: number | undefined) => Math.round((Number(v) || 0) * 10) / 10;
  return {
    code: c,
    name,
    brand: String(p.brands ?? '').split(',')[0].trim(),
    image: String(p.image_front_small_url ?? ''),
    kcal: Math.round(Number(n['energy-kcal_100g']) || (Number(n['energy_100g']) || 0) / 4.184),
    protein: num(n.proteins_100g),
    carbs: num(n.carbohydrates_100g),
    fat: num(n.fat_100g),
    serving: Math.round(Number(p.serving_quantity) || 0),
    pack: Math.round(Number(p.product_quantity) || 0),
    sugars: num(n.sugars_100g),
    satFat: num(n['saturated-fat_100g']),
    fiber: num(n.fiber_100g),
    salt: Math.round((Number(n.salt_100g) || (Number(n.sodium_100g) || 0) * 2.5) * 100) / 100,
  };
}
