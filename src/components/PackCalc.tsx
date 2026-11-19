import { useState } from 'react';
import { NumInput } from './ui';

/** Calcula cuánto pesa cada pieza dividiendo el peso del paquete entre las piezas que trae (es una media). */
export function PackCalc({ label, onUse }: { label: string; onUse: (g: number) => void }) {
  const [n, setN] = useState(0);
  const [kg, setKg] = useState(0);
  const each = n > 0 && kg > 0 ? Math.round((kg / n) * 10) / 10 : 0;
  return (
    <div className="mt-1.5 space-y-1.5 rounded-lg bg-slate-900 p-2 text-[11px] text-slate-300">
      <div>O calcúlalo con el paquete: cuántas {label} trae y cuánto pone que pesa.</div>
      <div className="flex flex-wrap items-center gap-1.5">
        <NumInput label={`Cuántas ${label} trae el paquete`} value={n} placeholder="nº" className="field !w-14 !py-1 text-center text-xs" onChange={setN} />
        <span>{label} en</span>
        <NumInput label="Peso del paquete en gramos" value={kg} placeholder="g" className="field !w-16 !py-1 text-center text-xs" onChange={setKg} />
        <span>g</span>
        {each > 0 && <button className="btn btn-green !px-2.5 !py-1 text-xs" onClick={() => onUse(each)}>Usar {each} g c/u</button>}
      </div>
      {each > 0 && <div className="text-slate-500">Es una media: unas piezas pesan algo más y otras algo menos.</div>}
    </div>
  );
}
