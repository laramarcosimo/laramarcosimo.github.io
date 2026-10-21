import { Check, Pause, Play, Plus, SkipForward, Sparkles } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BUZZ, vibrate } from '../lib/feedback';
import type { Exercise, Set as SetLog } from '../lib/types';
import { cx } from '../lib/utils';

type Status = 'idle' | 'running' | 'paused';
const R = 54;
const C = 2 * Math.PI * R;

/** Interfaz guiada por tiempo para ejercicios de rostro y cuello: demostración animada, cuenta atrás circular y descanso corto. */
export function FaceTimer({ ex, sets, restSec, soundDone, soundTick, soundUnlock, onSetDone, onSetSeconds, onAddSet, onRemoveLast, onRest }: {
  ex: Exercise;
  sets: SetLog[];
  restSec: number;
  soundDone: () => void;
  soundTick: () => void;
  soundUnlock: () => void;
  onSetDone: (setId: string, seconds: number) => void;
  /** Cambia los segundos objetivo de una serie aún sin completar. */
  onSetSeconds?: (setId: string, seconds: number) => void;
  onAddSet: () => void;
  onRemoveLast: () => void;
  onRest: (seconds: number) => void;
}) {
  const work = sets.filter((s) => s.type !== 'warmup');
  const idx = work.findIndex((s) => !s.completed);
  const current = idx >= 0 ? work[idx] : undefined;
  const target = Math.max(5, current?.reps || 30);

  const [status, setStatus] = useState<Status>('idle');
  const [endsAt, setEndsAt] = useState(0);
  const [pausedLeft, setPausedLeft] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [tipsOpen, setTipsOpen] = useState(false);
  const lastTick = useRef(-1);
  const lock = useRef<WakeLockSentinel | null>(null);
  const finished = useRef(false);

  const leftMs = status === 'running' ? Math.max(0, endsAt - now) : status === 'paused' ? pausedLeft : target * 1000;
  const left = Math.ceil(leftMs / 1000);

  // Mantiene la pantalla encendida mientras corre la cuenta atrás (si el navegador lo permite).
  const acquire = useCallback(async () => {
    try {
      lock.current = (await navigator.wakeLock?.request('screen')) ?? null;
    } catch {
      /* sin Wake Lock: el temporizador usa marcas de tiempo y sigue siendo exacto */
    }
  }, []);
  const release = useCallback(() => {
    void lock.current?.release().catch(() => undefined);
    lock.current = null;
  }, []);
  useEffect(() => release, [release]);

  useEffect(() => {
    if (status !== 'running') return;
    const i = setInterval(() => setNow(Date.now()), 200);
    const vis = () => {
      setNow(Date.now());
      if (document.visibilityState === 'visible') void acquire();
    };
    document.addEventListener('visibilitychange', vis);
    return () => {
      clearInterval(i);
      document.removeEventListener('visibilitychange', vis);
    };
  }, [status, acquire]);

  const finish = useCallback(
    (seconds: number) => {
      if (!current || finished.current) return;
      finished.current = true;
      release();
      setStatus('idle');
      soundDone();
      vibrate(BUZZ.end);
      onSetDone(current.id, Math.max(1, Math.round(seconds)));
      if (idx < work.length - 1) onRest(restSec); // descanso corto entre series
    },
    [current, idx, work.length, onSetDone, onRest, restSec, soundDone, release],
  );

  useEffect(() => {
    if (status !== 'running') return;
    if (left > 0 && left <= 3 && lastTick.current !== left) {
      lastTick.current = left;
      soundTick();
    }
    if (leftMs <= 0) finish(target);
  }, [status, left, leftMs, target, finish, soundTick]);

  const start = () => {
    if (!current) return;
    soundUnlock();
    vibrate(BUZZ.start);
    finished.current = false;
    lastTick.current = -1;
    const t = Date.now();
    setNow(t);
    setEndsAt(t + target * 1000);
    setStatus('running');
    void acquire();
  };
  const pause = () => {
    setPausedLeft(Math.max(0, endsAt - Date.now()));
    setStatus('paused');
    release();
  };
  const resume = () => {
    const t = Date.now();
    setNow(t);
    setEndsAt(t + pausedLeft);
    setStatus('running');
    void acquire();
  };
  const elapsed = target - left;

  const allDone = !current;
  return (
    <div className="mt-3 space-y-3">
      {ex.imageUrl && <img src={ex.imageUrl} alt={`Demostración: ${ex.name}`} loading="lazy" draggable={false} className="mx-auto h-44 w-full max-w-xs rounded-2xl bg-slate-900 object-contain" />}

      <div className="flex flex-wrap justify-center gap-1.5">
        {work.map((s, i) => (
          <span key={s.id} className={cx('rounded-full px-2.5 py-1 text-xs font-bold', s.completed ? 'bg-emerald-500/20 text-emerald-500' : i === idx ? 'bg-accent text-white' : 'bg-slate-800 text-slate-400')}>
            {s.completed && <Check size={11} strokeWidth={3} className="mr-0.5 inline" />}{s.completed ? `${s.reps} s` : `${s.reps || 30} s`}
          </span>
        ))}
      </div>

      {allDone ? (
        <div className="flex flex-col items-center gap-1 rounded-2xl bg-emerald-500/10 py-6 text-emerald-500">
          <Sparkles size={28} strokeWidth={1.75} />
          <div className="font-bold">¡Ejercicio completado!</div>
        </div>
      ) : (
        <>
          <div className="relative mx-auto h-36 w-36" role="timer" aria-live="off" aria-label={`${left} segundos`}>
            <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
              <circle cx="60" cy="60" r={R} fill="none" strokeWidth="9" className="stroke-slate-700" />
              <circle cx="60" cy="60" r={R} fill="none" strokeWidth="9" strokeLinecap="round" stroke="#10b981" strokeDasharray={C} strokeDashoffset={C * (1 - Math.min(1, leftMs / (target * 1000)))} style={{ transition: status === 'running' ? 'stroke-dashoffset 0.25s linear' : 'none' }} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-4xl font-black tabular-nums text-white">{left}</span>
              <span className="text-[11px] text-slate-400">Serie {idx + 1} de {work.length}</span>
            </div>
          </div>

          {onSetSeconds && current && status === 'idle' && (
            <div className="flex items-center justify-center gap-2 text-xs text-slate-300">
              <button className="btn btn-ghost !px-3 !py-1.5" aria-label="Menos segundos" onClick={() => onSetSeconds(current.id, Math.max(5, target - 5))}>−5</button>
              <label className="flex items-center gap-1">
                <input type="number" inputMode="numeric" min={5} max={600} value={target} aria-label="Segundos de esta serie" className="w-16 rounded-lg bg-slate-800 px-2 py-1.5 text-center text-sm font-bold text-white" onChange={(e) => { const n = Math.round(Number(e.target.value)); if (Number.isFinite(n) && n > 0) onSetSeconds(current.id, Math.min(600, n)); }} />
                <span>s</span>
              </label>
              <button className="btn btn-ghost !px-3 !py-1.5" aria-label="Más segundos" onClick={() => onSetSeconds(current.id, Math.min(600, target + 5))}>+5</button>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2">
            {status === 'running' ? (
              <button className="btn btn-ghost !px-1 !py-2.5 text-xs" onClick={pause}><Pause size={15} /> Pausar</button>
            ) : (
              <button className="btn btn-blue !px-1 !py-2.5 text-xs" onClick={status === 'paused' ? resume : start}><Play size={15} /> {status === 'paused' ? 'Seguir' : 'Iniciar'}</button>
            )}
            <button className="btn btn-ghost !px-1 !py-2.5 text-xs" onClick={() => finish(Math.max(1, status === 'idle' ? 1 : elapsed))}><SkipForward size={15} /> Siguiente</button>
            <button className="btn btn-green !px-1 !py-2.5 text-xs" onClick={() => finish(target)}><Check size={15} /> Completado</button>
          </div>
        </>
      )}

      <button className="flex w-full items-center justify-between rounded-lg bg-slate-800/60 px-3 py-2 text-left text-xs font-semibold text-slate-300" onClick={() => setTipsOpen((o) => !o)} aria-expanded={tipsOpen}>
        <span>Técnica: 3 puntos clave</span><span className="text-slate-500">{tipsOpen ? '–' : '+'}</span>
      </button>
      {tipsOpen && (
        <div className="space-y-2 rounded-lg bg-slate-800/40 p-3 text-xs leading-relaxed text-slate-300">
          {ex.instructions && <p>{ex.instructions}</p>}
          {ex.tips && <ul className="space-y-1.5">{ex.tips.map((t, i) => <li key={i} className="flex gap-2"><span className="mt-0.5 font-bold text-accent">{i + 1}</span><span>{t}</span></li>)}</ul>}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <button className="btn btn-ghost !py-2 text-xs" onClick={onAddSet}><Plus size={14} /> Añadir serie</button>
        <button className="btn btn-ghost !py-2 text-xs" disabled={sets.length === 0 || status !== 'idle'} onClick={onRemoveLast}>Eliminar última</button>
      </div>
    </div>
  );
}
