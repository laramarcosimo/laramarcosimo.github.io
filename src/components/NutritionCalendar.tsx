import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';
import { dayBalance } from '../lib/metabolic';
import { useStore } from '../lib/store';
import { SLOTS, slotOf } from '../lib/templates';
import { cx, dayKey } from '../lib/utils';
import { Modal } from './ui';

const DOW = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const MONTH_FMT = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' });
const DAY_FMT = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });

/** Calendario de alimentación: cada día se colorea según si llegaste a tu rango de kcal; al tocarlo ves qué comiste y los totales. */
export function NutritionCalendar() {
  const { state } = useStore();
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selected, setSelected] = useState<string | null>(null);
  const [todayKey] = useState(() => dayKey());
  const lead = (new Date(cursor.getFullYear(), cursor.getMonth(), 1).getDay() + 6) % 7;
  const total = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
  const cells: (number | null)[] = [...Array.from({ length: lead }, () => null), ...Array.from({ length: total }, (_, i) => i + 1)];
  const keyOf = (n: number) => dayKey(new Date(cursor.getFullYear(), cursor.getMonth(), n, 12).getTime());
  const logged = useMemo(() => new Set(state.meals.map((m) => dayKey(m.ts))), [state.meals]);
  const loggedCount = cells.filter((n) => n && logged.has(keyOf(n))).length;

  const tone = (k: string): string => {
    if (!logged.has(k)) return 'text-slate-400';
    const b = dayBalance(state, k);
    if (b.eaten > b.kcalMax) return 'bg-red-500/25 text-red-300';
    if (b.eaten >= b.kcalMin) return 'bg-emerald-500/25 text-emerald-300';
    return 'bg-amber-500/25 text-amber-300';
  };

  return (
    <div className="card !p-3">
      <div className="mb-2 flex items-center justify-between">
        <button className="rounded-full bg-slate-800 p-2" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} aria-label="Mes anterior"><ChevronLeft size={16} /></button>
        <div className="text-center">
          <div className="font-bold text-white">{MONTH_FMT.format(cursor).replace(/^./, (c) => c.toUpperCase())}</div>
          <div className="text-[11px] text-slate-400">{loggedCount} días con comidas anotadas</div>
        </div>
        <button className="rounded-full bg-slate-800 p-2" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} aria-label="Mes siguiente"><ChevronRight size={16} /></button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold text-slate-500">{DOW.map((d) => <span key={d}>{d}</span>)}</div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((n, i) => {
          if (!n) return <span key={i} />;
          const k = keyOf(n);
          return (
            <button key={i} onClick={() => setSelected(k)} aria-label={`Ver comidas del ${n}`} className={cx('flex h-10 items-center justify-center rounded-xl bg-slate-800/60 text-sm font-semibold', tone(k), k === todayKey && 'ring-2 ring-slate-400')}>
              {n}
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1 text-[11px] text-slate-400">
        <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-emerald-500" />En tu rango</span>
        <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-amber-500" />Por debajo</span>
        <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-red-500" />Por encima</span>
      </div>
      {selected && <DayMeals dayKeyStr={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function DayMeals({ dayKeyStr, onClose }: { dayKeyStr: string; onClose: () => void }) {
  const { state } = useStore();
  const b = dayBalance(state, dayKeyStr);
  const meals = state.meals.filter((m) => dayKey(m.ts) === dayKeyStr).sort((x, y) => x.ts - y.ts);
  const [y, m, d] = dayKeyStr.split('-').map(Number);
  const title = DAY_FMT.format(new Date(y, m - 1, d, 12)).replace(/^./, (c) => c.toUpperCase());
  const cells: [string, string][] = [
    ['Calorías', `${b.eaten}`],
    ['Proteína', `${Math.round(b.proteinEaten)} g`],
    ['Carbohidratos', `${Math.round(b.carbs)} g`],
    ['Grasas', `${Math.round(b.fat)} g`],
  ];
  return (
    <Modal title={title} onClose={onClose}>
      {meals.length === 0 ? (
        <p className="text-sm text-slate-400">No hay comidas anotadas este día.</p>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-4 gap-2 text-center">
            {cells.map(([l, v]) => <div key={l} className="rounded-xl bg-slate-800 p-2"><div className="text-sm font-bold text-white">{v}</div><div className="text-[10px] text-slate-400">{l}</div></div>)}
          </div>
          <p className="text-xs text-slate-400">Objetivo del día: {b.kcalMin}–{b.kcalMax} kcal · proteína {b.proteinTarget}{b.proteinMax > b.proteinTarget ? `–${b.proteinMax}` : ''} g · carbohidratos {b.carbsTarget} g · grasas {b.fatTarget} g.</p>
          {SLOTS.map((s) => {
            const list = meals.filter((x) => slotOf(x) === s.id);
            if (list.length === 0) return null;
            return (
              <div key={s.id}>
                <div className="mb-1 text-xs font-bold uppercase text-slate-400">{s.label} · {list.reduce((a, x) => a + x.calorias, 0)} kcal</div>
                <div className="space-y-1.5">
                  {list.map((x) => (
                    <div key={x.id} className="rounded-xl bg-slate-800 p-2.5">
                      <div className="flex items-start justify-between gap-2"><span className="min-w-0 flex-1 break-words text-sm font-semibold text-white">{x.plato}{x.out ? ' (fuera)' : ''}</span><span className="shrink-0 text-xs font-semibold text-slate-300">{x.calorias} kcal</span></div>
                      {x.detalle && x.detalle.length > 0 && <ul className="mt-1 space-y-0.5 text-[11px] text-slate-300">{x.detalle.map((l, k) => <li key={k}>• {l}</li>)}</ul>}
                      <div className="mt-1 text-[11px] text-slate-400">P {x.proteinas} · C {x.carbs} · G {x.grasas}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}
