import { Camera, Check, Loader2, MessageCircle, Plus, Sparkles, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { clearDraft, getDraft, setDraft, subscribeDraft } from '../lib/composeDraft';
import { estimateItems, type FoodItemEstimate, type FoodItemInput, type MealEstimate } from '../lib/gemini';
import { compressToBase64 } from '../lib/image';
import { resolveLine } from '../lib/foodDb';
import { findProducts, gramsOf, macrosFor } from '../lib/products';
import { saveProduct } from '../lib/products';
import { useStore } from '../lib/store';
import { ProductRater } from './ProductRater';
import { norm, uid } from '../lib/utils';
import { parseQuick } from '../lib/quickMeal';
import { storeList } from '../lib/stores';
import type { SavedProduct } from '../lib/types';
import { ErrorBox, NumInput } from './ui';
import { QtyInput, stepOf } from './QtyInput';
import { ChefChat } from './ChefChat';

const UNITS = ['unidades', 'g', 'ml', 'raciones', 'cucharadas', 'lonchas', 'rebanadas', 'puñados', 'tazas'];
const UNITKEY: Record<string, 'unidad' | 'loncha' | 'rebanada' | 'cucharada' | 'puñado'> = { unidades: 'unidad', lonchas: 'loncha', rebanadas: 'rebanada', cucharadas: 'cucharada', puñados: 'puñado' };
const SING: Record<string, string> = { unidades: 'unidad', lonchas: 'loncha', rebanadas: 'rebanada', cucharadas: 'cucharada', puñados: 'puñado', raciones: 'ración', tazas: 'taza' };
interface MV { kcal: number; protein: number; carbs: number; fat: number; w: number }
const blank = (): FoodItemInput => ({ nombre: '', cantidad: 1, unidad: 'unidades' });

export interface ComposedMeal {
  name: string;
  calorias: number;
  proteinas: number;
  carbs: number;
  grasas: number;
  /** Cada alimento con su cantidad (para poder editarlo luego). */
  detalle?: string[];
}

/**
 * Añadir comida «a mano» sin teclear macros: escribes los alimentos con su cantidad («2 huevos duros», «150 g de arroz»)
 * y la IA calcula con los productos de tu supermercado habitual. Si no le queda claro cuánto sumar, pide una foto del plato.
 */
export function FoodComposer({ confirmLabel, onConfirm, onManual, initial, autoCalc, localCalc, draftKey }: { confirmLabel: string; onConfirm: (m: ComposedMeal, save: boolean) => void; onManual: () => void; initial?: FoodItemInput[]; autoCalc?: boolean; localCalc?: boolean; draftKey?: string }) {
  const { state, update } = useStore();
  // Con `draftKey`, lo que vas eligiendo se guarda como borrador: no se pierde al cambiar de pestaña ni al cerrar la ventana.
  const draft0 = draftKey ? getDraft(draftKey) : null;
  const restoredAtStart = !!draft0 && draft0.items.some((i) => i.nombre.trim());
  const [restored, setRestored] = useState(restoredAtStart);
  const itemsRef = useRef<FoodItemInput[]>([]);
  const [items, setItems] = useState<FoodItemInput[]>(restoredAtStart ? draft0!.items : initial && initial.length ? initial : [blank()]);
  const [est, setEst] = useState<MealEstimate | null>(null);
  const [busy, setBusy] = useState(false);
  const [chef, setChef] = useState(false);
  const [err, setErr] = useState('');
  const camRef = useRef<HTMLInputElement>(null);
  const [save, setSave] = useState(false);
  const [quick, setQuick] = useState('');
  /** Posiciones de alimentos de los que no se conocen los valores: se piden a mano una vez y se guardan. */
  const [missing, setMissing] = useState<number[]>([]);
  const [mv, setMv] = useState<Record<number, MV>>({});
  const [run, setRun] = useState(0);
  const calcRef = useRef<(photo: File | null, onlyLocal?: boolean, noAI?: boolean) => Promise<void>>(async () => {});
  /** Producto guardado elegido por alimento (id); 'ai' = usar la estimación de la IA. Por defecto, el último guardado que coincide. */
  const [picks, setPicks] = useState<Record<number, string>>({});
  useEffect(() => {
    itemsRef.current = items;
  });
  const filled = items.filter((i) => i.nombre.trim());
  const total = est ? est.items.reduce((t, i) => ({ calorias: t.calorias + i.calorias, proteinas: t.proteinas + i.proteinas, carbs: t.carbs + i.carbs, grasas: t.grasas + i.grasas }), { calorias: 0, proteinas: 0, carbs: 0, grasas: 0 }) : null;

  /** Productos de tu despensa para elegir: todos (los primeros) si el nombre está vacío; los que coinciden si escribes. */
  const pantryFor = (name: string) => {
    const t = norm(name);
    const have = state.pantry.filter((p) => p.qty > 0);
    if (!t) return have.slice(0, 12);
    return have.filter((p) => norm(p.name).includes(t) && norm(p.name) !== t).slice(0, 8);
  };
  const matchesOf = (it: FoodItemInput): SavedProduct[] => findProducts(state.products, it.nombre);
  const chosen = (i: number, it: FoodItemInput): SavedProduct | null => {
    const m = matchesOf(it);
    if (picks[i] === 'ai') return null;
    return m.find((x) => x.id === picks[i]) ?? m[0] ?? null;
  };

  const calc = async (photo: File | null, onlyLocal = false, noAI = false) => {
    setBusy(true);
    setErr('');
    try {
      const b64 = photo ? await compressToBase64(photo, 1024, 0.8) : null;
      // Alimentos con producto guardado y cantidad convertible a gramos: se calculan aquí con TUS valores.
      const local: Record<number, FoodItemEstimate> = {};
      const rest: FoodItemInput[] = [];
      const restIdx: number[] = [];
      items.forEach((it, i) => {
        if (!it.nombre.trim()) return;
        const p = chosen(i, it);
        let g = p ? gramsOf(p, it.cantidad, it.unidad) : null;
        // Lonchas, rebanadas…: el peso de cada una está guardado con el producto.
        if (p && g === null && it.unidad !== 'raciones') g = resolveLine(`${it.cantidad} ${it.unidad === 'unidades' ? '' : it.unidad} de ${p.name}`)?.grams ?? null;
        if (p && g !== null) local[i] = { nombre: p.brand ? `${p.name} (${p.brand})` : p.name, cantidad: `${it.cantidad} ${it.unidad}`, supuesto: `tus valores guardados, ${Math.round(g)} g`, p100: { calorias: p.kcal, proteinas: p.protein, carbs: p.carbs, grasas: p.fat }, ...macrosFor(p, g) };
        else {
          const t = !p && it.unidad !== 'raciones' ? resolveLine(`${it.cantidad} ${it.unidad === 'unidades' ? '' : it.unidad} de ${it.nombre}`) : null;
          if (t) local[i] = { nombre: it.nombre, cantidad: `${it.cantidad} ${it.unidad}`, supuesto: `tabla de composición, ${Math.round(t.grams)} g`, p100: { calorias: (t.kcal * 100) / t.grams, proteinas: (t.protein * 100) / t.grams, carbs: (t.carbs * 100) / t.grams, grasas: (t.fat * 100) / t.grams }, calorias: t.kcal, proteinas: Math.round(t.protein), carbs: Math.round(t.carbs), grasas: Math.round(t.fat) };
          else { rest.push(it); restIdx.push(i); }
        }
      });
      // Al abrir para editar solo se calcula lo que la tabla o tus productos ya saben (sin gastar IA); lo demás lo calculas tú con el botón.
      if (noAI && !onlyLocal && rest.length > 0) {
        setMissing(restIdx);
        setEst(null);
        return;
      }
      setMissing([]);
      if (onlyLocal && (rest.length > 0 || Object.keys(local).length === 0)) return;
      const ai: MealEstimate = rest.length ? await estimateItems(state.settings, rest, storeList(state.defaultSupermarket, state.supermarkets), state.defaultSupermarket, b64) : { items: [], dudas: [], necesitaFoto: false };
      let k = 0;
      const merged: FoodItemEstimate[] = [];
      items.forEach((it, i) => {
        if (!it.nombre.trim()) return;
        const e = local[i] ?? ai.items[k++];
        if (e && !e.p100 && (it.unidad === 'g' || it.unidad === 'ml') && it.cantidad > 0 && e.calorias > 0) merged.push({ ...e, p100: { calorias: (e.calorias * 100) / it.cantidad, proteinas: (e.proteinas * 100) / it.cantidad, carbs: (e.carbs * 100) / it.cantidad, grasas: (e.grasas * 100) / it.cantidad } });
        else if (e) merged.push(e);
      });
      merged.push(...ai.items.slice(k));
      setEst({ ...ai, items: merged });
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'No se pudo calcular.');
    } finally {
      setBusy(false);
    }
  };
  calcRef.current = calc;
  // Tras guardar valores o sumar texto rápido se recalcula (el timeout deja que la base de alimentos se actualice antes).
  useEffect(() => {
    if (run === 0) return;
    const t = setTimeout(() => void calcRef.current(null, false, true), 0);
    return () => clearTimeout(t);
  }, [run]);
  const addQuick = () => {
    const parsed = parseQuick(quick);
    if (parsed.length === 0) return;
    setItems([...items.filter((x) => x.nombre.trim()), ...parsed]);
    setQuick('');
    setEst(null);
    setMissing([]);
    setPicks({});
    setRun((r) => r + 1);
  };
  const saveMissing = (i: number) => {
    const it = items[i];
    const v = mv[i];
    if (!it || !v || !(v.kcal > 0)) {
      setErr('Pon al menos las calorías por 100 g.');
      return;
    }
    setErr('');
    const name = it.nombre.trim();
    const uk = UNITKEY[it.unidad];
    update((s) => {
      const s2 = saveProduct(s, { id: uid(), name, kcal: v.kcal, protein: v.protein, carbs: v.carbs, fat: v.fat, sugars: 0, satFat: 0, fiber: 0, salt: 0, ...(it.unidad === 'raciones' && v.w > 0 ? { serving: v.w } : {}), ...(it.unidad === 'unidades' && v.w > 0 ? { pack: v.w } : {}) });
      const saved = (s2.products ?? []).find((x) => x.name.toLowerCase() === name.toLowerCase() && !x.brand);
      if (!saved || !uk || !(v.w > 0)) return s2;
      const key = `s:${saved.id}`;
      return { ...s2, foodUnits: { ...s2.foodUnits, [key]: { ...s2.foodUnits?.[key], [uk]: v.w } } };
    });
    setRun((r) => r + 1);
  };
  // Con alimentos elegidos de la despensa se calcula directamente.
  useEffect(() => {
    if (autoCalc && filled.length > 0) void calc(null, false, true);
    else if (localCalc && filled.length > 0) void calc(null, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  /** Aprende los alimentos estimados por la IA con cantidad en g/ml (valores por 100 g) para reutilizarlos la próxima vez sin gastar IA. */
  const learn = () => {
    if (!est) return;
    const found = items.filter((it) => it.nombre.trim());
    est.items.forEach((x, k) => {
      const it = found[k];
      if (!it || (it.unidad !== 'g' && it.unidad !== 'ml') || it.cantidad < 20 || x.supuesto.startsWith('tus valores') || x.supuesto.startsWith('tabla') || x.calorias <= 0) return;
      if (findProducts(state.products, it.nombre).length > 0) return; // ya hay uno guardado: no se pisa
      const k100 = 100 / it.cantidad;
      update((s) => saveProduct(s, { name: it.nombre.trim(), source: 'auto', kcal: Math.round(x.calorias * k100), protein: Math.round(x.proteinas * k100 * 10) / 10, carbs: Math.round(x.carbs * k100 * 10) / 10, fat: Math.round(x.grasas * k100 * 10) / 10, sugars: 0, satFat: 0, fiber: 0, salt: 0 }));
    });
  };
  useEffect(() => {
    if (!draftKey) return;
    // Alimentos añadidos desde fuera (por ejemplo, elegidos en la pestaña Despensa).
    return subscribeDraft(draftKey, () => {
      const d = getDraft(draftKey).items;
      if (d.length === 0 || JSON.stringify(itemsRef.current) === JSON.stringify(d)) return; // solo si vienen alimentos nuevos de fuera
      setItems(d);
      setEst(null);
    });
  }, [draftKey]);
  useEffect(() => {
    if (draftKey && !(initial && initial.length && JSON.stringify(items) === JSON.stringify(initial))) setDraft(draftKey, items);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);
  /** Gramos que equivale una fila (g/ml directos; si no, por tu producto guardado o por la tabla); null si no se sabe. */
  const gramsFor = (i: number, it: FoodItemInput): number | null => {
    if (it.unidad === 'g' || it.unidad === 'ml') return it.cantidad;
    const p = chosen(i, it);
    if (p) return gramsOf(p, it.cantidad, it.unidad);
    return resolveLine(`${it.cantidad} ${it.unidad === 'unidades' ? '' : it.unidad} de ${it.nombre}`)?.grams ?? null;
  };
  const patchItem = (i: number, p: Partial<FoodItemInput>) => {
    setMissing([]);
    const next = items.map((x, k) => (k === i ? { ...x, ...p } : x));
    setItems(next);
    // Cambiar solo la cantidad o la unidad recalcula AL INSTANTE (sin IA ni recargar) si se conocen los valores por 100 g.
    if (est && !('nombre' in p) && est.items.length === items.filter((x) => x.nombre.trim()).length) {
      const k = items.slice(0, i).filter((x) => x.nombre.trim()).length;
      const e = est.items[k];
      const g = e?.p100 ? gramsFor(i, next[i]) : null;
      if (e?.p100 && g !== null && g > 0) {
        const sc = (v: number) => Math.round((v * g) / 100);
        setEst({ ...est, items: est.items.map((y, j) => (j === k ? { ...y, cantidad: `${next[i].cantidad} ${next[i].unidad}`, supuesto: `${Math.round(g)} g · recalculado al instante`, calorias: sc(e.p100!.calorias), proteinas: sc(e.p100!.proteinas), carbs: sc(e.p100!.carbs), grasas: sc(e.p100!.grasas) } : y)) });
        return;
      }
    }
    setEst(null);
  };
  /** Cambia entre medida casera y gramos conservando la cantidad equivalente cuando se sabe. */
  const setMode = (i: number, grams: boolean) => {
    const it = items[i];
    if (grams && it.unidad !== 'g' && it.unidad !== 'ml') {
      const g = gramsFor(i, it);
      patchItem(i, { unidad: 'g', cantidad: g && g > 0 ? Math.round(g) : it.cantidad });
    } else if (!grams && (it.unidad === 'g' || it.unidad === 'ml')) patchItem(i, { unidad: 'unidades', cantidad: 1 });
  };

  return (
    <div className="space-y-2">
      {restored && (
        <div className="flex items-center justify-between gap-2 rounded-lg bg-accent/10 px-3 py-2 text-xs text-slate-200">
          <span>Recuperé lo que estabas añadiendo.</span>
          <button className="shrink-0 font-semibold text-accent" onClick={() => { if (draftKey) clearDraft(draftKey); setItems(initial && initial.length ? initial : [blank()]); setEst(null); setRestored(false); }}>Empezar de cero</button>
        </div>
      )}
      <div className="space-y-1.5 rounded-xl bg-accent/10 p-2.5">
        <div className="text-xs font-semibold text-slate-200">Escribe lo que has comido, todo seguido</div>
        <div className="flex gap-1.5">
          <input className="field !py-2" placeholder="2 queso, 2 pan, 1 jamón, 1 yogur" value={quick} onChange={(e) => setQuick(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addQuick()} aria-label="Lo que has comido" />
          <button className="btn btn-blue shrink-0 !px-3" disabled={!quick.trim() || busy} onClick={addQuick}>Sumar</button>
        </div>
        <div className="text-[11px] text-slate-400">Sin unidad: el queso y el embutido van por lonchas y el pan por rebanadas. También vale «150 g arroz» o «2 cucharadas mayonesa».</div>
      </div>
      <p className="text-xs text-slate-400">Escribe lo que comes y la cantidad (p. ej. «huevos duros», 2 unidades). Calculo calorías y macros con los productos de tu supermercado habitual.</p>
      {items.map((it, i) => (
        <div key={i} data-keyrow className="space-y-1.5 rounded-xl bg-slate-800/50 p-2">
          <div className="flex items-center gap-1.5">
            <input className="field !py-2" placeholder="Alimento (ej: huevos duros)" value={it.nombre} onChange={(e) => patchItem(i, { nombre: e.target.value })} aria-label="Alimento" />
            {items.length > 1 && <button className="shrink-0 p-1 text-slate-500" onClick={() => { setItems(items.filter((_, k) => k !== i)); setEst(null); setMissing([]); }} aria-label="Quitar alimento"><X size={16} /></button>}
          </div>
          <div className="inline-flex gap-1 rounded-lg bg-slate-700/60 p-0.5 text-[11px] font-bold" role="group" aria-label="Tipo de medida">
            {([[false, 'Unidades / ración'], [true, 'Gramos (g)']] as const).map(([g, l]) => {
              const on = (it.unidad === 'g' || it.unidad === 'ml') === g;
              return <button key={l} type="button" aria-pressed={on} onClick={() => setMode(i, g)} className={on ? 'rounded-md bg-accent px-2.5 py-1 text-white' : 'rounded-md px-2.5 py-1 text-slate-300'}>{l}</button>;
            })}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <QtyInput value={it.cantidad} step={stepOf(it.unidad)} label={it.nombre} onChange={(n) => patchItem(i, { cantidad: n })} />
            <select className="field !w-auto !py-2 text-xs" value={it.unidad} onChange={(e) => patchItem(i, { unidad: e.target.value })} aria-label="Unidad">{UNITS.map((u) => <option key={u}>{u}</option>)}</select>
          </div>
          {(() => {
            const ps = pantryFor(it.nombre);
            if (ps.length === 0) return null;
            return (
              <div>
                <div className="mb-1 text-[11px] font-semibold uppercase text-slate-400">{it.nombre.trim() ? 'En tu despensa' : 'Elige de tu despensa'}</div>
                <div className="flex gap-1.5 overflow-x-auto pb-1">
                  {ps.map((p) => <button key={p.id} type="button" className="shrink-0 rounded-full bg-slate-700 px-3 py-1 text-xs font-semibold text-slate-100 active:scale-95" onClick={() => patchItem(i, { nombre: p.name })}>{p.name}</button>)}
                </div>
              </div>
            );
          })()}
          {(() => {
            const m = matchesOf(it);
            if (m.length === 0) return null;
            const cur = chosen(i, it);
            return (
              <div className="space-y-1 rounded-lg bg-emerald-500/10 p-2 text-[11px] text-emerald-300">
                <div>{cur ? `${cur.source === 'auto' ? 'Uso lo que calculé la vez anterior de' : 'Uso tus valores de'} «${cur.name}${cur.brand ? ` · ${cur.brand}` : ''}»: ${cur.kcal} kcal · P ${cur.protein} · C ${cur.carbs} · G ${cur.fat} por 100 g.` : 'Uso la estimación de la IA.'}</div>
                <select className="field !py-1.5 text-xs" value={cur?.id ?? 'ai'} onChange={(e) => { setPicks({ ...picks, [i]: e.target.value }); setEst(null); }} aria-label="Producto guardado">
                  {m.map((x) => <option key={x.id} value={x.id}>{x.name}{x.brand ? ` · ${x.brand}` : ''}</option>)}
                  <option value="ai">Otro producto: estimación de la IA</option>
                </select>
                {cur?.source === 'auto' && <button className="font-semibold text-red-400" onClick={() => { update((s) => ({ ...s, products: (s.products ?? []).filter((x) => x.id !== cur.id) })); setEst(null); }}>Olvidar este cálculo</button>}
                {cur && cur.source !== 'auto' && <ProductRater prod={{ name: cur.name, brand: cur.brand ?? '', kcal: cur.kcal, protein: cur.protein, carbs: cur.carbs, sugars: cur.sugars, fat: cur.fat, satFat: cur.satFat, fiber: cur.fiber, salt: cur.salt }} />}
              </div>
            );
          })()}
        </div>
      ))}
      <button className="flex items-center gap-1 text-xs font-semibold text-accent" onClick={() => setItems([...items, blank()])}><Plus size={14} /> Añadir otro alimento</button>
      <button className="btn btn-blue w-full" disabled={filled.length === 0 || busy} onClick={() => void calc(null, false, true)}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Sumar con mis valores</button>
      <button className="btn btn-ghost w-full text-xs" disabled={filled.length === 0 || busy} onClick={() => void calc(null)}><Sparkles size={14} /> Estimar con IA (menos preciso)</button>
      {missing.length > 0 && (
        <div className="space-y-2 rounded-xl bg-amber-500/10 p-3">
          <div className="text-xs font-semibold text-amber-400">No tengo los valores de {missing.length === 1 ? 'este producto' : 'estos productos'}. Ponlos una vez (de la tabla del envase, por 100 g) y quedan guardados para siempre.</div>
          {missing.map((i) => {
            const it = items[i];
            if (!it) return null;
            const v: MV = mv[i] ?? { kcal: 0, protein: 0, carbs: 0, fat: 0, w: 0 };
            const set = (p: Partial<MV>) => setMv((m) => ({ ...m, [i]: { ...v, ...p } }));
            const grams = it.unidad === 'g' || it.unidad === 'ml';
            return (
              <div key={i} className="space-y-1.5 rounded-lg bg-slate-800 p-2">
                <div className="text-sm font-semibold text-white">{it.nombre} <span className="font-normal text-slate-400">· {it.cantidad} {it.unidad}</span></div>
                <div className="grid grid-cols-4 gap-1.5">
                  {([['kcal', 'kcal'], ['protein', 'Prot'], ['carbs', 'Carbs'], ['fat', 'Grasas']] as const).map(([k, l]) => (
                    <div key={k}>
                      <div className="text-[10px] uppercase text-slate-400">{l} /100 g</div>
                      <NumInput value={v[k]} label={`${it.nombre}: ${l} por 100 g`} className="field !py-1.5 text-center text-xs" onChange={(n) => set({ [k]: n } as Partial<MV>)} />
                    </div>
                  ))}
                </div>
                {!grams && (UNITKEY[it.unidad] || it.unidad === 'raciones') && it.unidad !== 'cucharadas' && (
                  <label className="flex items-center gap-2 text-[11px] text-slate-300">Peso de 1 {SING[it.unidad] ?? it.unidad} (g)
                    <NumInput value={v.w} label={`Peso de 1 ${SING[it.unidad] ?? it.unidad}`} className="field !w-20 !py-1.5 text-center text-xs" onChange={(n) => set({ w: n })} />
                  </label>
                )}
                {!grams && !UNITKEY[it.unidad] && it.unidad !== 'raciones' && <div className="text-[11px] text-amber-400">Cambia la unidad a gramos o a otra medida para poder sumarlo.</div>}
                <button className="btn btn-green w-full !py-2 text-xs" onClick={() => saveMissing(i)}><Check size={14} /> Guardar y sumar</button>
              </div>
            );
          })}
        </div>
      )}
      <button className="btn btn-ghost w-full text-accent" onClick={() => setChef(true)}><MessageCircle size={16} /> Preguntar al Chef sobre este plato</button>
      {chef && <ChefChat items={items} onClose={() => setChef(false)} onAdd={(list) => { setItems((cur) => { const real = cur.filter((x) => x.nombre.trim()); return [...real, ...list.map((a) => ({ nombre: a.nombre, cantidad: a.cantidad, unidad: a.unidad }))]; }); setEst(null); }} onApply={(cs) => { const pos = items.map((x, i) => (x.nombre.trim() ? i : -1)).filter((i) => i >= 0); setItems(items.map((x, k) => { const c = cs.find((y) => pos[y.indice] === k); return c ? { ...x, cantidad: c.cantidad, unidad: c.unidad } : x; })); setEst(null); setChef(false); }} />}
      {err && <ErrorBox msg={err} />}
      {est && total && (
        <div className="space-y-2 rounded-xl bg-slate-800 p-3">
          <div className="text-[11px] font-semibold uppercase text-slate-400">Cada alimento (puedes ajustar los números a mano)</div>
          {est.items.map((x, i) => (
            <div key={i} className="space-y-1 text-sm">
              <div className="font-semibold text-white">{x.nombre} <span className="font-normal text-slate-400">· {x.cantidad}</span></div>
              <div className="grid grid-cols-4 gap-1.5">
                {([['calorias', 'kcal'], ['proteinas', 'Prot g'], ['carbs', 'Carbs g'], ['grasas', 'Grasas g']] as const).map(([k, l]) => (
                  <div key={k}>
                    <div className="text-[10px] uppercase text-slate-400">{l}</div>
                    <NumInput decimal={false} value={x[k]} label={`${x.nombre}: ${l}`} className="field !py-1.5 text-center text-xs" onChange={(n) => setEst({ ...est, items: est.items.map((y, j) => (j === i ? { ...y, [k]: n } : y)) })} />
                  </div>
                ))}
              </div>
              {x.supuesto && <div className="text-[11px] text-slate-400">{x.supuesto}</div>}
            </div>
          ))}
          <div className="flex justify-between gap-2 border-t border-slate-700 pt-2 text-sm font-bold text-white"><span>Total</span><span className="text-right">{total.calorias} kcal · P {total.proteinas} · C {total.carbs} · G {total.grasas}</span></div>
          {est.necesitaFoto && (
            <div className="rounded-lg bg-amber-500/15 p-2.5 text-xs text-amber-500">
              <div className="font-semibold">No me queda claro cuánto sumar{est.dudas.length ? ':' : '.'}</div>
              {est.dudas.length > 0 && <ul className="mt-1 list-disc space-y-0.5 pl-4">{est.dudas.map((d, i) => <li key={i}>{d}</li>)}</ul>}
              <button className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-amber-500 py-2 text-xs font-bold text-slate-950 active:scale-95" disabled={busy} onClick={() => camRef.current?.click()}><Camera size={14} /> Hazme una foto del plato</button>
            </div>
          )}
          <label className="flex items-center gap-2 text-xs text-slate-300"><input type="checkbox" className="h-4 w-4" checked={save} onChange={(e) => setSave(e.target.checked)} /> Guardar como plato para usarlo otra vez</label>
          <button className="btn btn-green w-full" onClick={() => { learn(); onConfirm({ name: est.items.map((x) => x.nombre).join(' + '), ...total, detalle: est.items.map((x) => `${x.cantidad} ${x.nombre}`.trim()) }, save); if (draftKey) { clearDraft(draftKey); setRestored(false); } }}><Check size={16} /> {est.necesitaFoto ? 'Añadir igualmente' : confirmLabel}</button>
        </div>
      )}
      <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { const f = e.target.files?.[0] ?? null; if (camRef.current) camRef.current.value = ''; if (f) void calc(f); }} />
      <button className="w-full text-center text-xs text-slate-500 underline" onClick={onManual}>Prefiero poner kcal y macros a mano</button>
    </div>
  );
}
