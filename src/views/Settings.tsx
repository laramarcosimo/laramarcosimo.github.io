import { Blocks } from '../components/Blocks';
import { Bell, Database, Search, Download, Dumbbell, ExternalLink, Lightbulb, Palette, PanelBottom, PanelTop, Pill, ShieldCheck, Sparkles, Trash2, Upload, UserRound, Utensils } from 'lucide-react';
import { useRef, useState } from 'react';
import { isConnected, lastBackupAt } from '../lib/cloud';
import { searchSettings } from '../lib/settingsIndex';
import { usePushEnabled } from '../lib/usePushEnabled';
import { geminiLastMinute, geminiUsage, lastCallInfo, lastGoodModel, testGeminiKey, type KeyCheck } from '../lib/gemini';
import { exportBackupFile } from '../lib/backup';
import { exportWorkoutsCsv } from '../lib/exportWorkouts';
import { CloudBackup } from '../components/CloudBackup';
import { BackupStatus } from '../components/BackupStatus';
import { ReportsArchive } from '../components/ReportsArchive';
import { vacationPatch } from '../lib/vacation';
import { DEFAULT_MERIENDA_FUERA } from '../lib/nutriWeek';
import { DefaultStore } from '../components/DefaultStore';
import { HomeEquipment } from '../components/HomeEquipment';
import { IosGuide } from '../components/IosGuide';
import { SupplementsPanel } from '../components/SupplementsPanel';
import { UtensilChips } from '../components/UtensilChips';
import { PermissionStatus } from '../components/NotifyControl';
import { PushSetup } from '../components/PushSetup';
import { Section } from '../components/Section';
import { SupermarketChips } from '../components/SupermarketChips';
import { NumInput, Title } from '../components/ui';
import { useTheme, type ThemePref } from '../lib/theme';
import { cx } from '../lib/utils';
import { dayPlans } from '../lib/coach';
import { ACTIVITY_LEVELS, GOAL_ADJUST, RECOMP_DEFICIT, bmr } from '../lib/metabolic';
import { defaultState, useStore } from '../lib/store';
import type { AppState, Goal, Profile, Settings as S } from '../lib/types';
import { num } from '../lib/utils';
import { Hint } from '../components/Hint';

export default function Settings() {
  const { state, update, replace } = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState('');
  const { profile: p, settings: st } = state;
  const { pref, setPref } = useTheme();
  const plans = dayPlans(state);
  const [keyCheck, setKeyCheck] = useState<KeyCheck | null>(null);
  const [checking, setChecking] = useState(false);
  // Acordeón exclusivo: un único panel abierto; pulsar el abierto lo pliega.
  const [activeAccordion, setActiveAccordion] = useState<string | null>(null);
  const acc = (id: string) => ({ id: `ajustes-${id}`, open: activeAccordion === id, onToggle: () => setActiveAccordion((cur) => (cur === id ? null : id)) });

  const setP = (patch: Partial<Profile>) => update((s) => ({ ...s, profile: { ...s.profile, ...patch } }));
  const setS = (patch: Partial<S>) => update((s) => ({ ...s, settings: { ...s.settings, ...patch } }));

  const [lastBackup, setLastBackup] = useState(() => {
    try {
      return localStorage.getItem('apex-last-backup') ?? '';
    } catch {
      return '';
    }
  });

  const exportJson = async () => {
    if (await exportBackupFile(state)) {
      try {
        setLastBackup(localStorage.getItem('apex-last-backup') ?? '');
      } catch {
        /* noop */
      }
    }
  };

  const importJson = async (f: File | undefined) => {
    if (fileRef.current) fileRef.current.value = '';
    if (!f) return;
    try {
      const j = JSON.parse(await f.text()) as Partial<AppState>;
      if (!j.profile || !Array.isArray(j.workouts)) throw new Error('Formato no válido');
      const keep = state.settings.geminiKey; // la copia no lleva la clave: se conserva la actual
      replace({ ...defaultState(), ...j, profile: { ...defaultState().profile, ...j.profile }, settings: { ...defaultState().settings, ...j.settings, geminiKey: j.settings?.geminiKey || keep } });
      setMsg('Datos importados.');
    } catch {
      setMsg('Archivo JSON no válido.');
    }
  };

  const numField = (label: string, key: 'age' | 'height' | 'weight', unit: string) => (
    <div>
      <label className="label">{label} ({unit})</label>
      <NumInput value={p[key]} className="field" onChange={(n) => setP({ [key]: n })} />
    </div>
  );


  const [nowTs] = useState(() => Date.now());
  const [query, setQuery] = useState('');
  const results = searchSettings(query);
  const goTo = (section: string) => {
    setActiveAccordion(section);
    setQuery('');
    window.setTimeout(() => document.getElementById(`ajustes-${section}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
  };
  const keyOk = !!st.geminiKey.trim();
  const lastCloud = lastBackupAt();
  const cloudDays = lastCloud ? Math.floor((nowTs - lastCloud) / 86_400_000) : null;
  const cloudText = !isConnected() ? 'Sin configurar' : cloudDays === null ? 'Aún sin copia' : cloudDays === 0 ? 'Copia de hoy' : `Copia de hace ${cloudDays} d`;
  const cloudOk = isConnected() && cloudDays !== null && cloudDays <= 3;
  const pushOk = usePushEnabled();
  const status: [string, string, boolean, string][] = [
    ['IA', keyOk ? 'Conectada' : 'Falta la clave', keyOk, 'ia'],
    ['Nube', cloudText, cloudOk, 'datos'],
    ['Avisos', pushOk ? 'Activos' : 'No activados', pushOk, 'avisos'],
  ];

  const dayButtons = (on: (i: number) => boolean, toggle: (i: number) => void) => (
    <div className="grid grid-cols-7 gap-1.5">
      {([['L', 1], ['M', 2], ['X', 3], ['J', 4], ['V', 5], ['S', 6], ['D', 0]] as const).map(([l, i]) => (
        <button key={i} aria-pressed={on(i)} aria-label={['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][i]} onClick={() => toggle(i)} className={cx('btn !px-0 !py-2', on(i) ? 'btn-blue' : 'btn-ghost')}>{l}</button>
      ))}
    </div>
  );

  return (
    <div className="space-y-4">
      <Title sub="Perfil, avisos, IA y copias">Ajustes</Title>

      <div className="relative">
        <label className="flex items-center gap-2 rounded-xl bg-slate-800 px-3 py-2.5">
          <Search size={16} className="shrink-0 text-slate-400" />
          <input className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-500" placeholder="Buscar un ajuste (foto, vacaciones, clave…)" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Buscar en Ajustes" />
        </label>
        {query.trim().length >= 2 && (
          <div className="mt-1.5 space-y-1 rounded-xl bg-slate-800 p-1.5">
            {results.length === 0 ? <p className="px-2 py-1.5 text-xs text-slate-400">No encuentro ningún ajuste con eso.</p> : results.map((r) => (
              <button key={r.label} className="flex w-full flex-col rounded-lg px-2.5 py-2 text-left active:bg-slate-700" onClick={() => goTo(r.section)}>
                <span className="text-sm font-semibold text-white">{r.label}</span>
                <span className="text-[11px] text-slate-400">{r.sectionTitle}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2" aria-label="Estado de la app">
        {status.map(([label, text, ok, id]) => (
          <button key={id} onClick={() => setActiveAccordion(id)} className="rounded-xl bg-slate-800 p-2.5 text-left active:scale-95">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase text-slate-400"><span className={cx('h-2 w-2 shrink-0 rounded-full', ok ? 'bg-emerald-500' : 'bg-amber-500')} /> <span className="truncate">{label}</span></div>
            <div className={cx('mt-0.5 text-xs font-bold', ok ? 'text-white' : 'text-amber-500')}>{text}</div>
          </button>
        ))}
      </div>

      <Blocks
        page="ajustes"
        items={{
          perfil: (
            <Section icon={UserRound} title="Perfil y objetivos" hint="Datos, objetivo y calorías" {...acc('perfil')}>
            <div className="grid grid-cols-3 gap-2">{numField('Edad', 'age', 'años')}{numField('Altura', 'height', 'cm')}{numField('Peso', 'weight', 'kg')}</div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label">Sexo</label>
                <select className="field" value={p.sex} onChange={(e) => setP({ sex: e.target.value as Profile['sex'] })}>
                  <option value="M">Hombre</option>
                  <option value="F">Mujer</option>
                </select>
              </div>
              <div>
                <label className="label">Objetivo</label>
                <select className="field" value={p.goal} onChange={(e) => setP({ goal: e.target.value as Goal })}>
                  <option value="recomp">Recomposición (−{Math.round(RECOMP_DEFICIT * 100)}%)</option>
                  <option value="deficit">Déficit ({GOAL_ADJUST.deficit})</option>
                  <option value="maintain">Mantenimiento</option>
                  <option value="surplus">Superávit (+{GOAL_ADJUST.surplus})</option>
                </select>
              </div>
            </div>
            <div>
              <label className="label">Actividad diaria base (sin entreno)</label>
              <select className="field" value={p.activity} onChange={(e) => setP({ activity: num(e.target.value) })}>
                {ACTIVITY_LEVELS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
              </select>
            </div>
            <div className="space-y-2 rounded-xl bg-slate-800 p-3 text-sm text-slate-300">
              <div>TMB (Mifflin-St Jeor): <b className="text-white">{Math.round(bmr(p))} kcal</b></div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-slate-900 p-2">
                  <div className="text-[11px] font-semibold uppercase text-slate-500">Día de descanso</div>
                  <div className="text-lg font-bold text-fuel">{plans.rest.kcal} <span className="text-xs font-medium">kcal</span></div>
                  <div className="text-xs">Proteína <b className="text-accent">{plans.rest.protein} g</b></div>
                  <div className="text-xs text-slate-400">C {plans.rest.carbs} g · G {plans.rest.fat} g</div>
                </div>
                <div className="rounded-lg bg-slate-900 p-2">
                  <div className="text-[11px] font-semibold uppercase text-slate-500">Día de entreno</div>
                  <div className="text-lg font-bold text-fuel">{plans.train.kcal} <span className="text-xs font-medium">kcal</span></div>
                  <div className="text-xs">Proteína <b className="text-accent">{plans.train.protein} g</b></div>
                  <div className="text-xs text-slate-400">C {plans.train.carbs} g · G {plans.train.fat} g</div>
                </div>
              </div>
              <Hint className="text-xs text-slate-500">Entreno = descanso + ~{plans.session} kcal de una sesión típica (media de tus últimos entrenos; se ajusta al guardar cada sesión real).</Hint>
            </div>
            <div className="border-t border-slate-800 pt-3">
              <div className="label">Objetivos calóricos flexibles</div>
              <Hint className="mb-2 text-xs text-slate-400">Mínimo y máximo de kcal por tipo de día. En Hoy y en Nutrición las barras y la meta usan el rango del día (entreno o descanso, según los días que marcaste arriba) y las sugerencias de la IA se ajustan a él.</Hint>
              {([['Días de entreno', 'kcalTrain', 1600, 1800], ['Días de descanso', 'kcalRest', 1700, 1800]] as const).map(([label, key, dMin, dMax]) => {
                const r = st[key] ?? { min: dMin, max: dMax };
                return (
                  <div key={key} className="mb-2">
                    <div className="mb-1 text-xs font-semibold text-slate-300">{label}</div>
                    <div className="grid grid-cols-2 gap-2">
                      <div><label className="label">Mínimo kcal</label><NumInput decimal={false} label={`${label}: mínimo de kcal`} value={r.min} className="field text-center" onChange={(n) => setS({ [key]: { ...r, min: n } })} /></div>
                      <div><label className="label">Máximo kcal</label><NumInput decimal={false} label={`${label}: máximo de kcal`} value={r.max} className="field text-center" onChange={(n) => setS({ [key]: { ...r, max: n } })} /></div>
                    </div>
                    {r.min > r.max && <p className="mt-1 text-[11px] text-amber-500">El mínimo es mayor que el máximo: se usarán al revés.</p>}
                  </div>
                );
              })}
            </div>
            <div className="border-t border-slate-800 pt-3">
              <div className="label">Objetivo de proteína</div>
              <Hint className="mb-2 text-xs text-slate-400">Llegar al mínimo es obligatorio; el máximo es un techo opcional. Cualquier valor entre ambos es óptimo.</Hint>
              {(() => {
                const pr = st.proteinRange ?? { min: 100, max: 120 };
                return (
                  <div className="grid grid-cols-2 gap-2">
                    <div><label className="label">Mínimo g</label><NumInput decimal={false} label="Mínimo de proteína" value={pr.min} className="field text-center" onChange={(n) => setS({ proteinRange: { ...pr, min: n } })} /></div>
                    <div><label className="label">Máximo g</label><NumInput decimal={false} label="Máximo de proteína" value={pr.max} className="field text-center" onChange={(n) => setS({ proteinRange: { ...pr, max: n } })} /></div>
                  </div>
                );
              })()}
              <div className="mt-3 space-y-3">
                {([
                  ['Grasas (g/día)', 'fatRange', 50, 60],
                  ['Carbohidratos · días de entreno (g)', 'carbsRange', 200, 220],
                  ['Carbohidratos · días SIN entreno (g)', 'carbsRestRange', 195, 220],
                ] as const).map(([label, key, dMin, dMax]) => {
                  const r = st[key] ?? { min: dMin, max: dMax };
                  return (
                    <div key={key}>
                      <div className="mb-1 text-xs font-semibold text-slate-300">{label}</div>
                      <div className="grid grid-cols-2 gap-2">
                        <div><label className="label">Mínimo g</label><NumInput decimal={false} label={`${label}: mínimo`} value={r.min} className="field text-center" onChange={(n) => setS({ [key]: { ...r, min: n } })} /></div>
                        <div><label className="label">Máximo g</label><NumInput decimal={false} label={`${label}: máximo`} value={r.max} className="field text-center" onChange={(n) => setS({ [key]: { ...r, max: n } })} /></div>
                      </div>
                      {r.min > r.max && <p className="mt-1 text-[11px] text-amber-500">El mínimo es mayor que el máximo: se usarán al revés.</p>}
                    </div>
                  );
                })}
              </div>
              <Hint className="mt-1 text-[11px] text-slate-500">Baremo de cada día: el día se da por bueno entre el mínimo y el máximo; el máximo no se supera. La IA ajusta cada propuesta de comida a estos rangos (grasas, carbohidratos según el tipo de día, proteína y kcal) y los recalcula con su tabla de composición.</Hint>
            </div>
            </Section>
          ),
          entreno: (
            <Section icon={Dumbbell} title="Entrenamiento" hint="Días, material, rodilla, vacaciones y descanso" {...acc('entreno')}>
              <div>
                <div className="label">Mis días de entreno</div>
                <Hint className="mb-2 text-xs text-slate-400">Marca los días que entrenas; el resto son de descanso. Los días de entreno el objetivo de calorías suma el gasto típico de una sesión (cuando entrenas, pasa a ser el gasto real) y en Hoy se propone la rutina que lleve ese día en el nombre.</Hint>
                {dayButtons((i) => (st.trainDays ?? []).includes(i), (i) => setS({ trainDays: (st.trainDays ?? []).includes(i) ? (st.trainDays ?? []).filter((d) => d !== i) : [...(st.trainDays ?? []), i] }))}
                <div className="mt-1 text-[11px] text-slate-500">{st.trainDays === undefined ? 'Sin configurar: la app lo deduce de los entrenos que registras.' : `${st.trainDays.length} día${st.trainDays.length === 1 ? '' : 's'} de entreno y ${7 - st.trainDays.length} de descanso.`}</div>
              </div>
              <div className="border-t border-slate-800 pt-3">
                <label className="label">Objetivo semanal (días entrenados)</label>
                <select className="field" value={st.weeklyGoal} onChange={(e) => setS({ weeklyGoal: num(e.target.value) })}>
                  {[1, 2, 3, 4, 5, 6, 7].map((n) => <option key={n} value={n}>{n} día{n === 1 ? '' : 's'}/semana</option>)}
                </select>
              </div>
              <div className="border-t border-slate-800 pt-3">
                <div className="label flex items-center gap-1.5"><ShieldCheck size={13} strokeWidth={1.75} /> Protección de rodilla</div>
                <label className="flex items-center justify-between gap-3 text-sm"><span>Activar (recomendado)</span><input type="checkbox" className="h-5 w-5" checked={st.kneeSafe} onChange={(e) => setS({ kneeSafe: e.target.checked })} /></label>
                <Hint className="text-xs text-slate-400">Cero saltos y cero apoyo directo de rodilla en el suelo. Prioriza prensa inclinada, hack squat controlado, peso muerto rumano y curl femoral en gimnasio; wall-sit, box squat a silla y puente de glúteos en casa. Se aplica a tus rutinas y a las adaptaciones con IA.</Hint>
              </div>
              <div className="border-t border-slate-800 pt-3">
                <div className="label">Material en casa</div>
                <Hint className="mb-2 text-xs text-slate-400">Cuanto más específico, mejor se adaptan cargas, repeticiones y ejercicios cuando entrenas en casa.</Hint>
                <HomeEquipment />
              </div>
              <div className="border-t border-slate-800 pt-3">
                <label className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-white">Modo vacaciones</span>
                  <input type="checkbox" className="h-5 w-5" checked={!!st.vacation} onChange={(e) => setS(vacationPatch(st, e.target.checked))} aria-label="Modo vacaciones" />
                </label>
              <Hint className="mt-1 text-xs text-slate-400">En Hoy aparece un circuito de mantenimiento de 5 a 15 minutos sin material (tú eliges cuántos minutos tienes cada día) en vez de tu rutina, se pausan los avisos de entreno y tu objetivo semanal (no rompe la racha). Tus calorías se mantienen igual y tienes un botón rápido para contar una comida con una foto (hecha o subida de la galería). Si duran más de 2 semanas, al desactivarlo se activa una semana de readaptación (menos series y sin llegar al fallo). Tus fotos y tu Face Yoga siguen igual.</Hint>
              </div>
              <div className="space-y-2 border-t border-slate-800 pt-3">
                <div className="label">Descanso entre series</div>
            <div>
              <label className="label">Tiempo de descanso por defecto</label>
              <select className="field" value={st.restDefault} onChange={(e) => setS({ restDefault: num(e.target.value) })}>
                {[60, 90, 120, 150, 180, 240].map((s) => <option key={s} value={s}>{s}s</option>)}
              </select>
            </div>
            <label className="flex items-center justify-between text-sm"><span>Descanso automático por ejercicio</span><input type="checkbox" className="h-5 w-5" checked={st.restAuto !== false} onChange={(e) => setS({ restAuto: e.target.checked })} /></label>
            <Hint className="text-xs text-slate-500">Compuestos pesados descansan más y el aislamiento menos, tomando como base el tiempo de arriba. Puedes fijarlo por ejercicio desde su menú (⋮).</Hint>
            <label className="flex items-center justify-between text-sm"><span>Activar sonido de fin de descanso</span><input type="checkbox" className="h-5 w-5" checked={st.restSound} onChange={(e) => setS({ restSound: e.target.checked })} /></label>
            <label className="flex items-center justify-between text-sm"><span>Activar vibración</span><input type="checkbox" className="h-5 w-5" checked={st.restVibrate} onChange={(e) => setS({ restVibrate: e.target.checked })} /></label>
            <Hint className="text-xs text-slate-500">Safari en iPhone no permite vibración web; el sonido y los avisos sí funcionan.</Hint>
              </div>
            </Section>
          ),
          comida: (
            <Section icon={Utensils} title="Alimentación" hint="Supermercado, gustos, utensilios y meriendas" {...acc('comida')}>
              <div>
                <div className="label">Supermercado predeterminado</div>
                <DefaultStore />
              </div>
              <Hint className="text-xs text-slate-400">Gemini priorizará productos, marcas blancas y tablas nutricionales de estas cadenas.</Hint>
              <SupermarketChips />
              <div>
                <label className="label">Fruta mínima al día (piezas)</label>
                <NumInput decimal={false} label="Fruta mínima al día" value={state.settings.fruitMin ?? 1} className="field text-center" onChange={(n) => setS({ fruitMin: Math.max(0, Math.min(5, n)) })} />
              </div>
              <div className="border-t border-slate-800 pt-3">
                <div className="label flex items-center gap-1.5"><Utensils size={13} strokeWidth={1.75} /> Utensilios de cocina</div>
                <Hint className="mb-2 text-xs text-slate-400">Las recetas solo usarán lo que marques.</Hint>
                <UtensilChips />
              </div>
              <div className="border-t border-slate-800 pt-3">
                <div className="label">Meriendas fuera de casa</div>
              <Hint className="mb-2 text-xs text-slate-400">Marca los días que meriendas fuera (por ejemplo en la universidad). Esos días las ideas de merienda serán portátiles y sin cocinar; los demás, para hacer en casa. Cámbialo cuando cambie tu horario.</Hint>
                {dayButtons((i) => (st.meriendaFuera ?? DEFAULT_MERIENDA_FUERA).includes(i), (i) => { const cur = st.meriendaFuera ?? DEFAULT_MERIENDA_FUERA; setS({ meriendaFuera: cur.includes(i) ? cur.filter((d) => d !== i) : [...cur, i] }); })}
              <div className="mt-1 text-[11px] text-slate-500">Fuera de casa: {(st.meriendaFuera ?? DEFAULT_MERIENDA_FUERA).length} día{(st.meriendaFuera ?? DEFAULT_MERIENDA_FUERA).length === 1 ? '' : 's'}; en casa: {7 - (st.meriendaFuera ?? DEFAULT_MERIENDA_FUERA).length}.</div>
              </div>
            </Section>
          ),
          supl: (
            <Section icon={Pill} title="Suplementación" hint="Desactivada por defecto" {...acc('supl')}>
              <SupplementsPanel />
            </Section>
          ),
          avisos: (
            <Section icon={Bell} title="Avisos y recordatorios" hint="Face Yoga, fotos, cena, medidas y avisos con la app cerrada" {...acc('avisos')}>
            <div>
              <div className="label">Aviso diario de Face Yoga</div>
              <Hint className="mb-2 text-xs text-slate-400">Cada día a la hora que elijas te recuerda la rutina nocturna, solo si aún no la has hecho. Con los avisos con la app cerrada activados (más abajo) llega aunque la app esté cerrada. Se cuenta tu racha de días seguidos.</Hint>
              <label className="flex items-center justify-between text-sm"><span>Activar el aviso</span><input type="checkbox" className="h-5 w-5" checked={!!st.faceRemind} onChange={(e) => setS({ faceRemind: e.target.checked })} /></label>
              {st.faceRemind && (
                <div className="mt-2">
                  <label className="label">Hora del aviso</label>
                  <input type="time" className="field" aria-label="Hora del aviso de Face Yoga" value={st.faceTime ?? '22:30'} onChange={(e) => e.target.value && setS({ faceTime: e.target.value })} />
                </div>
              )}
            </div>
            <div className="border-t border-slate-800 pt-3">
              <div className="label">Recordatorio mensual de la foto de progreso</div>
              <Hint className="mb-2 text-xs text-slate-400">Una vez al mes, el día que elijas, te avisa para hacerte la foto de cuerpo entero y la de la cara. Si no la haces, insiste cada día a esa hora hasta que la hagas. Con los avisos con la app cerrada activados, llega aunque no abras la app.</Hint>
              <label className="flex items-center justify-between text-sm"><span>Activar el aviso mensual</span><input type="checkbox" className="h-5 w-5" checked={!!st.photoRemind} onChange={(e) => setS({ photoRemind: e.target.checked })} aria-label="Activar el aviso mensual de fotos" /></label>
              {st.photoRemind && (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div>
                    <label className="label">Día del mes</label>
                    <select className="field" aria-label="Día del mes del aviso de foto" value={st.photoDay ?? 1} onChange={(e) => setS({ photoDay: Number(e.target.value) })}>{Array.from({ length: 28 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>{d}</option>)}</select>
                  </div>
                  <div>
                    <label className="label">Hora</label>
                    <input type="time" className="field" aria-label="Hora del aviso de foto" value={st.photoTime ?? '09:00'} onChange={(e) => e.target.value && setS({ photoTime: e.target.value })} />
                  </div>
                </div>
              )}
            </div>
            <div className="border-t border-slate-800 pt-3">
              <div className="label">Aviso de cena tras entrenar</div>
              <Hint className="mb-2 text-xs text-slate-400">Si has entrenado hoy, desde esta hora aparece en Hoy cuánta proteína y cuántas kcal te quedan para cenar bien.</Hint>
              <select className="field" aria-label="Hora del aviso post-entreno" value={st.postHour ?? 21} onChange={(e) => setS({ postHour: num(e.target.value) })}>
                {[18, 19, 20, 21, 22, 23].map((h) => <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>)}
              </select>
            </div>
            <div className="border-t border-slate-800 pt-3">
              <div className="label">Aviso semanal: pesarte y medirte en ayunas</div>
              <Hint className="mb-2 text-xs text-slate-400">No hace falta hacerlo todos los días: con una vez a la semana, en ayunas y en las mismas condiciones, basta para ver la tendencia. Te avisa a ese día y hora si falta alguna de las medidas que tengas visibles en «Progreso» (peso, cintura, cadera, muslo, brazo, pecho), y desaparece al medirte.</Hint>
              <label className="mb-2 flex items-center justify-between text-sm"><span>Activar el aviso semanal</span><input type="checkbox" className="h-5 w-5" aria-label="Activar el aviso semanal de peso y medidas" checked={st.measureRemind !== false} onChange={(e) => setS({ measureRemind: e.target.checked })} /></label>
              {st.measureRemind !== false && (
                <div className="grid grid-cols-2 gap-2">
                  <select className="field" aria-label="Día del recordatorio" value={st.measureDay ?? 1} onChange={(e) => setS({ measureDay: num(e.target.value) })}>
                    {['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'].map((d, i) => <option key={d} value={i}>{d}</option>)}
                  </select>
                  <select className="field" aria-label="Hora del recordatorio" value={st.measureHour ?? 8} onChange={(e) => setS({ measureHour: num(e.target.value) })}>
                    {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>)}
                  </select>
                </div>
              )}
            </div>
              <div className="space-y-2 border-t border-slate-800 pt-3">
                <div className="label">Avisos con la app cerrada</div>
                <PermissionStatus />
                <PushSetup />
              </div>
              <div className="border-t border-slate-800 pt-3">
                <IosGuide />
              </div>
            </Section>
          ),
          apariencia: (
            <Section icon={Palette} title="Apariencia y modo simple" hint="Tema, letra, barra y menos saturación" {...acc('apariencia')}>
            <div>
              <div className="label">Apariencia</div>
            <div className="grid grid-cols-3 gap-2">
              {([['system', 'Sistema'], ['light', 'Claro'], ['dark', 'Oscuro']] as [ThemePref, string][]).map(([v, l]) => (
                <button key={v} onClick={() => setPref(v)} className={cx('btn !py-2', pref === v ? 'btn-blue' : 'btn-ghost')}>{l}</button>
              ))}
            </div>
    
            </div>
            <div className="border-t border-slate-800 pt-3">
              <div className="label">Tamaño de letra</div>
              <div className="grid grid-cols-3 gap-2">
                {([['normal', 'Normal'], ['large', 'Grande'], ['xlarge', 'Muy grande']] as const).map(([v, l]) => (
                  <button key={v} onClick={() => setS({ fontScale: v })} className={cx('btn !py-2', st.fontScale === v ? 'btn-blue' : 'btn-ghost')}>{l}</button>
                ))}
              </div>
            </div>
            <div className="border-t border-slate-800 pt-3">
              <div className="label">Posición de la barra de navegación</div>
              <div className="grid grid-cols-2 gap-2">
                {([['bottom', 'Abajo (iOS)', PanelBottom], ['top', 'Arriba', PanelTop]] as const).map(([v, l, Icon]) => (
                  <button key={v} onClick={() => setS({ navbarPosition: v })} className={cx('btn !py-2', st.navbarPosition === v ? 'btn-blue' : 'btn-ghost')}><Icon size={16} strokeWidth={1.5} /> {l}</button>
                ))}
              </div>
            </div>
            <div className="border-t border-slate-800 pt-3">
              <div className="text-sm font-semibold text-white">Modo simple</div>
              <div className="mt-1 text-xs text-slate-300">Menos saturación. Las pestañas y la barra inferior mantienen sus nombres.</div>
              {([['hideHints', 'Ocultar explicaciones (quedan tras un icono ⓘ)'], ['iconOnly', 'Botones «+ acción» (+ Nuevo tupper, + Añadir…): solo el +']] as const).map(([k, l]) => (
                <label key={k} className="mt-2 flex items-center justify-between gap-3 text-sm text-slate-200">
                  <span>{l}</span>
                  <input type="checkbox" className="h-5 w-5 shrink-0" checked={!!st[k]} onChange={(e) => setS({ [k]: e.target.checked })} aria-label={l} />
                </label>
              ))}
            </div>
            <div className="border-t border-slate-800 pt-3">
              <div className="label">Textos explicativos</div>
              <div className="grid grid-cols-2 gap-2">
                {([['short', 'Cortos'], ['detailed', 'Detallados']] as const).map(([v, l]) => (
                  <button key={v} onClick={() => setS({ textMode: v })} className={cx('btn !py-2', (st.textMode ?? 'short') === v ? 'btn-blue' : 'btn-ghost')}>{l}</button>
                ))}
              </div>
              <p className="mt-1 text-[11px] text-slate-500">Cortos: las explicaciones muestran una línea y se despliegan al tocarlas. Detallados: se ven completas siempre.</p>
            </div>
            </Section>
          ),
          ia: (
            <Section icon={Sparkles} title="Inteligencia artificial (Gemini)" hint="Clave, uso de hoy y modelo" {...acc('ia')}>
            <div className="rounded-xl bg-accent/10 p-3 text-sm text-slate-300">
              <b className="inline-flex items-center gap-1.5 text-white"><Lightbulb size={15} strokeWidth={1.75} /> ¿Por qué hace falta esta clave?</b> Para que la cámara reconozca tu comida y nevera sin coste mensual ni suscripciones, conectando con el servicio gratuito de Google. Se guarda únicamente en la memoria de tu iPhone.
              <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="btn btn-blue mt-3 w-full">
                <ExternalLink size={16} /> Conseguir mi clave gratis
              </a>
            </div>
            <div>
              <label className="label">Gemini API Key</label>
              <input className="field" type="password" autoComplete="off" value={st.geminiKey} onChange={(e) => { setS({ geminiKey: e.target.value.trim() }); setKeyCheck(null); }} placeholder="Pega tu clave (AQ.… o AIza…)" />
              <button className="btn btn-ghost mt-2 w-full" disabled={checking || !st.geminiKey.trim()} onClick={async () => { setChecking(true); setKeyCheck(await testGeminiKey(st.geminiKey)); setChecking(false); }}>{checking ? 'Comprobando…' : 'Probar clave'}</button>
              {keyCheck && <p className={`mt-2 text-sm ${keyCheck.ok ? 'text-emerald-500' : 'text-red-400'}`}>{keyCheck.message}</p>}
            </div>
            {(() => {
              const u = geminiUsage();
              return (
                <div className="rounded-xl bg-slate-800 p-3 text-xs text-slate-300">
                  <div className="mb-1 font-semibold text-white">Uso de hoy (aproximado)</div>
                  Peticiones enviadas: <b className="text-white">{u.sent}</b> · correctas: <b className="text-white">{u.ok}</b> · respuestas reutilizadas sin gastar cupo: <b className="text-white">{u.saved}</b>
                  <div className={geminiLastMinute() >= 8 ? 'mt-1 font-semibold text-amber-500' : 'mt-1'}>Último minuto: <b className="text-white">{geminiLastMinute()}</b>{geminiLastMinute() >= 8 ? ' · cerca del límite por minuto del plan gratuito: espera un poco' : ''}</div>
                  {(() => { const l = lastCallInfo(); return l ? <div className="mt-1">Última respuesta: <b className="text-white">{l.model}</b> en <b className="text-white">{(l.ms / 1000).toFixed(1)} s</b>{l.tried > 0 ? ` · tras fallar ${l.tried} modelo${l.tried > 1 ? 's' : ''} (cuota o saturación)` : ''}</div> : null; })()}
                  <Hint className="mt-1 text-slate-500">Contador local de este dispositivo; tu cupo real lo ves en aistudio.google.com. Se reinicia sobre las 9:00 (hora de España).</Hint>
                </div>
              );
            })()}
            <div className="rounded-xl bg-slate-800 p-3">
              <label className="label">Margen para cancelar antes de enviar</label>
              <select className="field" aria-label="Margen para cancelar antes de enviar" value={st.aiGraceSec ?? 1} onChange={(e) => setS({ aiGraceSec: num(e.target.value) })}>
                {[0, 1, 2, 3, 5].map((n) => <option key={n} value={n}>{n === 0 ? 'Enviar al instante' : `${n} segundos`}</option>)}
              </select>
              <p className="mt-1 text-[11px] text-slate-400">Cada consulta a la IA espera esos segundos antes de enviarse. Si pulsas «Cancelar» en ese margen, no se gasta nada de tu cupo; después, cancelar corta la espera pero puede que ya se haya gastado.</p>
            </div>
            <details className="rounded-xl bg-slate-800 p-3">
              <summary className="cursor-pointer text-sm font-semibold text-white">Modelo (avanzado)</summary>
              <Hint className="mb-2 mt-2 text-xs text-slate-400">Automático: las dudas cortas de texto usan un modelo ligero (más cupo) y las fotos, recetas y preguntas largas usan el mejor disponible. La lista de modelos se consulta cada día y, si uno falla o se retira, se prueba el siguiente. {lastGoodModel('simple') || lastGoodModel('complex') ? `Último usado: sencillas ${lastGoodModel('simple') || '–'}, complejas ${lastGoodModel('complex') || '–'}.` : ''} Solo fija uno si lo necesitas.</Hint>
              <select className="field" value={st.geminiModel} onChange={(e) => setS({ geminiModel: e.target.value })}>
                <option value="auto">Automático (recomendado)</option>
                {['gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-2.5-flash', 'gemini-2.5-flash-lite'].map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </details>
            <Hint className="text-xs text-slate-500">La clave se guarda solo en este dispositivo y únicamente se envía a Google.</Hint>
            </Section>
          ),
          datos: (
            <Section icon={Database} title="Copias de seguridad y datos" hint="Nube, cifrado, archivos, fotos y borrado" {...acc('datos')}>
              <BackupStatus />
              <CloudBackup />
              <ReportsArchive />
              <div className="space-y-2 border-t border-slate-800 pt-3">
                <div className="label">Copia en archivo</div>
                <div className="grid grid-cols-2 gap-2">
                  <button className="btn btn-ghost" onClick={() => void exportJson()}><Download size={16} /> Guardar en Archivos</button>
                  <button className="btn btn-ghost" onClick={() => fileRef.current?.click()}><Upload size={16} /> Importar</button>
                </div>
            <Hint className="text-xs text-slate-500">«Guardar en Archivos» abre la hoja de compartir del iPhone: elige «Guardar en Archivos» (iCloud Drive o En mi iPhone). Para restaurar, pulsa Importar y elige ese archivo.</Hint>
            <Hint className="text-xs text-slate-400">Las copias NO son automáticas: guarda el archivo en Archivos o iCloud. {lastBackup ? `Última copia: ${lastBackup}.` : 'Aún no has hecho ninguna.'} Si borras la app, tus datos desaparecen salvo que tengas ese archivo para importarlo. La copia no incluye tu clave de Gemini.</Hint>
            <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => void importJson(e.target.files?.[0])} />
                <button className="btn btn-ghost w-full" disabled={state.workouts.length === 0} onClick={() => void exportWorkoutsCsv(state.workouts)}>Exportar historial de entrenos (CSV)</button>
            <Hint className="text-xs text-slate-400">Archivo con todos tus entrenos en el formato de la app Strong, que otras apps (como Hevy) pueden importar. Solo lleva entrenos hechos, no rutinas. Hevy permite una única importación.</Hint>
                {msg && <p className="text-sm text-emerald-400">{msg}</p>}
              </div>
              <div className="border-t border-slate-800 pt-3">
                <button className="btn btn-red w-full" onClick={() => confirm('¿Borrar TODOS los datos de la app?') && replace(defaultState())}><Trash2 size={16} /> Borrar todo</button>
              </div>
            </Section>
          ),
        }}
      />
    </div>
  );
}
