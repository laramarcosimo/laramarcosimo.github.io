import { Target } from 'lucide-react';
import { reliabilityReport } from '../lib/mealCalc';
import { useStore } from '../lib/store';

/** En qué alimentos corriges más a la IA: la app ya aplica esos ajustes sola en las próximas fotos. */
export function ReliabilityCard() {
  const { state, update } = useStore();
  const rows = reliabilityReport(state.calib).slice(0, 6);
  const total = Object.keys(state.calib ?? {}).length;
  if (total === 0) return null;
  return (
    <div className="card space-y-2 text-sm text-slate-200">
      <div className="flex items-center gap-2 font-semibold text-white"><Target size={16} /> Cómo acierta la IA contigo</div>
      {rows.length === 0 ? (
        <p className="text-xs text-slate-400">Por ahora apenas la corriges en {total} alimento{total === 1 ? '' : 's'}: sus gramos son bastante fiables.</p>
      ) : (
        <ul className="space-y-1">
          {rows.map((r) => (
            <li key={r.key} className="flex items-baseline justify-between gap-2 text-xs">
              <span className="min-w-0 truncate capitalize text-slate-100">{r.key}</span>
              <span className={r.ratio > 1 ? 'text-amber-300' : 'text-sky-300'}>{r.texto} ({r.n} fotos)</span>
            </li>
          ))}
        </ul>
      )}
      <p className="text-[11px] text-slate-500">La app aplica estos ajustes sola en tus próximas fotos y lo indica en cada ingrediente.</p>
      <button className="text-[11px] text-slate-500 underline" onClick={() => { if (confirm('¿Borrar lo que ha aprendido de tus correcciones?')) update((s) => ({ ...s, calib: undefined })); }}>Olvidar lo aprendido</button>
    </div>
  );
}
