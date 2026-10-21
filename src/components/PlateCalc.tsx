import { useState } from 'react';
import { platesFor } from '../lib/plates';
import { cx, fmtKg } from '../lib/utils';
import { Modal, NumInput } from './ui';

const BARS: [number, string][] = [[20, 'Olímpica 20 kg'], [15, 'Mujer 15 kg'], [10, 'Ligera 10 kg']];
const COLOR: Record<number, string> = { 25: 'bg-red-500', 20: 'bg-blue-500', 15: 'bg-yellow-400 text-slate-900', 10: 'bg-emerald-500', 5: 'bg-slate-100 text-slate-900', 2.5: 'bg-slate-500', 1.25: 'bg-slate-400 text-slate-900' };

/** Calculadora de discos: qué poner a cada lado de la barra para un peso total. */
export function PlateCalc({ initial, onClose, onUse }: { initial: number; onClose: () => void; onUse?: (kg: number) => void }) {
  const [target, setTarget] = useState(initial);
  const [bar, setBar] = useState(() => {
    try {
      return Number(localStorage.getItem('apex-bar-kg')) || 20;
    } catch {
      return 20;
    }
  });
  const plan = platesFor(target, bar);
  const pick = (b: number) => {
    setBar(b);
    try {
      localStorage.setItem('apex-bar-kg', String(b));
    } catch {
      /* noop */
    }
  };
  const grouped = plan.perSide.reduce<Record<number, number>>((a, p) => ({ ...a, [p]: (a[p] ?? 0) + 1 }), {});
  return (
    <Modal title="Calculadora de discos" onClose={onClose}>
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-1.5">
          {BARS.map(([kg, l]) => <button key={kg} onClick={() => pick(kg)} className={cx('rounded-xl py-2 text-xs font-bold', bar === kg ? 'bg-accent text-white' : 'bg-slate-800 text-slate-300')}>{l}</button>)}
        </div>
        <div>
          <label className="label">Peso total (kg, con la barra)</label>
          <NumInput value={target} className="field text-center text-lg font-bold" onChange={setTarget} />
        </div>
        {target <= bar ? (
          <p className="rounded-xl bg-slate-800 p-3 text-sm text-slate-300">{target === bar ? 'Solo la barra, sin discos.' : `El peso mínimo es la barra (${bar} kg).`}</p>
        ) : (
          <div className="rounded-xl bg-slate-800 p-3">
            <div className="text-xs font-semibold uppercase text-slate-400">Por cada lado</div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {plan.perSide.map((p, i) => <span key={i} className={cx('flex h-10 min-w-10 items-center justify-center rounded-lg px-2 text-sm font-bold text-white', COLOR[p])}>{p}</span>)}
            </div>
            <div className="mt-2 text-sm text-slate-200">{Object.entries(grouped).sort((a, b) => Number(b[0]) - Number(a[0])).map(([p, n]) => `${n} × ${p} kg`).join(' + ') || '—'}</div>
            <div className="mt-1 text-xs text-slate-400">Total: <b className="text-white">{fmtKg(plan.total)} kg</b> (barra {bar} kg + 2 × {fmtKg((plan.total - bar) / 2)} kg)</div>
            {!plan.exact && <p className="mt-2 rounded-lg bg-amber-500/15 p-2 text-xs text-amber-500">Con discos de 1,25 kg o más no se llega a {fmtKg(target)} kg exactos: lo más cercano por debajo es {fmtKg(plan.total)} kg.</p>}
          </div>
        )}
        {onUse && plan.total > bar && <button className="btn btn-blue w-full" onClick={() => { onUse(plan.total); onClose(); }}>Usar {fmtKg(plan.total)} kg en el ejercicio</button>}
      </div>
    </Modal>
  );
}
