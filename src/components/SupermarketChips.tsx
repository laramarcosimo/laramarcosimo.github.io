import { Plus, Check } from 'lucide-react';
import { useState } from 'react';
import { SUPERMARKETS, storeInfo } from '../lib/stores';
import { useStore } from '../lib/store';
import { cx } from '../lib/utils';

export function SupermarketChips() {
  const { state, update } = useStore();
  const [custom, setCustom] = useState('');
  const [adding, setAdding] = useState(false);
  const chosen = state.supermarkets;
  const presetNames = SUPERMARKETS.map((s) => s.name);
  const all = [...presetNames, ...chosen.filter((c) => !presetNames.includes(c))];

  const toggle = (n: string) => update((s) => ({ ...s, supermarkets: s.supermarkets.includes(n) ? s.supermarkets.filter((x) => x !== n) : [...s.supermarkets, n] }));
  const add = () => {
    const n = custom.trim();
    if (!n) return;
    update((s) => ({ ...s, supermarkets: s.supermarkets.includes(n) ? s.supermarkets : [...s.supermarkets, n] }));
    setCustom('');
    setAdding(false);
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {all.map((n) => {
          const on = chosen.includes(n);
          const info = storeInfo(n);
          return (
            <button key={n} onClick={() => toggle(n)} className={cx('rounded-full border px-3 py-1.5 text-sm font-semibold transition active:scale-95', on ? 'border-transparent text-white' : 'border-slate-700 bg-slate-800 text-slate-400')} style={on ? { backgroundColor: info.color } : undefined}>
              {on && <Check size={13} strokeWidth={2} className="mr-1 inline" />}{n}{info.brands && <span className="ml-1 text-[10px] font-normal opacity-80">({info.brands})</span>}
            </button>
          );
        })}
        {!adding && <button onClick={() => setAdding(true)} className="rounded-full border border-dashed border-slate-600 px-3 py-1.5 text-sm text-slate-400"><Plus size={14} className="inline" /> Añadir otro</button>}
      </div>
      {adding && (
        <div className="mt-2 flex gap-2">
          <input autoFocus className="field" placeholder="Nombre del supermercado" value={custom} onChange={(e) => setCustom(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
          <button className="btn btn-blue" onClick={add}>Añadir</button>
        </div>
      )}
    </div>
  );
}
