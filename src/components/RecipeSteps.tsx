import { BookOpen, ChefHat, Clock, Lightbulb } from 'lucide-react';

/** Elaboración de una receta sugerida: tiempo, paso a paso y consejo. Se adapta a móvil (texto que baja de línea, sin desbordes). */
export function RecipeSteps({ tiempo, pasos, consejo }: { tiempo?: string; pasos?: string[]; consejo?: string }) {
  if (!pasos || pasos.length === 0) return <p className="rounded-lg bg-slate-800 p-2 text-xs text-slate-400">Esta sugerencia no trae elaboración. Pulsa «Otras ideas distintas» para generar una con paso a paso.</p>;
  return (
    <div className="space-y-2 rounded-lg bg-slate-800 p-3 text-xs text-slate-200">
      <div className="flex items-center gap-2 font-bold text-white"><ChefHat size={14} className="shrink-0 text-accent" /> Paso a paso{tiempo && <span className="ml-auto flex shrink-0 items-center gap-1 font-medium text-slate-300"><Clock size={12} /> {tiempo}</span>}</div>
      <ol className="space-y-1.5">
        {pasos.map((p, i) => (
          <li key={i} className="flex gap-2">
            <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-accent/20 text-[10px] font-bold text-accent">{i + 1}</span>
            <span className="min-w-0 break-words">{p}</span>
          </li>
        ))}
      </ol>
      {consejo && <p className="flex gap-1.5 rounded-md bg-emerald-500/10 p-2 text-emerald-400"><Lightbulb size={13} className="mt-0.5 shrink-0" /><span className="min-w-0 break-words">{consejo}</span></p>}
    </div>
  );
}

export const RecipeToggleLabel = ({ open }: { open: boolean }) => (
  <span className="flex items-center gap-1"><BookOpen size={12} /> {open ? 'Ocultar elaboración' : 'Ver elaboración / receta'}</span>
);
