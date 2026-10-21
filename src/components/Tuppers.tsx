import { Camera, Check, Minus, Pencil, Plus, Soup, Sparkles, Trash2, UtensilsCrossed, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { estimateDish } from '../lib/gemini';
import { compressToBase64 } from '../lib/image';
import { useStore } from '../lib/store';
import { storeList } from '../lib/stores';
import { consumeTupper } from '../lib/templates';
import type { Tupper } from '../lib/types';
import { cx, uid } from '../lib/utils';
import { ErrorBox, Modal, NumInput } from './ui';
import { Hint } from './Hint';

type Draft = Omit<Tupper, 'id' | 'createdAt'>;
const empty = (): Draft => ({ name: '', servings: 4, calorias: 0, proteinas: 0, carbs: 0, grasas: 0, ingredientes: '' });

/** Alta de un plato ya cocinado: macros por ración, a mano o estimados con IA (ingredientes y/o foto). */
export function TupperModal({ initial, onClose }: { /** Si se indica, se edita ese tupper en vez de crear uno nuevo. */ initial?: Tupper; onClose: () => void }) {
  const { state, update } = useStore();
  const [d, setD] = useState<Draft>(initial ? { name: initial.name, servings: initial.servings, calorias: initial.calorias, proteinas: initial.proteinas, carbs: initial.carbs, grasas: initial.grasas, ingredientes: initial.ingredientes ?? '' } : empty());
  const [photo, setPhoto] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const camRef = useRef<HTMLInputElement>(null);

  const estimate = async () => {
    setBusy(true);
    setErr('');
    try {
      // La foto solo se usa para esta estimación y no se guarda.
      let b64: string | null = photo ? await compressToBase64(photo) : null;
      const r = await estimateDish(state.settings, d.ingredientes ?? '', d.servings, b64, storeList(state.defaultSupermarket, state.supermarkets), state.defaultSupermarket);
      b64 = null;
      setD((x) => ({ ...x, ...r }));
      setPhoto(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error desconocido');
    } finally {
      setBusy(false);
    }
  };

  const save = () => {
    const clean = { ...d, name: d.name.trim() };
    update((s) => ({ ...s, tuppers: initial ? s.tuppers.map((t) => (t.id === initial.id ? { ...t, ...clean } : t)) : [{ ...clean, id: uid(), createdAt: Date.now() }, ...s.tuppers] }));
    onClose();
  };

  const canEstimate = !!state.settings.geminiKey && (!!d.ingredientes?.trim() || !!photo);

  return (
    <Modal title={initial ? 'Editar plato cocinado' : 'Guardar plato cocinado'} onClose={onClose}>
      <div className="space-y-3">
        <input className="field" placeholder="Nombre (ej: Lentejas con verduras de mi madre)" value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} />
        <div className="flex items-center justify-between rounded-xl bg-slate-800 px-3 py-2">
          <span className="text-sm text-slate-300">Raciones / tuppers</span>
          <div className="flex items-center gap-2">
            <button className="rounded-lg bg-slate-900 p-2" onClick={() => setD({ ...d, servings: Math.max(1, d.servings - 1) })} aria-label="Menos raciones"><Minus size={14} /></button>
            <span className="w-8 text-center text-lg font-bold text-white">{d.servings}</span>
            <button className="rounded-lg bg-slate-900 p-2" onClick={() => setD({ ...d, servings: d.servings + 1 })} aria-label="Más raciones"><Plus size={14} /></button>
          </div>
        </div>

        <div>
          <label className="label">Ingredientes de la tanda (opcional, para calcular)</label>
          <textarea rows={3} className="field text-sm" placeholder="Ej: 500 g lentejas, 2 zanahorias, 1 cebolla, 150 g chorizo, aceite…" value={d.ingredientes} onChange={(e) => setD({ ...d, ingredientes: e.target.value })} />
        </div>
        <div className="flex items-center gap-2">
          <button className="btn btn-ghost !px-3" onClick={() => camRef.current?.click()} aria-label="Foto del plato"><Camera size={18} strokeWidth={1.75} /></button>
          {photo && <span className="flex items-center gap-1.5 rounded-full bg-accent/15 px-3 py-1.5 text-xs font-semibold text-accent">Foto lista <button onClick={() => setPhoto(null)} aria-label="Quitar foto"><X size={13} /></button></span>}
          <button className="btn btn-blue ml-auto" disabled={busy || !canEstimate} onClick={() => void estimate()}><Sparkles size={16} strokeWidth={1.75} /> {busy ? 'Calculando…' : 'Calcular por ración'}</button>
        </div>
        <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { const f = e.target.files?.[0] ?? null; if (camRef.current) camRef.current.value = ''; if (f) setPhoto(f); }} />
        {!state.settings.geminiKey && <Hint className="text-[11px] text-slate-500">Para calcular con IA necesitas la clave de Gemini (Ajustes). También puedes escribir los macros a mano.</Hint>}
        {err && <ErrorBox msg={err} />}

        <div className="grid grid-cols-4 gap-2">
          {([['calorias', 'kcal'], ['proteinas', 'Prot g'], ['carbs', 'Carbs g'], ['grasas', 'Grasas g']] as const).map(([k, l]) => (
            <div key={k}><label className="label">{l}</label><NumInput value={d[k]} className="field text-center" onChange={(n) => setD({ ...d, [k]: n })} /></div>
          ))}
        </div>
        <Hint className="-mt-1 text-[11px] text-slate-500">Valores por ración.</Hint>
        <button className="btn btn-green w-full" disabled={!d.name.trim() || !d.calorias} onClick={save}>{initial ? 'Guardar cambios' : 'Guardar tupper'}</button>
      </div>
    </Modal>
  );
}

/** Comida preparada: raciones disponibles y consumo con un toque. */
export function Tuppers() {
  const { state, update } = useStore();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Tupper | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const setServings = (id: string, n: number) => update((s) => ({ ...s, tuppers: s.tuppers.map((t) => (t.id === id ? { ...t, servings: Math.max(0, n) } : t)) }));

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-bold text-white"><Soup size={18} strokeWidth={1.5} className="text-accent" /> Tuppers / comida casera</h3>
        <button className="text-sm font-semibold text-fuel" onClick={() => setAdding(true)}><Plus size={14} className="inline" /> Nuevo tupper</button>
      </div>
      {state.tuppers.length === 0 && <p className="text-sm text-slate-500">Guarda platos ya cocinados y cómelos con un toque.</p>}
      <div className="space-y-2">
        {state.tuppers.map((t) => (
          <div key={t.id} className={cx('rounded-xl bg-slate-800 p-3', t.servings === 0 && 'opacity-60')}>
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold text-white">{t.name}</div>
                <div className="text-xs text-slate-400">por ración: {t.calorias} kcal · P {t.proteinas} · C {t.carbs} · G {t.grasas}</div>
                {t.ingredientes?.trim() && <div className="mt-1 line-clamp-2 text-[11px] text-slate-500">{t.ingredientes}</div>}
              </div>
              <button className="p-1.5 text-slate-400" onClick={() => setEditing(t)} aria-label={`Editar ${t.name}`}><Pencil size={15} /></button>
              <button className="p-1.5 text-slate-500" onClick={() => confirm(`¿Borrar «${t.name}»?`) && update((s) => ({ ...s, tuppers: s.tuppers.filter((x) => x.id !== t.id) }))} aria-label="Borrar tupper"><Trash2 size={15} /></button>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button className="rounded-lg bg-slate-900 p-2 text-white" onClick={() => setServings(t.id, t.servings - 1)} aria-label="Una ración menos"><Minus size={14} /></button>
                <span className="min-w-[4.5rem] text-center text-sm font-bold text-white">{t.servings === 0 ? 'Agotado' : `${t.servings} ración${t.servings === 1 ? '' : 'es'}`}</span>
                <button className="rounded-lg bg-slate-900 p-2 text-white" onClick={() => setServings(t.id, t.servings + 1)} aria-label="Una ración más"><Plus size={14} /></button>
              </div>
              <button className="btn btn-green !px-3 !py-2 text-xs" disabled={t.servings === 0} onClick={() => { update((s) => consumeTupper(s, t.id)); setDone(t.id); setTimeout(() => setDone(null), 1800); }}>
                {done === t.id ? <><Check size={14} strokeWidth={2} /> Añadida</> : <><UtensilsCrossed size={14} strokeWidth={1.75} /> Comer hoy</>}
              </button>
            </div>
          </div>
        ))}
      </div>
      {adding && <TupperModal onClose={() => setAdding(false)} />}
      {editing && <TupperModal key={editing.id} initial={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
