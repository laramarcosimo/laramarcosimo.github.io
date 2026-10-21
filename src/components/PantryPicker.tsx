import { Check, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { pantryFoods, type FoodMatch } from '../lib/foods';
import type { FoodItemInput } from '../lib/gemini';
import { PLACES, placeOf } from '../lib/pantry';
import { useStore } from '../lib/store';
import { cx, norm } from '../lib/utils';
import { QtyInput, stepOf } from './QtyInput';

const UNITS = ['unidades', 'g', 'ml', 'raciones', 'cucharadas', 'rebanadas', 'tazas'];

/**
 * Inventario completo (Nevera, Despensa y Congelador) con buscador: tocas lo que vas a comer, eliges la cantidad
 * (editable a mano) y sigues para calcular el plato. Si de ese alimento se conoce una ración, también hay un atajo directo.
 */
export function PantryPicker({ onDone, onQuick }: { onDone: (items: FoodItemInput[], used: string[]) => void; onQuick?: (f: FoodMatch) => void }) {
  const { state } = useStore();
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<Record<string, FoodItemInput>>({});
  const known = useMemo(() => new Map(pantryFoods(state.pantry).map((f) => [f.item.id, f])), [state.pantry]);
  const nq = norm(q);
  const list = state.pantry.filter((p) => p.qty > 0 && (!nq || norm(p.name).includes(nq)));
  const chosen = Object.entries(sel);

  const toggle = (id: string, name: string, unitGrams?: number, portionG?: number) =>
    setSel((s) => {
      if (s[id]) {
        const { [id]: _drop, ...rest } = s;
        void _drop;
        return rest;
      }
      return { ...s, [id]: unitGrams ? { nombre: name, cantidad: portionG || 100, unidad: 'g' } : { nombre: name, cantidad: 1, unidad: 'unidades' } };
    });

  return (
    <div data-keyrow className="space-y-3">
      <div className="relative">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input className="field !pl-9" placeholder="Buscar en tu despensa…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar alimento" />
      </div>
      {state.pantry.length === 0 && <p className="text-sm text-slate-500">Tu despensa está vacía. Añade productos en Despensa → Inventario.</p>}
      {state.pantry.length > 0 && list.length === 0 && <p className="text-sm text-slate-500">Nada coincide con «{q}».</p>}
      {PLACES.map((pl) => {
        const items = list.filter((p) => placeOf(p) === pl.id);
        if (items.length === 0) return null;
        return (
          <div key={pl.id}>
            <div className="mb-1 text-[11px] font-bold uppercase text-slate-400">{pl.label} · {items.length}</div>
            <div className="space-y-1.5">
              {items.map((p) => {
                const on = !!sel[p.id];
                const it = sel[p.id];
                const kf = known.get(p.id);
                return (
                  <div key={p.id} className={cx('rounded-xl p-2.5', on ? 'bg-accent/15 ring-1 ring-accent' : 'bg-slate-800')}>
                    <button className="flex w-full items-center gap-2 text-left" onClick={() => toggle(p.id, p.name, p.unitGrams, p.portionG)} aria-pressed={on}>
                      <span className={cx('flex h-5 w-5 shrink-0 items-center justify-center rounded-md border', on ? 'border-accent bg-accent text-white' : 'border-slate-600')}>{on && <Check size={13} />}</span>
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-white">{p.name}</span>
                      <span className="shrink-0 text-xs text-slate-400">quedan {p.qty}</span>
                    </button>
                    {on && it && (
                      <div className="mt-2 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <QtyInput value={it.cantidad} step={stepOf(it.unidad)} label={p.name} onChange={(n) => setSel({ ...sel, [p.id]: { ...it, cantidad: n } })} />
                          <select className="field !w-auto !py-2 text-xs" value={it.unidad} onChange={(e) => setSel({ ...sel, [p.id]: { ...it, unidad: e.target.value, cantidad: e.target.value === 'g' || e.target.value === 'ml' ? 100 : 1 } })} aria-label="Unidad">{UNITS.map((u) => <option key={u}>{u}</option>)}</select>
                        </div>
                        {kf && onQuick && <button className="w-full rounded-lg bg-slate-700 px-2 py-1.5 text-left text-xs text-slate-200 active:scale-[0.99]" onClick={() => onQuick(kf)}>Atajo: {kf.portion} · {kf.kcal} kcal · P {kf.protein}</button>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      <div className="sticky bottom-0 -mx-1 bg-slate-900 px-1 pb-1 pt-2">
        <button className="btn btn-blue w-full" disabled={chosen.length === 0} onClick={() => { onDone(chosen.map(([, v]) => v), chosen.map(([, v]) => v.nombre)); setSel({}); }}>
          {chosen.length === 0 ? 'Toca lo que vas a comer' : `Añadir ${chosen.length} alimento${chosen.length === 1 ? '' : 's'} a mi selección`}
        </button>
      </div>
    </div>
  );
}
