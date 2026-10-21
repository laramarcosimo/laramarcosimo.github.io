import { Check } from 'lucide-react';
import { kcalStatus, type DayBalance } from '../lib/metabolic';
import { cx } from '../lib/utils';

const fmt = (n: number): string => String(n).replace(/\B(?=(\d{3})+$)/g, '.');

/**
 * Calorías del día con rango flexible: el mínimo es obligatorio, el máximo es un techo opcional.
 * Verde «óptimo» entre ambos; azul mientras falta para el mínimo; rojo solo si te pasas del máximo.
 */
export function KcalBalance({ b, big = true }: { b: DayBalance; big?: boolean }) {
  const st = kcalStatus(b.eaten, b.kcalMin, b.kcalMax);
  const color = st.state === 'over' ? 'text-red-400' : st.state === 'ok' ? 'text-fuel' : 'text-accent';
  const bar = st.state === 'over' ? 'bg-red-500' : st.state === 'ok' ? 'bg-fuel' : 'bg-accent';
  const label =
    st.state === 'below' ? `kcal para llegar al mínimo (${fmt(b.kcalMin)})` : st.state === 'ok' ? 'Objetivo cumplido dentro del rango saludable' : `kcal por encima del máximo (${fmt(b.kcalMax)})`;
  const sub = st.state === 'below' ? `Hasta ${fmt(b.kcalMax)} es seguro, pero no hace falta llegar.` : st.state === 'ok' ? `Puedes comer hasta ${fmt(st.headroom)} kcal más (opcional).` : 'Un día no pasa nada: sin compensar con ayunos.';
  const pct = (n: number): number => Math.min(100, Math.max(0, (n / Math.max(1, b.kcalMax)) * 100));
  return (
    <div>
      <div className="flex items-end gap-2">
        <div className={cx('font-black tabular-nums', big ? 'text-5xl' : 'text-4xl', color)}>{st.state === 'ok' ? <Check size={big ? 44 : 36} strokeWidth={3} aria-label="Óptimo" /> : fmt(st.delta)}</div>
        <div className="pb-1.5 text-sm text-slate-300">{st.state === 'ok' && <span className="mr-1.5 rounded-full bg-fuel/20 px-2 py-0.5 text-[10px] font-bold uppercase text-fuel">Óptimo</span>}{label}</div>
      </div>
      <div className="relative mt-2">
        <div className="h-2 overflow-hidden rounded-full bg-slate-800"><div className={cx('h-full rounded-full', bar)} style={{ width: `${pct(b.eaten)}%`, transition: 'width 0.3s' }} /></div>
        <span className="absolute -top-0.5 h-3 w-0.5 rounded bg-slate-300" style={{ left: `${pct(b.kcalMin)}%` }} aria-hidden />
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-slate-400"><span>Comido {fmt(b.eaten)}</span><span>Mínimo {fmt(b.kcalMin)} · Máximo {fmt(b.kcalMax)}</span></div>
      <div className="mt-0.5 text-xs text-slate-400">{sub}</div>
    </div>
  );
}
