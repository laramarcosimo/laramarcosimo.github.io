import { Bookmark, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { lineToItem } from '../lib/foodItems';
import { useStore } from '../lib/store';
import { SLOTS, slotOf } from '../lib/templates';
import type { Meal, Slot } from '../lib/types';
import { cx } from '../lib/utils';
import { FoodComposer } from './FoodComposer';
import { Modal, NumInput } from './ui';

/** Editar o borrar una comida registrada: por ingredientes (como con el «+») o a mano con kcal y macros. */
export function EditMealModal({ meal, onClose, onSaveTemplate }: { meal: Meal; onClose: () => void; onSaveTemplate: (m: Meal) => void }) {
  const { update } = useStore();
  const [m, setM] = useState<Meal>({ ...meal, slot: slotOf(meal) });
  const [tab, setTab] = useState<'ingredientes' | 'mano'>('ingredientes');
  const items = meal.detalle?.length ? meal.detalle.map(lineToItem) : [{ nombre: meal.plato, cantidad: 1, unidad: 'unidades' }];
  const save = (next: Meal) => {
    update((s) => ({ ...s, meals: s.meals.map((x) => (x.id === next.id ? next : x)) }));
    onClose();
  };
  return (
    <Modal title="Editar comida" onClose={onClose}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-800 p-1">
          {([['ingredientes', 'Ingredientes'], ['mano', 'A mano']] as const).map(([id, l]) => (
            <button key={id} onClick={() => setTab(id)} className={cx('rounded-lg py-2 text-xs font-bold', tab === id ? 'bg-accent text-white' : 'text-slate-400')}>{l}</button>
          ))}
        </div>
        <div>
          <label className="label">Toma</label>
          <select className="field" value={m.slot} onChange={(e) => setM({ ...m, slot: e.target.value as Slot })}>
            {SLOTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>
        <div className={tab === 'ingredientes' ? '' : 'hidden'}>
          <FoodComposer
            draftKey={`comida:${meal.id}`}
            initial={items}
            localCalc
            confirmLabel="Guardar cambios"
            onManual={() => setTab('mano')}
            onConfirm={(r) => save({ ...m, plato: r.name, calorias: r.calorias, proteinas: r.proteinas, carbs: r.carbs, grasas: r.grasas, detalle: r.detalle?.length ? r.detalle : undefined })}
          />
        </div>
        {tab === 'mano' && (
          <>
            <input className="field" value={m.plato} onChange={(e) => setM({ ...m, plato: e.target.value })} aria-label="Nombre" />
            <div className="grid grid-cols-4 gap-2">
              {([['calorias', 'kcal'], ['proteinas', 'Prot g'], ['carbs', 'Carbs g'], ['grasas', 'Grasas g']] as const).map(([k, l]) => (
                <div key={k}><label className="label">{l}</label><NumInput value={m[k]} label={l} className="field text-center" onChange={(n) => setM({ ...m, [k]: n })} /></div>
              ))}
            </div>
            <button className="btn btn-blue w-full" disabled={!m.plato.trim()} onClick={() => save({ ...m, plato: m.plato.trim() })}>Guardar cambios</button>
          </>
        )}
        <div className="grid grid-cols-2 gap-2">
          <button className="btn btn-ghost" onClick={() => { onSaveTemplate(m); onClose(); }}><Bookmark size={16} strokeWidth={1.75} /> Guardar como plato</button>
          <button className="btn btn-red" onClick={() => { update((s) => ({ ...s, meals: s.meals.filter((x) => x.id !== m.id) })); onClose(); }}><Trash2 size={16} strokeWidth={1.75} /> Borrar</button>
        </div>
      </div>
    </Modal>
  );
}
