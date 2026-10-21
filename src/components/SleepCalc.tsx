import { useState } from 'react';
import { FALL_ASLEEP_MIN, sleepCalc } from '../lib/sleepCalc';

const fmtHM = (h: number): string => {
  const t = Math.round(h * 60);
  return `${Math.floor(t / 60)}h ${String(t % 60).padStart(2, '0')}m`;
};

/** Calculadora de sueño: hora de acostarse + hora de despertar → horas dormidas (con 30 min para quedarse dormida). */
export function SleepCalc({ onUse }: { onUse: (hours: number) => void }) {
  const [open, setOpen] = useState(false);
  const [bed, setBed] = useState('23:30');
  const [wake, setWake] = useState('07:30');
  const r = sleepCalc(bed, wake);

  if (!open) {
    return <button className="w-full text-left text-[11px] font-semibold text-indigo-400" onClick={() => setOpen(true)}>Calculadora de sueño</button>;
  }
  return (
    <div className="space-y-1.5 rounded-lg bg-slate-800/50 p-2">
      <div className="grid grid-cols-2 gap-1.5 text-[10px] font-semibold text-slate-400">
        <label className="space-y-0.5">Me duermo a las
          <input type="time" value={bed} onChange={(e) => setBed(e.target.value)} className="w-full rounded-md bg-slate-800 px-1.5 py-1 text-sm text-white outline-none ring-1 ring-slate-700 focus:ring-accent" />
        </label>
        <label className="space-y-0.5">Quiero despertar a las
          <input type="time" value={wake} onChange={(e) => setWake(e.target.value)} className="w-full rounded-md bg-slate-800 px-1.5 py-1 text-sm text-white outline-none ring-1 ring-slate-700 focus:ring-accent" />
        </label>
      </div>
      {r ? (
        <div className="text-center">
          <div className="text-lg font-black tabular-nums text-white">{fmtHM(r.sleepH)}</div>
          <div className="text-[10px] text-slate-400">de sueño ({fmtHM(r.inBedH)} en la cama − {FALL_ASLEEP_MIN} min para dormirte)</div>
        </div>
      ) : (
        <div className="text-center text-[10px] text-slate-500">Elige las dos horas</div>
      )}
      <div className="grid grid-cols-2 gap-1.5">
        <button className="btn btn-ghost !px-1 !py-1.5 text-[11px]" onClick={() => setOpen(false)}>Cerrar</button>
        <button className="btn btn-blue !px-1 !py-1.5 text-[11px]" disabled={!r || r.sleepH <= 0} onClick={() => r && onUse(r.sleepH)}>Usar hoy</button>
      </div>
    </div>
  );
}
