import { Camera, ImagePlus, ShieldCheck, Sparkles } from 'lucide-react';
import { useRef, useState } from 'react';
import { analyzePlate } from '../lib/plateAnalysis';
import { learnFromMeal } from '../lib/mealCalc';
import { enqueueMeal, isNetworkError } from '../lib/mealQueue';
import { PendingMeals } from './PendingMeals';
import { compressToBase64 } from '../lib/image';
import { dayBalance } from '../lib/metabolic';
import { deductFromPantry } from '../lib/pantry';
import { useStore } from '../lib/store';
import { SUPERMARKETS } from '../lib/stores';
import { inferSlot } from '../lib/templates';
import type { Meal, MealAnalysis, Slot } from '../lib/types';
import { looseMatch, uid } from '../lib/utils';
import { AddToSlotModal } from './AddToSlotModal';
import { Blocks } from './Blocks';
import { DislikesCard } from './DislikesCard';
import { DayBars } from './DayBars';
import { SLOTS } from '../lib/templates';
import { EditMealModal } from './EditMealModal';
import { TemplateModal, type TemplateDraft } from './MealTemplates';
import { ErrorBox, MacroPill, Modal, Spinner } from './ui';
import { MealBreakdown } from './MealBreakdown';
import { AdaptiveTdeeCard } from './AdaptiveTdeeCard';
import { ReliabilityCard } from './ReliabilityCard';
import { RepeatedMealsCard } from './RepeatedMealsCard';
import { DoubleReadToggle } from './DoubleReadToggle';
import { Hint } from './Hint';
import { DayPlanner } from './DayPlanner';
import { WeeklyCoach } from './WeeklyCoach';
import { MenuPhoto } from './MenuPhoto';
import { SlotPicker } from './SlotPicker';

/** Diario de hoy: balance, foto del plato y lo comido agrupado por tomas. */
export function DiaryTab() {
  const { state, update } = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(''); // descripción opcional del plato para afinar la estimación
  const [err, setErr] = useState('');
  const [result, setResult] = useState<MealAnalysis | null>(null);
  const [confirmPantry, setConfirmPantry] = useState<{ picks: string[]; names: string[] } | null>(null);
  const [slotFor, setSlotFor] = useState<Slot | null>(null);
  const [adding, setAdding] = useState<Slot | null>(null);
  const [editing, setEditing] = useState<Meal | null>(null);
  const [draft, setDraft] = useState<TemplateDraft | null>(null);
  const [outside, setOutside] = useState(false);
  const [pickSlot, setPickSlot] = useState<Slot | null>(null);

  const b = dayBalance(state);

  const onFile = async (f: File | undefined, gallery = false) => {
    if (fileRef.current) fileRef.current.value = '';
    if (galleryRef.current) galleryRef.current.value = '';
    if (!f) return;
    setBusy(true);
    setErr('');
    setResult(null);
    let queued: string | null = null;
    try {
      // El Base64 vive solo en esta función (RAM volátil) y se descarta al terminar (salvo sin conexión: espera en cola).
      let b64: string | null = await compressToBase64(f);
      queued = b64;
      if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new Error('Failed to fetch');
      const r = await analyzePlate(state, b64, note);
      setNote('');
      b64 = null;
      setResult(r);
      // Una foto de la galería puede ser de otra hora: se pregunta a qué comida va. La de cámara parte de la hora actual.
      setPickSlot(slotFor ?? (gallery ? null : inferSlot(Date.now())));
    } catch (e) {
      if (queued && isNetworkError(e)) {
        await enqueueMeal(queued);
        setErr('Sin conexión: la foto espera y se analizará sola cuando vuelva internet (se borra al analizarla).');
      } else setErr(e instanceof Error ? e.message : 'Error desconocido');
    } finally {
      setBusy(false);
    }
  };

  const accept = () => {
    if (!result) return;
    const slot = pickSlot ?? slotFor ?? inferSlot(Date.now());
    update((s) => ({ ...s, calib: learnFromMeal(s.calib, result.desglose), meals: [...s.meals, { id: uid(), ts: Date.now(), slot, plato: result.plato, calorias: result.calorias, proteinas: result.proteinas, carbs: result.carbs, grasas: result.grasas, out: outside || undefined }] }));
    setOutside(false);
    if (result.coincidenciasDespensa.length > 0) setConfirmPantry({ picks: result.coincidenciasDespensa, names: result.coincidenciasDespensa });
    setResult(null);
    setSlotFor(null);
  };

  const photoFor = (slot: Slot | null, gallery = false) => {
    setSlotFor(slot);
    (gallery ? galleryRef : fileRef).current?.click();
  };

  const balance = <DayBars b={b} />;

  const photo = (
    <div className="space-y-2">
      <textarea value={note} onChange={(e) => setNote(e.target.value.slice(0, 400))} rows={2} disabled={busy} aria-label="Describe qué lleva el plato (opcional)" placeholder="Opcional: cuéntale qué lleva (ej. 150 g de pollo a la plancha, arroz con aceite de oliva…) para que sea más preciso" className="w-full resize-none rounded-xl bg-slate-800 px-3 py-2 text-sm text-white outline-none ring-1 ring-slate-700 placeholder:text-slate-500 focus:ring-accent" />
      <DoubleReadToggle />
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <button className="btn btn-green !py-4 text-base" disabled={busy} onClick={() => photoFor(null)}><Camera size={22} /> Fotografiar plato</button>
        <button className="btn btn-ghost !px-4 !py-4" disabled={busy} onClick={() => photoFor(null, true)} aria-label="Subir una foto de la galería"><ImagePlus size={22} /></button>
      </div>
      <Hint className="flex items-center justify-center gap-1 text-[11px] text-slate-500"><ShieldCheck size={12} /> La foto no se guarda: solo vive en memoria durante el análisis (sin conexión espera en el móvil y se borra al analizarla).</Hint>
      <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />
      <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={(e) => void onFile(e.target.files?.[0], true)} />
      <PendingMeals />
      <RepeatedMealsCard />
      {busy && <Spinner label="Analizando con Gemini…" />}
      {err && <ErrorBox msg={err} />}
      {result && (
        <div className="card space-y-3 border-fuel/40">
          <div className="text-lg font-bold text-white">{result.plato}</div>
          <div className="text-3xl font-black text-fuel">{result.calorias} <span className="text-sm font-medium text-slate-400">kcal</span></div>
          <div className="flex gap-2">
            <MacroPill label="Prot" value={result.proteinas} color="text-accent" />
            <MacroPill label="Carbs" value={result.carbs} color="text-amber-400" />
            <MacroPill label="Grasas" value={result.grasas} color="text-pink-400" />
          </div>
          <MealBreakdown result={result} onChange={setResult} />
          {result.consejo && <p className="flex gap-2 rounded-xl bg-accent/10 p-3 text-sm text-slate-200"><Sparkles size={16} strokeWidth={1.5} className="mt-0.5 shrink-0 text-accent" /> {result.consejo}</p>}
          <SlotPicker value={pickSlot} onChange={setPickSlot} />
          <label className="flex items-center gap-2 text-xs text-slate-300"><input type="checkbox" className="h-4 w-4" checked={outside} onChange={(e) => setOutside(e.target.checked)} /> Comida fuera de casa</label>
          <div className="grid grid-cols-2 gap-2">
            <button className="btn btn-ghost" onClick={() => { setResult(null); setSlotFor(null); }}>Descartar</button>
            <button className="btn btn-green" disabled={!pickSlot} onClick={accept}>Sumar al día</button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
      <DayPlanner
        onAdd={setAdding}
        onEditMeal={setEditing}
        render={({ head, slots, modals }) => (
          <>
            <Blocks
              page="nutri-diario"
              replaces={{ tomas: ['tomas', ...SLOTS.map((s) => 'toma-' + s.id)] }}
              items={{ balance, foto: photo, carta: <div className="card"><MenuPhoto /></div>, tomas: head, ...Object.fromEntries(SLOTS.map((s) => ['toma-' + s.id, slots[s.id]])), nogusta: <DislikesCard />, semana: <><WeeklyCoach /><AdaptiveTdeeCard /><ReliabilityCard /></> }}
            />
            {modals}
          </>
        )}
      />

      {adding && <AddToSlotModal slot={adding} onClose={() => setAdding(null)} onPhoto={(gallery) => photoFor(adding, gallery)} />}
      {editing && <EditMealModal meal={editing} onClose={() => setEditing(null)} onSaveTemplate={(m) => setDraft({ name: m.plato, calorias: m.calorias, proteinas: m.proteinas, carbs: m.carbs, grasas: m.grasas, ingredientes: [] })} />}
      {draft && <TemplateModal initial={draft} onClose={() => setDraft(null)} />}
      {confirmPantry && (
        <Modal title="¿Has usado estos productos de tu despensa?" onClose={() => setConfirmPantry(null)}>
          <div className="mb-4 space-y-2">
            {confirmPantry.names.map((n) => {
              const on = confirmPantry.picks.includes(n);
              return (
                <div key={n} className="flex items-center gap-3 rounded-xl bg-slate-800 px-3 py-2.5 text-sm">
                  <input type="checkbox" className="h-5 w-5 shrink-0" checked={on} onChange={() => setConfirmPantry({ ...confirmPantry, picks: on ? confirmPantry.picks.filter((x) => x !== n) : [...confirmPantry.picks, n] })} />
                  <span className="min-w-0 flex-1 truncate">{n}</span>
                  <select aria-label="Supermercado" className="max-w-[7.5rem] rounded-lg bg-slate-900 px-1.5 py-1 text-xs text-slate-300" value={state.pantry.find((p) => looseMatch(p.name, n))?.store ?? state.defaultSupermarket} onChange={(e) => update((s) => ({ ...s, pantry: s.pantry.map((p) => (looseMatch(p.name, n) ? { ...p, store: e.target.value } : p)) }))}>
                    {[...new Set([...SUPERMARKETS.map((x) => x.name), ...state.supermarkets, state.defaultSupermarket])].map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              );
            })}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button className="btn btn-ghost" onClick={() => setConfirmPantry(null)}>No</button>
            <button className="btn btn-green" onClick={() => { update((s) => ({ ...s, pantry: deductFromPantry(s.pantry, confirmPantry.picks) })); setConfirmPantry(null); }}>Descontar</button>
          </div>
        </Modal>
      )}
    </>
  );
}
