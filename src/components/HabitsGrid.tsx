import { Flame, Check, Droplet, Eye, EyeOff, Footprints, Minus, Moon, Pencil, Pill, Plus, Scale } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLayoutEdit } from '../lib/layoutEdit';
import { useStore } from '../lib/store';
import type { HabitDay } from '../lib/types';
import { cx, dayKey, round, uid } from '../lib/utils';
import { faceStreak } from '../lib/streaks';
import { FaceYogaNight } from './FaceYogaNight';
import { FaceNightEditor } from './FaceNightEditor';
import { nightTotal, resolveNight } from '../lib/faceYoga';
import { Bar, NumInput } from './ui';
import { isConnected } from '../lib/cloud';
import { applySleepEvents, pullSleepEvents } from '../lib/sleepCloud';
import { applyStepsEvents, pullStepsEvents } from '../lib/stepsCloud';
import { SleepCalc } from './SleepCalc';
import { MissingStepsNotice } from './MissingStepsNotice';

const clamp = (n: number, a: number, b: number): number => Math.min(b, Math.max(a, n));
const fmtHM = (h: number): string => {
  const t = Math.round(h * 60);
  return `${Math.floor(t / 60)}h ${String(t % 60).padStart(2, '0')}m`;
};

const PAGE = 'hoy-habitos';

const Tile = ({ icon, title, children, wide, hidden, editing, onToggle }: { icon: React.ReactNode; title: string; children: React.ReactNode; wide: boolean; hidden: boolean; editing: boolean; onToggle: () => void }) => (
  <div className={cx('relative', wide && 'col-span-2')}>
    <div className={cx('card flex h-full flex-col gap-2 !p-3', editing && 'outline-dashed outline-2 outline-offset-2 outline-accent/50', editing && hidden && 'opacity-40')}>
      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase text-slate-400">{icon} {title}</div>
      {children}
    </div>
    {editing && (
      <button className={cx('pointer-events-auto absolute -top-3 right-2 z-10 rounded-full p-2 shadow-lg ring-1', hidden ? 'bg-accent text-white ring-accent' : 'bg-slate-900 text-white ring-slate-600')} onClick={onToggle} aria-label={hidden ? `Mostrar ${title}` : `Ocultar ${title}`} aria-pressed={hidden}>
        {hidden ? <EyeOff size={16} strokeWidth={2} /> : <Eye size={16} strokeWidth={2} />}
      </button>
    )}
  </div>
);

/** Selector de día para registrar pasos o Face Yoga de otro día (hasta hoy). */
const DayPick = ({ value, today, label, onChange }: { value: string; today: string; label: string; onChange: (k: string) => void }) => (
  <label className="flex items-center gap-2 text-[11px] font-semibold text-slate-500">
    {value === today ? 'Día' : <span className="text-amber-400">Otro día</span>}
    <input type="date" aria-label={label} max={today} value={value} onChange={(e) => onChange(e.target.value && e.target.value <= today ? e.target.value : today)} className="w-0 min-w-0 flex-1 rounded-lg bg-slate-800 px-2 py-1.5 text-center text-xs font-bold text-slate-200 outline-none ring-1 ring-slate-700 focus:ring-accent" />
    {value !== today && <button type="button" className="shrink-0 text-accent" onClick={() => onChange(today)}>Hoy</button>}
  </label>
);

/** Hábitos del día en cuadrícula compacta 2×2: agua, pasos, sueño y peso (+ suplementos si los activaste). */
export function HabitsGrid() {
  const { state, update } = useStore();
  const key = dayKey();
  const h: HabitDay = state.habits[key] ?? { agua: 0 };
  const set = (p: Partial<HabitDay>) => update((s) => ({ ...s, habits: { ...s.habits, [key]: { ...(s.habits[key] ?? { agua: 0 }), ...p } } }));
  const liters = round(h.agua * 0.25, 2);
  const waterGoal = Math.max(2, Math.round(state.profile.weight * 0.035 * 4) / 4);
  const [stepsDay, setStepsDay] = useState(key);
  const [faceDay, setFaceDay] = useState(key);
  const setDay = (k: string, p: Partial<HabitDay>) => update((s) => ({ ...s, habits: { ...s.habits, [k]: { ...(s.habits[k] ?? { agua: 0 }), ...p } } }));
  const stepsH: HabitDay = state.habits[stepsDay] ?? { agua: 0 };
  const faceH: HabitDay = state.habits[faceDay] ?? { agua: 0 };
  const steps = stepsH.steps ?? 0;
  const stepGoal = state.settings.stepGoal && state.settings.stepGoal > 0 ? state.settings.stepGoal : 0;
  const sleep = h.sleepHours ?? 0;
  const sleeping = state.sleepStart !== null;
  const faceDays = faceStreak(state.habits);
  const [night, setNight] = useState(false);
  const [editNight, setEditNight] = useState(false);
  const nightRun = resolveNight(state.faceNight);
  const nightMin = Math.max(1, Math.round(nightTotal(nightRun.steps, nightRun.restSec) / 60));
  const [editW, setEditW] = useState(false);
  const [w, setW] = useState(0);
  const todayWeight = [...state.measurements].filter((m) => m.weight && dayKey(m.ts) === key).sort((a, b) => b.ts - a.ts)[0]?.weight;

  // Atajo de iPhone (Modo No molestar): al abrir la app y al volver a ella se leen los avisos de dormir/despertar.
  useEffect(() => {
    if (!isConnected()) return;
    let alive = true;
    const pull = () => {
      pullSleepEvents()
        .then((ev) => { if (alive && ev.length) update((s) => applySleepEvents(s, ev)); })
        .catch(() => { /* sin red o sin script: se ignora */ });
      pullStepsEvents()
        .then((ev) => { if (alive && ev.length) update((s) => applyStepsEvents(s, ev)); })
        .catch(() => { /* sin red o sin script de pasos: se ignora */ });
    };
    pull();
    const vis = () => { if (document.visibilityState === 'visible') pull(); };
    document.addEventListener('visibilitychange', vis);
    return () => { alive = false; document.removeEventListener('visibilitychange', vis); };
  }, [update]);

  const wakeUp = () => {
    if (state.sleepStart === null) return;
    const hours = round((Date.now() - state.sleepStart) / 3600000, 2);
    update((s) => ({ ...s, sleepStart: null, habits: { ...s.habits, [key]: { ...(s.habits[key] ?? { agua: 0 }), sleepHours: clamp(hours, 0, 16) } } }));
  };
  const saveWeight = () => {
    if (!w) return;
    update((s) => ({ ...s, measurements: [...s.measurements, { id: uid(), ts: Date.now(), weight: w }], profile: { ...s.profile, weight: w } }));
    setEditW(false);
    setW(0);
  };
  const { editing } = useLayoutEdit();
  const hiddenIds = state.layoutHidden[PAGE] ?? [];
  const toggle = (id: string) => update((st) => { const cur = st.layoutHidden[PAGE] ?? []; return { ...st, layoutHidden: { ...st.layoutHidden, [PAGE]: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] } }; });
  const ALL = ['agua', 'pasos', 'sueno', 'peso', 'cara'];
  const shown = editing ? ALL : ALL.filter((id) => !hiddenIds.includes(id));
  // Con un número impar de cuadros, el último ocupa el ancho completo para que no quede descompensado.
  const tileProps = (id: string) => ({ hidden: hiddenIds.includes(id), editing, onToggle: () => toggle(id), wide: shown.length % 2 === 1 && shown[shown.length - 1] === id });
  const supps = state.supplements.enabled ? state.supplements.items.filter((i) => i.active) : [];

  return (
    <div className="space-y-3">
      {shown.includes('pasos') && <MissingStepsNotice />}
      <div className="grid grid-cols-2 items-stretch gap-3">
        {shown.includes('agua') && <Tile {...tileProps('agua')} icon={<Droplet size={13} strokeWidth={1.75} className="text-sky-400" />} title="Agua">
          <div className="text-2xl font-black tabular-nums text-white">{liters}<span className="text-xs font-medium text-slate-400"> / {waterGoal} L</span></div>
          <div className="flex gap-1.5">
            <button className="btn btn-ghost !px-2.5 !py-1.5" onClick={() => set({ agua: Math.max(0, h.agua - 1) })} aria-label="Menos agua"><Minus size={14} /></button>
            <button className="btn btn-blue flex-1 !py-1.5 text-xs" onClick={() => set({ agua: h.agua + 1 })}><Plus size={14} /> 250 ml</button>
          </div>
        </Tile>}

        {shown.includes('pasos') && <Tile {...tileProps('pasos')} icon={<Footprints size={13} strokeWidth={1.75} className="text-orange-400" />} title="Pasos">
          <NumInput decimal={false} label="Pasos de hoy (escribe el total)" value={steps} placeholder="Pasos de hoy" className="w-full rounded-lg bg-slate-800 px-2 py-2 text-center text-lg font-black tabular-nums text-white outline-none ring-1 ring-slate-700 focus:ring-accent" onChange={(n) => setDay(stepsDay, { steps: Math.min(200000, Math.round(n)) })} />
          <DayPick value={stepsDay} today={key} label="Día de los pasos" onChange={setStepsDay} />
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1"><Bar value={stepGoal ? steps : 0} max={stepGoal || 1} color="bg-orange-400" /></div>
            <span className="shrink-0 text-[11px] font-bold tabular-nums text-slate-400">{stepGoal ? `${Math.round((steps / stepGoal) * 100)}%` : '–'}</span>
          </div>
          <label className="flex items-center gap-2 text-[11px] font-semibold text-slate-500">Meta
            <NumInput decimal={false} label="Meta diaria de pasos" value={stepGoal} placeholder="Sin meta" className="w-0 min-w-0 flex-1 rounded-lg bg-slate-800 px-2 py-1.5 text-center text-sm font-bold tabular-nums text-slate-200 outline-none ring-1 ring-slate-700 focus:ring-accent" onChange={(n) => update((st) => ({ ...st, settings: { ...st.settings, stepGoal: n > 0 ? Math.min(200000, Math.round(n)) : undefined } }))} />
          </label>
        </Tile>}

        {shown.includes('sueno') && <Tile {...tileProps('sueno')} icon={<Moon size={13} strokeWidth={1.75} className="text-indigo-400" />} title="Sueño">
          <div className="flex items-center justify-between">
            <div className="text-2xl font-black tabular-nums text-white">{sleep ? fmtHM(sleep) : '–'}</div>
            <div className="flex gap-1">
              <button className="rounded-lg bg-slate-800 p-1.5" onClick={() => set({ sleepHours: clamp(round(sleep - 0.5, 1), 0, 16) })} aria-label="Menos sueño"><Minus size={13} /></button>
              <button className="rounded-lg bg-slate-800 p-1.5" onClick={() => set({ sleepHours: clamp(round(sleep + 0.5, 1), 0, 16) })} aria-label="Más sueño"><Plus size={13} /></button>
            </div>
          </div>
          {sleeping && state.sleepStart !== null && <div className="text-[10px] text-indigo-400">Durmiendo desde las {new Date(state.sleepStart).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</div>}
          <div className="grid grid-cols-2 gap-1.5">
            <button className={cx('btn !px-1 !py-1.5 text-[11px]', sleeping ? 'btn-ghost opacity-60' : 'btn-blue')} disabled={sleeping} onClick={() => update((s) => ({ ...s, sleepStart: Date.now() }))}>Dormir</button>
            <button className={cx('btn !px-1 !py-1.5 text-[11px]', sleeping ? 'btn-green' : 'btn-ghost')} disabled={!sleeping} onClick={wakeUp}>Despertar</button>
          </div>
          <SleepCalc onUse={(h) => set({ sleepHours: clamp(round(h, 2), 0, 16) })} />
        </Tile>}

        {shown.includes('peso') && <Tile {...tileProps('peso')} icon={<Scale size={13} strokeWidth={1.75} className="text-fuel" />} title="Peso">
          {editW ? (
            <>
              <NumInput value={w} placeholder={`${state.profile.weight}`} className="field !py-1.5 text-center text-lg font-bold" onChange={setW} />
              <div className="grid grid-cols-2 gap-1.5">
                <button className="btn btn-ghost !py-1.5 text-xs" onClick={() => { setEditW(false); setW(0); }}>Cancelar</button>
                <button className="btn btn-green !py-1.5 text-xs" disabled={!w} onClick={saveWeight}><Check size={13} /> Guardar</button>
              </div>
            </>
          ) : (
            <>
              <div className="text-2xl font-black tabular-nums text-white">{todayWeight ?? state.profile.weight}<span className="text-xs font-medium text-slate-400"> kg</span></div>
              <div className="text-[10px] text-slate-500">{todayWeight ? 'Registrado hoy' : 'Último dato · sin registro hoy'}</div>
              <button className="btn btn-blue !py-1.5 text-xs" onClick={() => { setW(state.profile.weight); setEditW(true); }}>{todayWeight ? 'Actualizar' : 'Registrar'}</button>
            </>
          )}
        </Tile>}

        {shown.includes('cara') && <Tile {...tileProps('cara')} icon={<Moon size={13} strokeWidth={1.75} className="text-violet-400" />} title="Face Yoga">
          <div className="flex flex-col gap-2">
            <div className="text-sm text-slate-300">{faceH.faceYoga ? <span className="flex items-center gap-1 font-semibold text-emerald-500"><Check size={15} /> {faceDay === key ? 'Hecho hoy' : 'Hecho ese día'}</span> : `Rutina nocturna · ${nightMin} min`}{faceDays > 0 && <span className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-amber-500"><Flame size={12} /> Racha: {faceDays} día{faceDays === 1 ? '' : 's'}</span>}</div>
            <DayPick value={faceDay} today={key} label="Día del Face Yoga" onChange={setFaceDay} />
            {faceDay !== key && <button className={cx('btn !py-1.5 text-xs', faceH.faceYoga ? 'btn-ghost' : 'btn-green')} onClick={() => setDay(faceDay, { faceYoga: !faceH.faceYoga })}>{faceH.faceYoga ? 'Quitar ese día' : 'Marcar hecho ese día'}</button>}
            <div className="flex gap-1.5">
              <button className="btn btn-blue min-w-0 flex-1 !px-2 !py-2 text-xs" onClick={() => setNight(true)}><Moon size={14} /> Face Yoga Express</button>
              <button className="btn btn-ghost shrink-0 !px-2.5 !py-2" onClick={() => setEditNight(true)} aria-label="Editar rutina de Face Yoga"><Pencil size={14} /></button>
            </div>
          </div>
        </Tile>}
      </div>

      {editNight && <FaceNightEditor onClose={() => setEditNight(false)} />}
      {night && <FaceYogaNight onComplete={() => setDay(faceDay, { faceYoga: true })} onClose={() => setNight(false)} />}
      {supps.length > 0 && (
        <div className="card !p-3">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase text-slate-400"><Pill size={12} /> Suplementos</div>
          <div className="flex flex-wrap gap-2">
            {supps.map((it) => {
              const on = !!h.supps?.[it.id];
              return (
                <button key={it.id} onClick={() => set({ supps: { ...(h.supps ?? {}), [it.id]: !on } })} className={cx('rounded-full px-3 py-1.5 text-sm font-semibold active:scale-95', on ? 'bg-fuel text-slate-950' : 'bg-slate-800 text-slate-300')}>
                  {on && <Check size={13} strokeWidth={2} className="mr-1 inline" />}{it.name}{it.dose ? ` · ${it.dose}` : ''}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
