import { Camera, ImagePlus, Plus, Utensils } from 'lucide-react';
import { useRef, useState } from 'react';
import { goalContext } from '../lib/coach';
import { analyzeMenu, type MenuAdvice, type MenuPick } from '../lib/gemini';
import { compressToBase64 } from '../lib/image';
import { dayBalance } from '../lib/metabolic';
import { useStore } from '../lib/store';
import { inferSlot } from '../lib/templates';
import { uid } from '../lib/utils';
import { ErrorBox, Spinner } from './ui';

/** «Foto de la carta»: en un restaurante, la IA ordena los platos que mejor encajan con lo que te queda hoy y cómo pedirlos. */
export function MenuPhoto() {
  const { state, update } = useStore();
  const cam = useRef<HTMLInputElement>(null);
  const gal = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [advice, setAdvice] = useState<MenuAdvice | null>(null);
  const [added, setAdded] = useState<string[]>([]);

  const onFile = async (f: File | undefined, input: HTMLInputElement | null) => {
    if (input) input.value = '';
    if (!f) return;
    setBusy(true);
    setErr('');
    setAdvice(null);
    setAdded([]);
    try {
      const b64 = await compressToBase64(f, 1280, 0.8); // la carta tiene letra pequeña: algo más de resolución. No se guarda.
      setAdvice(await analyzeMenu(state.settings, b64, goalContext(state, dayBalance(state))));
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'No se pudo leer la carta.');
    } finally {
      setBusy(false);
    }
  };

  const add = (o: MenuPick) => {
    update((s) => ({ ...s, meals: [...s.meals, { id: uid(), ts: Date.now(), slot: inferSlot(Date.now()), plato: o.nombre, calorias: o.calorias, proteinas: o.proteinas, carbs: o.carbs, grasas: o.grasas, out: true }] }));
    setAdded((c) => [...c, o.nombre]);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-bold text-white"><Utensils size={16} className="text-accent" /> Comer fuera: foto de la carta</div>
      <div className="grid grid-cols-2 gap-2">
        <button className="btn btn-ghost !py-3" disabled={busy} onClick={() => cam.current?.click()}><Camera size={18} /> Foto de la carta</button>
        <button className="btn btn-ghost !py-3" disabled={busy} onClick={() => gal.current?.click()}><ImagePlus size={18} /> Subir foto</button>
      </div>
      <input ref={cam} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => void onFile(e.target.files?.[0], cam.current)} />
      <input ref={gal} type="file" accept="image/*" className="hidden" onChange={(e) => void onFile(e.target.files?.[0], gal.current)} />
      {busy && <Spinner label="Leyendo la carta…" />}
      {err && <ErrorBox msg={err} />}
      {advice && (
        <div className="space-y-2 rounded-xl bg-slate-800 p-3 text-sm">
          <div className="text-xs font-semibold uppercase text-slate-400">Lo que mejor te encaja hoy</div>
          {advice.opciones.map((o, i) => (
            <div key={o.nombre} className="space-y-1 rounded-lg bg-slate-900 p-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 font-semibold text-white">{i + 1}. {o.nombre}</div>
                <div className="shrink-0 text-xs text-slate-300">{o.calorias} kcal</div>
              </div>
              <div className="text-[11px] text-slate-400">P {o.proteinas} · C {o.carbs} · G {o.grasas}</div>
              <p className="text-xs text-slate-200">{o.motivo}</p>
              {o.pedir && <p className="text-xs text-emerald-400">Pídelo así: {o.pedir}</p>}
              <button className="flex items-center gap-1 rounded-full bg-accent px-3 py-1 text-xs font-semibold text-white disabled:opacity-50" disabled={added.includes(o.nombre)} onClick={() => add(o)}><Plus size={12} /> {added.includes(o.nombre) ? 'Añadido al diario' : 'Lo pido: añadir al diario'}</button>
            </div>
          ))}
          {advice.evitar.length > 0 && <p className="text-xs text-amber-500">Mejor evitar: {advice.evitar.join(' · ')}</p>}
          {advice.consejo && <p className="text-xs text-slate-300">{advice.consejo}</p>}
          <p className="text-[11px] text-slate-500">Estimación orientativa de raciones de restaurante. La foto no se guarda.</p>
        </div>
      )}
    </div>
  );
}
