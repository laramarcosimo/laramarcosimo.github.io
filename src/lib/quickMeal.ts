import { catalogCategory } from './catalog';

export interface QuickItem {
  nombre: string;
  cantidad: number;
  unidad: string;
}

const UNIT_MAP: [RegExp, string, number][] = [
  [/^(kg|kilos?)$/, 'g', 1000],
  [/^(g|gr|grs|gramos?)$/, 'g', 1],
  [/^(ml|mililitros?)$/, 'ml', 1],
  [/^(lonchas?|lonchitas?|lascas?)$/, 'lonchas', 1],
  [/^(rebanadas?|rebanadita?s?|tostadas?|biscotes?)$/, 'rebanadas', 1],
  [/^(cucharadas?|cdas?|cucharad[ao]s soperas?)$/, 'cucharadas', 1],
  [/^(cucharaditas?|cditas?)$/, 'cucharadas', 1 / 3],
  [/^(pu[ñn]ados?)$/, 'puñados', 1],
  [/^(raciones?|raci[óo]n)$/, 'raciones', 1],
  [/^(tazas?)$/, 'tazas', 1],
  [/^(unidades?|uds?|piezas?)$/, 'unidades', 1],
];

/** Sin unidad escrita: el queso y el embutido van por lonchas y el pan por rebanadas. */
const defaultUnit = (name: string): string => {
  const c = catalogCategory(name);
  return c === 'embutidos' || c === 'quesos' ? 'lonchas' : c === 'panes' ? 'rebanadas' : 'unidades';
};

/** «sandwich: 2 queso, 2 pan, 1 jamón» → [{queso,2,lonchas},{pan,2,rebanadas},{jamón,1,lonchas}]. */
export const parseQuick = (text: string): QuickItem[] => {
  const body = text.includes(':') ? text.slice(text.indexOf(':') + 1) : text;
  const out: QuickItem[] = [];
  for (const raw of body.split(/[,;\n+]|\s+y\s+/i)) {
    const part = raw.trim();
    if (!part) continue;
    const m = part.match(/^(\d+(?:[.,]\d+)?)\s*([a-zA-Záéíóúñ]+)?\s*(?:de\s+)?(.*)$/);
    let qty = 1;
    let unitWord = '';
    let name = part;
    if (m) {
      qty = parseFloat(m[1].replace(',', '.'));
      const w = (m[2] ?? '').toLowerCase();
      const hit = UNIT_MAP.find(([re]) => re.test(w));
      if (hit) {
        unitWord = w;
        name = m[3];
      } else name = `${m[2] ?? ''} ${m[3]}`.trim();
    }
    name = name.trim();
    if (!name || !(qty > 0)) continue;
    const hit = UNIT_MAP.find(([re]) => re.test(unitWord));
    if (hit) out.push({ nombre: name, cantidad: Math.round(qty * hit[2] * 100) / 100, unidad: hit[1] });
    else out.push({ nombre: name, cantidad: qty, unidad: defaultUnit(name) });
  }
  return out;
};
