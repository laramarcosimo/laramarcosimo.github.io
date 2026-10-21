import { SLOTS } from '../lib/templates';
import type { Slot } from '../lib/types';
import { cx } from '../lib/utils';

/** «¿A qué comida corresponde?»: desayuno, comida, merienda o cena. */
export function SlotPicker({ value, onChange, hint }: { value: Slot | null; onChange: (s: Slot) => void; hint?: string }) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-semibold uppercase text-slate-400">¿A qué comida corresponde?</div>
      <div className="grid grid-cols-5 gap-1" role="radiogroup" aria-label="Comida">
        {SLOTS.map((s) => (
          <button key={s.id} role="radio" aria-checked={value === s.id} onClick={() => onChange(s.id)} className={cx('rounded-lg py-2 text-[11px] font-bold active:scale-95', value === s.id ? 'bg-accent text-white' : 'bg-slate-800 text-slate-300')}>{s.label}</button>
        ))}
      </div>
      {value === null && <p className="text-[11px] text-amber-500">{hint ?? 'Elige a qué comida va para sumarla.'}</p>}
    </div>
  );
}
