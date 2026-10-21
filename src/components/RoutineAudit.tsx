import { ArrowRight, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { isPermutation, localAudit, pairAntagonists, type AuditItem, type AuditResult, type Status } from '../lib/audit';
import { auditRoutineAI } from '../lib/gemini';
import { describeGear } from '../lib/homeSwap';
import { useStore } from '../lib/store';
import type { Location, RoutineTemplate } from '../lib/types';
import { cx } from '../lib/utils';
import { Modal } from './ui';
import { Hint } from './Hint';

const LIGHT: Record<Status, { dot: string; text: string; label: string }> = {
  ok: { dot: 'bg-emerald-500', text: 'text-emerald-500', label: 'Rutina equilibrada y bien compensada' },
  warn: { dot: 'bg-amber-400', text: 'text-amber-400', label: 'Descompensación detectada' },
  alert: { dot: 'bg-red-500', text: 'text-red-400', label: 'Ejercicio de riesgo para tus rodillas' },
};

/** Modal de auditoría: semáforo, explicación del coach, comparativa de orden y botones de aplicar / mantener. */
export function RoutineAudit({ tpl, location, saving, onApply, onKeep, onClose }: { tpl: RoutineTemplate; location: Location; saving: boolean; onApply: (t: RoutineTemplate) => void; onKeep: () => void; onClose: () => void }) {
  const { state } = useStore();
  const [res, setRes] = useState<AuditResult | null>(null);
  const [pair, setPair] = useState(location === 'home');
  const exOf = (id: string) => state.exercises.find((e) => e.id === id);
  const items: AuditItem[] = tpl.exercises.map((e, index) => ({ index, name: exOf(e.exerciseId)?.name ?? 'Ejercicio', muscle: exOf(e.exerciseId)?.muscleGroup ?? 'Abdominales', equipment: exOf(e.exerciseId)?.equipment ?? '', sets: e.sets.filter((s) => s.type !== 'warmup').length }));

  useEffect(() => {
    let cancelled = false;
    const local = localAudit(items);
    void (async () => {
      if (!state.settings.geminiKey.trim()) return !cancelled && setRes(local);
      try {
        const ai = await auditRoutineAI(
          state.settings,
          items.map((i) => ({ i: i.index, nombre: i.name, musculo: i.muscle, equipo: i.equipment, series: i.sets })),
          { home: location === 'home', gear: describeGear(state.homeGear, state.homeSpecs), kneeSafe: state.settings.kneeSafe, local: local.points },
        );
        const order = isPermutation(ai.orden, items.length) ? ai.orden : local.order;
        const status: Status = local.status === 'alert' ? 'alert' : ai.estado === 'ok' && local.status === 'ok' ? 'ok' : 'warn';
        if (!cancelled) setRes({ status, points: ai.puntos.length ? ai.puntos : local.points, order, kneeAlerts: local.kneeAlerts, source: 'ia' });
      } catch {
        if (!cancelled) setRes(local);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const changed = res ? res.order.some((v, k) => v !== k) : false;
  const apply = () => {
    if (!res) return;
    let exercises = res.order.map((i) => tpl.exercises[i]);
    if (pair && location === 'home') exercises = pairAntagonists(exercises, exOf);
    onApply({ ...tpl, exercises });
  };

  const col = (title: string, order: number[], highlight: boolean) => (
    <div className="min-w-0 flex-1">
      <div className="mb-1.5 text-[10px] font-bold uppercase text-slate-400">{title}</div>
      <ol className="space-y-1">
        {order.map((idx, k) => (
          <li key={k} className={cx('flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] leading-tight', highlight && idx !== k ? 'bg-accent/20 text-white' : 'bg-slate-800 text-slate-300')}>
            <span className="w-3.5 shrink-0 text-slate-500">{k + 1}</span>
            <span className="min-w-0 truncate">{items[idx].name}</span>
          </li>
        ))}
      </ol>
    </div>
  );

  return (
    <Modal title="Auditoría del coach" onClose={onClose}>
      {!res ? (
        <div className="animate-pulse space-y-3" aria-busy="true" aria-label="El coach está evaluando la rutina">
          <div className="h-6 w-3/4 rounded-lg bg-slate-800" />
          <div className="h-4 w-full rounded bg-slate-800" />
          <div className="h-4 w-5/6 rounded bg-slate-800" />
          <div className="flex gap-3"><div className="h-40 flex-1 rounded-xl bg-slate-800" /><div className="h-40 flex-1 rounded-xl bg-slate-800" /></div>
          <p className="text-center text-xs text-slate-500">El coach está evaluando tu rutina…</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className={cx('h-3.5 w-3.5 shrink-0 rounded-full', LIGHT[res.status].dot)} />
            <span className={cx('font-bold', LIGHT[res.status].text)}>{LIGHT[res.status].label}</span>
          </div>
          <ul className="space-y-2">
            {res.points.map((p, i) => (
              <li key={i} className="flex gap-2 text-sm text-slate-300"><Sparkles size={14} strokeWidth={1.75} className="mt-0.5 shrink-0 text-accent" /> <span>{p}</span></li>
            ))}
          </ul>
          {changed ? (
            <div className="flex items-start gap-2">
              {col('Tu orden actual', items.map((i) => i.index), false)}
              <ArrowRight size={18} className="mt-6 shrink-0 text-slate-500" />
              {col('Orden recomendado', res.order, true)}
            </div>
          ) : (
            <p className="rounded-xl bg-slate-800 p-3 text-sm text-slate-300">Tu orden actual ya es el recomendado.</p>
          )}
          {location === 'home' && (
            <label className="flex items-center justify-between gap-3 rounded-xl bg-slate-800 p-3 text-sm text-slate-300">
              <span>Agrupar en superseries antagonistas (empuje + tracción, cuádriceps + femoral) para ganar densidad</span>
              <input type="checkbox" className="h-5 w-5 shrink-0" checked={pair} onChange={(e) => setPair(e.target.checked)} />
            </label>
          )}
          <div className="grid gap-2">
            <button className="btn btn-green" onClick={apply} disabled={!changed && !(pair && location === 'home')}>{saving ? 'Aplicar y guardar rutina' : 'Aplicar orden recomendado'}</button>
            <button className="btn btn-ghost" onClick={onKeep}>{saving ? 'Mantener mi orden y guardar' : 'Mantener mi orden original'}</button>
          </div>
          <Hint className="text-[11px] text-slate-500">{res.source === 'ia' ? 'Revisión con Gemini sobre tu perfil y tu objetivo de recomposición.' : 'Revisión automática en el dispositivo (sin Gemini).'}</Hint>
        </div>
      )}
    </Modal>
  );
}
