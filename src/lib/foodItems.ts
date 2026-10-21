import type { FoodItemInput } from './gemini';

const UNIT_MAP: [RegExp, string][] = [
  [/^(g|gr|gramos?)$/, 'g'],
  [/^ml$/, 'ml'],
  [/^cucharadas?$/, 'cucharadas'],
  [/^lonchas?$/, 'lonchas'],
  [/^rebanadas?$/, 'rebanadas'],
  [/^pu[ñn]ados?$/, 'puñados'],
  [/^tazas?$/, 'tazas'],
  [/^raciones?$/, 'raciones'],
  [/^(unidades?|piezas?)$/, 'unidades'],
];
const WORDS: Record<string, number> = { un: 1, una: 1, medio: 0.5, media: 0.5, '½': 0.5 };

/** Convierte una línea de detalle («3 lonchas de pavo (≈ 45 g)») en un alimento editable del compositor. */
export function lineToItem(line: string): FoodItemInput {
  const clean = line.replace(/\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();
  const m = clean.match(/^(½|\d+(?:[.,]\d+)?(?:\s*\/\s*\d+)?|medio|media|una?)\s*(.*)$/i);
  if (!m) return { nombre: clean || line, cantidad: 1, unidad: 'unidades' };
  const q = m[1].toLowerCase();
  let cantidad = WORDS[q];
  if (cantidad === undefined) {
    if (q.includes('/')) {
      const [a, b] = q.split('/').map((v) => Number(v.trim()));
      cantidad = b ? a / b : 1;
    } else cantidad = Number(q.replace(',', '.'));
  }
  let rest = m[2].trim();
  let unidad = 'unidades';
  const first = rest.split(' ')[0]?.toLowerCase() ?? '';
  const hit = UNIT_MAP.find(([re]) => re.test(first));
  if (hit) {
    unidad = hit[1];
    rest = rest.slice(first.length).trim().replace(/^(soperas?|de postre|colmadas?|rasas?)\s*/i, '').replace(/^de\s+/i, '');
  }
  return { nombre: rest || clean, cantidad: Number.isFinite(cantidad) && cantidad > 0 ? cantidad : 1, unidad };
}
