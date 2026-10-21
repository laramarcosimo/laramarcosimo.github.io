import { Footprints } from 'lucide-react';
import { useEffect, useState } from 'react';
import { missingStepsDay } from '../lib/missingSteps';
import { useStore } from '../lib/store';
import { NumInput } from './ui';

const KEY = 'apex-steps-dismissed';
const readDismissed = (): string[] => {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(-30) : [];
  } catch {
    return [];
  }
};

const longDay = (key: string): string => new Date(`${key}T12:00:00`).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });

/** Si los pasos de un día reciente quedaron a 0 (p. ej. el iPhone estaba bloqueado cuando el Atajo los leyó), lo avisa y deja escribirlos a mano. */
export function MissingStepsNotice() {
  const { state, update } = useStore();
  const [dismissed, setDismissed] = useState(readDismissed);
  const [ready, setReady] = useState(false);
  const [now] = useState(() => Date.now());
  const [n, setN] = useState(0);

  // Espera unos segundos: el Atajo puede haber mandado los pasos y la app los está recogiendo de la nube al abrirse.
  useEffect(() => {
    const t = window.setTimeout(() => setReady(true), 3000);
    return () => window.clearTimeout(t);
  }, []);

  const day = ready ? missingStepsDay(state.habits, now, dismissed) : null;
  if (!day) return null;

  const skip = () => {
    const next = [...dismissed, day].slice(-30);
    setDismissed(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* sin almacenamiento */
    }
  };
  const save = () => {
    if (!(n > 0)) return;
    update((s) => ({ ...s, habits: { ...s.habits, [day]: { ...(s.habits[day] ?? { agua: 0 }), steps: Math.min(200000, Math.round(n)) } } }));
    setN(0);
  };

  return (
    <div className="card space-y-2 !border-amber-500/40 !bg-amber-500/10 !p-3" role="status">
      <div className="flex items-center gap-2 text-sm font-bold text-amber-300"><Footprints size={16} strokeWidth={1.75} /> Faltan los pasos del {longDay(day)}</div>
      <p className="text-xs text-slate-300">Quedaron a 0: seguramente el iPhone estaba bloqueado cuando el Atajo intentó leerlos. Míralos en Salud o Fitness y escríbelos aquí.</p>
      <div className="flex items-center gap-2">
        <NumInput decimal={false} label={`Pasos del ${longDay(day)}`} value={n} placeholder="Pasos" className="min-w-0 flex-1 rounded-lg bg-slate-800 px-3 py-2 text-center font-bold tabular-nums text-white outline-none ring-1 ring-slate-700 focus:ring-accent" onChange={(v) => setN(Math.min(200000, Math.round(v)))} />
        <button className="btn btn-blue !px-4 !py-2 text-sm" disabled={!(n > 0)} onClick={save}>Guardar</button>
      </div>
      <button className="text-xs text-slate-400 underline" onClick={skip}>No tengo los pasos de ese día</button>
    </div>
  );
}
