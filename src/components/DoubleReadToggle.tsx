import { useStore } from '../lib/store';

/** Casilla para analizar cada foto dos veces y avisar si la IA no coincide consigo misma. */
export function DoubleReadToggle() {
  const { state, update } = useStore();
  return (
    <label className="flex items-start gap-2 text-[11px] text-slate-400">
      <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0" checked={!!state.settings.doubleRead} onChange={(e) => update((s) => ({ ...s, settings: { ...s.settings, doubleRead: e.target.checked } }))} />
      <span>Doble lectura: la IA mira el plato dos veces y te avisa si no coincide. Más exacto, pero gasta el doble de cupo gratuito.</span>
    </label>
  );
}
