import { BarChart3, CalendarDays, Dumbbell, Flame, Play, Target } from 'lucide-react';
import { useState } from 'react';
import { AskCoachBar } from '../components/AskCoach';
import { DayBars } from '../components/DayBars';
import { BackupNotice } from '../components/BackupNotice';
import { VacationCard } from '../components/VacationCard';
import { Blocks } from '../components/Blocks';
import { HabitsGrid } from '../components/HabitsGrid';
import { ProgressPhotos } from '../components/ProgressPhotos';
import { ProgressCard } from '../components/ProgressCard';
import { Reminders } from '../components/Reminders';
import { WeeklySummary } from '../components/WeeklySummary';
import { NutritionCalendar } from '../components/NutritionCalendar';
import { Title } from '../components/ui';
import { carryOver } from '../lib/balance';
import { dueReminders } from '../lib/reminders';
import { dayBalance } from '../lib/metabolic';
import { nextRoutine } from '../lib/routineToday';
import { useStore } from '../lib/store';
import { cx, dayKey } from '../lib/utils';

type Sub = 'hoy' | 'progreso' | 'semana';
const KEY = 'apex-today-sub';
const TABS: { id: Sub; label: string; Icon: typeof Flame }[] = [
  { id: 'hoy', label: 'Hoy', Icon: CalendarDays },
  { id: 'progreso', label: 'Progreso', Icon: Target },
  { id: 'semana', label: 'Estadísticas', Icon: BarChart3 },
];

export default function Today({ onStart }: { onStart: (templateId?: string) => void }) {
  const { state } = useStore();
  const [sub, setSub] = useState<Sub>(() => {
    try {
      const v = localStorage.getItem(KEY);
      return v === 'progreso' || v === 'semana' ? v : 'hoy';
    } catch {
      return 'hoy';
    }
  });
  const pick = (id: Sub) => {
    setSub(id);
    try {
      localStorage.setItem(KEY, id);
    } catch {
      /* noop */
    }
  };

  const b = dayBalance(state);
  const key = dayKey();
  const carry = carryOver(state);
  const todayWorkouts = state.workouts.filter((w) => dayKey(Date.parse(w.startTime)) === key);
  const routine = nextRoutine(state);
  const restToday = !!state.settings.trainDays && !b.trainingDay;
  const measureDue = dueReminders(state).some((r) => r.id === 'measure');

  const training = (
    <div className="card flex items-center justify-between gap-3 !p-3">
      <div className="min-w-0">
        <div className="text-[11px] font-semibold uppercase text-slate-400">{state.active ? 'Entreno en curso' : todayWorkouts.length ? 'Entreno de hoy hecho' : 'Rutina de hoy'}</div>
        <div className="truncate font-bold text-white">{state.active ? state.active.title : todayWorkouts.length ? todayWorkouts.map((w) => w.title).join(' + ') : restToday ? 'Hoy descansas' : routine ? routine.title : 'Entreno libre'}</div>
        <div className="text-xs text-slate-400">
          {state.active ? `${state.active.exercises.length} ejercicios` : todayWorkouts.length ? `${todayWorkouts.reduce((a, w) => a + w.totalVolumeKg, 0)} kg · ${todayWorkouts.reduce((a, w) => a + w.caloriesBurned, 0)} kcal` : routine ? (restToday ? `Si entrenas igualmente: ${routine.title}` : `${routine.exercises.length} ejercicios`) : 'Crea una rutina en Entreno'}
        </div>
      </div>
      <button className="btn btn-blue shrink-0 !px-4 !py-2.5" onClick={() => onStart(state.active || todayWorkouts.length ? undefined : routine?.id)}>
        {state.active ? <><Dumbbell size={16} /> Continuar</> : <><Play size={16} /> {todayWorkouts.length ? 'Otro' : 'Iniciar'}</>}
      </button>
    </div>
  );

  return (
    <div className="space-y-4">
      <Title sub={new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}>Hoy</Title>

      <div role="tablist" className="-mt-2 grid grid-cols-3 gap-1 rounded-2xl bg-slate-800 p-1">
        {TABS.map(({ id, label, Icon }) => (
          <button key={id} role="tab" aria-selected={sub === id} onClick={() => pick(id)} className={cx('relative flex flex-col items-center gap-0.5 rounded-xl px-1 py-2 text-[11px] font-semibold leading-tight transition', sub === id ? 'bg-slate-900 text-accent shadow' : 'text-slate-400')}>
            <Icon size={18} strokeWidth={sub === id ? 2 : 1.5} />
            {label}
            {id === 'progreso' && measureDue && sub !== 'progreso' && <span className="absolute right-3 top-1.5 h-2 w-2 rounded-full bg-amber-400" aria-label="Aviso pendiente" />}
          </button>
        ))}
      </div>

      <BackupNotice />

      {/* Las tres pestañas siguen montadas: el cambio es instantáneo y conservan su estado. */}
      <div className={cx(sub !== 'hoy' && 'hidden')}>
        <Blocks
          page="hoy"
          items={{
            avisos: <Reminders onMeasure={() => { pick('progreso'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />,
            coach: <AskCoachBar />,
            kcal: <DayBars b={b} />,
            balance: carry.note && (
              <div className={cx('rounded-2xl p-3 text-sm', carry.suggestion < 0 ? 'bg-amber-500/10 text-amber-500' : 'bg-slate-800 text-slate-300')}>
                <b>{carry.suggestion < 0 ? `Compensación suave: ${carry.suggestion} kcal hoy.` : 'Balance de los últimos días.'}</b> {carry.note}
              </div>
            ),
            entreno: state.settings.vacation ? <VacationCard onStart={onStart} /> : training,
            habitos: <HabitsGrid />,
          }}
        />
      </div>

      <div className={cx(sub !== 'progreso' && 'hidden')}>
        <Blocks page="hoy-progreso" items={{ objetivo: <ProgressCard />, fotos: <ProgressPhotos /> }} />
      </div>

      <div className={cx(sub !== 'semana' && 'hidden')}>
        <Blocks page="hoy-semana" items={{ semana: <WeeklySummary />, calendario: <NutritionCalendar /> }} />
      </div>
    </div>
  );
}
