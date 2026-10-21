import { BookmarkPlus } from 'lucide-react';
import { useState } from 'react';
import { repeatedMeals } from '../lib/repeats';
import { useStore } from '../lib/store';
import { uid } from '../lib/utils';

const KEY = 'apex-repeat-dismissed';

const dismissed = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as string[];
  } catch {
    return [];
  }
};

/** Te propone guardar como plato frecuente lo que registras muchas veces: con valores fijos es más exacto que estimarlo cada vez. */
export function RepeatedMealsCard() {
  const { state, update } = useStore();
  const [hidden, setHidden] = useState<string[]>(dismissed);
  const list = repeatedMeals(state.meals, state.mealTemplates).filter((r) => !hidden.includes(r.key)).slice(0, 2);
  if (list.length === 0) return null;

  const save = (i: number) => {
    const r = list[i];
    update((s) => ({ ...s, mealTemplates: [...s.mealTemplates, { id: uid(), name: r.name, calorias: r.calorias, proteinas: r.proteinas, carbs: r.carbs, grasas: r.grasas, ingredientes: [] }] }));
  };
  const hide = (key: string) => {
    const next = [...hidden, key];
    setHidden(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* sin almacenamiento */
    }
  };

  return (
    <div className="space-y-2">
      {list.map((r, i) => (
        <div key={r.key} className="space-y-2 rounded-xl bg-accent/10 p-3 text-sm text-slate-200">
          <div className="flex items-start gap-2"><BookmarkPlus size={16} className="mt-0.5 shrink-0 text-accent" /> <span>Has registrado «{r.name}» {r.veces} veces (media {r.calorias} kcal · P {r.proteinas} g). ¿Lo guardo como plato frecuente? Así lo añades con un toque y con la misma cifra siempre.</span></div>
          <div className="grid grid-cols-2 gap-2">
            <button className="btn btn-green !py-2 text-xs" onClick={() => save(i)}>Guardar plato</button>
            <button className="btn btn-ghost !py-2 text-xs" onClick={() => hide(r.key)}>No, gracias</button>
          </div>
        </div>
      ))}
    </div>
  );
}
