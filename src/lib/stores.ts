export interface StoreInfo {
  name: string;
  /** Marcas blancas, para ayudar a la búsqueda y a Gemini. */
  brands?: string;
  color: string;
}

export const SUPERMARKETS: StoreInfo[] = [
  { name: 'HiperDino', brands: 'Dino / HiperDino Eco', color: '#b91c1c' },
  { name: 'Mercadona', brands: 'Hacendado', color: '#16a34a' },
  { name: 'Lidl', brands: 'Milbona / Chef Select', color: '#2563eb' },
  { name: 'Carrefour', color: '#1d4ed8' },
  { name: 'Alcampo', color: '#dc2626' },
  { name: 'Aldi', brands: 'GutBio / Milsani', color: '#0ea5e9' },
  { name: 'Dia', color: '#e11d48' },
  { name: 'Consum', color: '#ea580c' },
  { name: 'Eroski', color: '#be123c' },
  { name: 'El Corte Inglés', color: '#15803d' },
  { name: 'Genérico / Mercado local', color: '#64748b' },
];

export const storeInfo = (name: string): StoreInfo => SUPERMARKETS.find((s) => s.name.toLowerCase() === name.toLowerCase()) ?? { name, color: '#64748b' };

/** Primera marca blanca de la cadena (para afinar búsquedas). */
export const whiteBrand = (store?: string): string => (store ? (storeInfo(store).brands?.split('/')[0].trim() ?? '') : '');

export const storeInitials = (name: string): string => {
  if (/gen[eé]rico/i.test(name)) return 'ML';
  const w = name.split(/\s+/).filter(Boolean);
  return (w.length > 1 ? w[0][0] + w[1][0] : name.slice(0, 2)).toUpperCase();
};

/** Lista de cadenas a enviar a Gemini: la predeterminada primero. */
export const storeList = (def: string, others: string[]): string[] => [def, ...others.filter((o) => o !== def)].filter(Boolean);
