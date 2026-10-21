export const uid = (): string => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export const dayKey = (ts: number = Date.now()): string => {
  const d = new Date(ts);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
};

export const norm = (s: string): string =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

/** Coincidencia laxa entre nombres de ingredientes ("huevos" ~ "huevo", "pechuga de pollo" ~ "pollo"). */
export const looseMatch = (a: string, b: string): boolean => {
  const x = norm(a).replace(/s\b/g, '');
  const y = norm(b).replace(/s\b/g, '');
  if (!x || !y) return false;
  return x === y || x.includes(y) || y.includes(x);
};

export const fmtDuration = (sec: number): string => {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
};

export const num = (v: string | number | undefined | null): number => {
  if (v === undefined || v === null) return 0;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};

export const round = (n: number, d = 0): number => {
  const f = 10 ** d;
  return Math.round(n * f) / f;
};

export const cx = (...c: (string | false | null | undefined)[]): string => c.filter(Boolean).join(' ');

/** Días hasta una fecha AAAA-MM-DD (negativo = ya pasó). */
export const daysUntil = (iso: string, now = Date.now()): number => {
  const [y, m, d] = iso.split('-').map(Number);
  const target = new Date(y, m - 1, d).getTime();
  const today = new Date(new Date(now).getFullYear(), new Date(now).getMonth(), new Date(now).getDate()).getTime();
  return Math.round((target - today) / 86400000);
};

/** Peso para mostrar: hasta 2 decimales y coma decimal (55,6). */
export const fmtKg = (n: number): string => n.toLocaleString('es-ES', { maximumFractionDigits: 2 });

/** Etiqueta del lado en ejercicios unilaterales: I = izquierda (empieza siempre por ella), D = derecha. */
export const sideLetter = (s: 'D' | 'I'): 'I' | 'D' => s;
/** Tren inferior → «pierna»; torso, espalda, hombro, brazos y core → «brazo». */
export const limbOf = (muscleGroup?: string): 'pierna' | 'brazo' => (['Cuádriceps', 'Isquios', 'Glúteos', 'Gemelos'].includes(muscleGroup ?? '') ? 'pierna' : 'brazo');
export const sideName = (s: 'D' | 'I', limb: 'pierna' | 'brazo' = 'pierna'): string => `${limb === 'pierna' ? 'Pierna' : 'Brazo'} ${s === 'I' ? 'izquierd' : 'derech'}${limb === 'pierna' ? 'a' : 'o'} (${s})`;
