import { Check, Loader2, Pencil, Plus, RefreshCw, Sparkles, ThumbsDown, Trash2, X } from 'lucide-react';
import { fitsSlot, suggestForSlot, swapIngredient, type IngredientSwap, type MealOption } from '../lib/gemini';
import { isFruit, placeOf } from '../lib/pantry';
import { planText } from '../lib/metabolic';
import { autoSkipDue, meriendaText, periText, weekContext } from '../lib/nutriWeek';
import { storeList } from '../lib/stores';
import { IngredientEditor, type IngredientEdit } from './IngredientEditor';
import { suggestMacroFix } from '../lib/macroFix';
import { foodNameOf } from '../lib/dislikes';
import { incoherence, missingFromPantry } from '../lib/coherence';
import { slotTarget } from '../lib/slotTargets';
import { RecipeSteps, RecipeToggleLabel } from './RecipeSteps';
import { FoodComposer } from './FoodComposer';
import { PantryPicker } from './PantryPicker';
import { lineToItem } from '../lib/foodItems';
import type { FoodItemInput } from '../lib/gemini';
import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { addToDraft, draftCount, getDraft, subscribeDraft } from '../lib/composeDraft';
import { dayBalance } from '../lib/metabolic';
import { useStore } from '../lib/store';
import { SLOTS, saveMealTemplate, slotOf } from '../lib/templates';
import type { Meal, PlannedMeal, Slot } from '../lib/types';
import { cx, dayKey } from '../lib/utils';
import { Modal, NumInput } from './ui';
import { canPlanTomorrow, movePlannedToDiary, nextDayKey, pendingSlots } from '../lib/plan';

/**
 * «Hoy como esto…»: marca por adelantado lo que comerás (tuppers, comidas guardadas, productos de la despensa o a mano),
 * ve el balance proyectado del día y qué te falta o te sobra; sugiere cómo completarlo con tu despensa.
 */
export function DayPlanner({ onAdd, onEditMeal, render }: { onAdd?: (slot: Slot) => void; onEditMeal?: (m: Meal) => void; render?: (p: { head: ReactNode; slots: Record<string, ReactNode>; modals: ReactNode }) => ReactNode } = {}) {
  const { state, update } = useStore();
  const [picking, setPicking] = useState<Slot | null>(null);
  const [one, setOne] = useState<Partial<Record<Slot, { busy: boolean; items: MealOption[]; err: string }>>>({});
  const [seenOne, setSeenOne] = useState<Partial<Record<Slot, string[]>>>({}); // ideas ya mostradas por toma: no se repiten
  const [editing, setEditing] = useState<Slot | null>(null);
  /** Ingrediente que se está ajustando (en una comida anotada o en una prevista). */
  const [ing, setIng] = useState<{ kind: 'meal'; id: string; idx: number } | { kind: 'plan'; slot: Slot; idx: number } | null>(null);
  const today = dayKey();
  const tomorrowKey = nextDayKey();
  // Pasada la hora de cenar se puede planificar el día siguiente (mismas tarjetas, otro plan).
  const [viewDay, setViewDay] = useState<'hoy' | 'manana'>('hoy');
  const canTomorrow = canPlanTomorrow(state);
  const isTomorrow = viewDay === 'manana' && canTomorrow;
  const viewKey = isTomorrow ? tomorrowKey : today;
  const planField = isTomorrow ? 'nextPlan' : 'dayPlan';
  const dpView = isTomorrow ? (state.nextPlan?.day === tomorrowKey ? state.nextPlan : undefined) : state.dayPlan?.day === today ? state.dayPlan : undefined;
  const plan = dpView?.slots ?? {};
  const b = dayBalance(state, viewKey);
  const tomorrowDate = new Date(Date.now() + 86_400_000);
  // El plan de hoy (para el tachado automático) es siempre el de hoy, se esté viendo lo que se vea.
  const todayPlan = state.dayPlan?.day === today ? state.dayPlan.slots : {};
  const todaySkipped: Slot[] = state.dayPlan?.day === today ? state.dayPlan.skipped ?? [] : [];

  const planned = Object.values(plan) as PlannedMeal[];
  const plannedKcal = planned.reduce((a, p) => a + p.calorias, 0);
  const plannedProt = planned.reduce((a, p) => a + p.proteinas, 0);
  const leftProt = b.proteinRemaining - plannedProt;
  const skipped: Slot[] = dpView?.skipped ?? [];
  // Tacha sola la toma que ya no vas a hacer: desayuno pasadas las 12:00 y merienda pasadas las 20:00 sin nada registrado ni previsto (siempre se puede volver a poner).
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    const h = new Date().getHours();
    const due = autoSkipDue(h, { planned: Object.keys(todayPlan), skipped: todaySkipped, restored: state.dayPlan?.day === today ? state.dayPlan.restored ?? [] : [], logged: state.meals.filter((m) => dayKey(m.ts) === today).map((m) => slotOf(m)) }) as Slot[];
    if (due.length === 0) return;
    update((s) => {
      const dp = s.dayPlan?.day === today ? s.dayPlan : undefined;
      return { ...s, dayPlan: { day: today, slots: dp?.slots ?? {}, skipped: [...new Set([...(dp?.skipped ?? []), ...due])], auto: [...new Set([...(dp?.auto ?? []), ...due])], restored: dp?.restored } };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, state.meals, state.dayPlan]);
  // Tomas ya anotadas hoy: no cuentan como libres, así lo que queda del día se reparte solo entre las tomas pendientes.
  const todayMeals = state.meals.filter((m) => dayKey(m.ts) === viewKey);
  const free = SLOTS.filter((s) => pendingSlots(state, viewKey, dpView).some((f) => f.id === s.id));
  const wsum = free.reduce((a, s) => a + s.weight, 0) || 1;
  const plannedTot = { kcal: plannedKcal, prot: plannedProt, carbs: planned.reduce((a, p) => a + p.carbs, 0), fat: planned.reduce((a, p) => a + p.grasas, 0) };
  /** Objetivos numéricos de una toma: parte del resto del día que le toca (calorías, proteína, carbohidratos y grasa). */
  const targetOf = (slot: Slot) => {
    const w = SLOTS.find((x) => x.id === slot)?.weight ?? 0;
    const inFree = free.some((f) => f.id === slot);
    return slotTarget(b, plannedTot, w === 0 ? 0 : inFree ? w / wsum : w / (wsum + w));
  };

  const setSlot = (slot: Slot, meal: PlannedMeal | null) =>
    update((s) => {
      const base = s[planField]?.day === viewKey ? s[planField] : undefined;
      const cur = { ...(base?.slots ?? {}) };
      if (meal) cur[slot] = meal;
      else delete cur[slot];
      const sk = (base?.skipped ?? []).filter((x) => !(meal && x === slot));
      return { ...s, [planField]: { ...(base ?? {}), day: viewKey, slots: cur, skipped: sk } };
    });

  /** Marca (o desmarca) una toma como «hoy me la salto»: su presupuesto de kcal y proteína pasa al resto. */
  const skipSlot = (slot: Slot, on: boolean) =>
    update((s) => {
      const dp = s[planField]?.day === viewKey ? s[planField] : undefined;
      const cur = dp?.slots ?? {};
      const sk = (dp?.skipped ?? []).filter((x) => x !== slot);
      const restored = (dp?.restored ?? []).filter((x) => x !== slot);
      return { ...s, [planField]: { day: viewKey, slots: cur, skipped: on ? [...sk, slot] : sk, auto: (dp?.auto ?? []).filter((x) => x !== slot), restored: on ? restored : [...restored, slot] } };
    });

  // Inventario por ubicación y fruta: la IA incluye fruta de tu despensa hasta llegar a 2 piezas al día.
  const inventory = { nevera: [] as string[], despensa: [] as string[], congelador: [] as string[] };
  for (const p of state.pantry) if (p.qty > 0) inventory[placeOf(p)].push(p.name);
  const fruitMin = Math.max(0, Math.min(5, Math.round(state.settings.fruitMin ?? 1)));
  const fruitToday = [...state.meals.filter((m) => dayKey(m.ts) === viewKey).flatMap((m) => [m.plato, ...(m.detalle ?? [])]), ...planned.flatMap((p) => [p.name, ...(p.detalle ?? [])])].filter((t) => isFruit(foodNameOf(t)) || isFruit(t)).length;
  const frutaPendiente = Math.max(0, fruitMin - fruitToday);
  const frutasDespensa = state.pantry.filter((p) => p.qty > 0 && isFruit(p.name)).map((p) => p.name);

  /** Macros de una toma: lo que le toca (punto medio del baremo repartido) y lo que queda del día entre mínimo y máximo. */
  const macroBudget = (slot: Slot) => {
    const t = targetOf(slot);
    return {
      carbsSlot: t.carbs,
      grasaSlot: t.fat,
      restoCarbs: Math.max(0, Math.round(b.carbsTarget - b.carbs - plannedTot.carbs)),
      restoGrasa: Math.max(0, Math.round(b.fatTarget - b.fat - plannedTot.fat)),
      restoCarbsMin: Math.max(0, Math.round(b.carbsMin - b.carbs - plannedTot.carbs)),
      restoGrasaMin: Math.max(0, Math.round(b.fatMin - b.fat - plannedTot.fat)),
    };
  };
  /** Presupuesto aproximado de una toma (para recalcular al cambiar un ingrediente). */
  const budgetOf = (slot: Slot) => {
    const t = targetOf(slot);
    return { kcal: t.kcal, prot: t.prot, kcalLow: t.kcalLow, kcalHigh: t.kcalHigh, protCap: t.protCap, resto: Math.max(0, b.kcalMax - b.eaten - plannedKcal), ...macroBudget(slot) };
  };

  // Sugerencias solo para una toma: con lo que queda del día, el tipo de comida y el inventario (nevera, despensa y congelador).
  const suggestOne = async (slot: Slot) => {
    setOne((o) => ({ ...o, [slot]: { busy: true, items: [], err: '' } }));
    try {
      const tg = targetOf(slot);
      const inv = inventory;
      const items = await suggestForSlot(
        state.settings,
        {
          slot,
          kcal: tg.kcal,
          proteina: tg.prot,
          kcalMin: tg.kcalLow,
          kcalMax: tg.kcalHigh,
          proteinaMax: tg.protCap,
          proteinaCubierta: tg.covered,
          kcalFaltanMin: tg.kcalToMin,
          restoKcal: Math.max(0, b.kcalMax - b.eaten - plannedKcal),
          restoProteina: Math.max(0, Math.round(leftProt)),
          ...macroBudget(slot),
          inventario: inv,
          noLeGusta: state.dislikes,
          planDia: `${planText(state.settings)} ${periText(state, b.trainingDay)} ${meriendaText(state.settings, isTomorrow ? tomorrowDate : new Date())} ${weekContext(state)}`,
          evitar: (seenOne[slot] ?? []).slice(-9),
          frutaPendiente,
          frutaMin: fruitMin,
          // Si esta es la última toma libre del día, la fruta pendiente es obligatoria.
          frutaObligatoria: frutaPendiente > 0 && free.filter((f) => f.id !== slot).length === 0,
          frutasDespensa,
          variante: Math.floor((seenOne[slot] ?? []).length / 3) + 1,
          utensilios: state.utensils,
        },
        storeList(state.defaultSupermarket, state.supermarkets),
        state.defaultSupermarket,
      );
      setSeenOne((c) => ({ ...c, [slot]: [...(c[slot] ?? []), ...items.map((o) => o.nombre)] }));
      setOne((o) => ({ ...o, [slot]: { busy: false, items, err: items.length ? '' : 'No he encontrado ideas nuevas. Pulsa otra vez para intentarlo de nuevo.' } }));
    } catch (e) {
      setOne((o) => ({ ...o, [slot]: { busy: false, items: [], err: e instanceof Error ? e.message : 'No se pudo consultar al Coach.' } }));
    }
  };

  const head = canTomorrow && (
        <div className="space-y-1.5">
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-800 p-1 text-xs font-bold" role="group" aria-label="Día a planificar">
            {([['hoy', 'Hoy'], ['manana', `Mañana · ${tomorrowDate.toLocaleDateString('es-ES', { weekday: 'long' })}`]] as const).map(([id, l]) => <button key={id} aria-pressed={viewDay === id} onClick={() => setViewDay(id)} className={cx('rounded-lg px-2 py-2 capitalize', viewDay === id ? 'bg-slate-900 text-accent' : 'text-slate-400')}>{l}</button>)}
          </div>
          {isTomorrow && <p className="rounded-lg bg-accent/10 p-2 text-xs text-slate-200">Planificando <b className="text-white">mañana</b> ({b.trainingDay ? 'día de entreno' : 'día de descanso'}): te caben {b.kcalMin.toLocaleString('es-ES')}–{b.kcalMax.toLocaleString('es-ES')} kcal y {b.proteinTarget} g de proteína. Lo que dejes previsto pasa solo a tu diario cuando llegue cada toma.</p>}
        </div>
  );
  const slotNodes: Record<string, ReactNode> = Object.fromEntries(SLOTS.map((s) => {
          const p = plan[s.id];
          const eatenHere = todayMeals.filter((m) => slotOf(m) === s.id).sort((x, y) => x.ts - y.ts);
          const hasLogged = eatenHere.length > 0;
          const keptKcal = eatenHere.reduce((acc, m) => acc + m.calorias, 0);
          const isFree = free.some((f) => f.id === s.id);
          const tgt = isFree ? targetOf(s.id) : null;
          const budgetK = tgt?.kcal ?? 0;
          const budgetP = tgt?.prot ?? 0;
          const protCovered = !!tgt?.covered;
          const rangeCovered = b.eaten + plannedKcal >= b.kcalMin;
          const openAdd = () => (onAdd && !isTomorrow ? onAdd(s.id) : setPicking(s.id));
          return [s.id, (
            <div className="card !p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="font-semibold text-white">{s.label}{hasLogged && <span className="ml-2 text-xs font-medium text-slate-400">{keptKcal} kcal</span>}</div>
                {!hasLogged && !p && !skipped.includes(s.id) && (
                  <button className="rounded-lg bg-slate-700 p-1.5 text-slate-200 active:scale-95" onClick={() => skipSlot(s.id, true)} aria-label={`Saltar ${s.label.toLowerCase()}`}><X size={16} /></button>
                )}
                {p && (
                  <div className="flex items-center gap-1">
                    <button className="rounded-lg p-1.5 text-accent" onClick={() => setEditing(s.id)} aria-label={`Editar lo previsto en ${s.label.toLowerCase()}`}><Pencil size={14} /></button>
                    <button className="p-1.5 text-slate-500" onClick={() => { setOne((c) => ({ ...c, [s.id]: undefined })); setSlot(s.id, null); }} aria-label="Quitar lo previsto"><Trash2 size={14} /></button>
                  </div>
                )}
              </div>

              {hasLogged && (
                <div className="mt-2 space-y-1">
                  {eatenHere.map((m) => (
                    <div key={m.id} className="flex items-start gap-2 rounded-lg bg-slate-900 px-3 py-2">
                      <div className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-white">{m.plato}{m.out && <span className="ml-1.5 rounded bg-slate-700 px-1.5 py-0.5 align-middle text-[10px] font-normal text-slate-300">fuera</span>}</span>
                        {m.detalle && m.detalle.length > 0 && (
                          <ul className="mt-0.5 space-y-0.5 text-[11px] text-slate-300">
                            {m.detalle.map((d, k) => <li key={k} className="flex items-start gap-1"><span className="min-w-0 flex-1 break-words">• {d}</span><button className="shrink-0 rounded p-0.5 text-accent" onClick={() => setIng({ kind: 'meal', id: m.id, idx: k })} aria-label={`Ajustar ${d}`}><Pencil size={11} /></button></li>)}
                          </ul>
                        )}
                        <span className="block text-[11px] text-slate-400">P {m.proteinas} · C {m.carbs} · G {m.grasas}</span>
                      </div>
                      <span className="mt-0.5 shrink-0 text-xs font-semibold text-slate-300">{m.calorias} kcal</span>
                      {onEditMeal && <button className="shrink-0 rounded-lg bg-accent/15 p-1.5 text-accent active:scale-95" onClick={() => onEditMeal(m)} aria-label={`Editar ${m.plato}`}><Pencil size={14} /></button>}
                    </div>
                  ))}
                  <button className="flex items-center gap-1 pt-1 text-xs font-semibold text-accent" onClick={openAdd}><Plus size={13} strokeWidth={2.2} /> Añadir algo más a {s.label.toLowerCase()}</button>
                </div>
              )}

              {p && (
                <div className="mt-2 rounded-lg bg-slate-900/60 p-2 text-xs text-slate-400">
                  <div className="text-[10px] font-semibold uppercase text-accent">Previsto</div>
                  <div className="text-slate-200">{p.name}</div>
                  {p.detalle && p.detalle.length > 0 && <ul className="mt-0.5 space-y-0.5">{p.detalle.map((d, k) => <li key={k} className="flex items-start gap-1"><span className="min-w-0 flex-1 break-words">• {d}</span><button className="shrink-0 rounded p-0.5 text-accent" onClick={() => setIng({ kind: 'plan', slot: s.id, idx: k })} aria-label={`Ajustar ${d}`}><Pencil size={11} /></button></li>)}</ul>}
                  <div className="mt-0.5">{p.calorias} kcal · P {p.proteinas} · C {p.carbs} · G {p.grasas}</div>
                  {p.pasos && p.pasos.length > 0 && <div className="mt-1.5"><RecipeSteps tiempo={p.tiempo} pasos={p.pasos} consejo={p.consejo} /></div>}
                  {!isTomorrow && <button className="btn btn-green mt-2 w-full !py-2 text-xs" onClick={() => update((st) => movePlannedToDiary(st, s.id))}>Anotar ya en el diario</button>}
                </div>
              )}

              {!hasLogged && !p && skipped.includes(s.id) && (
                <div className="mt-1 flex items-center justify-between gap-2 text-xs text-slate-400"><span>{!isTomorrow && state.dayPlan?.auto?.includes(s.id) ? 'Como ya pasó la hora y no hay nada registrado, la he tachado sola: sus kcal pasan a las demás tomas.' : 'Toma saltada: sus kcal y su proteína pasan a las demás tomas.'}</span><button className="shrink-0 font-semibold text-accent" onClick={() => skipSlot(s.id, false)}>Volver a ponerla</button></div>
              )}

              {!hasLogged && !p && !skipped.includes(s.id) && (
                <>
                  <div className="mt-1 text-xs text-slate-400">
                    {s.id === 'snack'
                      ? <>Opcional: lo que comas aquí cuenta para el total del día{b.kcalMax - b.eaten - plannedKcal > 0 ? <> (caben hasta <b className="text-white">{Math.max(0, b.kcalMax - b.eaten - plannedKcal)} kcal</b>)</> : null}.</>
                      : budgetK > 0 || !rangeCovered
                        ? <>Te caben ≈ <b className="text-white">{budgetK} kcal</b> {protCovered ? <>· proteína de hoy <b className="text-white">ya cubierta</b> (en esta toma, poca)</> : <>y <b className="text-white">{budgetP} g</b> de proteína</>}{tgt && tgt.kcalToMin > 0 && <span className="block text-[11px] text-slate-500">Para tu mínimo del día aún faltan {tgt.kcalToMin} kcal en total.</span>}{frutaPendiente > 0 && <span className="block text-[11px] text-emerald-500">Aún no has llegado a tu fruta de hoy ({fruitMin} pieza{fruitMin === 1 ? '' : 's'} mínimo).</span>}</>
                        : <>Ya cubriste el rango del día. Si tienes hambre, caben hasta <b className="text-white">{Math.max(0, b.kcalMax - b.eaten - plannedKcal)} kcal</b> (opcional).</>}
                  </div>
                  <div className="mt-2 space-y-2">
                    <button className="btn btn-blue w-full !py-2.5" onClick={openAdd}><Plus size={16} strokeWidth={2.2} /> Añadir alimento</button>
                    <button className="btn btn-ghost w-full !py-2.5 text-accent" disabled={one[s.id]?.busy} onClick={() => void suggestOne(s.id)}>{one[s.id]?.busy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} Sugerir receta para esta toma</button>
                  </div>
                  {one[s.id] && !one[s.id]!.busy && one[s.id]!.err && <p className="mt-1 text-[11px] text-red-400">{one[s.id]!.err}</p>}
                  {one[s.id] && !one[s.id]!.busy && one[s.id]!.items.length > 0 && (
                    <div className="mt-2 space-y-1.5">
                      {one[s.id]!.items.map((o, i) => (
                        <OptionCard key={`${s.id}-${i}-${o.nombre}`} o={o} slot={s.id} budget={budgetOf(s.id)} onAdd={(x) => { setSlot(s.id, { name: x.nombre, calorias: x.calorias, proteinas: x.proteinas, carbs: x.carbs, grasas: x.grasas, pantryNames: x.usa.length ? x.usa : undefined, detalle: x.detalle.length ? x.detalle : undefined, tiempo: x.tiempo, pasos: x.pasos, consejo: x.consejo }); setOne((cur) => ({ ...cur, [s.id]: undefined })); }} />
                      ))}
                      <button className="flex items-center gap-1 text-xs font-semibold text-accent" disabled={one[s.id]?.busy} onClick={() => void suggestOne(s.id)}><RefreshCw size={12} /> Otras ideas distintas</button>
                    </div>
                  )}
                </>
              )}
            </div>
          )] as const;
        }));
  const modals = (
    <>
      {ing && (() => {
        const meal = ing.kind === 'meal' ? state.meals.find((x) => x.id === ing.id) : undefined;
        const planned = ing.kind === 'plan' ? plan[ing.slot] : undefined;
        const line = (meal?.detalle ?? planned?.detalle)?.[ing.idx];
        if (line === undefined) return null;
        return (
          <IngredientEditor
            line={line}
            onClose={() => setIng(null)}
            onSave={(r) => {
              const fix = <T extends { detalle?: string[]; calorias: number; proteinas: number; carbs: number; grasas: number }>(x: T): T => ({ ...x, detalle: (x.detalle ?? []).map((d, j) => (j === ing.idx ? r.line : d)), calorias: Math.max(0, x.calorias + r.delta.kcal), proteinas: Math.max(0, x.proteinas + r.delta.prot), carbs: Math.max(0, x.carbs + r.delta.carbs), grasas: Math.max(0, x.grasas + r.delta.fat) });
              if (meal) update((st) => ({ ...st, meals: st.meals.map((x) => (x.id === meal.id ? fix(x) : x)) }));
              else if (planned && ing.kind === 'plan') setSlot(ing.slot, fix(planned));
              setIng(null);
            }}
          />
        );
      })()}
      {editing && plan[editing] && <PlanModal slot={editing} edit={plan[editing]!} onPick={(m) => { setSlot(editing, m); setEditing(null); }} onClose={() => setEditing(null)} />}
      {picking && <PlanModal slot={picking} onPick={(m) => { setSlot(picking, m); setPicking(null); }} onClose={() => setPicking(null)} />}
    </>
  );
  if (render) return <>{render({ head, slots: slotNodes, modals })}</>;
  return (
    <div className="space-y-2">
      {head}
      <div className="space-y-2">{SLOTS.map((s) => <div key={s.id}>{slotNodes[s.id]}</div>)}</div>
      {modals}
    </div>
  );
}

type Tab = 'tuppers' | 'guardadas' | 'despensa' | 'manual';

function PlanModal({ slot, onPick, onClose, edit }: { slot: Slot; onPick: (m: PlannedMeal) => void; onClose: () => void; edit?: PlannedMeal }) {
  const { state, update } = useStore();
  const [tab, setTab] = useState<Tab>(edit ? 'manual' : state.tuppers.some((t) => t.servings > 0) ? 'tuppers' : 'guardadas');
  const [m, setM] = useState<PlannedMeal>(edit ?? { name: '', calorias: 0, proteinas: 0, carbs: 0, grasas: 0 });
  // Al editar, los ingredientes de la comida se abren como alimentos editables (igual que con el «+»).
  const editItems: FoodItemInput[] | undefined = edit ? (edit.detalle?.length ? edit.detalle.map(lineToItem) : [{ nombre: edit.name, cantidad: 1, unidad: 'unidades' }]) : undefined;
  const [manualRaw, setManualRaw] = useState(false);
  const draftKey = edit ? `plan-edit:${slot}` : `plan:${slot}`;
  const inDraft = useSyncExternalStore((f) => subscribeDraft(draftKey, f), () => draftCount(draftKey), () => 0);
  const [saveRaw, setSaveRaw] = useState(false);
  const TABS: [Tab, string][] = [['tuppers', 'Tuppers'], ['guardadas', 'Guardadas'], ['despensa', 'Despensa'], ['manual', inDraft > 0 ? `A mano (${inDraft})` : 'A mano']];
  const row = (key: string, name: string, sub: string, meal: PlannedMeal) => (
    <button key={key} className="flex w-full items-center justify-between rounded-xl bg-slate-800 px-3 py-2.5 text-left active:scale-[0.99]" onClick={() => onPick(meal)}>
      <span className="min-w-0"><span className="block truncate text-sm font-semibold text-white">{name}</span><span className="block text-[11px] text-slate-400">{sub}</span></span>
      <span className="ml-2 shrink-0 text-xs text-slate-400">{meal.calorias} kcal</span>
    </button>
  );
  return (
    <Modal title={`${edit ? 'Editar' : 'Prever'} ${SLOTS.find((s) => s.id === slot)?.label.toLowerCase()}`} onClose={onClose}>
      <div className="mb-3 grid grid-cols-4 gap-1 rounded-xl bg-slate-800 p-1">
        {TABS.map(([id, l]) => <button key={id} onClick={() => setTab(id)} className={cx('min-w-0 truncate rounded-lg px-0.5 py-2 text-[11px] font-bold', tab === id ? 'bg-accent text-white' : 'text-slate-400')}>{l}</button>)}
      </div>
      <div className="space-y-1.5">
        {tab === 'tuppers' && (state.tuppers.filter((t) => t.servings > 0).length === 0 ? <p className="text-sm text-slate-500">No tienes tuppers con raciones. Añádelos en «Comida preparada».</p> : state.tuppers.filter((t) => t.servings > 0).map((t) => row(t.id, t.name, `Tupper · P ${t.proteinas} · quedan ${t.servings}`, { name: t.name, calorias: t.calorias, proteinas: t.proteinas, carbs: t.carbs, grasas: t.grasas, tupperId: t.id })))}
        {tab === 'guardadas' && (state.mealTemplates.length === 0 ? <p className="text-sm text-slate-500">Aún no tienes comidas guardadas.</p> : state.mealTemplates.map((t) => row(t.id, t.name, `P ${t.proteinas} · C ${t.carbs} · G ${t.grasas}`, { name: t.name, calorias: t.calorias, proteinas: t.proteinas, carbs: t.carbs, grasas: t.grasas, templateId: t.id })))}

      </div>
      {/* Siempre montados (solo se ocultan): lo que eliges no se pierde al cambiar de pestaña. */}
      <div className={tab === 'despensa' ? '' : 'hidden'}>
        <PantryPicker onQuick={(f) => onPick({ name: f.portion, calorias: f.kcal, proteinas: f.protein, carbs: f.carbs, grasas: f.fat, pantryName: f.item.name })} onDone={(items, used) => { addToDraft(draftKey, items, used); setManualRaw(false); setTab('manual'); }} />
      </div>
      <div className={tab === 'manual' && !manualRaw ? '' : 'hidden'}>
        <FoodComposer draftKey={draftKey} initial={editItems} localCalc={!!edit} confirmLabel={edit ? 'Guardar cambios' : 'Añadir al plan'} onManual={() => setManualRaw(true)} onConfirm={(r, save) => { const used = getDraft(draftKey).used; if (save) update((st) => saveMealTemplate(st, r, slot)); onPick({ name: r.name, calorias: r.calorias, proteinas: r.proteinas, carbs: r.carbs, grasas: r.grasas, detalle: r.detalle, ...(used.length ? { pantryNames: used } : {}) }); }} />
      </div>
      {tab === 'manual' && manualRaw && (
        <div className="space-y-2">
          <input className="field" placeholder="Qué vas a comer (ej: pasta con atún)" value={m.name} onChange={(e) => setM({ ...m, name: e.target.value })} />
          <div className="grid grid-cols-4 gap-2">
            <div><label className="label">kcal</label><NumInput value={m.calorias} className="field text-center" onChange={(n) => setM({ ...m, calorias: n })} /></div>
            <div><label className="label">Prot g</label><NumInput value={m.proteinas} className="field text-center" onChange={(n) => setM({ ...m, proteinas: n })} /></div>
            <div><label className="label">Carbs g</label><NumInput value={m.carbs} className="field text-center" onChange={(n) => setM({ ...m, carbs: n })} /></div>
            <div><label className="label">Grasas g</label><NumInput value={m.grasas} className="field text-center" onChange={(n) => setM({ ...m, grasas: n })} /></div>
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-300"><input type="checkbox" className="h-4 w-4" checked={saveRaw} onChange={(e) => setSaveRaw(e.target.checked)} /> Guardar como plato para usarlo otra vez</label>
          <button className="btn btn-blue w-full" disabled={!m.name.trim() || !m.calorias} onClick={() => { if (saveRaw) update((st) => saveMealTemplate(st, { ...m, name: m.name.trim() }, slot)); onPick({ ...m, name: m.name.trim() }); }}><Check size={16} strokeWidth={2} /> Añadir al plan</button>
        </div>
      )}
    </Modal>
  );
}

/** Opción sugerida: tocar un ingrediente permite cambiarlo por el tuyo y recalcular; si no cabe, ofrece alternativas solo de ese ingrediente. */
function OptionCard({ o, slot, budget, onAdd }: { o: MealOption; slot: Slot; budget: { kcal: number; prot: number; kcalLow: number; kcalHigh: number; protCap: number; resto: number; carbsSlot: number; grasaSlot: number; restoCarbs: number; restoGrasa: number }; onAdd: (o: MealOption) => void }) {
  const { state, update } = useStore();
  const [cur, setCur] = useState<MealOption>(o);
  const [noted, setNoted] = useState('');
  const [sel, setSel] = useState<number | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [res, setRes] = useState<IngredientSwap | null>(null);
  const [changed, setChanged] = useState(false);
  const [recipe, setRecipe] = useState(false);
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const applyEdit = (k: number, r: IngredientEdit) => {
    setCur((c) => ({ ...c, detalle: c.detalle.map((x, j) => (j === k ? r.line : x)), calorias: Math.max(0, c.calorias + r.delta.kcal), proteinas: Math.max(0, c.proteinas + r.delta.prot), carbs: Math.max(0, c.carbs + r.delta.carbs), grasas: Math.max(0, c.grasas + r.delta.fat) }));
    setChanged(true);
    setEditIdx(null);
  };

  // Ajuste automático (sin IA) si el plato se pasa de carbohidratos o grasa para lo que le toca a la toma.
  const missing = missingFromPantry(cur.detalle, state.pantry.filter((p) => p.qty > 0).map((p) => p.name));
  const fits = fitsSlot(cur, { kcal: budget.kcal, proteina: budget.prot, restoCarbs: budget.restoCarbs, restoGrasa: budget.restoGrasa, carbsSlot: budget.carbsSlot, grasaSlot: budget.grasaSlot, kcalMin: budget.kcalLow, kcalMax: budget.kcalHigh, proteinaMax: budget.protCap });
  const fix = suggestMacroFix(cur.detalle, { carbsSlot: budget.carbsSlot, grasaSlot: budget.grasaSlot, restoCarbs: budget.restoCarbs, restoGrasa: budget.restoGrasa });
  const applyFix = () => {
    if (!fix) return;
    setCur((c) => ({ ...c, detalle: fix.newLine ? c.detalle.map((x, j) => (j === fix.index ? fix.newLine : x)) : c.detalle.filter((_, j) => j !== fix.index), calorias: Math.max(0, c.calorias + fix.delta.kcal), proteinas: Math.max(0, c.proteinas + fix.delta.prot), carbs: Math.max(0, c.carbs + fix.delta.carbs), grasas: Math.max(0, c.grasas + fix.delta.fat) }));
    setChanged(true);
  };

  const run = async (reemplazo: string) => {
    if (sel === null) return;
    setBusy(true);
    setErr('');
    try {
      const r = await swapIngredient(state.settings, { slot, nombre: cur.nombre, detalle: cur.detalle, indice: sel, reemplazo, kcal: budget.kcal, proteina: budget.prot, restoKcal: budget.resto, carbsSlot: budget.carbsSlot, grasaSlot: budget.grasaSlot, restoCarbs: budget.restoCarbs, restoGrasa: budget.restoGrasa, noLeGusta: state.dislikes }, storeList(state.defaultSupermarket, state.supermarkets), state.defaultSupermarket);
      setRes(reemplazo ? r : { ...r, cabe: false });
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'No se pudo recalcular.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-1.5 rounded-lg bg-slate-900 px-2.5 py-2">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1 text-xs">
          <div className="font-semibold text-slate-100">{cur.nombre}</div>
          {cur.detalle.length > 0 && (
            <ul className="mt-0.5 space-y-0.5 text-slate-300">
              {cur.detalle.map((d, k) => (
                <li key={k}><button className={cx('flex w-full items-start gap-1 rounded px-1 text-left', sel === k ? 'bg-accent/20 text-white' : '')} onClick={() => setEditIdx(k)} aria-label={`Ajustar ${d}`}><span>•</span><span className="min-w-0 flex-1">{d}{missing.includes(foodNameOf(d)) && <span className="ml-1.5 rounded bg-amber-500/20 px-1 text-[9px] font-bold uppercase text-amber-400">comprar</span>}</span><Pencil size={11} className="mt-0.5 shrink-0 text-slate-500" /></button></li>
              ))}
            </ul>
          )}
          <div className="mt-0.5 text-slate-400">{cur.calorias} kcal · P {cur.proteinas} · C {cur.carbs} · G {cur.grasas}{changed ? ' · recalculado' : ''}</div>
          {cur.detalle.length > 0 && sel === null && <div className="mt-0.5 text-[10px] text-slate-500">Toca el lápiz de un ingrediente para ajustar sus gramos y números.</div>}
          <button className="mt-1.5 text-[11px] font-semibold text-accent" onClick={() => setRecipe((v) => !v)} aria-expanded={recipe}><RecipeToggleLabel open={recipe} /></button>
        </div>
        <button className="shrink-0 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white" onClick={() => onAdd(cur)}>Añadir al plan</button>
      </div>
      {incoherence(cur.nombre, cur.detalle) && (
        <div className="rounded-lg bg-amber-500/10 p-2 text-[11px] text-amber-400">Combinación rara: {incoherence(cur.nombre, cur.detalle)}.</div>
      )}
      {!fits && budget.kcal > 0 && (
        <div className="rounded-lg bg-amber-500/10 p-2 text-[11px] text-amber-400">
          Se sale de lo que te toca en esta toma: {cur.calorias} kcal (objetivo {budget.kcalLow}–{budget.kcalHigh}) y {cur.proteinas} g de proteína (máx. {budget.protCap} g). Ajusta un ingrediente o pide otra idea.
        </div>
      )}
      {fix && (
        <div className="space-y-1 rounded-lg bg-amber-500/10 p-2 text-xs text-amber-400">
          <div className="font-semibold">Se pasa de {fix.over.map((x) => (x === 'carbs' ? 'carbohidratos' : 'grasa')).join(' y ')} para lo que le toca a esta toma.</div>
          <div className="text-slate-200">{fix.newLine ? <>Cambia «{fix.line}» por «{fix.newLine}»</> : <>Quita «{fix.line}»</>}</div>
          <div className="text-slate-300">C {fix.before.carbs} → <b className="text-white">{fix.after.carbs}</b> · G {fix.before.grasas} → <b className="text-white">{fix.after.grasas}</b> · P {fix.before.proteinas} → <b className="text-white">{fix.after.proteinas}</b> · {fix.before.calorias} → <b className="text-white">{fix.after.calorias}</b> kcal</div>
          <button className="w-full rounded-lg bg-amber-500 py-1.5 font-bold text-slate-950 active:scale-95" onClick={() => applyFix()}>Aplicar el ajuste</button>
        </div>
      )}
      {recipe && <RecipeSteps tiempo={cur.tiempo} pasos={cur.pasos} consejo={cur.consejo} />}
      {editIdx !== null && cur.detalle[editIdx] !== undefined && <IngredientEditor line={cur.detalle[editIdx]} onSave={(r) => applyEdit(editIdx, r)} onClose={() => setEditIdx(null)} onSwap={() => { setSel(editIdx); setRes(null); setErr(''); setText(''); setEditIdx(null); }} />}
      {sel !== null && (
        <div className="space-y-1.5 rounded-lg bg-slate-800 p-2 text-xs">
          <div className="text-slate-300">Cambiar «{cur.detalle[sel]}» por:</div>
          <div className="flex gap-1.5">
            <input className="field !py-1.5 text-xs" placeholder="Ej: 1 pera, 2 kiwis, 30 g de avena" value={text} onChange={(e) => setText(e.target.value)} aria-label="Ingrediente nuevo" />
            <button className="btn btn-blue shrink-0 !px-3 !py-1.5 text-xs" disabled={busy || !text.trim()} onClick={() => void run(text.trim())}>{busy ? <Loader2 size={14} className="animate-spin" /> : 'Recalcular'}</button>
          </div>
          <button className="flex items-center gap-1 font-semibold text-accent" disabled={busy} onClick={() => void run('')}><Sparkles size={12} /> Ideas solo para este ingrediente</button>
          {(() => {
            const nm = foodNameOf(cur.detalle[sel] ?? '');
            if (!nm) return null;
            const already = state.dislikes.some((x) => x.toLowerCase() === nm.toLowerCase());
            return (
              <button className="flex items-center gap-1 font-semibold text-red-400 disabled:text-slate-500" disabled={already} onClick={() => { update((s) => (s.dislikes.some((x) => x.toLowerCase() === nm.toLowerCase()) ? s : { ...s, dislikes: [...s.dislikes, nm] })); setNoted(nm); }}>
                <ThumbsDown size={12} /> {already ? `«${nm}» ya está en tus «no me gusta»` : `No me gusta «${nm}»: que no vuelva a salir`}
              </button>
            );
          })()}
          {noted && <p className="text-[11px] text-slate-400">Anotado «{noted}». Se quita de las sugerencias; puedes verlo y editarlo en «Alimentos que no me gustan».</p>}
          {err && <p className="text-red-400">{err}</p>}
          {res && res.option.calorias > 0 && (
            <div className="space-y-1.5 rounded-lg bg-slate-900 p-2">
              <div className="font-semibold text-white">{res.cabe ? 'Entra en lo que te toca' : 'No encaja del todo'}: {res.option.calorias} kcal · P {res.option.proteinas} · C {res.option.carbs} · G {res.option.grasas}</div>
              <div className="text-slate-300">{res.option.detalle[sel]}</div>
              <div className="grid grid-cols-2 gap-1.5">
                <button className="rounded-lg bg-emerald-600 py-1.5 font-semibold text-white" onClick={() => { setCur({ ...cur, ...res.option, usa: [] }); setChanged(true); setRes(null); setSel(null); setText(''); }}>Confirmar cambio</button>
                <button className="rounded-lg bg-slate-700 py-1.5 font-semibold text-slate-100" onClick={() => setRes(null)}>Descartar</button>
              </div>
            </div>
          )}
          {res && (res.alternativas.length > 0 || res.motivo) && (
            <div className={cx('space-y-1 rounded-lg p-2', res.cabe ? 'bg-emerald-500/10 text-emerald-300' : 'bg-amber-500/10 text-amber-400')}>
              {res.motivo && <p>{res.motivo}</p>}
              {res.alternativas.length > 0 && <div className="flex flex-wrap gap-1.5">{res.alternativas.map((a, k) => <button key={k} className="rounded-full bg-slate-700 px-2.5 py-1 font-semibold text-slate-100 active:scale-95" disabled={busy} onClick={() => { setText(a); void run(a); }}>{a}</button>)}</div>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
