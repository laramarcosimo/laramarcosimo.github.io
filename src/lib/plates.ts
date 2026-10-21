/** Discos habituales de gimnasio (kg por disco). */
export const PLATES = [25, 20, 15, 10, 5, 2.5, 1.25];

export interface PlatePlan {
  /** Discos por cada lado, de dentro (más pesado) hacia fuera. */
  perSide: number[];
  /** Peso total conseguido con esos discos (barra + 2 lados). */
  total: number;
  /** ¿Se consigue exactamente el peso pedido? */
  exact: boolean;
}

/** Calcula qué discos poner a cada lado de la barra para llegar al peso total (barra incluida). */
export const platesFor = (target: number, bar: number): PlatePlan => {
  let rest = Math.round(((target - bar) / 2) * 100) / 100;
  const perSide: number[] = [];
  if (rest > 0) {
    for (const p of PLATES) {
      while (rest + 1e-9 >= p) {
        perSide.push(p);
        rest = Math.round((rest - p) * 100) / 100;
      }
    }
  }
  const total = Math.round((bar + 2 * perSide.reduce((a, b) => a + b, 0)) * 100) / 100;
  return { perSide, total, exact: Math.abs(total - target) < 0.005 };
};
