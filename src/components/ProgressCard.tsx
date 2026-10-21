import { Eye, EyeOff, Target, Trash2, Trophy } from 'lucide-react';
import { useState } from 'react';
import { analyze } from '../lib/progress';
import { measureTone, toneClass } from '../lib/measureRules';
import { useStore } from '../lib/store';
import { cx, uid } from '../lib/utils';
import { useLayoutEdit } from '../lib/layoutEdit';
import { MEASURES, MeasureEntry, lastOf, type MeasureKind } from './MeasureEntry';
import { MeasureChart } from './MeasureChart';
import { Modal, NumInput } from './ui';
import { fmtKg } from '../lib/utils';
import { Hint } from './Hint';

const TONE = { good: 'bg-emerald-500/10 text-emerald-500', warn: 'bg-amber-500/10 text-amber-500', neutral: 'bg-slate-800 text-slate-300' } as const;

function Spark({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 100},${28 - ((v - min) / span) * 24}`).join(' ');
  return (
    <svg viewBox="0 0 100 32" className="h-8 w-24" preserveAspectRatio="none" aria-hidden>
      <polyline points={pts} fill="none" stroke="#10b981" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** Seguimiento de la recomposición: cintura (grasa abdominal) + peso + fuerza. */
export function ProgressCard() {
  const { state, update } = useStore();
  const { editing } = useLayoutEdit();
  const hidden = state.layoutHidden['hoy-medidas'] ?? [];
  const toggleHidden = (k: string) => update((st) => { const cur = st.layoutHidden['hoy-medidas'] ?? []; return { ...st, layoutHidden: { ...st.layoutHidden, 'hoy-medidas': cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k] } }; });
  const visible = MEASURES.filter((m) => editing || !hidden.includes(m.id));
  const delta = (k: MeasureKind): number | null => { const l = state.measurements.filter((m) => (m[k] ?? 0) > 0).sort((a, b) => a.ts - b.ts); return l.length >= 2 ? Math.round(((l[l.length - 1][k] as number) - (l[0][k] as number)) * 10) / 10 : null; };
  const [entry, setEntry] = useState<MeasureKind | null>(null);
  const p = analyze(state.measurements, state.profile.height);
  const waists = [...state.measurements].sort((a, b) => a.ts - b.ts).filter((m) => m.waist).map((m) => m.waist as number);
  const [nowTs] = useState(() => Date.now());
  const since = nowTs - 30 * 86400000;
  const recent = state.workouts.filter((w) => Date.parse(w.startTime) >= since);
  const prs = recent.reduce((a, w) => a + w.prsAchieved, 0);

  return (
    <div className="card">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-1.5 font-bold text-white"><Target size={16} className="text-fuel" /> Tu objetivo</div>
          <Hint className="text-xs text-slate-400">Menos grasa abdominal y más tono. Lo que cuenta es tu <b className="text-slate-200">cintura</b>, tu <b className="text-slate-200">barriga baja</b> y tu fuerza, no solo el peso. Que suban cadera, muslo, brazo y pecho es buena señal.</Hint>
        </div>
      </div>

      <div className="grid grid-cols-6 gap-2 text-center">
        {visible.map((m, i) => {
          const v = m.id === 'weight' ? lastOf(state.measurements, 'weight') ?? state.profile.weight : lastOf(state.measurements, m.id);
          const d = delta(m.id);
          const rem = visible.length % 3;
          const span = rem === 1 && i === visible.length - 1 ? 'col-span-6' : rem === 2 && i >= visible.length - 2 ? 'col-span-3' : 'col-span-2';
          const isHidden = hidden.includes(m.id);
          return (
            <div key={m.id} className={cx('relative', span)}>
              <button onClick={() => setEntry(m.id)} className={cx('w-full cursor-pointer rounded-xl bg-slate-800 p-2 transition-transform active:scale-95', editing && 'outline-dashed outline-2 outline-offset-2 outline-accent/50', editing && isHidden && 'opacity-40')} aria-label={`Registrar ${m.label.toLowerCase()}`}>
                <div className="text-lg font-bold text-white">{v ? fmtKg(v) : '—'}<span className="text-xs font-medium text-slate-400"> {m.unit}</span></div>
                <div className="text-[10px] uppercase text-slate-400">{m.label}</div>
                {d !== null && <div className={cx('text-xs font-bold', m.id === 'weight' ? 'text-slate-300' : toneClass(measureTone(m.id, d)))}>{d > 0 ? '+' : ''}{fmtKg(d)} {m.unit}</div>}
              </button>
              {editing && (
                <button className={cx('pointer-events-auto absolute -top-3 right-1 z-10 rounded-full p-1.5 shadow-lg ring-1', isHidden ? 'bg-accent text-white ring-accent' : 'bg-slate-900 text-white ring-slate-600')} onClick={() => toggleHidden(m.id)} aria-label={isHidden ? `Mostrar ${m.label}` : `Ocultar ${m.label}`} aria-pressed={isHidden}>
                  {isHidden ? <EyeOff size={14} strokeWidth={2} /> : <Eye size={14} strokeWidth={2} />}
                </button>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex items-center justify-center gap-2 rounded-xl bg-slate-800/60 py-1.5 text-xs text-slate-300"><Trophy size={13} className="text-amber-500" /> <b className="text-amber-500">{prs}</b> PRs en 30 días · {recent.length} entreno{recent.length === 1 ? "" : "s"}</div>

      <MeasureChart kinds={MEASURES.map((m) => m.id).filter((k) => !hidden.includes(k))} />

      <div className={cx('mt-3 rounded-xl p-3 text-sm', TONE[p.verdict.tone])}>{p.verdict.text}</div>
      {p.notes.map((n) => <div key={n.text} className={cx('mt-2 rounded-xl p-3 text-sm', TONE[n.tone])}>{n.text}</div>)}
      {p.whtr !== null && (
        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between text-xs text-slate-400">
            <span>Cintura/altura: <b className="text-slate-200">{p.whtr}</b> <span className="text-slate-500">(saludable &lt; 0,5)</span></span>
            <Spark values={waists.slice(-12)} />
          </div>
          <div className="relative h-2.5 overflow-hidden rounded-full" style={{ background: 'linear-gradient(to right, #10b981 0 40%, #f59e0b 40% 80%, #ef4444 80% 100%)' }} role="img" aria-label="Semáforo de cintura/altura">
            <span className="absolute top-0 h-full w-1 rounded bg-white shadow" style={{ left: `${Math.min(98, Math.max(0, ((p.whtr - 0.4) / 0.25) * 100))}%` }} />
          </div>
          <div className="mt-0.5 flex justify-between text-[10px] text-slate-500"><span>0,40</span><span>0,50</span><span>0,60</span><span>0,65+</span></div>
        </div>
      )}
      {entry && <MeasureEntry kind={entry} onClose={() => setEntry(null)} />}
    </div>
  );
}

export function MeasureModal({ onClose }: { onClose: () => void }) {
  const { state, update } = useStore();
  const last = [...state.measurements].sort((a, b) => b.ts - a.ts);
  const [waist, setWaist] = useState(last.find((m) => m.waist)?.waist ?? 0);
  const [belly, setBelly] = useState(last.find((m) => m.belly)?.belly ?? 0);
  const [hip, setHip] = useState(last.find((m) => m.hip)?.hip ?? 0);
  const [weight, setWeight] = useState(state.profile.weight);

  const save = () => {
    if (!waist && !weight && !hip && !belly) return;
    update((s) => ({
      ...s,
      measurements: [...s.measurements, { id: uid(), ts: Date.now(), waist: waist || undefined, belly: belly || undefined, hip: hip || undefined, weight: weight || undefined }],
      profile: weight ? { ...s.profile, weight } : s.profile, // el peso actualiza tus calorías y proteína
    }));
    onClose();
  };

  return (
    <Modal title="Registrar medidas" onClose={onClose}>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label">Cintura (cm)</label><NumInput value={waist} className="field text-center text-lg font-bold" onChange={setWaist} /></div>
        <div><label className="label">Barriga baja (cm)</label><NumInput value={belly} className="field text-center text-lg font-bold" onChange={setBelly} /></div>
        <div><label className="label">Cadera (cm)</label><NumInput value={hip} className="field text-center text-lg font-bold" onChange={setHip} /></div>
        <div><label className="label">Peso (kg)</label><NumInput value={weight} className="field text-center text-lg font-bold" onChange={setWeight} /></div>
      </div>
      <Hint className="mt-3 text-xs text-slate-400">Mide la cintura por encima del ombligo y la barriga baja unos 4 cm por debajo, relajada, al final de una exhalación y sin apretar la cinta. Hazlo el mismo día de la semana y en ayunas. El peso actualizará tus metas de calorías y proteína.</Hint>
      <button className="btn btn-green mt-4 w-full" onClick={save}>Guardar</button>
      {last.length > 0 && (
        <div className="mt-4 space-y-1">
          <div className="label">Historial</div>
          {last.slice(0, 8).map((m) => (
            <div key={m.id} className="flex items-center justify-between rounded-lg bg-slate-800 px-3 py-2 text-sm">
              <span className="text-slate-400">{new Date(m.ts).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}</span>
              <span className="text-white">{m.waist ? `${m.waist} cm` : '–'} · {m.belly ? `${m.belly} cm` : '–'} · {m.hip ? `${m.hip} cm` : '–'} · {m.weight ? `${m.weight} kg` : '–'}</span>
              <button className="text-slate-500" aria-label="Borrar" onClick={() => update((s) => ({ ...s, measurements: s.measurements.filter((x) => x.id !== m.id) }))}><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
