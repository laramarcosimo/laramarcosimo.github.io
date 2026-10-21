import { Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { suggestAlternatives } from '../lib/gemini';
import { feasibleAtHome } from '../lib/homeSwap';
import { describeGear } from '../lib/homeSwap';
import { localAlternatives } from '../lib/liveCoach';
import { avoidFilter, JOINTS, recentJoints } from '../lib/joints';
import { useStore } from '../lib/store';
import { uid } from '../lib/utils';
import type { Exercise, Location } from '../lib/types';
import { ExerciseImage } from './ExerciseImage';
import { ErrorBox, Modal, Spinner } from './ui';
import { Hint } from './Hint';

interface Alt { ex: Exercise; motivo: string }

/** «Sugerir ejercicio alternativo»: el coach propone 3 sustitutos viables (material de casa y rodilla protegida). */
export function AltExercise({ exercise, location, onPick, onClose }: { exercise: Exercise; location: Location; onPick: (id: string) => void; onClose: () => void }) {
  const { state, update } = useStore();
  const [alts, setAlts] = useState<Alt[] | null>(null);
  const [err, setErr] = useState('');
  const home = location === 'home';
  const [reason, setReason] = useState('');
  const [askJoint, setAskJoint] = useState(false);

  useEffect(() => {
    if (!reason) return;
    let cancelled = false;
    const pool = localAlternatives(exercise, state.exercises, { kneeSafe: state.settings.kneeSafe, feasible: home ? (e) => feasibleAtHome(e, state.homeGear) : undefined, allowed: avoidFilter(recentJoints(state.discomfort)) });
    const local = (): Alt[] => pool.slice(0, 2).map((ex) => ({ ex, motivo: `Mismo músculo (${ex.muscleGroup}) con ${ex.equipment.toLowerCase()}.` }));
    void (async () => {
      if (pool.length === 0) return setAlts([]);
      try {
        if (!state.settings.geminiKey.trim()) throw new Error('sin clave');
        const res = await suggestAlternatives(
          state.settings,
          { nombre: exercise.name, musculo: exercise.muscleGroup, equipo: exercise.equipment },
          pool.slice(0, 40).map((e) => ({ id: e.id, name: e.name, equipment: e.equipment })),
          { home, gear: describeGear(state.homeGear, state.homeSpecs), kneeSafe: state.settings.kneeSafe || recentJoints(state.discomfort).includes('Rodilla'), reason: recentJoints(state.discomfort).length ? `${reason}. Molestias recientes a respetar: ${recentJoints(state.discomfort).join(', ')}` : reason },
        );
        const out = res.map((r) => ({ ex: pool.find((e) => e.id === r.id)!, motivo: r.motivo })).filter((a) => a.ex);
        if (!cancelled) setAlts(out.length ? out : local());
      } catch (e) {
        if (!cancelled) {
          setAlts(local());
          if (e instanceof Error && e.message !== 'sin clave') setErr('No se pudo consultar al coach: te muestro opciones del mismo músculo.');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reason]);

  const REASONS: [string, string][] = home
    ? [['Falta material en casa', 'No tengo el material para este ejercicio en casa'], ['Molestia en una articulación', '']]
    : [['Máquina ocupada', 'La máquina o el material está ocupado en el gimnasio'], ['Molestia en una articulación', '']];


  return (
    <Modal title="Pedir alternativa al Coach" onClose={onClose}>
      <Hint className="mb-3 text-xs text-slate-400">Sustituir <b className="text-slate-200">{exercise.name}</b>{state.settings.kneeSafe ? ' · sin impacto ni apoyo de rodilla' : ''}{home ? ' · solo con tu material de casa' : ''}.</Hint>
      {!reason && !askJoint && (
        <div className="space-y-2">
          <p className="text-sm text-slate-300">¿Por qué quieres cambiarlo?</p>
          {REASONS.map(([label, r]) => (
            <button key={label} className="btn btn-ghost w-full" onClick={() => (r ? setReason(r) : setAskJoint(true))}>{label}</button>
          ))}
        </div>
      )}
      {!reason && askJoint && (
        <div>
          <p className="mb-2 text-sm text-slate-300">¿Qué articulación te molesta hoy?</p>
          <div className="grid grid-cols-2 gap-2">
            {JOINTS.map((j) => <button key={j} className="btn btn-ghost" onClick={() => { update((s) => ({ ...s, discomfort: [...s.discomfort, { id: uid(), ts: Date.now(), joint: j, exerciseName: exercise.name }] })); setReason(`Me molesta la articulación: ${j.toLowerCase()}. Debe trabajar el mismo músculo sin cargarla ni provocar dolor`); }}>{j}</button>)}
          </div>
        </div>
      )}
      {reason && alts === null && <Spinner label="El coach está eligiendo…" />}
      {err && <ErrorBox msg={err} />}
      {reason && alts?.length === 0 && <p className="text-sm text-slate-500">No hay alternativas compatibles en la biblioteca. Prueba a añadir un ejercicio propio.</p>}
      <div className="space-y-2">
        {reason && alts?.map(({ ex, motivo }) => (
          <div key={ex.id} className="flex items-center gap-3 rounded-xl bg-slate-800 p-2.5">
            <ExerciseImage exerciseId={ex.id} size={48} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1 text-sm font-semibold text-white"><Sparkles size={12} className="text-accent" /> {ex.name}</div>
              <div className="text-[11px] text-slate-400">{ex.muscleGroup} · {ex.equipment}</div>
              <div className="text-xs text-slate-300">{motivo}</div>
            </div>
            <button className="btn btn-blue !px-3 !py-1.5 text-xs" onClick={() => onPick(ex.id)}>Usar</button>
          </div>
        ))}
      </div>
    </Modal>
  );
}
