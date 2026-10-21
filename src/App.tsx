import { Apple, Check, WifiOff, Dumbbell, Home, Refrigerator, Settings as Cog } from 'lucide-react';
import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { AiCancelBar } from './components/AiCancelBar';
import { RestTimer, type RestState, type TimePlan } from './components/RestTimer';
import { targetOf } from './lib/timeOptimizer';
import { Modal } from './components/ui';
import { DefaultStore } from './components/DefaultStore';
import { SupermarketChips } from './components/SupermarketChips';
import { backupNow, dueForBackup } from './lib/cloud';
import { autoLogPlanned, rolloverPlan } from './lib/plan';
import { setExtraFoods } from './lib/foodDb';
import { enforceRetention } from './lib/reports';
import { syncPushJobs } from './lib/push';
import { ImportReview } from './components/ShoppingImport';
import { parseList, type ParsedItem } from './lib/shoppingParse';
import { LayoutEditProvider, useLayoutEdit } from './lib/layoutEdit';
import { useOnline } from './lib/online';
import { useUpdateAvailable } from './lib/update';
import { useStore } from './lib/store';
import { cx, dayKey, round } from './lib/utils';
import Today from './views/Today';

// Las demás pantallas se cargan aparte (la app abre antes) y se descargan solas en segundo plano para que funcionen sin conexión.
const loadNutrition = () => import('./views/Nutrition');
const loadPantry = () => import('./views/Pantry');
const loadSettings = () => import('./views/Settings');
const loadTrain = () => import('./views/Train');
const Nutrition = lazy(loadNutrition);
const Pantry = lazy(loadPantry);
const Settings = lazy(loadSettings);
const Train = lazy(loadTrain);

type Tab = 'hoy' | 'entreno' | 'nutricion' | 'despensa' | 'ajustes';

const TABS: { id: Tab; label: string; Icon: typeof Home; color: string }[] = [
  { id: 'hoy', label: 'Hoy', Icon: Home, color: 'text-white' },
  { id: 'entreno', label: 'Entreno', Icon: Dumbbell, color: 'text-accent' },
  { id: 'nutricion', label: 'Nutrición', Icon: Apple, color: 'text-fuel' },
  { id: 'despensa', label: 'Despensa', Icon: Refrigerator, color: 'text-fuel' },
  { id: 'ajustes', label: 'Ajustes', Icon: Cog, color: 'text-slate-200' },
];

export default function App() {
  return (
    <LayoutEditProvider>
      <AppShell />
    </LayoutEditProvider>
  );
}

function AppShell() {
  const { setEditing } = useLayoutEdit();
  const { state, update, undoInfo, undo } = useStore();
  const [toast, setToast] = useState('');
  const [importItems, setImportItems] = useState<ParsedItem[] | null>(null);
  const handled = useRef(false);

  // Archivo de informes PDF: al abrir se borran los caducados (del mes: los de años anteriores; del año y de fotos: más de 3 años).
  useEffect(() => {
    void enforceRetention();
  }, []);

  // Tus productos guardados (escaneados o de tu foto de la tabla) se suman a la tabla de composición.
  useEffect(() => {
    setExtraFoods(state.products ?? []);
  }, [state.products]);

  // Deep link de Atajos de iOS: /?logSleep=HORAS&logSteps=PASOS&date=AAAA-MM-DD
  useEffect(() => {
    if (handled.current) return;
    handled.current = true;
    const q = new URLSearchParams(window.location.search);
    const listRaw = q.get('importList');
    if (listRaw !== null) {
      const items = parseList(listRaw);
      if (items.length) setImportItems(items);
      window.history.replaceState(null, '', window.location.pathname);
      return;
    }
    const sleepRaw = q.get('logSleep');
    const stepsRaw = q.get('logSteps');
    if (sleepRaw === null && stepsRaw === null) return;
    const dateParam = q.get('date') ?? '';
    const date = /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : dayKey();
    const hours = sleepRaw === null ? NaN : parseFloat(sleepRaw.replace(',', '.'));
    const steps = stepsRaw === null ? NaN : Math.round(parseFloat(stepsRaw.replace(/[.\s]/g, '').replace(',', '.')));
    const okSleep = Number.isFinite(hours) && hours > 0 && hours <= 24;
    const okSteps = Number.isFinite(steps) && steps >= 0 && steps <= 200000;
    if (okSleep || okSteps) {
      update((s) => ({
        ...s,
        habits: { ...s.habits, [date]: { ...(s.habits[date] ?? { agua: 0 }), ...(okSleep ? { sleepHours: round(hours, 2) } : {}), ...(okSteps ? { steps } : {}) } },
      }));
      setToast('Métricas sincronizadas desde iOS');
      setTimeout(() => setToast(''), 6000);
    }
    window.history.replaceState(null, '', window.location.pathname);
  }, [update]);
  // Copia automática en la nube: al abrir (si pasó 1 día) y tras guardar un entreno (si pasó 1 h). Sobrescribe la anterior.
  const workoutCount = state.workouts.length;
  const prevCount = useRef(workoutCount);
  useEffect(() => {
    const after = workoutCount > prevCount.current;
    prevCount.current = workoutCount;
    if (!dueForBackup(after)) return;
    const t = setTimeout(() => void backupNow(state).catch(() => undefined), 3000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workoutCount]);
  // Avisos con la app cerrada: deja puestos en el servidor los que se pueden prever (cena tras entrenar, medidas, proteína, caducidades).
  const mealCount = state.meals.length;
  const pantryCount = state.pantry.length;
  const { postHour, measureDay, measureHour, faceRemind, faceTime } = state.settings;
  const faceDone = !!state.habits[dayKey()]?.faceYoga;
  useEffect(() => {
    const t = setTimeout(() => void syncPushJobs(state), 2500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workoutCount, mealCount, pantryCount, postHour, measureDay, measureHour, faceRemind, faceTime, faceDone]);
  const online = useOnline();
  const updateAvailable = useUpdateAvailable();
  const [startId, setStartId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('hoy');
  const [rest, setRest] = useState<RestState | null>(null);
  const [firstRun, setFirstRun] = useState(() => {
    try {
      return localStorage.getItem('apex-onboarded') !== '1' && state.supermarkets.length === 0;
    } catch {
      return false;
    }
  });
  const finishOnboarding = () => {
    setFirstRun(false);
    try {
      localStorage.setItem('apex-onboarded', '1');
    } catch {
      /* noop */
    }
  };

  const act = state.active;
  const actTarget = act ? targetOf(act.timeMode) : null;
  const timePlan: TimePlan | null = act && actTarget ? { target: actTarget, startedAt: act.startedAt, planned: act.exercises.filter((e) => !e.skipped).reduce((a, e) => a + e.sets.filter((s) => s.type !== 'warmup').length, 0), done: act.exercises.reduce((a, e) => a + e.sets.filter((s) => s.type !== 'warmup' && s.completed).length, 0) } : null;

  const startRest = useCallback((seconds?: number) => {
    if (seconds === 0) {
      setRest(null); // 0 = parar el descanso (al terminar o descartar el entreno)
      return;
    }
    void import('./lib/notify').then((m) => m.maybeAskNotifications()); // una sola vez, desde el toque que inicia el descanso
    const total = seconds ?? state.settings.restDefault;
    setRest({ endsAt: Date.now() + total * 1000, total });
  }, [state.settings.restDefault]);

  // Tamaño de letra global (la app usa rem, así que todo escala).
  useEffect(() => {
    const pct = { normal: 100, large: 112.5, xlarge: 125 }[state.settings.fontScale] ?? 100;
    document.documentElement.style.fontSize = `${pct}%`;
  }, [state.settings.fontScale]);

  useEffect(() => {
    const id = window.setTimeout(() => { void loadTrain(); void loadNutrition(); void loadPantry(); void loadSettings(); }, 2500);
    return () => window.clearTimeout(id);
  }, []);
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  });

  // Lo previsto en «Planificar día» cuya hora ya pasó se anota solo en el diario (y se quita del plan).
  useEffect(() => {
    const run = () => {
      // 1) lo planificado para «mañana» pasa a ser el plan de hoy al llegar el día; 2) lo previsto cuya hora ya pasó se anota solo.
      if (rolloverPlan(stateRef.current) !== stateRef.current) update((s) => rolloverPlan(s));
      const r = autoLogPlanned(rolloverPlan(stateRef.current));
      if (r.moved.length === 0) return;
      update((s) => autoLogPlanned(rolloverPlan(s)).state);
      const done = r.moved.filter((m) => m.logged).map((m) => m.name);
      if (done.length) {
        setToast(`Pasé a tu diario lo que tenías previsto: ${done.join(', ')}`);
        setTimeout(() => setToast(''), 7000);
      }
    };
    const first = window.setTimeout(run, 2500);
    const id = window.setInterval(run, 60_000);
    return () => { window.clearTimeout(first); window.clearInterval(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Las fotos de progreso pendientes se suben solas: al abrir la app y cada vez que vuelve la conexión.
  useEffect(() => {
    const meals = () => { void import('./lib/mealQueue').then((m) => m.processQueue(stateRef.current)); };
    window.addEventListener('online', meals);
    const mid = window.setTimeout(meals, 9000);
    const go = () => { void import('./lib/photosCloud').then(async (m) => { await m.purgeTrash(); await m.syncPhotos(); }); };
    const id = window.setTimeout(go, 6000);
    window.addEventListener('online', go);
    return () => { window.clearTimeout(id); window.clearTimeout(mid); window.removeEventListener('online', go); window.removeEventListener('online', meals); };
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle('hide-hints', !!state.settings.hideHints);
    document.documentElement.classList.toggle('icon-only', !!state.settings.iconOnly);
  }, [state.settings.hideHints, state.settings.iconOnly]);

  const top = state.settings.navbarPosition === 'top';

  /*
   * Barra de navegación con la misma estructura que la app de ahorros: el scroll es el del documento y la barra
   * va aparte (fija abajo con safe-area-inset-bottom, o pegada arriba con sticky). Sin contenedores con altura fija.
   */
  const nav = (
    <nav
      className={cx(
        'z-50 w-full border-slate-800 bg-slate-900/95 backdrop-blur-md',
        top ? 'sticky top-0 border-b' : 'fixed bottom-0 left-0 right-0 border-t',
      )}
      style={top ? { paddingTop: 'env(safe-area-inset-top, 0px)' } : { paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      aria-label="Navegación principal"
    >
      <div className="mx-auto grid max-w-xl grid-cols-5">
        {TABS.map(({ id, label, Icon }) => {
          const on = tab === id;
          return (
            <button
              key={id}
              onClick={() => { setTab(id); setEditing(false); }}
              aria-current={on ? 'page' : undefined}
              className={cx('relative flex h-[58px] flex-col items-center justify-center gap-1 text-[10.5px] transition-colors', on ? 'font-semibold text-accent' : 'font-medium text-slate-400 active:text-accent')}
            >
              <span className={cx('absolute left-1/4 right-1/4 h-0.5 rounded-full', top ? 'bottom-0' : 'top-0', on ? 'bg-accent' : 'bg-transparent')} />
              <Icon size={22} strokeWidth={on ? 2 : 1.5} />
              {label}
              {id === 'entreno' && state.active && <span className="absolute right-[28%] top-2 h-2 w-2 rounded-full bg-accent" />}
            </button>
          );
        })}
      </div>
    </nav>
  );

  return (
    <div
      className="mx-auto min-h-screen max-w-xl"
      style={{
        ['--sticky-pt' as string]: '0px',
        ['--nav-h' as string]: top ? 'calc(58px + env(safe-area-inset-top, 0px))' : '0px',
        ['--rest-bottom' as string]: top ? 'calc(env(safe-area-inset-bottom, 0px) + 12px)' : 'calc(env(safe-area-inset-bottom, 0px) + 76px)',
      }}
    >
      {top && nav}
      <main className="px-4" style={{ paddingTop: top ? 12 : 'calc(env(safe-area-inset-top, 0px) + 12px)', paddingBottom: top ? 32 : 'calc(env(safe-area-inset-bottom, 0px) + 96px)' }}>
        {updateAvailable && (
          <div className="mb-3 flex items-center justify-between gap-3 rounded-xl bg-accent/15 px-3 py-2 text-xs text-accent" role="status">
            <span><b>Hay una versión nueva.</b> Toca para actualizar (tus datos no se pierden).</span>
            <button className="btn btn-blue shrink-0 !px-3 !py-1.5 text-xs" onClick={() => window.location.reload()}>Actualizar</button>
          </div>
        )}
        {!online && (
          <div className="mb-3 flex items-start gap-2 rounded-xl bg-amber-500/15 px-3 py-2 text-xs text-amber-500" role="status">
            <WifiOff size={15} strokeWidth={1.75} className="mt-0.5 shrink-0" />
            <span><b>Sin conexión.</b> Todo lo demás funciona; las consultas a Gemini esperan a que vuelva la red y se envían solas.</span>
          </div>
        )}
        <AiCancelBar />
        <Suspense fallback={<div className="p-6 text-center text-sm text-slate-500">Cargando…</div>}>
        {tab === 'hoy' && <Today onStart={(id) => { setStartId(id ?? null); setTab('entreno'); }} />}
        {tab === 'entreno' && <Train onRest={startRest} autoStart={startId} onAutoStarted={() => setStartId(null)} />}
        {tab === 'nutricion' && <Nutrition />}
        {tab === 'despensa' && <Pantry />}
        {tab === 'ajustes' && <Settings />}
        </Suspense>
      </main>

      {toast && (
        <div className="fixed inset-x-4 z-[60] mx-auto flex max-w-sm items-center justify-center gap-2 rounded-2xl border border-indigo-400/40 bg-slate-900 px-4 py-3 text-sm text-white shadow-2xl" style={{ top: 'calc(env(safe-area-inset-top) + 12px)' }} role="status" onClick={() => setToast('')}>
          <Check size={16} strokeWidth={2} className="text-fuel" /> {toast}
        </div>
      )}

      {undoInfo && (
        <div className="fixed inset-x-4 z-[60] mx-auto flex max-w-sm items-center justify-between gap-3 rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white shadow-2xl" style={{ bottom: 'calc(env(safe-area-inset-bottom) + 84px)' }} role="status">
          <span className="min-w-0 truncate">{undoInfo.label}</span>
          <button className="shrink-0 font-bold text-accent" onClick={undo}>Deshacer</button>
        </div>
      )}

      {importItems && <ImportReview items={importItems} onClose={() => setImportItems(null)} />}

      {firstRun && (
        <Modal title="¿Dónde sueles comprar?" onClose={finishOnboarding}>
          <p className="mb-3 text-sm text-slate-400">Así Gemini reconoce mejor tus productos y marcas blancas. Puedes cambiarlo luego en Ajustes.</p>
          <DefaultStore />
          <SupermarketChips />
          <button className="btn btn-green mt-4 w-full" onClick={finishOnboarding}>Continuar</button>
        </Modal>
      )}

      {rest && act && <RestTimer rest={rest} setRest={setRest} options={[60, 90, 120, 180]} plan={timePlan} />}

      {!top && nav}
    </div>
  );
}
