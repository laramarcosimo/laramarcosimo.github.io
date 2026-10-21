import { CalendarDays, Check, ShoppingCart, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { recipeContext } from '../lib/coach';
import { generateWeekMenu, type MenuDay, type MenuMeal } from '../lib/gemini';
import { dayBalance } from '../lib/metabolic';
import { useStore } from '../lib/store';
import { logTemplate } from '../lib/templates';
import { daysUntil, looseMatch, uid } from '../lib/utils';
import { ErrorBox, Spinner } from './ui';
import { Hint } from './Hint';

const KEY = 'apex-weekmenu';
const load = (): MenuDay[] => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as MenuDay[];
  } catch {
    return [];
  }
};

const EATEN_KEY = 'apex-weekmenu-eaten';
const loadEaten = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(EATEN_KEY) ?? '[]') as string[];
  } catch {
    return [];
  }
};

/** Menú semanal (comida y cena) pensado a partir de la despensa; lo que falta se manda a la lista de la compra. */
export function WeekMenu() {
  const { state, update } = useStore();
  const [menu, setMenu] = useState<MenuDay[]>(load);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [eaten, setEaten] = useState<string[]>(loadEaten);
  const eat = (id: string, slot: 'comida' | 'cena', m: MenuMeal) => {
    update((s) => logTemplate(s, { name: m.nombre, calorias: m.kcal, proteinas: m.proteinas, carbs: m.carbs, grasas: m.grasas, ingredientes: m.ingredientes }, true, slot));
    const next = [...eaten, id];
    setEaten(next);
    try {
      localStorage.setItem(EATEN_KEY, JSON.stringify(next));
    } catch {
      /* noop */
    }
  };

  const make = async () => {
    setBusy(true);
    setErr('');
    setMsg('');
    try {
      const b = dayBalance(state);
      const out = await generateWeekMenu(state.settings, state.pantry.map((p) => p.name), state.utensils, Math.round((b.target * 0.32) / 10) * 10, Math.round(b.proteinTarget * 0.3), state.dislikes, state.pantry.filter((p) => p.expires && daysUntil(p.expires) <= 4).map((p) => p.name), recipeContext(state, b));
      setMenu(out);
      setEaten([]);
      try {
        localStorage.setItem(EATEN_KEY, '[]');
      } catch {
        /* noop */
      }
      try {
        localStorage.setItem(KEY, JSON.stringify(out));
      } catch {
        /* noop */
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error desconocido');
    } finally {
      setBusy(false);
    }
  };

  const missing = (() => {
    const seen: string[] = [];
    for (const d of menu) for (const ing of [...d.comida.ingredientes, ...d.cena.ingredientes]) {
      if (!ing.trim() || seen.some((x) => looseMatch(x, ing))) continue;
      if (state.pantry.some((p) => p.qty > 0 && looseMatch(p.name, ing))) continue;
      seen.push(ing.trim());
    }
    return seen;
  })();

  const toList = () => {
    const fresh = missing.filter((m) => !state.shopping.some((x) => looseMatch(x.name, m)));
    update((s) => ({ ...s, shopping: [...s.shopping, ...fresh.map((name) => ({ id: uid(), name, qty: 1 }))] }));
    setMsg(fresh.length ? `${fresh.length} producto${fresh.length === 1 ? '' : 's'} añadido${fresh.length === 1 ? '' : 's'} a la lista de la compra.` : 'Ya estaba todo en la lista de la compra.');
  };

  return (
    <div className="space-y-3">
      <button className="btn btn-green w-full" disabled={busy} onClick={() => void make()}><Sparkles size={18} strokeWidth={1.75} /> {menu.length ? 'Generar otro menú' : 'Generar menú de la semana'}</button>
      {busy && <Spinner label="Preparando tu semana…" />}
      {err && <ErrorBox msg={err} />}
      {menu.length > 0 && (
        <>
          <div className="space-y-2">
            {menu.map((d, i) => (
              <div key={i} className="card !p-3">
                <div className="mb-1 flex items-center gap-1.5 text-sm font-bold text-white"><CalendarDays size={14} strokeWidth={1.75} className="text-accent" /> {d.dia}</div>
                {([['Comida', 'comida', d.comida], ['Cena', 'cena', d.cena]] as const).map(([l, slot, m]) => {
                  const id = `${i}-${slot}`;
                  return (
                  <div key={l} className="py-1 text-sm">
                    <div className="flex justify-between gap-2"><span className="text-slate-200"><b className="text-slate-400">{l}:</b> {m.nombre}</span><span className="shrink-0 text-xs text-slate-400">{m.kcal} kcal · P {m.proteinas}</span></div>
                    <div className="text-[11px] text-slate-500">{m.ingredientes.join(', ')}</div>
                    {eaten.includes(id) ? <div className="mt-1 flex items-center gap-1 text-xs text-fuel"><Check size={13} /> Registrado en el diario</div> : <button className="mt-1 rounded-lg bg-slate-800 px-2.5 py-1 text-xs font-semibold text-accent active:scale-95" onClick={() => eat(id, slot, m)}>Comí esto · registrar</button>}
                  </div>
                  );
                })}
              </div>
            ))}
          </div>
          <div className="card !p-3">
            <div className="text-sm text-slate-300">{missing.length === 0 ? 'Con tu despensa tienes todo lo necesario.' : <>Te faltan <b className="text-white">{missing.length}</b> producto{missing.length === 1 ? '' : 's'}: {missing.join(', ')}.</>}</div>
            {missing.length > 0 && <button className="btn btn-blue mt-2 w-full" onClick={toList}><ShoppingCart size={16} strokeWidth={1.75} /> Añadir lo que falta a la lista de la compra</button>}
            {msg && <div className="mt-2 text-xs text-fuel">{msg}</div>}
          </div>
        </>
      )}
      {menu.length === 0 && !busy && <Hint className="text-xs text-slate-500">Gemini propone comida y cena para 7 días según tu despensa, tus objetivos y lo que no te gusta.</Hint>}
    </div>
  );
}
