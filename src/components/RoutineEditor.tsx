import { ArrowDown, ArrowUp, Camera, GripVertical, MoreVertical, Plus, Repeat, Sparkles, Trash2, Video, X } from 'lucide-react';
import { BUILTIN_EXERCISES } from '../lib/exercises';
import { compressToBase64 } from '../lib/image';
import { useScrollLock } from '../lib/scrollLock';
import { normalizePairs } from '../lib/workout';
import { useRef, useState } from 'react';
import { useStore } from '../lib/store';
import type { Location, RoutineTemplate, SetType } from '../lib/types';
import { cx, sideLetter, uid } from '../lib/utils';
import { SET_BADGE, SET_LABEL, SET_TYPES } from '../lib/workout';
import { ExerciseImage } from './ExerciseImage';
import { ExercisePicker } from './ExercisePicker';
import { VideoFormCheck } from './VideoFormCheck';
import { RoutineAudit } from './RoutineAudit';
import { NumInput } from './ui';
import { ExerciseTargets, byTimeOf, defaultExtras, isCore } from './ExerciseTargets';

export const BADGE_STYLE: Record<SetType, string> = {
  normal: 'bg-slate-800 text-slate-300',
  warmup: 'bg-orange-500/20 text-orange-500',
  dropset: 'bg-blue-500/20 text-blue-500',
  failure: 'bg-red-500/20 text-red-500',
};

const next = (t: SetType): SetType => SET_TYPES[(SET_TYPES.indexOf(t) + 1) % SET_TYPES.length];

/** Pantalla completa para crear o editar una plantilla de rutina. */
export function RoutineEditor({ initial, location = 'gym', onClose }: { initial?: RoutineTemplate; location?: Location; onClose: () => void }) {
  useScrollLock();
  const { state, update } = useStore();
  const [tpl, setTpl] = useState<RoutineTemplate>(() => initial ?? { id: uid(), title: '', folder: '', notes: '', exercises: [] });
  const [picker, setPicker] = useState<{ replace: number | null } | null>(null);
  const [audit, setAudit] = useState<{ saving: boolean } | null>(null);
  const [menuIdx, setMenuIdx] = useState<number | null>(null);
  const [videoFor, setVideoFor] = useState<string | null>(null);
  const [audited, setAudited] = useState(false);
  const [dragging, setDragging] = useState<number | null>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  // Foto propia del ejercicio (de la galería): sustituye a la miniatura en la rutina y en el catálogo.
  const photoFor = useRef<string | null>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const onPhoto = async (f: File | undefined) => {
    const id = photoFor.current;
    if (photoRef.current) photoRef.current.value = '';
    if (!f || !id) return;
    try {
      const img = `data:image/jpeg;base64,${await compressToBase64(f, 480, 0.75)}`;
      update((s) => ({ ...s, exercises: s.exercises.map((e) => (e.id === id ? { ...e, imageUrl: img, imageNote: undefined } : e)) }));
    } catch {
      /* imagen ilegible: se conserva la anterior */
    }
  };
  const resetPhoto = (id: string) => update((s) => ({ ...s, exercises: s.exercises.map((e) => (e.id === id ? { ...e, imageUrl: BUILTIN_EXERCISES.find((b) => b.id === id)?.imageUrl ?? '', imageNote: BUILTIN_EXERCISES.find((b) => b.id === id)?.imageNote } : e)) }));
  const nameOf = (id: string) => state.exercises.find((e) => e.id === id)?.name ?? 'Ejercicio';

  const patchEx = (i: number, fn: (e: RoutineTemplate['exercises'][number]) => RoutineTemplate['exercises'][number]) =>
    setTpl((t) => ({ ...t, exercises: t.exercises.map((e, k) => { if (k !== i) return e; const r = fn(e); return r.unilateral && r.sets.some((x) => x.side) ? { ...r, sets: normalizePairs(r.sets) } : r; }) }));
  const move = (i: number, d: -1 | 1) =>
    setTpl((t) => {
      const j = i + d;
      if (j < 0 || j >= t.exercises.length) return t;
      const ex = [...t.exercises];
      [ex[i], ex[j]] = [ex[j], ex[i]];
      return { ...t, exercises: ex };
    });

  // Arrastrar y soltar desde el asa: la tarjeta sigue al dedo y se recoloca al pasar sobre otra.
  const startDrag = (e: React.PointerEvent, from: number) => {
    e.preventDefault();
    let cur = from;
    setDragging(from);
    const onMove = (ev: PointerEvent) => {
      const rects = cardRefs.current.map((el) => el?.getBoundingClientRect());
      const over = rects.findIndex((r) => r && ev.clientY >= r.top && ev.clientY <= r.bottom);
      if (over >= 0 && over !== cur) {
        const a = cur;
        cur = over;
        setTpl((t) => {
          const ex = [...t.exercises];
          const [it] = ex.splice(a, 1);
          ex.splice(over, 0, it);
          return { ...t, exercises: ex };
        });
        setDragging(over);
      }
    };
    const end = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
      setDragging(null);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
  };

  const save = (t: RoutineTemplate = tpl) => {
    const clean = { ...t, title: t.title.trim(), folder: t.folder?.trim() || undefined, notes: t.notes?.trim() || undefined };
    update((s) => ({ ...s, templates: s.templates.some((t) => t.id === clean.id) ? s.templates.map((t) => (t.id === clean.id ? clean : t)) : [...s.templates, clean] }));
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-slate-950">
      <div className="flex items-center justify-between border-b border-slate-800 px-4 pb-3" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 10px)' }}>
        <button onClick={onClose} className="rounded-full bg-slate-800 p-2" aria-label="Cerrar"><X size={18} /></button>
        <h2 className="font-bold text-white">{initial ? 'Editar rutina' : 'Nueva rutina'}</h2>
        <span className="w-9" />
      </div>

      <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={(e) => void onPhoto(e.target.files?.[0])} />
      <div className="flex-1 space-y-3 overflow-y-auto overscroll-contain p-4 pb-32" onClick={() => setMenuIdx(null)}>
        <input className="field !text-lg font-bold" placeholder="Nombre de la rutina (ej: Push Day A)" value={tpl.title} onChange={(e) => setTpl({ ...tpl, title: e.target.value })} />
        <div className="grid grid-cols-2 gap-2">
          <input className="field" placeholder="Carpeta (opcional)" value={tpl.folder ?? ''} onChange={(e) => setTpl({ ...tpl, folder: e.target.value })} />
          <input className="field" placeholder="Notas (opcional)" value={tpl.notes ?? ''} onChange={(e) => setTpl({ ...tpl, notes: e.target.value })} />
        </div>

        {tpl.exercises.map((ex, i) => (
          <div key={i} ref={(el) => { cardRefs.current[i] = el; }} className={cx('card !p-3 transition', dragging === i && 'ring-2 ring-accent')}>
            <div className="mb-3 flex items-center gap-2.5">
              <button className="touch-none cursor-grab p-1 text-slate-500" onPointerDown={(e) => startDrag(e, i)} aria-label="Arrastrar para reordenar"><GripVertical size={18} /></button>
              <ExerciseImage exerciseId={ex.exerciseId} size={44} />
              <div className="min-w-0 flex-1">
                <div className="line-clamp-2 text-[15px] font-bold leading-snug text-accent">{nameOf(ex.exerciseId)}</div>
                <div className="mt-0.5 text-xs text-slate-500">{state.exercises.find((e) => e.id === ex.exerciseId)?.muscleGroup}{ex.unilateral ? ' · una pierna' : ''}{ex.restSec ? ` · descanso ${ex.restSec} s` : ''}</div>
              </div>
              <div className="relative">
                <button className="p-2 text-slate-400" onClick={(e) => { e.stopPropagation(); setMenuIdx(menuIdx === i ? null : i); }} aria-label="Opciones del ejercicio"><MoreVertical size={18} /></button>
                {menuIdx === i && (
                  <div className="absolute right-0 top-9 z-20 w-56 overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-xl" onClick={(e) => e.stopPropagation()}>
                    <button className="flex w-full items-center gap-2 px-3 py-3 text-sm text-slate-200 disabled:opacity-40" disabled={i === 0} onClick={() => { setMenuIdx(null); move(i, -1); }}><ArrowUp size={15} /> Subir</button>
                    <button className="flex w-full items-center gap-2 px-3 py-3 text-sm text-slate-200 disabled:opacity-40" disabled={i === tpl.exercises.length - 1} onClick={() => { setMenuIdx(null); move(i, 1); }}><ArrowDown size={15} /> Bajar</button>
                    <button className="flex w-full items-center gap-2 px-3 py-3 text-sm text-slate-200" onClick={() => { setMenuIdx(null); setPicker({ replace: i }); }}><Repeat size={15} /> Reemplazar</button>
                    <button className="flex w-full items-center gap-2 px-3 py-3 text-sm text-slate-200" onClick={() => { setMenuIdx(null); photoFor.current = ex.exerciseId; photoRef.current?.click(); }}><Camera size={15} /> Cambiar foto / miniatura</button>
                    {state.exercises.find((x) => x.id === ex.exerciseId)?.imageUrl.startsWith('data:') && <button className="flex w-full items-center gap-2 px-3 py-3 text-sm text-slate-400" onClick={() => { setMenuIdx(null); resetPhoto(ex.exerciseId); }}><X size={15} /> Quitar mi foto</button>}
                    <button className="flex w-full items-center gap-2 px-3 py-3 text-sm text-slate-200" onClick={() => { setMenuIdx(null); setVideoFor(ex.exerciseId); }}><Video size={15} /> Revisar técnica con vídeo</button>
                    <button className="flex w-full items-center gap-2 px-3 py-3 text-sm text-red-400" onClick={() => { setMenuIdx(null); setTpl((t) => ({ ...t, exercises: t.exercises.filter((_, k) => k !== i) })); }}><Trash2 size={15} /> Eliminar</button>
                  </div>
                )}
              </div>
            </div>
            <div className={`grid ${(ex.extras ?? defaultExtras(ex.exerciseId)) && !isCore(state.exercises.find((x) => x.id === ex.exerciseId)) ? 'grid-cols-[34px_1fr_1fr_1fr_1fr_28px]' : 'grid-cols-[40px_1fr_1fr_32px]'} items-center gap-1.5 px-1 pb-1 text-[10px] font-semibold uppercase text-slate-500`}>
              <span className="text-center">Set</span><span className="text-center">kg</span><span className="text-center">{byTimeOf(ex, state.exercises.find((x) => x.id === ex.exerciseId)) ? 'Seg' : 'Reps'}</span>{(ex.extras ?? defaultExtras(ex.exerciseId)) && !isCore(state.exercises.find((x) => x.id === ex.exerciseId)) && <><span className="text-center">Seg</span><span className="text-center">Cortas</span></>}<span />
            </div>
            {ex.sets.map((s, k) => (
              <div key={k} className={`mb-1 grid ${(ex.extras ?? defaultExtras(ex.exerciseId)) && !isCore(state.exercises.find((x) => x.id === ex.exerciseId)) ? 'grid-cols-[34px_1fr_1fr_1fr_1fr_28px]' : 'grid-cols-[40px_1fr_1fr_32px]'} items-center gap-1.5`}>
                <button className={cx('h-9 rounded-md text-sm font-bold', BADGE_STYLE[s.type])} onClick={() => patchEx(i, (e) => { const nt = next(e.sets[k].type); const wk = e.sets.map((x, n) => (x.type !== 'warmup' ? n : -1)).filter((n) => n >= 0); const wi = wk.indexOf(k); const pair = e.unilateral && wi >= 0 && nt !== 'warmup' ? [wk[wi - (wi % 2)], wk[wi - (wi % 2) + 1]] : [k]; return { ...e, sets: e.sets.map((x, n) => (pair.includes(n) ? { ...x, type: nt } : x)) }; })} aria-label={`Tipo: ${SET_LABEL[s.type]}`}>
                  {s.type === 'normal' ? (ex.unilateral ? Math.floor(k / 2) + 1 : k + 1) : SET_BADGE[s.type]}{s.side && <span className={cx('ml-0.5 text-[10px]', s.side === 'D' ? 'text-sky-400' : 'text-amber-500')}>{sideLetter(s.side)}</span>}
                </button>
                <NumInput value={s.weight} placeholder="–" className="h-9 w-full rounded-md bg-slate-800 text-center font-semibold text-white outline-none focus:ring-1 focus:ring-accent" onChange={(n) => patchEx(i, (e) => ({ ...e, sets: e.sets.map((x, m) => (m === k ? { ...x, weight: n } : x)) }))} />
                <NumInput decimal={false} value={s.reps} placeholder="–" className="h-9 w-full rounded-md bg-slate-800 text-center font-semibold text-white outline-none focus:ring-1 focus:ring-accent" onChange={(n) => patchEx(i, (e) => ({ ...e, sets: e.sets.map((x, m) => (m === k ? { ...x, reps: n } : x)) }))} />
                {(ex.extras ?? defaultExtras(ex.exerciseId)) && !isCore(state.exercises.find((x) => x.id === ex.exerciseId)) && <>
                  <NumInput decimal={false} value={s.secs ?? 0} placeholder="–" label="Segundos" className="h-9 w-full rounded-md bg-slate-800 text-center font-semibold text-white outline-none focus:ring-1 focus:ring-accent" onChange={(n) => patchEx(i, (e) => ({ ...e, sets: e.sets.map((q, m) => (m === k ? { ...q, secs: n > 0 ? n : undefined } : q)) }))} />
                  <NumInput decimal={false} value={s.partials ?? 0} placeholder="–" label="Reps cortas" className="h-9 w-full rounded-md bg-slate-800 text-center font-semibold text-white outline-none focus:ring-1 focus:ring-accent" onChange={(n) => patchEx(i, (e) => ({ ...e, sets: e.sets.map((q, m) => (m === k ? { ...q, partials: n > 0 ? n : undefined } : q)) }))} />
                </>}
                <button className="text-slate-500" onClick={() => patchEx(i, (e) => { if (!e.unilateral || e.sets[k].type === 'warmup') return { ...e, sets: e.sets.filter((_, m) => m !== k) }; const wk = e.sets.map((x, n) => (x.type !== 'warmup' ? n : -1)).filter((n) => n >= 0); const wi = wk.indexOf(k); const drop = [wk[wi - (wi % 2)], wk[wi - (wi % 2) + 1]]; return { ...e, sets: e.sets.filter((_, m) => !drop.includes(m)) }; })} aria-label="Quitar serie"><X size={16} /></button>
              </div>
            ))}
            <button className="btn btn-ghost mt-1 w-full !py-2" onClick={() => patchEx(i, (e) => { const last = e.sets[e.sets.length - 1] ?? { type: 'normal' as const, weight: 0, reps: 0 }; return { ...e, sets: e.unilateral ? [...e.sets, { ...last, side: 'I' as const }, { ...last, side: 'D' as const }] : [...e.sets, { ...last }] }; })}><Plus size={16} /> Añadir serie{ex.unilateral ? ' (I + D)' : ''}</button>
            <ExerciseTargets exerciseId={ex.exerciseId} exercise={state.exercises.find((x) => x.id === ex.exerciseId)} value={ex} onChange={(p) => patchEx(i, (x) => ({ ...x, ...p }))} />
            <input className="field mt-2 !py-2 text-xs" placeholder="Notas del ejercicio (ej: 10-12 reps)" value={ex.notes ?? ''} onChange={(e) => patchEx(i, (x) => ({ ...x, notes: e.target.value }))} />
          </div>
        ))}

        <button className="btn btn-blue w-full !py-3.5" onClick={() => setPicker({ replace: null })}><Plus size={18} /> Añadir ejercicios</button>
        <button className="btn btn-ghost w-full !py-3.5 !border !border-accent/40 !text-accent" disabled={tpl.exercises.length < 2} onClick={() => setAudit({ saving: false })}><Sparkles size={18} strokeWidth={1.75} /> Auditar y optimizar orden de ejercicios</button>
      </div>

      <div className="fixed inset-x-0 bottom-0 bg-gradient-to-t from-slate-950 via-slate-950 to-transparent px-4 pt-6" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)' }}>
        <button className="btn btn-green w-full !py-3.5 shadow-xl" disabled={!tpl.title.trim() || tpl.exercises.length === 0} onClick={() => { if (!initial && !audited && tpl.exercises.length >= 2) setAudit({ saving: true }); else save(); }}>Guardar rutina</button>
      </div>

      {videoFor && state.exercises.find((e) => e.id === videoFor) && <VideoFormCheck exercise={state.exercises.find((e) => e.id === videoFor)!} location={location} onClose={() => setVideoFor(null)} />}
      {audit && (
        <RoutineAudit
          tpl={tpl}
          location={location}
          saving={audit.saving}
          onClose={() => setAudit(null)}
          onApply={(t) => { setTpl(t); setAudited(true); setAudit(null); if (audit.saving) save(t); }}
          onKeep={() => { setAudited(true); setAudit(null); if (audit.saving) save(); }}
        />
      )}

      {picker && (
        <ExercisePicker
          single={picker.replace !== null}
          onClose={() => setPicker(null)}
          onPick={(ids) => {
            if (picker.replace !== null) patchEx(picker.replace, (e) => ({ ...e, exerciseId: ids[0] })); // conserva las series
            else setTpl((t) => ({ ...t, exercises: [...t.exercises, ...ids.map((id) => ({ exerciseId: id, sets: Array.from({ length: 3 }, () => ({ type: 'normal' as const, weight: 0, reps: 0 })) }))] }));
            setPicker(null);
          }}
        />
      )}
    </div>
  );
}
