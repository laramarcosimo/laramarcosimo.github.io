import { ArrowRight, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import { HomeEquipment } from './HomeEquipment';
import { adaptRoutineWithAI } from '../lib/gemini';
import { adaptSetsForHome, adaptToHome, describeGear } from '../lib/homeSwap';
import { isKneeUnsafe } from '../lib/knee';
import { makeResolver } from '../lib/importers';
import { useStore } from '../lib/store';
import type { Exercise, HomeGear, HomeSpecs, RoutineTemplate, TemplateSet } from '../lib/types';
import { ErrorBox, Modal, Spinner } from './ui';
import { Hint } from './Hint';

export interface HomePlanItem {
  orig: Exercise;
  sub: Exercise;
  sets: TemplateSet[];
  note?: string;
}

export interface HomePlan {
  items: HomePlanItem[];
  created: Exercise[];
}

const avgReps = (r: string): number => {
  const n = r.match(/\d+/g)?.map(Number) ?? [];
  return n.length ? Math.round(n.reduce((a, b) => a + b, 0) / n.length) : 12;
};

/** Plan automático por reglas biomecánicas con el material de casa. */
export const autoPlan = (tpl: RoutineTemplate, library: Exercise[], gear: HomeGear[], specs: HomeSpecs, kneeSafe: boolean): HomePlan => {
  const used = new Set<string>();
  const items: HomePlanItem[] = [];
  for (const te of tpl.exercises) {
    const orig = library.find((e) => e.id === te.exerciseId);
    if (!orig) continue;
    const sub = adaptToHome(orig, library, gear, used, kneeSafe);
    used.add(sub.id);
    const r = adaptSetsForHome(orig, sub, te.sets, gear, specs);
    items.push({ orig, sub, sets: r.sets, note: r.note || undefined });
  }
  return { created: [], items };
};

export function HomePreview({ tpl, onStart, onClose }: { tpl: RoutineTemplate; onStart: (plan: HomePlan) => void; onClose: () => void }) {
  const { state } = useStore();
  const [aiPlan, setAiPlan] = useState<{ plan: HomePlan; key: string } | null>(null);
  const [editGear, setEditGear] = useState(false);
  const gearKey = JSON.stringify([state.homeGear, state.homeSpecs]);
  const auto = useMemo(() => autoPlan(tpl, state.exercises, state.homeGear, state.homeSpecs, state.settings.kneeSafe), [tpl, state.exercises, state.homeGear, state.homeSpecs, state.settings.kneeSafe]);
  // Si cambias el material, el plan de IA anterior deja de ser válido.
  const plan = aiPlan && aiPlan.key === gearKey ? aiPlan.plan : auto;
  const usedAI = plan === aiPlan?.plan;
  const gearText = describeGear(state.homeGear, state.homeSpecs);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const askAI = async () => {
    setBusy(true);
    setErr('');
    try {
      const routine = tpl.exercises.flatMap((te) => {
        const ex = state.exercises.find((e) => e.id === te.exerciseId);
        return ex ? [{ nombre: ex.name, series: te.sets.length, reps: te.sets[0]?.reps || 10 }] : [];
      });
      const swaps = await adaptRoutineWithAI(state.settings, routine, gearText, state.settings.kneeSafe);
      const { resolve, created } = makeResolver(state.exercises);
      const items: HomePlanItem[] = tpl.exercises.flatMap((te, i) => {
        const orig = state.exercises.find((e) => e.id === te.exerciseId);
        const sw = swaps[i];
        if (!orig || !sw) return orig ? [{ orig, sub: orig, sets: te.sets }] : [];
        const sub = resolve(sw.sustituto);
        // Red de seguridad: si la IA propone algo prohibido para la rodilla, se usa la alternativa segura.
        if (state.settings.kneeSafe && isKneeUnsafe(sub.name)) return [auto.items[i] ?? { orig, sub: orig, sets: te.sets }];
        const reps = avgReps(sw.reps);
        return [{ orig, sub, sets: Array.from({ length: sw.series }, () => ({ type: 'normal' as const, weight: 0, reps })), note: `RPE ${sw.rpe} · ${sw.reps} reps${sw.nota ? ` · ${sw.nota}` : ''}` }];
      });
      setAiPlan({ plan: { items, created }, key: gearKey });
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'No se pudo adaptar con IA');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={`${tpl.title} en casa`} onClose={onClose}>
      <div className="mb-3 rounded-xl bg-slate-800 p-2.5 text-xs text-slate-300">
        <div className="mb-1 font-semibold text-white">Material disponible</div>
        {gearText.join(' · ')}
        <button className="mt-1.5 block font-semibold text-emerald-400" onClick={() => setEditGear((v) => !v)}>{editGear ? 'Ocultar' : 'Cambiar material'}</button>
        {editGear && <div className="mt-2 border-t border-slate-700 pt-2"><HomeEquipment /></div>}
      </div>
      <Hint className="mb-2 text-[11px] text-slate-500">{usedAI ? 'Adaptado con IA.' : 'Sustitución automática por patrón de movimiento y carga disponible.'}{state.settings.kneeSafe ? ' Protección de rodilla activa.' : ''}</Hint>
      <div className="space-y-2">
        {plan.items.map((it, i) => (
          <div key={i} className="rounded-xl bg-slate-800 p-3 text-sm">
            <div className="text-xs text-slate-500 line-through decoration-slate-600">{it.orig.name}</div>
            <div className="flex items-center gap-1.5 font-semibold text-white"><ArrowRight size={14} className="shrink-0 text-accent" />{it.sub.name}</div>
            <div className="mt-0.5 text-[11px] text-slate-400">{it.sets.length} series{it.sets[0]?.reps ? ` × ${it.sets[0].reps} reps` : ''}{it.sets[0]?.weight ? ` · ${it.sets[0].weight} kg` : ''}{it.note ? ` · ${it.note}` : ''}</div>
          </div>
        ))}
      </div>
      {state.homeGear.length === 1 && state.homeGear[0] === 'bodyweight' && <p className="mt-3 rounded-xl bg-emerald-500/10 p-2 text-xs text-emerald-400">Con solo peso corporal las opciones son limitadas. Añade material (barra de dominadas, bandas, mancuernas…) para sustituciones más fieles.</p>}
      {busy && <Spinner label="Adaptando con Gemini…" />}
      {err && <div className="mt-3"><ErrorBox msg={err} /></div>}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button className="btn btn-ghost" disabled={busy || !state.settings.geminiKey} onClick={() => void askAI()}><Sparkles size={16} /> Adaptar con IA</button>
        <button className="btn btn-green" disabled={busy} onClick={() => onStart(plan)}>Empezar en casa</button>
      </div>
      {!state.settings.geminiKey && <Hint className="mt-2 text-center text-[11px] text-slate-500">La IA necesita tu clave de Gemini (Ajustes).</Hint>}
      <Hint className="mt-2 text-center text-[11px] text-slate-500">Los entrenos en casa no modifican tus PRs de gimnasio.</Hint>
    </Modal>
  );
}
