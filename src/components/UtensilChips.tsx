import { Check } from 'lucide-react';
import { useStore } from '../lib/store';
import { cx } from '../lib/utils';

export const UTENSILS = ['Sartén', 'Horno', 'Airfryer / Freidora de aire', 'Microondas', 'Batidora', 'Olla', 'Plancha'];

export function UtensilChips() {
  const { state, update } = useStore();
  return (
    <div className="flex flex-wrap gap-2">
      {UTENSILS.map((u) => {
        const on = state.utensils.includes(u);
        return (
          <button key={u} onClick={() => update((s) => ({ ...s, utensils: on ? s.utensils.filter((x) => x !== u) : [...s.utensils, u] }))} className={cx('rounded-full px-3 py-1.5 text-sm font-semibold transition active:scale-95', on ? 'bg-fuel text-slate-950' : 'bg-slate-800 text-slate-400')}>
            {on && <Check size={13} strokeWidth={2} className="mr-1 inline" />}{u}
          </button>
        );
      })}
    </div>
  );
}
