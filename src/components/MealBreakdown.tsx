import { AlertTriangle, BookmarkCheck, X } from 'lucide-react';
import { hasRawVariant } from '../lib/foodDb';
import { DEFAULT_PUFF_G, oilGrams, setOil, SPOON_G, sourceCount, toggleRaw, totalsOf, withGrams } from '../lib/mealCalc';
import { useStore } from '../lib/store';
import { NumInput } from './ui';
import type { MealAnalysis, MealPart } from '../lib/types';

const fmt = (n: number) => String(Math.round(n * 10) / 10).replace('.', ',');

/** Desglose por ingrediente de un plato analizado: corrige gramos, crudo/cocinado y aceite (con «chuf») y los totales se recalculan al momento. */
export function MealBreakdown({ result, onChange }: { result: MealAnalysis; onChange: (r: MealAnalysis) => void }) {
  const { state, update } = useStore();
  const puff = state.settings.oilPuffG ?? DEFAULT_PUFF_G;
  const parts = result.desglose;
  const g = result.guardado;

  const savedBanner = g && (
    <div className="space-y-1.5 rounded-lg bg-emerald-500/10 p-2 text-xs text-slate-200">
      <div className="flex items-start gap-2"><BookmarkCheck size={14} className="mt-0.5 shrink-0 text-emerald-400" /> Parece tu «{g.nombre}» guardado ({g.calorias} kcal · P {g.proteinas} g). Sus valores salieron de pesarlo tú, así que son más fiables que la foto.</div>
      <button className="btn btn-green w-full !py-1.5 text-xs" onClick={() => onChange({ ...result, plato: g.nombre, calorias: g.calorias, proteinas: g.proteinas, carbs: g.carbs, grasas: g.grasas, desglose: undefined, guardado: undefined, aviso: undefined })}>Usar mis valores guardados</button>
    </div>
  );

  if (!parts || parts.length === 0) return savedBanner || null;

  const apply = (next: MealPart[]) => onChange({ ...result, desglose: next, ...(next.length ? totalsOf(next) : { calorias: 0, proteinas: 0, carbs: 0, grasas: 0 }) });
  const oil = oilGrams(parts);
  const src = sourceCount(parts);
  const chips: { label: string; grams: number }[] = [
    { label: 'Sin aceite', grams: 0 },
    { label: '1 chuf', grams: puff },
    { label: '3 chuf', grams: puff * 3 },
    { label: '5 chuf', grams: puff * 5 },
    { label: '1 cucharadita', grams: SPOON_G.cucharadita },
    { label: '1 cucharada', grams: SPOON_G.cucharada },
  ];

  return (
    <div className="space-y-2">
      {savedBanner}
      {result.aviso && <p className="flex items-start gap-2 rounded-lg bg-amber-500/10 p-2 text-xs text-amber-300"><AlertTriangle size={14} className="mt-0.5 shrink-0" /> {result.aviso}</p>}
      <div className="space-y-1 rounded-lg bg-slate-900 p-2">
        <div className="flex items-center justify-between text-[11px] font-semibold uppercase text-slate-400">
          <span>Ajusta los gramos si no cuadran</span>
          <span>kcal</span>
        </div>
        {parts.map((p, i) => (
          <div key={`${p.nombre}-${i}`} className="space-y-0.5">
            <div className="flex items-center gap-2 text-sm text-slate-200">
              <span className="min-w-0 flex-1 truncate">{p.nombre}{!p.tabla && <span className="ml-1 text-[10px] text-slate-500" title="Estimación de la IA, no está en la tabla de la app">~</span>}</span>
              <NumInput
                label={`Gramos de ${p.nombre}`}
                value={p.gramos}
                onChange={(n) => apply(parts.map((x, j) => (j === i ? withGrams(x, n) : x)))}
                className="w-20 rounded bg-slate-800 px-2 py-1 text-right text-white outline-none ring-1 ring-slate-700 focus:ring-accent"
              />
              <span className="text-xs text-slate-500">g</span>
              <span className="w-12 text-right text-xs tabular-nums text-slate-300">{p.calorias}</span>
              <button aria-label={`Quitar ${p.nombre}`} className="text-slate-500 hover:text-red-400" onClick={() => apply(parts.filter((_, j) => j !== i))}><X size={14} /></button>
            </div>
            <div className="flex items-center gap-2 pl-0.5 text-[10px] text-slate-500">
              {p.tabla && hasRawVariant(p.nombre) && (
                <button className="rounded bg-slate-800 px-1.5 py-0.5 text-slate-300 ring-1 ring-slate-700" onClick={() => apply(parts.map((x, j) => (j === i ? toggleRaw(x) : x)))} aria-label={`Cambiar ${p.nombre} entre crudo y cocinado`}>
                  pesado {p.crudo ? 'crudo' : 'cocinado'} · tocar para cambiar
                </button>
              )}
              {p.ajuste && <span>ajustado ×{fmt(p.ajuste)} según tus correcciones</span>}
            </div>
          </div>
        ))}
        <div className="pt-1 text-[10px] text-slate-500">{src.tabla} de {parts.length} con valores de la tabla · {src.ia} estimado{src.ia === 1 ? '' : 's'} por la IA (~)</div>
      </div>
      <div className="space-y-1.5 rounded-lg bg-slate-900 p-2">
        <div className="text-[11px] font-semibold uppercase text-slate-400">Aceite ahora: {oil > 0 ? `${fmt(oil)} g (${Math.round(oil * 9)} kcal)` : 'ninguno'}</div>
        <div className="flex flex-wrap gap-1.5">
          {chips.map((c) => (
            <button key={c.label} className={`rounded-full px-2.5 py-1 text-xs ring-1 ${Math.abs(oil - c.grams) < 0.05 ? 'bg-accent text-slate-900 ring-accent' : 'bg-slate-800 text-slate-200 ring-slate-700'}`} onClick={() => apply(setOil(parts, c.grams))}>{c.label}</button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-[11px] text-slate-400">
          1 chuf de tu dispensador =
          <NumInput
            label="Gramos de aceite por chuf"
            value={puff}
            onChange={(v) => { if (v > 0 && v < 10) update((s) => ({ ...s, settings: { ...s.settings, oilPuffG: v } })); }}
            className="w-16 rounded bg-slate-800 px-2 py-1 text-right text-white outline-none ring-1 ring-slate-700 focus:ring-accent"
          />
          g <span className="text-slate-600">(pesa 10 chufs y divide entre 10)</span>
        </label>
      </div>
    </div>
  );
}
