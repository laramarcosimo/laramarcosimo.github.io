import { Blocks } from '../components/Blocks';
import { AlertCircle, CalendarDays, Camera, Image as ImageIcon, Refrigerator, ScanBarcode, ShoppingCart, type LucideIcon, ChefHat, Clock, Utensils } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { DefaultStore } from '../components/DefaultStore';
import { BarcodeScanner } from '../components/BarcodeScanner';
import { WeekMenu } from '../components/WeekMenu';
import { ShoppingList } from '../components/ShoppingList';
import { UtensilChips } from '../components/UtensilChips';
import { recipeContext } from '../lib/coach';
import { PantryInventory } from '../components/PantryInventory';
import { ErrorBox, Spinner, Title } from '../components/ui';
import { storeList } from '../lib/stores';
import { generateRecipes, scanPantry } from '../lib/gemini';
import { compressToBase64 } from '../lib/image';
import { dayBalance } from '../lib/metabolic';
import { addToPantry, deductFromPantry, type PantryEntry } from '../lib/pantry';
import { useStore } from '../lib/store';
import type { Difficulty, Recipe } from '../lib/types';
import { cx, daysUntil, uid } from '../lib/utils';
import { Hint } from '../components/Hint';

const DIFF_STYLE: Record<Difficulty, string> = {
  Fácil: 'bg-emerald-500/15 text-emerald-500',
  Media: 'bg-amber-500/15 text-amber-500',
  Difícil: 'bg-red-500/15 text-red-400',
};

const RECIPES_KEY = 'apex-recipes-last';

/** Firma de lo que influye en las recetas: si no cambia, se reutilizan las anteriores sin gastar petición. */
const recipeSig = (pantry: string[], utensils: string[], dislikes: string[], remaining: number, protein: number, trained: boolean): string =>
  JSON.stringify([[...pantry].sort(), [...utensils].sort(), [...dislikes].sort(), Math.round(remaining / 100), Math.round(protein / 15), trained]);

const loadRecipes = (sig: string): Recipe[] => {
  try {
    const v = JSON.parse(localStorage.getItem(RECIPES_KEY) ?? 'null') as { sig: string; ts: number; recipes: Recipe[] } | null;
    return v && v.sig === sig && Date.now() - v.ts < 24 * 3600000 ? v.recipes : [];
  } catch {
    return [];
  }
};

type Sub = 'inventario' | 'menu' | 'compra';
const SUBS: { id: Sub; label: string; Icon: LucideIcon }[] = [
  { id: 'inventario', label: 'Inventario', Icon: Refrigerator },
  { id: 'menu', label: 'Menú y recetas', Icon: ChefHat },
  { id: 'compra', label: 'Compra y utensilios', Icon: ShoppingCart },
];
const GROUPS: Record<Sub, string[]> = {
  inventario: ['caduca', 'inventario', 'escaner'],
  menu: ['menu', 'recetas'],
  compra: ['compra', 'utensilios'],
};

export default function Pantry() {
  const { state, update } = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState('');
  const [sub, setSub] = useState<Sub>(() => {
    try {
      const v = localStorage.getItem('apex-pantry-sub');
      return v === 'menu' || v === 'compra' ? v : 'inventario';
    } catch {
      return 'inventario';
    }
  });
  const [barcode, setBarcode] = useState(false);
  const [soon, setSoon] = useState(false);
  const [err, setErr] = useState('');
  const [scanned, setScanned] = useState<PantryEntry[]>([]);
  const b = dayBalance(state);
  const sig = recipeSig(state.pantry.map((p) => p.name), state.utensils, state.dislikes, b.remaining, b.proteinRemaining, b.trainingDay);
  const [recipes, setRecipes] = useState<Recipe[]>(() => loadRecipes(sig));
  const savedSig = useRef(sig);
  const expiring = state.pantry.filter((p) => p.expires && daysUntil(p.expires) <= 3);
  // La última tanda se guarda (también tras cocinar una) para no volver a pedirla al cambiar de pestaña.
  useEffect(() => {
    try {
      localStorage.setItem(RECIPES_KEY, JSON.stringify({ sig: savedSig.current, ts: Date.now(), recipes }));
    } catch {
      /* sin almacenamiento */
    }
  }, [recipes]);

  const onFile = async (f: File | undefined) => {
    if (fileRef.current) fileRef.current.value = '';
    if (galleryRef.current) galleryRef.current.value = '';
    if (!f) return;
    setBusy('Escaneando despensa…');
    setErr('');
    try {
      let b64: string | null = await compressToBase64(f);
      const list = await scanPantry(state.settings, b64, storeList(state.defaultSupermarket, state.supermarkets), state.defaultSupermarket);
      b64 = null;
      setScanned(list.filter((e) => !state.pantry.some((p) => p.name.toLowerCase() === e.name.toLowerCase())));
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error desconocido');
    } finally {
      setBusy('');
    }
  };

  const makeRecipes = async () => {
    setBusy('Cocinando ideas…');
    setErr('');
    try {
      savedSig.current = sig;
      setRecipes(await generateRecipes(state.settings, state.pantry.map((p) => p.name), state.utensils, storeList(state.defaultSupermarket, state.supermarkets), b.remaining, b.proteinRemaining, recipeContext(state, b), state.dislikes, state.pantry.filter((p) => p.expires && daysUntil(p.expires) <= 3).map((p) => p.name)));
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error desconocido');
    } finally {
      setBusy('');
    }
  };

  const cook = (r: Recipe) => {
    update((s) => ({
      ...s,
      pantry: deductFromPantry(s.pantry, r.ingredientesDespensa),
      meals: [...s.meals, { id: uid(), ts: Date.now(), plato: r.nombre, calorias: r.calorias, proteinas: r.proteinas, carbs: r.carbs, grasas: r.grasas }],
    }));
    setRecipes((list) => list.filter((x) => x !== r));
  };

  const pick = (id: Sub) => {
    setSub(id);
    try {
      localStorage.setItem('apex-pantry-sub', id);
    } catch {
      /* noop */
    }
  };
  const pick2 = (all: Record<string, ReactNode>): Record<string, ReactNode> => Object.fromEntries(GROUPS[sub].filter((k) => k in all).map((k) => [k, all[k]]));

  return (
    <div className="space-y-4">
      <Title sub="Inventario y recetas ajustadas a tu día">Despensa</Title>
      <div role="tablist" className="grid grid-cols-3 gap-1 rounded-2xl bg-slate-800 p-1">
        {SUBS.map(({ id, label, Icon }) => (
          <button key={id} role="tab" aria-selected={sub === id} onClick={() => pick(id)} className={cx('flex flex-col items-center gap-0.5 rounded-xl px-1 py-2 text-[11px] font-semibold leading-tight transition', sub === id ? 'bg-slate-900 text-accent shadow' : 'text-slate-400')}>
            <Icon size={18} strokeWidth={sub === id ? 2 : 1.5} />
            {label}
          </button>
        ))}
      </div>
      <Blocks
        page={`despensa-${sub}`}
        items={pick2({
          caduca: expiring.length > 0 && (
            <button className="card flex w-full gap-2 !p-3 text-left text-sm text-amber-500" onClick={() => setSoon(true)}>
              <AlertCircle size={18} strokeWidth={1.75} className="mt-0.5 shrink-0" />
              <span><b>Caduca pronto:</b> {expiring.map((p) => p.name).join(', ')}. Toca para verlos en la lista.</span>
            </button>
          ),
          escaner: (
            <>
          <DefaultStore />
    
          <button className="btn btn-green w-full !py-4" disabled={!!busy} onClick={() => fileRef.current?.click()}>
            <Camera size={20} /> Escanear nevera / armario
          </button>
          <button className="btn btn-ghost w-full" disabled={!!busy} onClick={() => galleryRef.current?.click()}><ImageIcon size={18} strokeWidth={1.75} /> Subir foto de la galería</button>
          <button className="btn btn-ghost w-full" onClick={() => setBarcode(true)}><ScanBarcode size={18} strokeWidth={1.75} /> Escanear código de barras</button>
          {barcode && <BarcodeScanner onClose={() => setBarcode(false)} />}
          <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />
          <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />
    
          {scanned.length > 0 && (
            <div className="card">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-semibold text-white">Detectado — toca para añadir</span>
                <button className="text-xs font-semibold text-fuel" onClick={() => { update((s) => ({ ...s, pantry: addToPantry(s.pantry, scanned) })); setScanned([]); }}>Añadir todo</button>
              </div>
              <div className="flex flex-wrap gap-2">
                {scanned.map((e) => (
                  <button key={e.name} className="rounded-full bg-fuel/15 px-3 py-1.5 text-left text-sm text-fuel" onClick={() => { update((s) => ({ ...s, pantry: addToPantry(s.pantry, [e]) })); setScanned((l) => l.filter((x) => x !== e)); }}>
                    + {e.name}{e.store ? ` · ${e.store}` : ''}
                  </button>
                ))}
              </div>
            </div>
          )}
    
          {busy && <Spinner label={busy} />}
          {err && <ErrorBox msg={err} />}
            </>
          ),
          inventario: <PantryInventory onBarcode={() => setBarcode(true)} soon={soon} setSoon={setSoon} />,
          menu: (<div className="space-y-3"><h3 className="flex items-center gap-2 font-bold text-white"><CalendarDays size={16} strokeWidth={1.75} /> Menú de la semana</h3><WeekMenu /></div>),
          compra: <ShoppingList />,
          utensilios: (
            <>
          <div className="card space-y-3">
            <div>
              <h3 className="flex items-center gap-2 font-bold text-white"><Utensils size={16} /> Mis utensilios de cocina</h3>
              <Hint className="text-xs text-slate-400">Marca con qué cocinas en casa; las recetas solo usarán esto.</Hint>
            </div>
            <UtensilChips />
          </div>
            </>
          ),
          recetas: (
            <>
          <div className="card space-y-3">
            <div>
              <h3 className="font-bold text-white">Recetas ajustadas</h3>
              <Hint className="text-xs text-slate-400">Te quedan {Math.max(0, b.remaining)} kcal y {Math.max(0, b.proteinRemaining)} g de proteína. Solo usa lo que hay en tu despensa{state.dislikes.length ? ' y evita lo que no te gusta' : ''}.</Hint>
            </div>
            <button className="btn btn-blue w-full" disabled={!!busy || state.pantry.length === 0} onClick={() => void makeRecipes()}>
              <ChefHat size={16} /> {recipes.length ? 'Generar otras recetas (gasta 1 petición)' : 'Generar recetas (fácil → elaborada)'}
            </button>
            {recipes.map((r) => (
              <div key={r.nombre} className="rounded-xl bg-slate-800 p-3">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className={cx('rounded-full px-2.5 py-0.5 text-xs font-bold', DIFF_STYLE[r.dificultad])}>{r.dificultad}</span>
                  <span className="flex items-center gap-1 text-xs text-slate-400"><Clock size={12} /> {r.tiempoMin} min</span>
                </div>
                <div className="font-bold text-white">{r.nombre}</div>
                <div className="my-2 grid grid-cols-4 gap-1.5 text-center">
                  {([['Kcal', r.calorias, 'text-fuel'], ['Prot', r.proteinas, 'text-accent'], ['Carbs', r.carbs, 'text-amber-400'], ['Grasas', r.grasas, 'text-pink-400']] as const).map(([l, v, c]) => (
                    <div key={l} className="rounded-lg bg-slate-900 py-1.5"><div className={cx('text-sm font-bold', c)}>{v}</div><div className="text-[10px] uppercase text-slate-400">{l}</div></div>
                  ))}
                </div>
                {r.utensilios.length > 0 && <div className="mb-1 flex items-center gap-1 text-xs text-slate-400"><Utensils size={12} /> {r.utensilios.join(', ')}</div>}
                <div className="mb-2 text-xs text-fuel">{r.ingredientes.length ? r.ingredientes.map((i) => (i.cantidad ? `${i.nombre} (${i.cantidad})` : i.nombre)).join(' · ') : r.ingredientesDespensa.join(', ')}</div>
                {r.fueraDespensa.length > 0 && (
                  <div className="mb-2 flex gap-1.5 rounded-lg bg-amber-500/10 p-2 text-xs text-amber-500">
                    <AlertCircle size={14} strokeWidth={1.75} className="mt-0.5 shrink-0" />
                    <span>Incluye algo que no tienes o que no te gusta: {r.fueraDespensa.join(', ')}. Revísalo antes de cocinar.</span>
                  </div>
                )}
                <ol className="mb-3 list-decimal space-y-0.5 pl-4 text-xs text-slate-300">{r.pasos.map((p, i) => <li key={i}>{p}</li>)}</ol>
                <button className="btn btn-green w-full !py-2" onClick={() => cook(r)}>Cocinar y Registrar</button>
              </div>
            ))}
          </div>
            </>
          ),
        })}
      />

    </div>
  );
}
