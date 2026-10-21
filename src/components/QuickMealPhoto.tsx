import { Camera, ImagePlus, ShieldCheck, Sparkles } from 'lucide-react';
import { useRef, useState } from 'react';
import { deductFromPantry } from '../lib/pantry';
import { analyzePlate } from '../lib/plateAnalysis';
import { learnFromMeal } from '../lib/mealCalc';
import { enqueueMeal, isNetworkError } from '../lib/mealQueue';
import { PendingMeals } from './PendingMeals';
import { MealBreakdown } from './MealBreakdown';
import { AnalysisOptions } from './AnalysisOptions';
import { SlotPicker } from './SlotPicker';
import type { Slot } from '../lib/types';
import { compressToBase64 } from '../lib/image';
import { useStore } from '../lib/store';
import { inferSlot } from '../lib/templates';
import type { MealAnalysis } from '../lib/types';
import { uid } from '../lib/utils';
import { ErrorBox, MacroPill, Spinner } from './ui';

/** Registro rápido de una comida con foto: hacer la foto o subir una de la galería; la IA cuenta las calorías y se suma al día. */
export function QuickMealPhoto() {
  const { state, update } = useStore();
  const cam = useRef<HTMLInputElement>(null);
  const gal = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [result, setResult] = useState<MealAnalysis | null>(null);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [home, setHome] = useState(false); // comida en casa: pregunta qué descontar de la despensa
  const [picks, setPicks] = useState<string[]>([]);
  const [note, setNote] = useState(''); // descripción opcional del plato para afinar la estimación

  const onFile = async (f: File | undefined, input: HTMLInputElement | null, gallery = false) => {
    if (input) input.value = '';
    if (!f) return;
    setBusy(true);
    setErr('');
    setResult(null);
    setHome(false);
    let b64 = '';
    try {
      b64 = await compressToBase64(f); // solo en memoria (salvo que no haya conexión: espera en cola hasta analizarla)
      if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new Error('Failed to fetch');
      setSlot(gallery ? null : inferSlot(Date.now())); // la de la galería puede ser de otra hora: se pregunta
      setResult(await analyzePlate(state, b64, note));
      setNote('');
    } catch (e) {
      if (b64 && isNetworkError(e)) {
        await enqueueMeal(b64);
        setErr('Sin conexión: la foto espera y se analizará sola cuando vuelva internet (se borra al analizarla).');
      } else setErr(e instanceof Error ? e.message : 'Error desconocido');
    } finally {
      setBusy(false);
    }
  };

  const accept = (deduct: string[] = [], out = false) => {
    if (!result) return;
    update((s) => ({ ...s, calib: learnFromMeal(s.calib, result.desglose), pantry: deduct.length ? deductFromPantry(s.pantry, deduct) : s.pantry, meals: [...s.meals, { id: uid(), ts: Date.now(), slot: slot ?? inferSlot(Date.now()), plato: result.plato, calorias: result.calorias, proteinas: result.proteinas, carbs: result.carbs, grasas: result.grasas, out: out || undefined }] }));
    setResult(null);
    setHome(false);
  };

  const found = result?.coincidenciasDespensa ?? [];

  return (
    <div className="space-y-2">
      <AnalysisOptions note={note} setNote={setNote} busy={busy} />
      <div className="grid grid-cols-2 gap-2">
        <button className="btn btn-green !py-3.5" disabled={busy} onClick={() => cam.current?.click()}><Camera size={20} /> Foto de mi comida</button>
        <button className="btn btn-ghost !py-3.5" disabled={busy} onClick={() => gal.current?.click()}><ImagePlus size={20} /> Subir foto</button>
      </div>
      <input ref={cam} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => void onFile(e.target.files?.[0], cam.current)} />
      <input ref={gal} type="file" accept="image/*" className="hidden" onChange={(e) => void onFile(e.target.files?.[0], gal.current, true)} />
      <p className="flex items-center justify-center gap-1 text-[11px] text-slate-500"><ShieldCheck size={12} /> La foto no se guarda: solo vive en memoria durante el análisis.</p>
      <PendingMeals />
      {busy && <Spinner label="Analizando con Gemini…" />}
      {err && <ErrorBox msg={err} />}
      {result && (
        <div className="space-y-2 rounded-xl bg-slate-800 p-3">
          <div className="font-bold text-white">{result.plato}</div>
          <div className="text-2xl font-black text-fuel">{result.calorias} <span className="text-xs font-medium text-slate-400">kcal</span></div>
          <div className="flex gap-2">
            <MacroPill label="Prot" value={result.proteinas} color="text-accent" />
            <MacroPill label="Carbs" value={result.carbs} color="text-amber-400" />
            <MacroPill label="Grasas" value={result.grasas} color="text-pink-400" />
          </div>
          <MealBreakdown result={result} onChange={setResult} />
          {result.consejo && <p className="flex gap-2 rounded-lg bg-accent/10 p-2 text-xs text-slate-200"><Sparkles size={14} className="mt-0.5 shrink-0 text-accent" /> {result.consejo}</p>}
          {!home ? (
            <div className="space-y-2">
              <SlotPicker value={slot} onChange={setSlot} />
              <div className="text-xs font-semibold uppercase text-slate-400">¿Dónde la comiste?</div>
              <div className="grid grid-cols-2 gap-2">
                <button className="btn btn-green !py-2 text-xs" disabled={!slot} onClick={() => accept([], true)}>Fuera de casa</button>
                <button className="btn btn-blue !py-2 text-xs" disabled={!slot} onClick={() => { if (found.length === 0) accept([], false); else { setPicks(found); setHome(true); } }}>En casa</button>
              </div>
              <p className="text-[11px] text-slate-500">«Fuera de casa» solo suma las calorías. «En casa» además te deja descontar de la despensa lo que has usado.</p>
              <button className="w-full text-center text-xs text-slate-500 underline" onClick={() => setResult(null)}>Descartar</button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase text-slate-400">¿Qué descuento de tu despensa?</div>
              {found.map((n) => (
                <label key={n} className="flex items-center gap-3 rounded-lg bg-slate-900 px-3 py-2 text-sm text-slate-200">
                  <input type="checkbox" className="h-5 w-5 shrink-0" checked={picks.includes(n)} onChange={() => setPicks((c) => (c.includes(n) ? c.filter((x) => x !== n) : [...c, n]))} />
                  <span className="min-w-0 flex-1 truncate">{n}</span>
                </label>
              ))}
              <div className="grid grid-cols-2 gap-2">
                <button className="btn btn-ghost !py-2 text-xs" onClick={() => setHome(false)}>Atrás</button>
                <button className="btn btn-green !py-2 text-xs" onClick={() => accept(picks)}>{picks.length ? 'Sumar y descontar' : 'Sumar sin descontar'}</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
