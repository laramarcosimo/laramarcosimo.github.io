import { Camera, Check, Image as ImageIcon, Link2, Loader2, Plus, Search, ShieldCheck, Sparkles, Trophy, X } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { EQUIPMENT, isCardio, MUSCLE_FILTERS, MUSCLE_GROUPS, noRecords } from '../lib/exercises';
import { suggestExtras, type ExtraSuggestion } from '../lib/gemini';
import { compressToBase64 } from '../lib/image';
import { isKneeUnsafe } from '../lib/knee';
import { useStore } from '../lib/store';
import type { ActiveWorkout, Equipment, MuscleGroup } from '../lib/types';
import { cx, norm, uid } from '../lib/utils';
import { hasPR } from '../lib/workout';
import { ExerciseImage, MUSCLE_ICONS } from './ExerciseImage';
import { ErrorBox, Modal } from './ui';
import { Hint } from './Hint';

export function ExercisePicker({ onPick, onClose, single = false, workout }: { onPick: (ids: string[]) => void; onClose: () => void; single?: boolean; workout?: ActiveWorkout }) {
  const { state, update } = useStore();
  const [q, setQ] = useState('');
  const [muscle, setMuscle] = useState('Todos');
  const [equip, setEquip] = useState('Todos');
  const [selected, setSelected] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<{ name: string; muscle: MuscleGroup; equip: Equipment }>({ name: '', muscle: 'Pecho', equip: 'Mancuernas' });
  const [image, setImage] = useState('');
  const [url, setUrl] = useState('');
  const [err, setErr] = useState('');
  const [ai, setAi] = useState<{ busy: boolean; items: ExtraSuggestion[]; err: string } | null>(null);
  const galRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);

  const list = useMemo(() => {
    const groups = muscle === 'Todos' ? null : MUSCLE_FILTERS[muscle];
    const nq = norm(q);
    return state.exercises.filter((e) => e.muscleGroup !== 'Rostro y Cuello' && (!state.settings.kneeSafe || !isKneeUnsafe(e.name)) && (!groups || groups.includes(e.muscleGroup)) && (equip === 'Todos' || e.equipment === equip) && (!nq || norm(e.name).includes(nq)));
  }, [state.exercises, state.settings.kneeSafe, q, muscle, equip]);

  // Sugerencias del Coach: qué añadir según lo que ya haces hoy, los últimos 14 días y el tiempo que queda.
  const suggest = async () => {
    setAi({ busy: true, items: [], err: '' });
    try {
      const inSession = new Set((workout?.exercises ?? []).map((e) => e.exerciseId));
      const name = (id: string) => state.exercises.find((e) => e.id === id);
      const since = Date.now() - 14 * 86400000;
      const vol: Record<string, number> = {};
      for (const w of state.workouts) if (Date.parse(w.startTime) >= since) for (const e of w.exercises) if (!isCardio({ id: e.exerciseId, name: e.name })) vol[e.muscleGroup] = (vol[e.muscleGroup] ?? 0) + e.sets.filter((s) => s.type !== 'warmup').length;
      const target = workout?.timeMode === 'q45' ? 45 : workout?.timeMode === 'm50' ? 50 : workout?.timeMode === 'x75' ? 75 : workout?.timeMode === 'free' ? null : 65;
      const left = target === null || !workout ? null : Math.max(0, target - Math.round((Date.now() - workout.startedAt) / 60000));
      const cands = state.exercises.filter((e) => !inSession.has(e.id) && !e.timed && e.muscleGroup !== 'Rostro y Cuello' && (!state.settings.kneeSafe || !isKneeUnsafe(e.name))).map((e) => ({ id: e.id, name: e.name, muscle: e.muscleGroup, equipment: e.equipment }));
      const items = await suggestExtras(state.settings, { sesion: [...inSession].map((id) => name(id)?.name ?? id), minutosRestantes: left, ultimos14dias: vol, kneeSafe: state.settings.kneeSafe, home: workout?.location === 'home' }, cands);
      setAi({ busy: false, items, err: items.length ? '' : 'El Coach no ha encontrado sugerencias. Inténtalo de nuevo.' });
    } catch (e) {
      setAi({ busy: false, items: [], err: e instanceof Error ? e.message : 'No se pudo consultar al Coach.' });
    }
  };

  const tap = (id: string) => {
    if (single) return onPick([id]);
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  };

  const onFile = async (f: File | undefined, ref: React.RefObject<HTMLInputElement | null>) => {
    if (ref.current) ref.current.value = '';
    if (!f) return;
    try {
      setImage(`data:image/jpeg;base64,${await compressToBase64(f, 420, 0.8)}`);
      setErr('');
    } catch {
      setErr('No se pudo leer la imagen.');
    }
  };

  const useUrl = () => {
    const u = url.trim();
    if (!/^https?:\/\//i.test(u)) return setErr('Pega una URL de imagen que empiece por http(s)://');
    const probe = new Image();
    probe.onload = () => {
      setImage(u);
      setErr('');
    };
    probe.onerror = () => setErr('No se pudo cargar esa imagen.');
    probe.src = u;
  };

  const create = () => {
    const name = form.name.trim();
    if (!name) return;
    const id = uid();
    update((s) => ({ ...s, exercises: [...s.exercises, { id, name, muscleGroup: form.muscle, equipment: form.equip, imageUrl: image, personalRecords: noRecords(), custom: true }] }));
    setCreating(false);
    setForm({ ...form, name: '' });
    setImage('');
    setUrl('');
    tap(id);
  };

  const Icon = MUSCLE_ICONS[form.muscle];

  return (
    <Modal title="Ejercicios" onClose={onClose}>
      <div className="relative mb-3">
        <Search size={16} className="absolute left-3 top-3 text-slate-500" />
        <input className="field pl-9" placeholder="Buscar ejercicio…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {state.settings.kneeSafe && <p className="mb-2 flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-2 py-1 text-[11px] text-emerald-500"><ShieldCheck size={12} strokeWidth={1.75} /> Protección de rodilla activa: se ocultan saltos y apoyos de rodilla en el suelo.</p>}
      <div className="mb-3 grid grid-cols-2 gap-2">
        <label className="block">
          <span className="label">Grupo muscular</span>
          <select className="field" value={muscle} onChange={(e) => setMuscle(e.target.value)}>
            <option value="Todos">Todos</option>
            {Object.keys(MUSCLE_FILTERS).filter((m) => m !== 'Rostro y cuello').map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="label">Equipamiento</span>
          <select className="field" value={equip} onChange={(e) => setEquip(e.target.value)}>
            <option value="Todos">Todos</option>
            {EQUIPMENT.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </label>
      </div>

      {/* Barra de acción fija: siempre a la vista, por encima de la lista. */}
      <div className="sticky -top-5 z-10 -mx-5 space-y-2 border-b border-slate-800 bg-slate-900 px-5 pb-3 pt-7">
        <button className="btn btn-ghost w-full" onClick={() => setCreating((c) => !c)}><Plus size={16} /> Crear ejercicio personalizado</button>
        <button className="btn btn-ghost w-full text-accent" disabled={ai?.busy} onClick={() => void suggest()} aria-label="Sugerir ejercicios con IA">{ai?.busy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} Sugerir con IA qué añadir</button>
        {!single && (
          <button className="btn btn-blue w-full !py-3" disabled={selected.length === 0} onClick={() => onPick(selected)}>
            {selected.length === 0 ? 'Selecciona ejercicios de la lista' : `Añadir ${selected.length} ejercicio${selected.length === 1 ? '' : 's'} a la rutina`}
          </button>
        )}
      </div>

      {ai && !ai.busy && (
        <div className="mt-3 space-y-2 rounded-xl bg-accent/10 p-3">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase text-accent"><Sparkles size={13} /> Sugerencias del Coach</div>
          {ai.err && <ErrorBox msg={ai.err} />}
          {ai.items.map((s) => {
            const e = state.exercises.find((x) => x.id === s.id);
            if (!e) return null;
            const on = selected.includes(s.id);
            return (
              <button key={s.id} className="flex w-full items-center gap-3 rounded-xl bg-slate-800 p-2 text-left active:scale-[0.99]" onClick={() => tap(s.id)}>
                <ExerciseImage exerciseId={s.id} size={44} />
                <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-white">{e.name}</span><span className="block text-xs text-slate-400">{s.motivo}</span></span>
                {!single && <span className={cx('flex h-6 w-6 shrink-0 items-center justify-center rounded-md border', on ? 'border-accent bg-accent text-white' : 'border-slate-600')}>{on && <Check size={14} />}</span>}
              </button>
            );
          })}
        </div>
      )}

      {creating && (
        <div className="mt-3 space-y-3 rounded-xl bg-slate-800 p-3">
          <input className="field" placeholder="Nombre del ejercicio" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <div className="grid grid-cols-2 gap-2">
            <select className="field" value={form.muscle} onChange={(e) => setForm({ ...form, muscle: e.target.value as MuscleGroup })}>{MUSCLE_GROUPS.map((m) => <option key={m}>{m}</option>)}</select>
            <select className="field" value={form.equip} onChange={(e) => setForm({ ...form, equip: e.target.value as Equipment })}>{EQUIPMENT.map((m) => <option key={m}>{m}</option>)}</select>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-accent/15 text-accent">
              {image ? <img src={image} alt="Vista previa" className="h-full w-full object-cover" /> : <Icon size={32} strokeWidth={1.5} />}
              {image && <button className="absolute right-0.5 top-0.5 rounded-full bg-slate-900/80 p-0.5 text-white" onClick={() => setImage('')} aria-label="Quitar imagen"><X size={12} /></button>}
            </div>
            <div className="grid flex-1 grid-cols-2 gap-2">
              <button className="btn btn-ghost !py-2" onClick={() => camRef.current?.click()}><Camera size={16} strokeWidth={1.75} /> Cámara</button>
              <button className="btn btn-ghost !py-2" onClick={() => galRef.current?.click()}><ImageIcon size={16} strokeWidth={1.75} /> Galería</button>
            </div>
          </div>
          <div className="flex gap-2">
            <input className="field" placeholder="o pega la URL de una imagen" inputMode="url" value={url} onChange={(e) => setUrl(e.target.value)} />
            <button className="btn btn-ghost" disabled={!url.trim()} onClick={useUrl} aria-label="Usar URL"><Link2 size={16} strokeWidth={1.75} /></button>
          </div>
          <Hint className="text-[11px] text-slate-500">Sin imagen se usa el icono del grupo muscular.</Hint>
          {err && <ErrorBox msg={err} />}
          <input ref={galRef} type="file" accept="image/*" className="hidden" onChange={(e) => void onFile(e.target.files?.[0], galRef)} />
          <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => void onFile(e.target.files?.[0], camRef)} />
          <button className="btn btn-blue w-full" disabled={!form.name.trim()} onClick={create}>Crear{single ? ' y elegir' : ' y seleccionar'}</button>
        </div>
      )}

      <div className="mt-3 space-y-1">
        {list.map((e) => {
          const on = selected.includes(e.id);
          return (
            <button key={e.id} onClick={() => tap(e.id)} className={cx('flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left', on ? 'bg-accent/20 ring-1 ring-accent' : 'bg-slate-800/60')}>
              <ExerciseImage exerciseId={e.id} size={48} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-slate-100">{e.name}</span>
                <span className="block text-[11px] text-slate-400">{e.muscleGroup} · {e.equipment}</span>
              </span>
              {hasPR(e) && <span className="flex items-center gap-0.5 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-500"><Trophy size={10} /> PR</span>}
              {!single && <span className={cx('flex h-6 w-6 items-center justify-center rounded-md border', on ? 'border-accent bg-accent text-white' : 'border-slate-600')}>{on && <Check size={14} />}</span>}
            </button>
          );
        })}
        {list.length === 0 && <p className="py-4 text-center text-sm text-slate-500">Sin resultados.</p>}
      </div>
    </Modal>
  );
}
