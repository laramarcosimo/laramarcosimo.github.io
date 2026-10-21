import { Camera, Check, Plus } from 'lucide-react';
import { useState } from 'react';
import { num } from '../lib/utils';
import type { Set as SetLog } from '../lib/types';
import { cx } from '../lib/utils';
import { NumInput } from './ui';
import { TreadmillScan, type CardioResult } from './TreadmillScan';

const INPUT = 'h-9 w-full rounded-md bg-slate-800 text-center text-base font-semibold text-white outline-none focus:ring-1 focus:ring-accent';

/** Series de cardio (cinta, elíptica, bici): tiempo en minutos y distancia en km, con decimales con punto o coma. */
export function CardioBlock({ sets, onPatch, onAdd, onRemoveLast, onApplyScan }: {
  sets: SetLog[];
  onPatch: (id: string, p: Partial<SetLog>) => void;
  onAdd: () => void;
  onRemoveLast: () => void;
  onApplyScan: (r: CardioResult) => void;
}) {
  const [scan, setScan] = useState(false);
  let n = 0;
  // Con la fila vacía, al pulsar ✓ se rellena con lo de la sesión anterior.
  const toggle = (s: SetLog) => {
    if (s.completed) return onPatch(s.id, { completed: false });
    const m = s.previous?.match(/^([\d.,]+) min · ([\d.,]+) km/);
    onPatch(s.id, { completed: true, min: s.min || (m ? num(m[1]) : 0), km: s.km || (m ? num(m[2]) : 0) });
  };
  return (
    <>
      <button className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-accent/15 px-3 py-2.5 text-sm font-semibold text-accent active:scale-95" onClick={() => setScan(true)}>
        <Camera size={16} /> Escanear pantalla de cinta
      </button>
      <div className="mt-3 grid grid-cols-[38px_1fr_62px_62px_42px] items-center gap-1.5 px-1 pb-1 text-[10px] font-semibold uppercase text-slate-500">
        <span className="text-center">Set</span><span className="text-center">Anterior</span><span className="text-center">Min</span><span className="text-center">Km</span><span className="flex justify-center"><Check size={12} strokeWidth={2} /></span>
      </div>
      {sets.map((s) => {
        n++;
        const m = s.previous?.match(/^([\d.,]+) min · ([\d.,]+) km/);
        return (
          <div key={s.id} className={cx('mb-1.5 grid grid-cols-[38px_1fr_62px_62px_42px] items-center gap-1.5 rounded-lg p-1', s.completed && 'bg-emerald-500/15')}>
            <span className="flex h-9 items-center justify-center rounded-md bg-slate-800 text-sm font-bold text-slate-300">{n}</span>
            <span className="truncate text-center text-xs text-slate-500">{s.previous ?? '–'}</span>
            <NumInput value={s.min ?? 0} placeholder={m?.[1] ?? '0'} className={INPUT} onChange={(v) => onPatch(s.id, { min: v })} />
            <NumInput value={s.km ?? 0} placeholder={m?.[2] ?? '0.0'} className={INPUT} onChange={(v) => onPatch(s.id, { km: v })} />
            <button className={cx('flex h-9 items-center justify-center rounded-md', s.completed ? 'bg-fuel text-slate-950' : 'bg-slate-800 text-slate-500')} onClick={() => toggle(s)} aria-label="Completar serie"><Check size={20} /></button>
            {s.kcal ? <div className="col-span-5 -mt-0.5 pl-1 text-[10px] text-emerald-500">~{s.kcal} kcal reales (ACSM)</div> : null}
          </div>
        );
      })}
      <div className="mt-2 grid grid-cols-2 gap-2">
        <button className="btn btn-ghost !py-2" onClick={onAdd}><Plus size={15} /> Añadir serie</button>
        <button className="btn btn-ghost !py-2" disabled={sets.length === 0} onClick={onRemoveLast}>Eliminar última</button>
      </div>
      {scan && <TreadmillScan onClose={() => setScan(false)} onSave={onApplyScan} />}
    </>
  );
}
