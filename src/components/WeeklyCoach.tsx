import { Loader2, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { weeklyCoach } from '../lib/gemini';
import { weekContext, weekStats } from '../lib/nutriWeek';
import { useStore } from '../lib/store';
import { dayBalance } from '../lib/metabolic';
import { ErrorBox } from './ui';

const KEY = 'apex-weekly-coach-v1';
const weekId = (): string => {
  const d = new Date();
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // lunes de esta semana
  return d.toDateString();
};
const readCache = (): string[] => {
  try {
    const c = JSON.parse(localStorage.getItem(KEY) ?? 'null') as { week: string; puntos: string[] } | null;
    return c && c.week === weekId() ? c.puntos : [];
  } catch {
    return [];
  }
};

/** Revisión semanal de la «nutricionista»: datos calculados en el móvil + 4 frases de la IA. Se guarda y se regenera cuando quieras. */
export function WeeklyCoach() {
  const { state } = useStore();
  const [puntos, setPuntos] = useState<string[]>(readCache);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const w = weekStats(state);

  const run = async () => {
    setBusy(true);
    setErr('');
    try {
      const b = dayBalance(state);
      const sets = Object.entries(w.setsByMuscle).map(([k, v]) => `${k} ${v}`).join(', ');
      const datos = `${weekContext(state)}\nProteína media por toma (g): ${JSON.stringify(w.perSlot)}. Calorías medias ${w.avgKcal} kcal/día. Meta de proteína ${b.proteinTarget}-${b.proteinMax} g/día. Entrenos esta semana: ${w.workouts} (objetivo ${state.settings.weeklyGoal}). Series por músculo: ${sets || 'ninguna'}.`;
      const r = await weeklyCoach(state.settings, datos);
      setPuntos(r);
      try {
        localStorage.setItem(KEY, JSON.stringify({ week: weekId(), puntos: r }));
      } catch {
        /* sin almacenamiento */
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'No se pudo preparar la revisión.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2 rounded-2xl bg-slate-800/60 p-3">
      <div className="text-sm font-bold text-white">Revisión de la semana</div>
      {w.days === 0 ? (
        <p className="text-xs text-slate-400">Registra algunas comidas y tendré datos para hacerte la revisión.</p>
      ) : (
        <div className="grid grid-cols-2 gap-1.5 text-center text-[11px]">
          <div className="rounded-lg bg-slate-900 p-2"><div className="text-base font-bold text-white">{w.oilyFish}</div>pescado azul (meta 2-3)</div>
          <div className="rounded-lg bg-slate-900 p-2"><div className="text-base font-bold text-white">{w.vegDays}/{w.days}</div>días con verdura</div>
          <div className="rounded-lg bg-slate-900 p-2"><div className="text-base font-bold text-white">{w.avgProtein} g</div>proteína media/día</div>
          <div className="rounded-lg bg-slate-900 p-2"><div className="text-base font-bold text-white">{Object.keys(w.sources).length}</div>fuentes de proteína</div>
          {w.outMeals > 0 && <div className="col-span-2 rounded-lg bg-slate-900 p-2"><div className="text-base font-bold text-white">{w.outMeals} de {w.totalMeals} comidas fuera de casa</div>{w.outAvg.kcal} kcal de media fuera · {w.homeAvg.kcal} kcal en casa</div>}
        </div>
      )}
      {puntos.length > 0 && <ul className="list-disc space-y-1 pl-5 text-xs text-slate-200">{puntos.map((p, i) => <li key={i}>{p}</li>)}</ul>}
      {err && <ErrorBox msg={err} />}
      <button className="btn btn-ghost w-full text-accent" disabled={busy || w.days === 0} onClick={() => void run()}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} {puntos.length ? 'Actualizar la revisión' : 'Pedir la revisión de la semana'}</button>
    </div>
  );
}
