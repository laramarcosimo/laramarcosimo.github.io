import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { AppState } from './types';
import { normalizePairs } from './workout';
import { legacyPlaceOf, rememberPantry, syncPackUnits } from './pantry';
import { moveStretches, stretchSets } from './stretchFix';
import { setExtraFoods } from './foodDb';
import { REMOVED_IDS, BUILTIN_EXERCISES, DB_VERSION, DEFAULT_TEMPLATES, GLOW_TEMPLATE, OLD_DEFAULT_IDS } from './exercises';
import { uid } from './utils';

const SEED_PANTRY = [
  { name: 'Pechuga de pollo', qty: 3 }, { name: 'Huevos', qty: 6 }, { name: 'Lata de atún', qty: 2 }, { name: 'Yogur griego', qty: 4 },
  { name: 'Arroz', qty: 4 }, { name: 'Patatas', qty: 4 }, { name: 'Avena', qty: 5 }, { name: 'Pasta integral', qty: 3 },
  { name: 'Tomates', qty: 4 }, { name: 'Cebolla', qty: 3 }, { name: 'Aceite de oliva', qty: 10 }, { name: 'Plátanos', qty: 5 },
];

const KEY = 'apex-coach-v2';
const OLD_KEY = 'apex-coach-v1';

export const defaultState = (): AppState => ({
  profile: { age: 28, sex: 'M', height: 175, weight: 75, goal: 'recomp', activity: 1.3 },
  settings: { geminiKey: '', geminiModel: 'auto', restDefault: 120, restAuto: true, restSound: true, restVibrate: true, weeklyGoal: 3, fontScale: 'normal', kneeSafe: true, navbarPosition: 'bottom' },
  active: null,
  workouts: [],
  templates: DEFAULT_TEMPLATES,
  exercises: BUILTIN_EXERCISES,
  measurements: [],
  mealTemplates: [],
  tuppers: [],
  shopping: [],
  dayPlan: null,
  layout: {},
  layoutHidden: {},
  meals: [],
  pantry: SEED_PANTRY.map((p) => ({ ...p, id: uid() })),
  utensils: ['Sartén', 'Olla', 'Microondas'],
  supermarkets: [],
  dislikes: [],
  discomfort: [],
  demoLinks: {},
  defaultSupermarket: 'HiperDino',
  productImages: {},
  homeGear: ['bodyweight'],
  homeSpecs: { dumbbellKg: 10, kettlebellKg: 12, bandLevel: 'media', backpackKg: 8 },
  habits: {},
  supplements: {
    enabled: false,
    items: [
      { id: 'protein', name: 'Proteína en polvo / Batido', active: false },
      { id: 'creatine', name: 'Creatina monohidrato', dose: '3-5 g', active: false },
      { id: 'multi', name: 'Multivitamínico', active: false },
      { id: 'magnesium', name: 'Magnesio', active: false },
      { id: 'omega3', name: 'Omega 3', active: false },
    ],
  },
  sleepStart: null,
});

/** Mantiene los ejercicios propios y los récords guardados, y añade los nuevos de la biblioteca. */
const mergeExercises = (stored: AppState['exercises'] | undefined): AppState['exercises'] => {
  if (!Array.isArray(stored)) return BUILTIN_EXERCISES;
  const have = new Map(stored.map((e) => [e.id, e]));
  // Los de rostro y cuello se refrescan desde la biblioteca (textos, técnica y animación), conservando tu imagen si subiste una.
  const merged = BUILTIN_EXERCISES.map((b) => {
    const st = have.get(b.id);
    if (!st) return b;
    // DB_VERSION 2: las URLs de fotos antiguas se sustituyen siempre por las ilustraciones nuevas (salvo una imagen propia subida por ti).
    if (!b.timed) return { ...st, name: b.name, unilateral: b.unilateral, imageNote: st.imageUrl.startsWith('data:') ? undefined : b.imageNote, imageUrl: st.imageUrl.startsWith('data:') ? st.imageUrl : b.imageUrl };
    return b.timed ? { ...st, name: b.name, timed: true, muscleGroup: b.muscleGroup, instructions: b.instructions, tips: b.tips, imageUrl: st.imageUrl.startsWith('data:') ? st.imageUrl : b.imageUrl } : st;
  });
  return moveStretches([...merged, ...stored.filter((e) => e.custom)]).exercises;
};

/** Repara los unilaterales con series desparejadas (p. ej. dos D en la serie 3): siempre parejas I, D. */
const fixTemplates = (t: AppState['templates']): AppState['templates'] => t.map((x) => ({ ...x, exercises: x.exercises.filter((e) => !REMOVED_IDS.has(e.exerciseId)).map((e) => (e.unilateral && e.sets.some((s) => s.side) ? { ...e, sets: normalizePairs(e.sets) } : e)) }));
const fixActive = (a: NonNullable<AppState['active']>): NonNullable<AppState['active']> => ({ ...a, exercises: a.exercises.map((e) => (e.unilateral ? { ...e, sets: normalizePairs(e.sets) } : e)) });

const PLACE_FLAG = 'apex-place-v2';

/** Una sola vez: las ubicaciones (nevera/despensa/congelador) que se guardaron con el criterio antiguo y no elegiste tú se vuelven a deducir con el criterio nuevo, más afinado. */
const fixPlaces = (pantry: AppState['pantry'] | undefined): AppState['pantry'] | undefined => {
  if (!pantry) return pantry;
  try {
    if (localStorage.getItem(PLACE_FLAG)) return pantry;
    localStorage.setItem(PLACE_FLAG, '1');
  } catch {
    return pantry;
  }
  return pantry.map((p) => (p.place && p.place === legacyPlaceOf(p.name) ? { ...p, place: undefined } : p));
};

const HEVY_FLAG = 'apex-hevy-routines-v1';

/** Una sola vez: quita las rutinas de ejemplo antiguas y añade las de la semana (que luego puedes editar o borrar). */
const withWeekRoutines = (templates: AppState['templates']): AppState['templates'] => {
  try {
    if (localStorage.getItem(HEVY_FLAG)) return templates;
    localStorage.setItem(HEVY_FLAG, '1');
  } catch {
    return templates;
  }
  const keep = templates.filter((t) => !OLD_DEFAULT_IDS.includes(t.id));
  return [...DEFAULT_TEMPLATES.filter((t) => !keep.some((k) => k.id === t.id)), ...keep];
};

const GLOW_FLAG = 'apex-glow-routine-v1';

/** Una sola vez: añade la rutina «Glow & Jawline Sculpt» (si la borras, no vuelve). */
const withGlowRoutine = (templates: AppState['templates']): AppState['templates'] => {
  try {
    if (localStorage.getItem(GLOW_FLAG)) return templates;
    localStorage.setItem(GLOW_FLAG, '1');
  } catch {
    return templates;
  }
  return templates.some((t) => t.id === GLOW_TEMPLATE.id) ? templates : [...templates, GLOW_TEMPLATE];
};

/** Marca la versión del esquema de imágenes aplicada (la migración se hace en mergeExercises en cada carga). */
const markDbVersion = (): void => {
  try {
    localStorage.setItem('apex-db-version', String(DB_VERSION));
  } catch {
    /* noop */
  }
};

/** El grupo «Core» pasó a llamarse «Abdominales»: se migran ejercicios (también los propios) y entrenos guardados. */
const renameCore = (s: AppState): AppState => {
  const fix = <T extends { muscleGroup: string }>(e: T): T => ((e.muscleGroup as string) === 'Core' ? { ...e, muscleGroup: 'Abdominales' } : e);
  return { ...s, exercises: s.exercises.map(fix), workouts: (s.workouts ?? []).map((w) => ({ ...w, exercises: w.exercises.map(fix) })) };
};

/** Aplica y recuerda las unidades por envase de la despensa (rebanadas, packs…). Devuelve el mismo estado si no cambia nada. */
const syncUnits = (s: AppState): AppState => {
  const r = syncPackUnits(s.pantry, s.packInfo);
  const history = rememberPantry(s.pantryHistory, r.pantry);
  return r.pantry === s.pantry && r.packInfo === s.packInfo && history === s.pantryHistory ? s : { ...s, pantry: r.pantry, packInfo: r.packInfo, pantryHistory: history };
};

const load = (): AppState => syncUnits(renameCore(loadRaw()));

const loadRaw = (): AppState => {
  markDbVersion();
  const d = defaultState();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      localStorage.setItem(HEVY_FLAG, '1');
      localStorage.setItem(GLOW_FLAG, '1');
    } // instalación nueva: ya parte de las rutinas de la semana (si las borras, no vuelven)
    if (raw) {
      const p = JSON.parse(raw) as Partial<AppState>;
      if (p.settings && (!p.settings.geminiModel || p.settings.geminiModel === 'gemini-flash-latest' || p.settings.geminiModel === 'gemini-3.5-flash')) p.settings.geminiModel = 'auto'; // modo automático por defecto
      return { ...d, ...p, homeSpecs: { ...d.homeSpecs, ...p.homeSpecs }, supplements: { ...d.supplements, ...p.supplements }, exercises: mergeExercises(p.exercises), pantry: fixPlaces(p.pantry) ?? d.pantry, templates: stretchSets(fixTemplates(withGlowRoutine(withWeekRoutines(p.templates ?? d.templates))), moveStretches(Array.isArray(p.exercises) ? p.exercises : []).movedIds), active: p.active ? fixActive(p.active) : (p.active ?? null), profile: { ...d.profile, ...p.profile }, settings: { ...d.settings, ...p.settings } };
    }
    // Migración desde la versión anterior: se conservan perfil, nutrición y despensa (el modelo de entrenos cambió).
    const old = localStorage.getItem(OLD_KEY);
    if (old) {
      const p = JSON.parse(old) as Partial<AppState> & { settings?: Record<string, unknown> };
      delete p.settings?.hevyKey;
      return { ...d, profile: { ...d.profile, ...p.profile }, settings: { ...d.settings, ...(p.settings as object) }, meals: p.meals ?? [], pantry: p.pantry ?? d.pantry, utensils: p.utensils ?? d.utensils, habits: p.habits ?? {} };
    }
  } catch {
    /* estado corrupto: se parte de cero */
  }
  return d;
};

interface Ctx {
  state: AppState;
  update: (fn: (s: AppState) => AppState) => void;
  replace: (s: AppState) => void;
  /** Aplica un borrado y permite deshacerlo unos segundos. */
  removeWithUndo: (label: string, fn: (s: AppState) => AppState) => void;
  undoInfo: { label: string } | null;
  undo: () => void;
}

const StoreCtx = createContext<Ctx | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(load);
  const first = useRef(true);
  const stateRef = useRef(state);
  const [undoSnap, setUndoSnap] = useState<{ label: string; snap: AppState } | null>(null);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Tus productos escaneados (etiquetas) pasan a la tabla de alimentos y mandan sobre los valores genéricos.
  useEffect(() => {
    setExtraFoods(state.products ?? []);
  }, [state.products]);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
      localStorage.setItem('user_supermarkets', JSON.stringify(state.supermarkets));
      localStorage.setItem('default_supermarket', state.defaultSupermarket);
      localStorage.setItem('navbar_position', state.settings.navbarPosition);
      localStorage.setItem('product_image_cache', JSON.stringify(state.productImages));
    } catch {
      /* almacenamiento lleno o bloqueado */
    }
  }, [state]);

  const update = useCallback((fn: (s: AppState) => AppState) => setState((s) => syncUnits(fn(s))), []);
  const replace = useCallback((s: AppState) => setState(syncUnits(renameCore({ ...defaultState(), ...s, exercises: mergeExercises(s.exercises) }))), []);
  const removeWithUndo = useCallback((label: string, fn: (s: AppState) => AppState) => {
    setUndoSnap({ label, snap: stateRef.current });
    setState((s) => syncUnits(fn(s)));
  }, []);
  const undo = useCallback(() => {
    setUndoSnap((u) => {
      if (u) setState(u.snap);
      return null;
    });
  }, []);
  useEffect(() => {
    if (!undoSnap) return;
    const t = setTimeout(() => setUndoSnap(null), 15000);
    return () => clearTimeout(t);
  }, [undoSnap]);
  const undoInfo = useMemo(() => (undoSnap ? { label: undoSnap.label } : null), [undoSnap]);
  const value = useMemo(() => ({ state, update, replace, removeWithUndo, undoInfo, undo }), [state, update, replace, removeWithUndo, undoInfo, undo]);
  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export const useStore = (): Ctx => {
  const c = useContext(StoreCtx);
  if (!c) throw new Error('StoreProvider ausente');
  return c;
};
