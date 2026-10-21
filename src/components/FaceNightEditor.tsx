import { ArrowDown, ArrowUp, Camera, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { useRef } from 'react';
import { defaultNightCfg, resolveNight, sideSeconds, type FaceNightCfg, type FaceStepCfg } from '../lib/faceYoga';
import { compressToBase64 } from '../lib/image';
import { useStore } from '../lib/store';
import { cx, uid } from '../lib/utils';
import { Modal, NumInput } from './ui';

/** Editor de la rutina de Face Yoga: añadir o quitar ejercicios (con foto), cambiar tiempos y marcar los que van por lados. */
export function FaceNightEditor({ onClose }: { onClose: () => void }) {
  const { state, update } = useStore();
  const cfg: FaceNightCfg = state.faceNight ?? defaultNightCfg();
  const run = resolveNight(cfg);
  const fileFor = useRef<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const save = (next: FaceNightCfg) => update((s) => ({ ...s, faceNight: next }));
  const patch = (id: string, p: Partial<FaceStepCfg>) => save({ ...cfg, steps: cfg.steps.map((k) => (k.id === id ? { ...k, ...p } : k)) });
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= cfg.steps.length) return;
    const steps = [...cfg.steps];
    [steps[i], steps[j]] = [steps[j], steps[i]];
    save({ ...cfg, steps });
  };
  const onFile = async (f: File | undefined) => {
    const id = fileFor.current;
    if (fileRef.current) fileRef.current.value = '';
    if (!f || !id) return;
    try {
      patch(id, { image: `data:image/jpeg;base64,${await compressToBase64(f, 480, 0.7)}` });
    } catch {
      /* imagen ilegible: se deja la anterior */
    }
  };
  const total = run.steps.reduce((a, s) => a + s.seconds, 0) + Math.max(0, run.steps.length - 1) * run.restSec;

  return (
    <Modal title="Editar Face Yoga" onClose={onClose}>
      <div className="space-y-3">
        <p className="text-xs text-slate-400">Duración total: {Math.floor(total / 60)} min {total % 60} s. Si un ejercicio va por lados, los segundos son totales y se reparten a mitades.</p>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />
        {cfg.steps.map((k, i) => {
          const r = run.steps[i];
          const [a, b] = sideSeconds(r.seconds);
          return (
            <div key={k.id} className="rounded-xl bg-slate-800 p-3">
              <div className="flex items-center gap-2">
                <button className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-slate-900 text-slate-500" onClick={() => { fileFor.current = k.id; fileRef.current?.click(); }} aria-label="Cambiar foto">
                  {r.image ? <img src={r.image} alt="" className="h-full w-full object-cover" /> : <Camera size={20} className="mx-auto" />}
                </button>
                <input className="field min-w-0 flex-1 !py-2 text-sm font-semibold" value={k.title ?? r.title} onChange={(e) => patch(k.id, { title: e.target.value })} aria-label="Nombre del ejercicio" />
                <div className="flex shrink-0 flex-col">
                  <button className="p-1 text-slate-300 disabled:opacity-30" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Subir"><ArrowUp size={15} /></button>
                  <button className="p-1 text-slate-300 disabled:opacity-30" disabled={i === cfg.steps.length - 1} onClick={() => move(i, 1)} aria-label="Bajar"><ArrowDown size={15} /></button>
                </div>
                <button className="shrink-0 p-1.5 text-red-400" onClick={() => { if (confirm(`¿Quitar «${r.title}» de la rutina?`)) save({ ...cfg, steps: cfg.steps.filter((x) => x.id !== k.id) }); }} aria-label="Quitar ejercicio"><Trash2 size={16} /></button>
              </div>
              <div className="mt-2 grid grid-cols-[1fr_auto] items-center gap-2">
                <button className={cx('rounded-lg px-3 py-2 text-xs font-semibold', k.sides ? 'bg-accent/15 text-accent' : 'bg-slate-900 text-slate-400')} aria-pressed={!!k.sides} onClick={() => patch(k.id, { sides: !k.sides })}>
                  {k.sides ? `✓ Un lado y luego el otro: ${a} s + ${b} s` : 'Un lado y luego el otro'}
                </button>
                <div className="flex items-center gap-1.5"><NumInput decimal={false} label="Segundos totales" value={k.seconds} className="h-9 w-16 rounded-lg bg-slate-900 text-center font-semibold text-white outline-none focus:ring-1 focus:ring-accent" onChange={(n) => patch(k.id, { seconds: n })} /><span className="text-xs text-slate-400">s</span></div>
              </div>
              {k.custom && <textarea className="field mt-2 !py-2 text-xs" rows={2} placeholder="Cómo se hace (opcional)" value={k.how ?? ''} onChange={(e) => patch(k.id, { how: e.target.value })} />}
              {k.image && <button className="mt-1 text-[11px] text-slate-400 underline" onClick={() => patch(k.id, { image: undefined })}>Quitar mi foto</button>}
            </div>
          );
        })}
        <button className="btn btn-blue w-full" onClick={() => save({ ...cfg, steps: [...cfg.steps, { id: `mi-${uid()}`, custom: true, title: 'Nuevo ejercicio', seconds: 30, sides: false }] })}><Plus size={16} /> Añadir ejercicio</button>
        <div className="flex items-center justify-between gap-2 rounded-xl bg-slate-800 p-3">
          <span className="text-sm text-slate-200">Descanso entre ejercicios</span>
          <div className="flex items-center gap-1.5"><NumInput decimal={false} label="Segundos de descanso" value={cfg.restSec} className="h-9 w-16 rounded-lg bg-slate-900 text-center font-semibold text-white outline-none focus:ring-1 focus:ring-accent" onChange={(n) => save({ ...cfg, restSec: n })} /><span className="text-xs text-slate-400">s</span></div>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-ghost flex-1 text-xs" onClick={() => { if (confirm('¿Volver a la rutina original (7 ejercicios de 60 s)? Se pierden tus cambios y fotos.')) update((s) => ({ ...s, faceNight: undefined })); }}><RotateCcw size={14} /> Rutina original</button>
          <button className="btn btn-green flex-1" onClick={onClose}>Listo</button>
        </div>
      </div>
    </Modal>
  );
}
