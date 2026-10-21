import { Minus, Plus } from 'lucide-react';
import { NumInput } from './ui';

const round = (n: number): number => Math.round(n * 100) / 100;

/** Cantidad con [−] y [+] como atajos, pero con la cifra editable directamente con el teclado numérico (135 g, 2,5 unidades…). */
export function QtyInput({ value, onChange, step = 1, min = 0, label }: { value: number; onChange: (n: number) => void; step?: number; min?: number; label?: string }) {
  return (
    <div className="flex items-center gap-1">
      <button type="button" className="shrink-0 rounded-lg bg-slate-700 p-2 text-slate-200 active:scale-95" onClick={() => onChange(round(Math.max(min, value - step)))} aria-label={`Menos ${label ?? ''}`}><Minus size={14} /></button>
      <NumInput value={value} className="field !px-1 !py-2 w-16 min-w-0 text-center" onChange={onChange} />
      <button type="button" className="shrink-0 rounded-lg bg-slate-700 p-2 text-slate-200 active:scale-95" onClick={() => onChange(round(value + step))} aria-label={`Más ${label ?? ''}`}><Plus size={14} /></button>
    </div>
  );
}

/** Paso razonable del [−]/[+] según la unidad. */
export const stepOf = (unit: string): number => (unit === 'g' || unit === 'ml' ? 10 : unit === 'raciones' ? 0.5 : 1);
