import { BarChart3 } from 'lucide-react';
import { isCardio } from '../lib/exercises';
import { useState } from 'react';
import { useStore } from '../lib/store';
import type { MuscleGroup } from '../lib/types';
import { cx } from '../lib/utils';
import { Hint } from './Hint';

const GROUPS: MuscleGroup[] = ['Pecho', 'Espalda', 'Hombros', 'Bíceps', 'Tríceps', 'Cuádriceps', 'Isquios', 'Glúteos', 'Gemelos', 'Abdominales'];
const DAY = 86400000;
const GOAL = 10; // series semanales por músculo: rango efectivo 8-16 para tonificar/hipertrofia

/** Series de trabajo de los últimos 7 días por grupo muscular, para ver qué se descuida. */
export function MuscleBalance() {
  const { state } = useStore();
  const [now] = useState(() => Date.now());
  const counts = new Map<MuscleGroup, number>();
  for (const w of state.workouts) {
    if (now - Date.parse(w.startTime) > 7 * DAY) continue;
    for (const e of w.exercises) if (!isCardio({ id: e.exerciseId, name: e.name })) counts.set(e.muscleGroup, (counts.get(e.muscleGroup) ?? 0) + e.sets.filter((s) => s.type !== 'warmup').length);
  }
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  const low = GROUPS.filter((g) => (counts.get(g) ?? 0) < 6);
  const max = Math.max(GOAL * 1.6, ...GROUPS.map((g) => counts.get(g) ?? 0));

  return (
    <div className="card space-y-3">
      <div className="flex items-center gap-2 font-bold text-white"><BarChart3 size={18} strokeWidth={1.5} className="text-accent" /> Balance semanal por músculo</div>
      {total === 0 ? (
        <p className="text-sm text-slate-500">Aún no hay series en los últimos 7 días.</p>
      ) : (
        <>
          <div className="space-y-1.5">
            {GROUPS.map((g) => {
              const n = counts.get(g) ?? 0;
              const tone = n < 6 ? 'bg-amber-500' : n <= 16 ? 'bg-emerald-500' : 'bg-red-400';
              return (
                <div key={g} className="flex items-center gap-2 text-xs">
                  <span className="w-20 shrink-0 text-slate-300">{g}</span>
                  <div className="relative h-2.5 flex-1 rounded-full bg-slate-800">
                    <div className={cx('h-full rounded-full', tone)} style={{ width: `${Math.min(100, (n / max) * 100)}%` }} />
                    <div className="absolute top-[-2px] h-[14px] w-px bg-slate-500" style={{ left: `${(GOAL / max) * 100}%` }} />
                  </div>
                  <span className="w-6 text-right tabular-nums text-slate-400">{n}</span>
                </div>
              );
            })}
          </div>
          <Hint className="text-[11px] text-slate-500">Series de trabajo en 7 días. La marca es la referencia de {GOAL} series; verde = rango efectivo (6-16), ámbar = poco.</Hint>
          {low.length > 0 && <p className="text-sm text-amber-500">Te falta volumen en: {low.join(', ')}.{low.includes('Abdominales') ? ' Los abdominales son clave para tu objetivo.' : ''}</p>}
        </>
      )}
    </div>
  );
}
