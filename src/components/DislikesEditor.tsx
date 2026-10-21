import { Plus, X } from 'lucide-react';
import { useState } from 'react';
import { useStore } from '../lib/store';
import { Hint } from './Hint';

/** Alimentos que no te gustan: se excluyen de las recetas y de los consejos del Coach. */
export function DislikesEditor() {
  const { state, update } = useStore();
  const [v, setV] = useState('');
  const add = () => {
    const n = v.trim();
    if (!n || state.dislikes.some((d) => d.toLowerCase() === n.toLowerCase())) return setV('');
    update((s) => ({ ...s, dislikes: [...s.dislikes, n] }));
    setV('');
  };
  return (
    <div className="space-y-2">
      <Hint className="text-xs text-slate-400">Las recetas y consejos nunca usarán estos alimentos.</Hint>
      <div className="flex flex-wrap gap-2">
        {state.dislikes.map((d) => (
          <span key={d} className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-3 py-1.5 text-sm font-semibold text-red-400">
            {d}
            <button onClick={() => update((s) => ({ ...s, dislikes: s.dislikes.filter((x) => x !== d) }))} aria-label={`Quitar ${d}`}><X size={14} strokeWidth={2} /></button>
          </span>
        ))}
        {state.dislikes.length === 0 && <span className="text-xs text-slate-500">Ninguno todavía.</span>}
      </div>
      <div className="flex gap-2">
        <input className="field" placeholder="Ej: brócoli, atún, cilantro…" value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
        <button className="btn btn-ghost" onClick={add} disabled={!v.trim()} aria-label="Añadir"><Plus size={18} /></button>
      </div>
    </div>
  );
}
