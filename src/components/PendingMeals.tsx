import { CloudOff, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { listQueue, processQueue, QUEUE_EVENT, removeQueued, type QueuedMeal } from '../lib/mealQueue';
import { learnFromMeal } from '../lib/mealCalc';
import { useStore } from '../lib/store';
import { inferSlot } from '../lib/templates';
import { uid } from '../lib/utils';
import type { Slot } from '../lib/types';
import { SlotPicker } from './SlotPicker';

/** Comidas fotografiadas sin conexión: las que esperan (se analizan solas) y las ya analizadas pendientes de sumar al día. */
export function PendingMeals() {
  const { state, update } = useStore();
  const [items, setItems] = useState<QueuedMeal[]>([]);
  const [slots, setSlots] = useState<Record<string, Slot>>({});
  const load = useCallback(async () => {
    try {
      setItems(await listQueue());
    } catch {
      setItems([]);
    }
  }, []);
  useEffect(() => {
    void load();
    window.addEventListener(QUEUE_EVENT, load);
    return () => window.removeEventListener(QUEUE_EVENT, load);
  }, [load]);

  if (items.length === 0) return null;
  const waiting = items.filter((i) => i.b64);
  const done = items.filter((i) => i.result);

  const add = async (q: QueuedMeal, out: boolean) => {
    const r = q.result;
    if (!r) return;
    update((s) => ({ ...s, calib: learnFromMeal(s.calib, r.desglose), meals: [...s.meals, { id: uid(), ts: q.ts, slot: slots[q.id] ?? inferSlot(q.ts), plato: r.plato, calorias: r.calorias, proteinas: r.proteinas, carbs: r.carbs, grasas: r.grasas, out: out || undefined }] }));
    await removeQueued(q.id);
  };

  return (
    <div className="space-y-2 rounded-xl bg-amber-500/10 p-3 text-xs">
      {waiting.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 font-semibold text-amber-500"><CloudOff size={14} /> {waiting.length} foto{waiting.length === 1 ? '' : 's'} esperando conexión</div>
          <p className="text-slate-300">Se analizan solas cuando vuelva internet y la foto se borra al analizarla.</p>
          {waiting.some((w) => w.error) && <p className="text-red-400">{waiting.find((w) => w.error)?.error}</p>}
          <button className="font-semibold text-accent" onClick={() => void processQueue(state)}>Reintentar ahora</button>
        </div>
      )}
      {done.map((q) => (
        <div key={q.id} className="space-y-1.5 rounded-lg bg-slate-900 p-2.5">
          <div className="font-semibold text-white">{q.result?.plato} · {q.result?.calorias} kcal</div>
          <div className="text-[11px] text-slate-400">P {q.result?.proteinas} · C {q.result?.carbs} · G {q.result?.grasas} · foto de las {new Date(q.ts).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</div>
          <SlotPicker value={slots[q.id] ?? inferSlot(q.ts)} onChange={(sl) => setSlots((c) => ({ ...c, [q.id]: sl }))} />
          <div className="grid grid-cols-[1fr_1fr_auto] gap-1.5">
            <button className="btn btn-green !py-1.5 text-[11px]" onClick={() => void add(q, false)}>Sumar (en casa)</button>
            <button className="btn btn-blue !py-1.5 text-[11px]" onClick={() => void add(q, true)}>Sumar (fuera)</button>
            <button className="btn btn-ghost !px-2.5 !py-1.5" onClick={() => void removeQueued(q.id)} aria-label="Descartar"><Trash2 size={13} /></button>
          </div>
        </div>
      ))}
    </div>
  );
}
