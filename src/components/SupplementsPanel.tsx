import { Check, Loader2, Plus, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { organizeSupplements, type SupplementPlan } from '../lib/gemini';
import { usualTrainHour } from '../lib/nutriWeek';
import { useStore } from '../lib/store';
import { ErrorBox } from './ui';
import { cx, uid } from '../lib/utils';
import { Hint } from './Hint';

/** Gestor de suplementos: desactivado por defecto; solo los activados salen en el checklist diario. */
export function SupplementsPanel() {
  const { state, update } = useStore();
  const sup = state.supplements;
  const [name, setName] = useState('');
  const [dose, setDose] = useState('');
  const [plan, setPlan] = useState<SupplementPlan | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const active = sup.items.filter((i) => i.active);
  const organize = async () => {
    setBusy(true);
    setErr('');
    try {
      const dias = (state.settings.trainDays ?? []).map((d) => ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'][d]).join(', ') || 'no indicados';
      setPlan(await organizeSupplements(state.settings, { items: active.map((i) => ({ nombre: i.name, dosis: i.dose ?? '' })), horaEntreno: usualTrainHour(state), diasEntreno: dias }));
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'No se pudo organizar.');
    } finally {
      setBusy(false);
    }
  };
  const patch = (fn: (s: typeof sup) => typeof sup) => update((s) => ({ ...s, supplements: fn(s.supplements) }));

  const add = () => {
    const n = name.trim();
    if (!n) return;
    patch((s) => ({ ...s, items: [...s.items, { id: uid(), name: n, dose: dose.trim() || undefined, active: true }] }));
    setName('');
    setDose('');
  };

  return (
    <div className="space-y-3">
      <label className="flex items-center justify-between gap-3 text-sm">
        <span className="font-semibold text-white">¿Tomas suplementación actualmente?</span>
        <input type="checkbox" className="h-5 w-5" checked={sup.enabled} onChange={(e) => patch((s) => ({ ...s, enabled: e.target.checked }))} />
      </label>
      {!sup.enabled ? (
        <Hint className="text-xs text-slate-400">Ahora mismo tu checklist solo tiene hábitos naturales: agua, sueño, pasos y proteína con comida real. Si algún día empiezas con suplementos (o tu coach te lo recomienda), actívalo aquí.</Hint>
      ) : (
        <>
          <Hint className="text-xs text-slate-400">Marca los que tomas: solo esos aparecerán en el checklist de Hoy.</Hint>
          <div className="flex flex-wrap gap-2">
            {sup.items.map((it) => (
              <button key={it.id} onClick={() => patch((s) => ({ ...s, items: s.items.map((x) => (x.id === it.id ? { ...x, active: !x.active } : x)) }))} className={cx('rounded-full px-3 py-1.5 text-sm font-semibold transition active:scale-95', it.active ? 'bg-fuel text-slate-950' : 'bg-slate-800 text-slate-400')}>
                {it.active && <Check size={13} strokeWidth={2} className="mr-1 inline" />}{it.name}{it.dose ? ` · ${it.dose}` : ''}
              </button>
            ))}
          </div>
          <button className="btn btn-ghost w-full text-accent" disabled={busy || active.length === 0} onClick={() => void organize()}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} {plan ? 'Reorganizar con IA' : 'Organizar mis suplementos con IA'}</button>
          {active.length === 0 && <p className="text-[11px] text-slate-500">Marca al menos un suplemento para organizarlos.</p>}
          {err && <ErrorBox msg={err} />}
          {plan && (
            <div className="space-y-2 rounded-xl bg-slate-800 p-3">
              {plan.horario.map((h) => (
                <div key={h.momento} className="text-sm">
                  <div className="font-semibold text-white">{h.momento}</div>
                  <div className="text-xs text-fuel">{h.suplementos.join(' · ')}</div>
                  {h.nota && <div className="text-xs text-slate-400">{h.nota}</div>}
                </div>
              ))}
              {plan.avisos.length > 0 && <ul className="list-disc space-y-0.5 border-t border-slate-700 pt-2 pl-4 text-[11px] text-amber-500">{plan.avisos.map((a, i) => <li key={i}>{a}</li>)}</ul>}
            </div>
          )}
          <div className="space-y-2 rounded-xl bg-slate-800 p-3">
            <div className="text-xs font-semibold uppercase text-slate-400">Añadir suplemento personalizado</div>
            <div className="grid grid-cols-[1fr_6rem] gap-2">
              <input className="field" placeholder="Nombre" value={name} onChange={(e) => setName(e.target.value)} />
              <input className="field" placeholder="Dosis (g/mg)" value={dose} onChange={(e) => setDose(e.target.value)} />
            </div>
            <button className="btn btn-ghost w-full" disabled={!name.trim()} onClick={add}><Plus size={16} /> Añadir</button>
          </div>
        </>
      )}
    </div>
  );
}
