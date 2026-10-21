import { Plus, Zap } from 'lucide-react';
import { ExerciseImage } from './ExerciseImage';
import type { Exercise, WorkoutExercise } from '../lib/types';
import { Hint } from './Hint';

const LOWER = ['Cuádriceps', 'Isquios', 'Glúteos', 'Gemelos'];
const LOWER_PICKS = ['cable-glute-kickback', 'Lying_Leg_Curls', 'Thigh_Abductor'];
const UPPER_PICKS = ['Face_Pull', 'cable-lateral-raise'];
const CORE_BLOCK = ['Plank', 'deadbug', 'pallof-press'];

/** Sección «Completar sesión» cuando la rutina se ha acabado antes de tiempo: 1 ejercicio coherente con el día + bloque de core. */
export function CompleteSession({ list, exOf, onAdd }: { list: WorkoutExercise[]; exOf: (id: string) => Exercise | undefined; onAdd: (ids: string[]) => void }) {
  const have = new Set(list.map((w) => w.exerciseId));
  const groups = list.map((w) => exOf(w.exerciseId)?.muscleGroup).filter((g): g is NonNullable<typeof g> => !!g && g !== 'Rostro y Cuello');
  const lower = groups.filter((g) => LOWER.includes(g)).length;
  const isLower = lower >= groups.length - lower;
  const pick = (isLower ? LOWER_PICKS : UPPER_PICKS).map(exOf).filter((e): e is Exercise => !!e && !have.has(e.id))[0];
  const core = CORE_BLOCK.map(exOf).filter((e): e is Exercise => !!e && !have.has(e.id));

  if (!pick && core.length === 0) return null;
  return (
    <div className="card space-y-3 !border-amber-500/40 !p-3">
      <div className="flex items-center gap-2 font-bold text-white"><Zap size={18} strokeWidth={1.75} className="text-amber-500" /> Completar sesión: ejercicios recomendados</div>
      <Hint className="text-xs text-slate-400">Has terminado antes de tiempo. Estas dos ideas encajan con tu sesión de hoy y se suman a tu volumen y tiempo.</Hint>

      {pick && (
        <div className="flex items-center gap-3 rounded-xl bg-slate-800 p-2.5">
          <ExerciseImage exerciseId={pick.id} size={48} />
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-bold uppercase text-slate-400">{isLower ? 'Día de pierna / glúteo' : 'Día de torso'} · 3 series</div>
            <div className="text-sm font-semibold leading-tight text-white">{pick.name}</div>
            <div className="text-[11px] text-slate-400">{isLower ? 'Accesorio seguro para tus rodillas' : 'Accesorio analítico para postura y hombro'}</div>
          </div>
          <button className="btn btn-blue shrink-0 !px-3 !py-2 text-xs" onClick={() => onAdd([pick.id])}><Plus size={14} /> Añadir</button>
        </div>
      )}

      {core.length > 0 && (
        <div className="rounded-xl bg-slate-800 p-2.5">
          <div className="mb-1.5 text-[10px] font-bold uppercase text-slate-400">Bloque de core · vientre plano y estabilidad · sin impacto ni compresión cervical</div>
          <ol className="mb-2 space-y-1 text-sm text-slate-200">
            {core.map((e, i) => <li key={e.id} className="flex gap-2"><span className="font-bold text-accent">{i + 1}</span><span>{e.name}</span></li>)}
          </ol>
          <button className="btn btn-green w-full !py-2.5 text-xs" onClick={() => onAdd(core.map((e) => e.id))}><Plus size={14} /> Añadir bloque de core a la sesión (3 series)</button>
        </div>
      )}
    </div>
  );
}
