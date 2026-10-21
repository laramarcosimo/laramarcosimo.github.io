/** Minutos que se tarda en dormirse por defecto. */
export const FALL_ASLEEP_MIN = 30;

/** "HH:MM" -> minutos desde medianoche (null si no es válida). */
export const parseHM = (v: string): number | null => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(v.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  return h > 23 || mi > 59 ? null : h * 60 + mi;
};

/**
 * Horas de sueño real entre acostarse y despertar (cruza la medianoche si hace falta),
 * restando el tiempo que se tarda en dormirse. Nunca negativo.
 */
export const sleepCalc = (bed: string, wake: string, fallAsleepMin: number = FALL_ASLEEP_MIN): { inBedH: number; sleepH: number } | null => {
  const b = parseHM(bed);
  const w = parseHM(wake);
  if (b === null || w === null) return null;
  const inBed = (w - b + 1440) % 1440; // mismas horas = 0 (no 24 h)
  const asleep = Math.max(0, inBed - Math.max(0, fallAsleepMin));
  return { inBedH: inBed / 60, sleepH: asleep / 60 };
};
