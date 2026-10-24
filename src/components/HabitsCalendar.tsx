import { ChevronLeft, ChevronRight, Footprints, Moon, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { useStore } from '../lib/store';
import type { HabitDay } from '../lib/types';
import { cx, dayKey } from '../lib/utils';
import { Modal } from './ui';

const DOW = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const MONTH_FMT = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' });
const DAY_FMT = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });

type Mode = 'pasos' | 'sueno' | 'face';
const MODES: { id: Mode; label: string; icon: typeof Moon }[] = [
  { id: 'pasos', label: 'Pasos', icon: Footprints },
  { id: 'sueno', label: 'Sueño', icon: Moon },
  { id: 'face', label: 'Face Yoga', icon: Sparkles },
];

const SLEEP_OK = 7;
const SLEEP_MIN = 6;
const fmtH = (h: number): string => {
  const t = Math.round(h * 60);
  return `${Math.floor(t / 60)}h ${String(t % 60).padStart(2, '0')}m`;
};
const fmtSteps = (n: number): string => n.toLocaleString('es-ES');
const short = (n: number): string => (n >= 1000 ? `${(n / 1000).toFixed(1).replace('.', ',')}k` : String(n));

/** Calendario de hábitos: pasos, horas de sueño y días de Face Yoga. Cada día se colorea según llegaste a tu meta; al tocarlo ves el detalle. */
export function HabitsCalendar() {
  const { state } = useStore();
  const [mode, setMode] = useState<Mode>('pasos');
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selected, setSelected] = useState<string | null>(null);
  const [todayKey] = useState(() => dayKey());
  const stepGoal = state.settings.stepGoal && state.settings.stepGoal > 0 ? state.settings.stepGoal : 0;

  const lead = (new Date(cursor.getFullYear(), cursor.getMonth(), 1).getDay() + 6) % 7;
  const total = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
  const cells: (number | null)[] = [...Array.from({ length: lead }, () => null), ...Array.from({ length: total }, (_, i) => i + 1)];
  const keyOf = (n: number) => dayKey(new Date(cursor.getFullYear(), cursor.getMonth(), n, 12).getTime());
  const habit = (k: string): HabitDay | undefined => state.habits[k];

  const val = (k: string): number => {
    const h = habit(k);
    if (!h) return 0;
    return mode === 'pasos' ? h.steps ?? 0 : mode === 'sueno' ? h.sleepHours ?? 0 : h.faceYoga ? 1 : 0;
  };
  const tone = (k: string): string => {
    const v = val(k);
    if (v <= 0) return 'text-slate-400';
    if (mode === 'face') return 'bg-emerald-500/25 text-emerald-300';
    if (mode === 'pasos') {
      if (!stepGoal) return 'bg-emerald-500/25 text-emerald-300';
      return v >= stepGoal ? 'bg-emerald-500/25 text-emerald-300' : v >= stepGoal * 0.6 ? 'bg-amber-500/25 text-amber-300' : 'bg-red-500/25 text-red-300';
    }
    return v >= SLEEP_OK ? 'bg-emerald-500/25 text-emerald-300' : v >= SLEEP_MIN ? 'bg-amber-500/25 text-amber-300' : 'bg-red-500/25 text-red-300';
  };
  const tiny = (k: string): string => {
    const v = val(k);
    if (v <= 0 || mode === 'face') return '';
    return mode === 'pasos' ? short(v) : String(Math.round(v * 10) / 10).replace('.', ',');
  };

  const days = cells.filter((n): n is number => !!n).map(keyOf);
  const filled = days.filter((k) => val(k) > 0);
  const avg = filled.length ? filled.reduce((a, k) => a + val(k), 0) / filled.length : 0;
  const summary =
    mode === 'face'
      ? `${filled.length} ${filled.length === 1 ? 'día' : 'días'} de Face Yoga este mes`
      : filled.length === 0
        ? 'Sin datos este mes'
        : mode === 'pasos'
          ? `Media ${fmtSteps(Math.round(avg))} pasos${stepGoal ? ` · meta en ${filled.filter((k) => val(k) >= stepGoal).length} de ${filled.length} días` : ''}`
          : `Media ${fmtH(avg)} · ${filled.filter((k) => val(k) >= SLEEP_OK).length} de ${filled.length} noches con ${SLEEP_OK} h o más`;

  const legend: [string, string][] =
    mode === 'face'
      ? [['bg-emerald-500', 'Hecho']]
      : mode === 'pasos'
        ? stepGoal ? [['bg-emerald-500', 'Meta cumplida'], ['bg-amber-500', 'Casi (60 %+)'], ['bg-red-500', 'Poco']] : [['bg-emerald-500', 'Con datos']]
        : [['bg-emerald-500', `${SLEEP_OK} h o más`], ['bg-amber-500', `${SLEEP_MIN}–${SLEEP_OK} h`], ['bg-red-500', `Menos de ${SLEEP_MIN} h`]];

  return (
    <div className="card !p-3">
      <div className="mb-2 grid grid-cols-3 gap-1 rounded-xl bg-slate-800 p-1" role="tablist" aria-label="Qué ver en el calendario">
        {MODES.map((m) => (
          <button key={m.id} role="tab" aria-selected={mode === m.id} onClick={() => setMode(m.id)} className={cx('flex items-center justify-center gap-1 rounded-lg py-1.5 text-xs font-semibold', mode === m.id ? 'bg-accent text-white' : 'text-slate-300')}>
            <m.icon size={13} /> {m.label}
          </button>
        ))}
      </div>
      <div className="mb-2 flex items-center justify-between">
        <button className="rounded-full bg-slate-800 p-2" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} aria-label="Mes anterior"><ChevronLeft size={16} /></button>
        <div className="text-center">
          <div className="font-bold text-white">{MONTH_FMT.format(cursor).replace(/^./, (c) => c.toUpperCase())}</div>
          <div className="text-[11px] text-slate-400">{summary}</div>
        </div>
        <button className="rounded-full bg-slate-800 p-2" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} aria-label="Mes siguiente"><ChevronRight size={16} /></button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold text-slate-500">{DOW.map((d) => <span key={d}>{d}</span>)}</div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((n, i) => {
          if (!n) return <span key={i} />;
          const k = keyOf(n);
          const t = tiny(k);
          return (
            <button key={i} onClick={() => setSelected(k)} aria-label={`Ver hábitos del ${n}`} className={cx('flex h-11 flex-col items-center justify-center rounded-xl bg-slate-800/60 text-sm font-semibold leading-none', tone(k), k === todayKey && 'ring-2 ring-slate-400')}>
              {n}
              {t && <span className="mt-0.5 text-[9px] font-medium opacity-80">{t}</span>}
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1 text-[11px] text-slate-400">
        {legend.map(([c, l]) => <span key={l}><span className={cx('mr-1 inline-block h-2 w-2 rounded-full', c)} />{l}</span>)}
      </div>
      {selected && <DayHabits dayKeyStr={selected} stepGoal={stepGoal} onClose={() => setSelected(null)} />}
    </div>
  );
}

function DayHabits({ dayKeyStr, stepGoal, onClose }: { dayKeyStr: string; stepGoal: number; onClose: () => void }) {
  const { state } = useStore();
  const h = state.habits[dayKeyStr];
  const [y, m, d] = dayKeyStr.split('-').map(Number);
  const title = DAY_FMT.format(new Date(y, m - 1, d, 12)).replace(/^./, (c) => c.toUpperCase());
  const steps = h?.steps ?? 0;
  const sleep = h?.sleepHours ?? 0;
  const rows: [React.ReactNode, string, string][] = [
    [<Footprints key="s" size={16} />, 'Pasos', steps > 0 ? `${fmtSteps(steps)}${stepGoal ? ` de ${fmtSteps(stepGoal)}` : ''}` : 'Sin datos'],
    [<Moon key="m" size={16} />, 'Sueño', sleep > 0 ? fmtH(sleep) : 'Sin datos'],
    [<Sparkles key="f" size={16} />, 'Face Yoga', h?.faceYoga ? 'Hecho' : 'No hecho'],
  ];
  return (
    <Modal title={title} onClose={onClose}>
      <div className="space-y-2">
        {rows.map(([icon, label, v]) => (
          <div key={label} className="flex items-center justify-between rounded-xl bg-slate-800 p-3">
            <span className="flex items-center gap-2 text-sm text-slate-300">{icon} {label}</span>
            <span className="text-sm font-bold text-white">{v}</span>
          </div>
        ))}
        <p className="text-xs text-slate-400">Para corregir un dato de otro día, usa el selector de día en la tarjeta de pasos o de Face Yoga.</p>
      </div>
    </Modal>
  );
}
