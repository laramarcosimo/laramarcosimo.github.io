import { Lightbulb } from 'lucide-react';
import { useState } from 'react';
import { dismissHabit, habitSuggestions } from '../lib/habits';
import { useStore } from '../lib/store';

/** Propuestas basadas en lo que haces de verdad: incluir un extra repetido o quitar lo que omites siempre. */
export function HabitSuggestions() {
  const { state, update } = useStore();
  const [tick, setTick] = useState(0);
  void tick;
  const list = habitSuggestions(state);
  if (list.length === 0) return null;
  const nameOf = (id: string) => state.exercises.find((e) => e.id === id)?.name ?? 'Ejercicio';
  const tplOf = (id: string) => state.templates.find((t) => t.id === id)?.title ?? 'la rutina';

  const apply = (h: (typeof list)[number]) => {
    update((s) => ({
      ...s,
      templates: s.templates.map((t) => {
        if (t.id !== h.templateId) return t;
        if (h.kind === 'remove') return { ...t, exercises: t.exercises.filter((e) => e.exerciseId !== h.exerciseId) };
        const ex = s.exercises.find((e) => e.id === h.exerciseId);
        const set = (side?: 'D' | 'I') => ({ type: 'normal' as const, weight: 0, reps: 0, side });
        const sets = ex?.unilateral ? Array.from({ length: 3 }, () => [set('I'), set('D')]).flat() : Array.from({ length: 3 }, () => set());
        return { ...t, exercises: [...t.exercises, { exerciseId: h.exerciseId, sets, unilateral: ex?.unilateral || undefined }] };
      }),
    }));
    dismissHabit(h.key);
    setTick((x) => x + 1);
  };
  const no = (key: string) => {
    dismissHabit(key);
    setTick((x) => x + 1);
  };

  return (
    <div className="space-y-2">
      {list.map((h) => (
        <div key={h.key} className="card !p-3">
          <div className="flex gap-2 text-sm text-slate-200">
            <Lightbulb size={16} strokeWidth={1.75} className="mt-0.5 shrink-0 text-amber-500" />
            <span>
              {h.kind === 'include' ? (
                <>Has añadido <b>{nameOf(h.exerciseId)}</b> a «{tplOf(h.templateId)}» {h.count} de tus últimas {h.total} sesiones. ¿Lo incluyo en la rutina?</>
              ) : (
                <>Has omitido <b>{nameOf(h.exerciseId)}</b> en «{tplOf(h.templateId)}» {h.count} de tus últimas {h.total} sesiones. ¿Lo quito de la rutina?</>
              )}
            </span>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button className="btn btn-blue !py-2 text-xs" onClick={() => apply(h)}>{h.kind === 'include' ? 'Incluir en la rutina' : 'Quitar de la rutina'}</button>
            <button className="btn btn-ghost !py-2 text-xs" onClick={() => no(h.key)}>No, déjalo como está</button>
          </div>
        </div>
      ))}
    </div>
  );
}
