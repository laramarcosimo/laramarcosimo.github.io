import { Camera, PlayCircle, RotateCcw, Trophy } from 'lucide-react';
import { useRef, useState } from 'react';
import { builtinImageUrl } from '../lib/exercises';
import { compressToBase64 } from '../lib/image';
import { useStore } from '../lib/store';
import { TechniqueModal } from './TechniqueModal';
import { techniqueTips } from '../lib/techniques';
import { targetsFor } from '../lib/muscles';
import { ExerciseImage } from './ExerciseImage';
import { ProgressChart } from './ExerciseProgress';
import { ErrorBox, Modal } from './ui';

export function ExerciseDetail({ exerciseId, onClose }: { exerciseId: string; onClose: () => void }) {
  const { state, update } = useStore();
  const ref = useRef<HTMLInputElement>(null);
  const [err, setErr] = useState('');
  const [demo, setDemo] = useState(false);
  const ex = state.exercises.find((e) => e.id === exerciseId);
  if (!ex) return null;
  const isBuiltin = !ex.custom;
  const edited = ex.imageUrl.startsWith('data:');
  const setImage = (url: string) => update((s) => ({ ...s, exercises: s.exercises.map((e) => (e.id === ex.id ? { ...e, imageUrl: url } : e)) }));

  const onFile = async (f: File | undefined) => {
    if (ref.current) ref.current.value = '';
    if (!f) return;
    try {
      setImage(`data:image/jpeg;base64,${await compressToBase64(f, 520, 0.82)}`);
      setErr('');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'No se pudo cargar la imagen');
    }
  };

  const r = ex.personalRecords;
  return (
    <Modal title={ex.name} onClose={onClose}>
      <ExerciseImage exerciseId={ex.id} size={320} className="mx-auto !h-auto aspect-square !w-full max-w-xs" />
      <p className="mt-2 text-center text-sm text-slate-400">{ex.muscleGroup} · {ex.equipment}</p>
      {ex.instructions && <p className="mt-3 rounded-xl bg-slate-800 p-3 text-sm leading-relaxed text-slate-300">{ex.instructions}</p>}
      {ex.tips && <ul className="mt-2 space-y-1.5 rounded-xl bg-slate-800/60 p-3 text-xs text-slate-300">{ex.tips.map((t, i) => <li key={i} className="flex gap-2"><span className="font-bold text-accent">{i + 1}</span><span>{t}</span></li>)}</ul>}
      {r.maxWeight > 0 && (
        <div className="mt-3 flex items-center justify-center gap-3 rounded-xl bg-amber-500/10 p-2 text-xs text-amber-500">
          <Trophy size={14} /> Máx {r.maxWeight} kg · Mejor serie {Math.round(r.maxVolume)} kg · 1RM est. {r.best1RM} kg
        </div>
      )}
      <button className="btn btn-ghost mt-3 w-full" onClick={() => setDemo(true)}><PlayCircle size={16} /> Ver técnica</button>
      {demo && <TechniqueModal title={ex.name} imageUrl={ex.imageUrl} muscles={[ex.muscleGroup]} bm={targetsFor(ex).primary} bmSecondary={targetsFor(ex).secondary} equipment={ex.equipment} tips={techniqueTips(ex)} demoKey={ex.id} onClose={() => setDemo(false)} />}
      <div className="mt-4"><div className="label">Progreso</div><ProgressChart exerciseId={ex.id} /></div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button className="btn btn-blue" onClick={() => ref.current?.click()}><Camera size={16} /> {edited ? 'Cambiar imagen' : 'Subir mi imagen'}</button>
        <button className="btn btn-ghost" disabled={!edited || !isBuiltin} onClick={() => setImage(builtinImageUrl(ex.id))}><RotateCcw size={16} /> Restaurar</button>
      </div>
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />
      {err && <div className="mt-3"><ErrorBox msg={err} /></div>}
    </Modal>
  );
}
