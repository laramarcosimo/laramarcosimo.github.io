/** Gasto de caminata/carrera con la ecuación ACSM: VO2 (ml/kg/min) = 0,1·S + 1,8·S·G + 3,5, con S en m/min y G = pendiente (fracción). */
export const acsmKcal = (speedKmh: number, inclinePct: number, minutes: number, weightKg: number): number => {
  const S = speedKmh * 16.667;
  const G = inclinePct / 100;
  const vo2 = 0.1 * S + 1.8 * S * G + 3.5;
  const kcalMin = ((vo2 * weightKg) / 1000) * 5;
  return Math.round(kcalMin * minutes);
};

/** Convierte «08:29» (mm:ss) o «1:05:10» (h:mm:ss) en minutos decimales. */
export const parseClock = (v: unknown): number => {
  const parts = String(v ?? '').trim().split(':').map((x) => Number(x.replace(',', '.')));
  if (parts.length < 2 || parts.some((x) => !Number.isFinite(x))) return Number(String(v).replace(',', '.')) || 0;
  return parts.length === 3 ? parts[0] * 60 + parts[1] + parts[2] / 60 : parts[0] + parts[1] / 60;
};

/** Estimación plana (sin pendiente) a partir de tiempo y distancia, para series de cardio sin escanear. */
export const flatKcal = (minutes: number, km: number, weightKg: number): number => (minutes > 0 && km > 0 ? acsmKcal((km / minutes) * 60, 0, minutes, weightKg) : 0);
