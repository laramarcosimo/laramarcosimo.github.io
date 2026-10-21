import { Camera, Check, ImagePlus, ScanBarcode } from 'lucide-react';
import { useState, useSyncExternalStore } from 'react';
import { addToDraft, draftCount, getDraft, subscribeDraft } from '../lib/composeDraft';
import { useStore } from '../lib/store';
import { SLOTS, consumeTupper, logTemplate, saveMealTemplate } from '../lib/templates';
import type { Slot } from '../lib/types';
import { cx } from '../lib/utils';
import { BarcodeScanner } from './BarcodeScanner';
import { movePlannedToDiary } from '../lib/plan';
import { dayKey } from '../lib/utils';
import { FoodComposer } from './FoodComposer';
import { PantryPicker } from './PantryPicker';
import { Modal, NumInput } from './ui';


type Tab = 'tuppers' | 'platos' | 'despensa' | 'mano';

/** «+ Añadir» de una toma: foto rápida, un tupper, un plato frecuente, algo de la despensa o a mano. */
export function AddToSlotModal({ slot, onClose, onPhoto }: { slot: Slot; onClose: () => void; onPhoto: (gallery?: boolean) => void }) {
  const { state, update } = useStore();
  const hasTup = state.tuppers.some((t) => t.servings > 0);
  const [tab, setTab] = useState<Tab>(hasTup ? 'tuppers' : state.mealTemplates.length ? 'platos' : 'mano');
  const [scan, setScan] = useState(false);
  const [manual, setManual] = useState(false);
  const draftKey = `diario:${slot}`;
  const inDraft = useSyncExternalStore((f) => subscribeDraft(draftKey, f), () => draftCount(draftKey), () => 0);
  const [saveManual, setSaveManual] = useState(false);
  const [m, setM] = useState({ name: '', calorias: 0, proteinas: 0, carbs: 0, grasas: 0 });
  const label = SLOTS.find((s) => s.id === slot)?.label ?? '';
  const planned = state.dayPlan?.day === dayKey() ? state.dayPlan.slots[slot] : undefined;
  const done = () => onClose();
  const TABS: [Tab, string][] = [['tuppers', 'Tuppers'], ['platos', 'Platos'], ['despensa', 'Despensa'], ['mano', inDraft > 0 ? `A mano (${inDraft})` : 'A mano']];

  const row = (key: string, name: string, sub: string, kcal: number, onTap: () => void) => (
    <button key={key} className="flex w-full items-center justify-between rounded-xl bg-slate-800 px-3 py-2.5 text-left active:scale-[0.99]" onClick={() => { onTap(); done(); }}>
      <span className="min-w-0"><span className="block truncate text-sm font-semibold text-white">{name}</span><span className="block text-[11px] text-slate-400">{sub}</span></span>
      <span className="ml-2 shrink-0 text-xs text-slate-400">{kcal} kcal</span>
    </button>
  );

  return (
    <Modal title={`Añadir a ${label.toLowerCase()}`} onClose={onClose}>
      {planned && (
        <div className="mb-3 rounded-xl border border-accent/40 bg-accent/10 p-3">
          <div className="text-[11px] font-semibold uppercase text-accent">Lo que planificaste para hoy</div>
          <div className="mt-1 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate font-semibold text-white">{planned.name}</div>
              <div className="text-[11px] text-slate-400">{planned.calorias} kcal · P {planned.proteinas} · C {planned.carbs} · G {planned.grasas}</div>
            </div>
            <button className="btn btn-green shrink-0 !px-3 !py-2 text-xs" onClick={() => { update((s) => movePlannedToDiary(s, slot)); onClose(); }}>Añadir al diario</button>
          </div>
        </div>
      )}
      <div className="mb-3 grid grid-cols-2 gap-2">
        <button className="btn btn-green" onClick={() => { onClose(); onPhoto(); }}><Camera size={18} strokeWidth={1.75} /> Foto rápida</button>
        <button className="btn btn-ghost" onClick={() => { onClose(); onPhoto(true); }}><ImagePlus size={18} strokeWidth={1.75} /> Subir foto</button>
      </div>
      <button className="btn btn-ghost mb-3 w-full" onClick={() => setScan(true)}><ScanBarcode size={18} strokeWidth={1.75} /> Escanear código de barras</button>
      {scan && <BarcodeScanner slot={slot} onClose={() => { setScan(false); onClose(); }} />}
      <div className="mb-3 grid grid-cols-4 gap-1 rounded-xl bg-slate-800 p-1">
        {TABS.map(([id, l]) => <button key={id} onClick={() => setTab(id)} className={cx('min-w-0 truncate rounded-lg px-0.5 py-2 text-[11px] font-bold', tab === id ? 'bg-accent text-white' : 'text-slate-400')}>{l}</button>)}
      </div>
      <div className="space-y-1.5">
        {tab === 'tuppers' && (!hasTup ? <p className="text-sm text-slate-500">No tienes tuppers con raciones.</p> : state.tuppers.filter((t) => t.servings > 0).map((t) => row(t.id, t.name, `quedan ${t.servings} · P ${t.proteinas}`, t.calorias, () => update((s) => consumeTupper(s, t.id, slot)))))}
        {tab === 'platos' && (state.mealTemplates.length === 0 ? <p className="text-sm text-slate-500">Aún no tienes platos frecuentes.</p> : state.mealTemplates.map((t) => row(t.id, t.name, `P ${t.proteinas} · C ${t.carbs} · G ${t.grasas}`, t.calorias, () => update((s) => logTemplate(s, t, true, slot)))))}

      </div>
      {/* Siempre montados (solo se ocultan): lo que eliges no se pierde al cambiar de pestaña. */}
      <div className={tab === 'despensa' ? '' : 'hidden'}>
        <PantryPicker onQuick={(f) => { update((s) => logTemplate(s, { name: f.portion, calorias: f.kcal, proteinas: f.protein, carbs: f.carbs, grasas: f.fat, ingredientes: [f.item.name] }, true, slot)); done(); }} onDone={(items, used) => { addToDraft(draftKey, items, used); setManual(false); setTab('mano'); }} />
      </div>
      <div className={tab === 'mano' && !manual ? '' : 'hidden'}>
        <FoodComposer draftKey={draftKey} confirmLabel={`Añadir a ${label.toLowerCase()}`} onManual={() => setManual(true)} onConfirm={(r, save) => { const used = getDraft(draftKey).used; update((s) => { const n = logTemplate(s, { ...r, ingredientes: used }, used.length > 0, slot); return save ? saveMealTemplate(n, r, slot) : n; }); done(); }} />
      </div>
      {tab === 'mano' && manual && (
        <div className="space-y-2">
          <input className="field" placeholder="Nombre" value={m.name} onChange={(e) => setM({ ...m, name: e.target.value })} />
          <div className="grid grid-cols-4 gap-2">
            {([['calorias', 'kcal'], ['proteinas', 'Prot g'], ['carbs', 'Carbs g'], ['grasas', 'Grasas g']] as const).map(([k, l]) => (
              <div key={k}><label className="label">{l}</label><NumInput value={m[k]} className="field text-center" onChange={(n) => setM({ ...m, [k]: n })} /></div>
            ))}
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-300"><input type="checkbox" className="h-4 w-4" checked={saveManual} onChange={(e) => setSaveManual(e.target.checked)} /> Guardar como plato para usarlo otra vez</label>
          <button className="btn btn-blue w-full" disabled={!m.name.trim() || !m.calorias} onClick={() => { update((s) => { const n = logTemplate(s, { ...m, name: m.name.trim(), ingredientes: [] }, false, slot); return saveManual ? saveMealTemplate(n, { ...m, name: m.name.trim() }, slot) : n; }); done(); }}><Check size={16} strokeWidth={1.75} /> Añadir a {label.toLowerCase()}</button>
          <button className="w-full text-center text-xs text-slate-500 underline" onClick={() => setManual(false)}>Volver a calcular con IA</button>
        </div>
      )}
    </Modal>
  );
}
