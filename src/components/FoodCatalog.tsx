import { Check, Globe, Loader2, Refrigerator, Search, Star } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { CAT_LIST, UNIT_KEYS, UNIT_LABEL, builtinItems, detailLine, gramsFor, itemToSaved, macrosOf, savedToItem, searchItems, searchOnline, withUnits, type CatalogItem, type StoreFilter, type UnitKey } from '../lib/catalog';
import { addToPantry } from '../lib/pantry';
import { saveProduct } from '../lib/products';
import { useStore } from '../lib/store';
import { SLOTS, inferSlot, logTemplate } from '../lib/templates';
import type { Slot } from '../lib/types';
import { cx, looseMatch, norm, uid } from '../lib/utils';
import { Modal, NumInput } from './ui';

type View = 'favoritos' | 'despensa' | 'todos' | string;
const STORES: StoreFilter[] = ['Mercadona', 'HiperDino', 'todas'];
const PAGE = 50;

const defaultUnit = (i: CatalogItem): 'g' | UnitKey => {
  if (i.cat === 'embutidos' || i.cat === 'quesos') return 'loncha';
  if (i.cat === 'panes' && i.units.rebanada) return 'rebanada';
  if (i.cat === 'salsas' && i.units.cucharada) return 'cucharada';
  return i.units.unidad ? 'unidad' : 'g';
};
const defaultQty = (u: 'g' | UnitKey): number => (u === 'g' ? 100 : u === 'loncha' ? 2 : 1);

/** Catálogo de alimentos: tabla de la app + tus productos + búsqueda de productos de Mercadona / HiperDino. Las cuentas son locales, sin IA. */
export function FoodCatalog() {
  const { state, update } = useStore();
  const [q, setQ] = useState('');
  const [store, setStore] = useState<StoreFilter>('Mercadona');
  const [online, setOnline] = useState<CatalogItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [asked, setAsked] = useState('');
  const [limit, setLimit] = useState(PAGE);
  const [sel, setSel] = useState<CatalogItem | null>(null);
  const ctl = useRef<AbortController | null>(null);

  const favs = useMemo(() => new Set(state.favFoods ?? []), [state.favFoods]);
  const all = useMemo(() => {
    const mine = (state.products ?? []).filter((p) => p.source !== 'auto').map(savedToItem);
    return [...mine, ...builtinItems()].map((i) => withUnits(i, state.foodUnits));
  }, [state.products, state.foodUnits]);
  const pantryNames = state.pantry.filter((p) => p.qty > 0).map((p) => p.name);
  const inPantry = (i: CatalogItem): boolean => pantryNames.some((n) => looseMatch(n, i.name));
  const [view, setView] = useState<View>(() => ((state.favFoods ?? []).length > 0 ? 'favoritos' : 'todos'));

  const byView = (list: CatalogItem[]): CatalogItem[] => (view === 'favoritos' ? list.filter((i) => favs.has(i.id)) : view === 'despensa' ? list.filter(inPantry) : view === 'todos' ? list : list.filter((i) => i.cat === view));
  const local = byView(searchItems(all, q));
  const codes = new Set(all.map((i) => i.code).filter(Boolean));
  const onlineShown = online.filter((i) => !codes.has(i.code)).map((i) => withUnits(i, state.foodUnits));
  const nFav = all.filter((i) => favs.has(i.id)).length;
  const nPan = all.filter(inPantry).length;

  const toggleFav = (i: CatalogItem) => {
    const it = adopt(i);
    update((s) => {
      const cur = new Set(s.favFoods ?? []);
      if (cur.has(it.id)) cur.delete(it.id);
      else cur.add(it.id);
      return { ...s, favFoods: [...cur] };
    });
  };

  /** Un producto de la búsqueda online pasa a «mis productos» en cuanto lo usas (favorito, medida, comida…). */
  const adopt = (i: CatalogItem): CatalogItem => {
    if (i.source !== 'online') return i;
    const same = (state.products ?? []).find((x) => (i.code && x.code === i.code) || (x.name.toLowerCase() === i.name.toLowerCase() && (x.brand ?? '') === (i.brand ?? '')));
    const id = same?.id ?? uid();
    update((s) => saveProduct(s, { ...itemToSaved(i), id }));
    return { ...i, id: `s:${id}`, source: 'mio' };
  };

  const search = async () => {
    const term = q.trim();
    if (term.length < 3) return;
    ctl.current?.abort();
    const c = new AbortController();
    ctl.current = c;
    setBusy(true);
    setErr('');
    try {
      const r = await searchOnline(term, store, c.signal);
      setOnline(r);
      setAsked(`${term}|${store}`);
      if (r.length === 0) setErr(store === 'todas' ? 'No encontré ese producto. Prueba con otra palabra o escanea su código de barras.' : `No encontré ese producto de ${store}. Prueba «Todas» o con otra palabra.`);
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setErr('No se pudo buscar en el súper (¿sin conexión?). Lo que ya tienes guardado sigue funcionando.');
    } finally {
      setBusy(false);
    }
  };

  const row = (i: CatalogItem) => (
    <div key={i.id} className="flex items-center gap-2 rounded-xl bg-slate-800 p-2">
      <button className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => setSel(i)}>
        {i.image ? <img src={i.image} alt="" className="h-10 w-10 shrink-0 rounded-lg bg-white object-contain" loading="lazy" /> : null}
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-white">{i.name}</span>
          <span className="block truncate text-[11px] text-slate-400">{i.store !== 'Genérico' ? `${i.store} · ` : ''}100 g: {i.kcal} kcal · P {i.protein} · C {i.carbs} · G {i.fat}</span>
        </span>
      </button>
      {inPantry(i) && <Refrigerator size={14} className="shrink-0 text-emerald-500" aria-label="En tu despensa" />}
      <button className="shrink-0 p-2" onClick={() => toggleFav(i)} aria-label={favs.has(i.id) ? 'Quitar de favoritos' : 'Añadir a favoritos'} aria-pressed={favs.has(i.id)}>
        <Star size={18} className={favs.has(i.id) ? 'fill-amber-400 text-amber-400' : 'text-slate-500'} />
      </button>
    </div>
  );

  const chips: { id: View; label: string }[] = [{ id: 'favoritos', label: `⭐ Favoritos (${nFav})` }, { id: 'despensa', label: `En mi despensa (${nPan})` }, { id: 'todos', label: 'Todos' }, ...CAT_LIST.map((c) => ({ id: c.id, label: c.label }))];

  return (
    <div className="space-y-3">
      <div className="card !p-3 space-y-2">
        <div className="relative">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input className="field !pl-9" placeholder="Buscar un alimento o producto…" value={q} onChange={(e) => { setQ(e.target.value); setLimit(PAGE); }} onKeyDown={(e) => { if (e.key === 'Enter') void search(); }} aria-label="Buscar alimento" />
        </div>
        <div className="flex items-center gap-1.5">
          {STORES.map((s) => <button key={s} onClick={() => setStore(s)} aria-pressed={store === s} className={cx('rounded-full px-3 py-1.5 text-xs font-semibold', store === s ? 'bg-accent text-white' : 'bg-slate-800 text-slate-400')}>{s === 'todas' ? 'Todas' : s}</button>)}
          <button className="btn btn-blue ml-auto !px-3 !py-1.5 text-xs" disabled={busy || q.trim().length < 3} onClick={() => void search()}>{busy ? <Loader2 size={14} className="animate-spin" /> : <Globe size={14} />} Buscar en el súper</button>
        </div>
        <p className="text-[11px] leading-snug text-slate-500">Escribe y filtra tu lista al instante. Para productos concretos (p. ej. «jamón cocido Hacendado») pulsa «Buscar en el súper»: trae los valores del envase y se guarda al usarlo.</p>
      </div>

      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {chips.map((c) => <button key={c.id} onClick={() => { setView(c.id); setLimit(PAGE); }} aria-pressed={view === c.id} className={cx('shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold', view === c.id ? 'bg-accent text-white' : 'bg-slate-800 text-slate-300')}>{c.label}</button>)}
      </div>

      {view === 'favoritos' && nFav === 0 && <p className="card !p-3 text-sm text-slate-400">Aún no tienes favoritos. Toca la ⭐ de un alimento y aparecerá aquí para encontrarlo rápido.</p>}
      {view === 'despensa' && nPan === 0 && <p className="card !p-3 text-sm text-slate-400">Ningún alimento de tu inventario coincide con el catálogo. Abre un alimento y pulsa «Tengo en casa».</p>}

      <div className="space-y-1.5">{local.slice(0, limit).map(row)}</div>
      {local.length > limit && <button className="btn btn-ghost w-full text-xs" onClick={() => setLimit(limit + PAGE)}>Mostrar más ({local.length - limit})</button>}
      {local.length === 0 && q.trim() && view !== 'favoritos' && <p className="text-center text-xs text-slate-500">Nada en tu lista con «{q.trim()}». Prueba «Buscar en el súper».</p>}

      {err && <p className="rounded-xl bg-amber-500/10 p-3 text-xs text-amber-400">{err}</p>}
      {onlineShown.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-xs font-bold uppercase text-slate-400">Del súper ({asked.split('|')[1] === 'todas' ? 'todas las marcas' : asked.split('|')[1]}) · Open Food Facts</div>
          {onlineShown.map(row)}
          <p className="text-[11px] text-slate-500">Datos de la comunidad: comprueba que coinciden con tu envase antes de fiarte.</p>
        </div>
      )}
      {sel && <FoodSheet item={sel} adopt={adopt} onClose={() => setSel(null)} />}
    </div>
  );
}

function FoodSheet({ item, adopt, onClose }: { item: CatalogItem; adopt: (i: CatalogItem) => CatalogItem; onClose: () => void }) {
  const { state, update } = useStore();
  const [cur, setCur] = useState<CatalogItem>(() => withUnits(item, state.foodUnits));
  const [unit, setUnit] = useState<'g' | UnitKey>(() => defaultUnit(cur));
  const [qty, setQty] = useState(() => defaultQty(defaultUnit(cur)));
  const [slot, setSlot] = useState<Slot>(() => inferSlot(Date.now()));
  const [done, setDone] = useState(false);
  const grams = gramsFor(cur, qty, unit);
  const m = grams ? macrosOf(cur, grams) : null;
  const exactInPantry = state.pantry.some((p) => p.qty > 0 && norm(p.name) === norm(cur.name));

  const pickUnit = (u: 'g' | UnitKey) => {
    setUnit(u);
    setQty(defaultQty(u));
  };
  const own = (): CatalogItem => {
    const a = adopt(cur);
    if (a.id !== cur.id) setCur(a);
    return a;
  };
  /** Corrige cuánto pesa una medida (p. ej. 1 yogur = 120 g): se guarda y se usa siempre. */
  const setUnitG = (u: UnitKey, g: number) => {
    const a = own();
    setCur({ ...a, units: { ...a.units, [u]: g > 0 ? g : undefined } });
    update((s) => {
      const prev = { ...(s.foodUnits?.[a.id] ?? {}) };
      if (g > 0) prev[u] = g;
      else delete prev[u];
      return { ...s, foodUnits: { ...(s.foodUnits ?? {}), [a.id]: prev } };
    });
  };
  const togglePantry = () => {
    const a = own();
    update((s) => ({ ...s, pantry: exactInPantry ? s.pantry.filter((p) => norm(p.name) !== norm(a.name)) : addToPantry(s.pantry, [{ name: a.name, store: a.store !== 'Genérico' && a.store !== 'Mío' ? a.store : undefined }]) }));
  };
  const eat = () => {
    if (!grams || !m) return;
    const a = own();
    const w = unit === 'g' ? `${qty} g` : `${qty} ${qty === 1 ? UNIT_LABEL[unit].one : UNIT_LABEL[unit].many}`;
    update((s) => logTemplate(s, { name: `${a.name} (${w})`, calorias: m.kcal, proteinas: Math.round(m.protein), carbs: Math.round(m.carbs), grasas: Math.round(m.fat), ingredientes: [a.name], detalle: [detailLine(a, qty, unit, grams)] }, true, slot));
    setDone(true);
    window.setTimeout(onClose, 700);
  };

  return (
    <Modal title={cur.name} onClose={onClose}>
      <div className="space-y-3">
        <div className="rounded-xl bg-slate-800 p-3 text-xs text-slate-300">
          <div className="font-semibold text-white">Por 100 g: {cur.kcal} kcal</div>
          <div>Proteína {cur.protein} g · Hidratos {cur.carbs} g · Grasas {cur.fat} g{cur.fiber ? ` · Fibra ${cur.fiber} g` : ''}</div>
          <div className="mt-0.5 text-slate-500">{cur.source === 'tabla' ? 'Valores medios de la tabla de la app (no de una marca concreta).' : cur.source === 'online' ? 'Valores del envase según Open Food Facts.' : 'Valores guardados por ti.'}</div>
        </div>
        <div className="flex gap-2">
          <button className={cx('btn flex-1 !py-2 text-xs', exactInPantry ? 'btn-green' : 'btn-ghost')} onClick={togglePantry}>{exactInPantry ? <><Check size={14} /> En mi despensa</> : <><Refrigerator size={14} /> Tengo en casa</>}</button>
        </div>

        <div>
          <div className="label">¿Cuánto vas a comer?</div>
          <div className="flex flex-wrap gap-1.5">
            {(['g', ...UNIT_KEYS.filter((k) => k !== 'puñado' || cur.units.puñado)] as ('g' | UnitKey)[]).map((u) => (
              <button key={u} onClick={() => pickUnit(u)} aria-pressed={unit === u} className={cx('rounded-full px-3 py-1.5 text-xs font-semibold', unit === u ? 'bg-accent text-white' : cur.units[u as UnitKey] || u === 'g' ? 'bg-slate-800 text-slate-200' : 'border border-dashed border-slate-600 text-slate-500')}>
                {u === 'g' ? 'gramos' : UNIT_LABEL[u].many.replace(' soperas llenas', '')}
              </button>
            ))}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <NumInput label="Cantidad" value={qty} className="field w-24 text-center" onChange={setQty} />
            <span className="text-sm text-slate-300">{unit === 'g' ? 'g' : qty === 1 ? UNIT_LABEL[unit].one : UNIT_LABEL[unit].many}</span>
          </div>
          {unit !== 'g' && (
            <div className="mt-2 flex items-center gap-2 rounded-xl bg-slate-800 p-2 text-xs text-slate-300">
              <span>1 {UNIT_LABEL[unit].one} pesa</span>
              <NumInput label={`Gramos de 1 ${UNIT_LABEL[unit].one}`} value={cur.units[unit] ?? 0} placeholder="?" className="h-8 w-16 rounded-md bg-slate-900 text-center font-semibold text-white outline-none focus:ring-1 focus:ring-accent" onChange={(g) => setUnitG(unit, g)} />
              <span>g · se guarda para la próxima vez</span>
            </div>
          )}
        </div>

        <div className={cx('rounded-xl p-3 text-center', m ? 'bg-accent/10' : 'bg-slate-800')}>
          {m && grams ? (
            <>
              <div className="text-3xl font-black tabular-nums text-white">{m.kcal}<span className="text-sm font-semibold text-slate-400"> kcal</span></div>
              <div className="text-xs text-slate-300">P {m.protein} g · C {m.carbs} g · G {m.fat} g · {Math.round(grams)} g en total</div>
            </>
          ) : <div className="text-xs text-amber-400">Escribe cuántos gramos pesa 1 {unit === 'g' ? 'unidad' : UNIT_LABEL[unit].one} para calcularlo.</div>}
        </div>

        <div>
          <div className="label">Añadir a</div>
          <div className="grid grid-cols-5 gap-1">
            {SLOTS.map((s) => <button key={s.id} onClick={() => setSlot(s.id)} aria-pressed={slot === s.id} className={cx('truncate rounded-lg px-0.5 py-2 text-[11px] font-bold', slot === s.id ? 'bg-accent text-white' : 'bg-slate-800 text-slate-400')}>{s.label}</button>)}
          </div>
        </div>
        <button className="btn btn-green w-full" disabled={!m || done} onClick={eat}>{done ? <><Check size={16} /> Añadido</> : 'Comer'}</button>
      </div>
    </Modal>
  );
}
