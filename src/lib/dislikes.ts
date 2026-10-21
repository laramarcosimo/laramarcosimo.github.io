import { norm } from './utils';

const UNITS = '(?:pizcas?|chorritos?|chorro|g|gr|gramos?|kg|ml|l|cl|cucharadas?|cucharaditas?|lonchas?|lonchitas?|rebanadas?|puñados?|punados?|tazas?|vasos?|latas?|botes?|dientes?|ramitas?|hojas?|piezas?|unidades?|raciones?|trozos?|filetes?|medi[ao]s?|grandes?|pequeñ[oa]s?|mediana?s?)';

/** Nombre del alimento de una línea de receta («2 cucharadas de aceite de oliva (≈ 20 g)» → «aceite de oliva»). */
export const foodNameOf = (line: string): string =>
  line
    .toLowerCase()
    .replace(/\(.*?\)/g, ' ')
    .replace(/^\s*(?:\d+(?:[.,]\d+)?(?:\s*\/\s*\d+)?|½|un|una|uno|dos|tres|cuatro|cinco|medio|media)(?![a-záéíóúñ])/, '')
    .replace(new RegExp(`^\\s*${UNITS}\\b`, 'i'), '')
    .replace(new RegExp(`^\\s*${UNITS}\\b`, 'i'), '')
    .replace(/^\s*de(?:l)?\s+/, '')
    .replace(/\s+/g, ' ')
    .trim();

/** ¿Aparece este alimento (o su plural) como palabra(s) completa(s) en el texto? Evita falsos positivos como «sal» en «ensalada». */
export const dislikedIn = (text: string, food: string): boolean => {
  const f = norm(food).replace(/[^a-z0-9ñ ]/g, ' ').replace(/\s+/g, ' ').trim();
  if (f.length < 2) return false;
  const t = ` ${norm(text).replace(/[^a-z0-9ñ ]/g, ' ').replace(/\s+/g, ' ')} `;
  const esc = f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\s${esc}(?:s|es)?\\s`).test(t) || (f.endsWith('s') && new RegExp(`\\s${esc.slice(0, -1)}(?:s|es)?\\s`).test(t));
};

/** Alimentos que no te gustan y aparecen en alguno de los textos (nombre del plato, ingredientes…). */
export const dislikedHits = (texts: string[], dislikes: string[]): string[] => [...new Set(dislikes.filter((d) => texts.some((t) => dislikedIn(t, d))))];
