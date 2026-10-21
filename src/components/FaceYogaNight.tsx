import { ChevronDown, ExternalLink, Moon, Pause, Play, SkipBack, SkipForward, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { NIGHT_INFO, nightTotal, resolveNight, sideSeconds, type NightStep } from '../lib/faceYoga';
import { useStore } from '../lib/store';
import { BUZZ, vibrate } from '../lib/feedback';
import { useScrollLock } from '../lib/scrollLock';
import { useWakeLock } from '../lib/wakeLock';
import { useSoundAlert } from '../lib/useSoundAlert';

type Phase = 'ready' | 'work' | 'rest' | 'done';

/** Dibujo del ejercicio, sin el título ni el texto que algunas imágenes traen integrados (se recortan con la máscara). */
function StepImage({ step, className = '' }: { step: NightStep; className?: string }) {
  if (!step.image) return null;
  if (step.crop) {
    const { top, bottom, h } = step.crop;
    return (
      <div className={`relative w-full overflow-hidden rounded-2xl bg-white ${className}`} style={{ aspectRatio: `2000 / ${bottom - top}` }}>
        <img key={step.image} src={step.image} alt={step.title} className="absolute left-0 w-full max-w-none" style={{ top: `${(-top / (bottom - top)) * 100}%`, height: `${(h / (bottom - top)) * 100}%`, objectFit: 'fill' }} />
      </div>
    );
  }
  return (
    <div className={`w-full overflow-hidden rounded-2xl bg-white ${className}`} style={{ aspectRatio: '1 / 1' }}>
      <img key={step.image} src={step.image} alt={step.title} className="h-full w-full object-contain" />
    </div>
  );
}

const R = 100;
const C = 2 * Math.PI * R;

/**
 * Face Yoga nocturno guiado: 7 ejercicios de 60 s con 5 s de «prepárate» entre uno y otro, controles
 * Anterior / Pausar / Siguiente y avisos de vibración y sonido en cada cambio.
 */
export function FaceYogaNight({ onComplete, onClose }: { onComplete: () => void; onClose: () => void }) {
  const sound = useSoundAlert();
  const { state } = useStore();
  const { steps, restSec } = useMemo(() => resolveNight(state.faceNight), [state.faceNight]);
  const [i, setI] = useState(0);
  const [phase, setPhase] = useState<Phase>('ready');
  const [running, setRunning] = useState(false);
  const [endAt, setEndAt] = useState(0); // marca de tiempo en la que acaba la fase actual (mientras corre)
  const [leftMs, setLeftMs] = useState(steps[0].seconds * 1000); // tiempo que queda (mientras está en pausa)
  const [now, setNow] = useState(() => Date.now());
  const lastSec = useRef(-1);
  const completed = useRef(false);

  useWakeLock(phase === 'work' || phase === 'rest');
  useScrollLock();

  const step = steps[i];
  const total = phase === 'rest' ? restSec : step.seconds;
  const remainingMs = running ? Math.max(0, endAt - now) : leftMs;
  const remaining = Math.ceil(remainingMs / 1000);
  const next = steps[i + 1];
  const elapsed = step.seconds - remaining; // segundos transcurridos del ejercicio (solo en fase de trabajo)

  /** Empieza una fase (ejercicio o pausa de preparación) desde su duración completa. */
  const begin = useCallback((p: 'work' | 'rest', idx: number) => {
    const ms = (p === 'work' ? steps[idx].seconds : restSec) * 1000;
    const t = Date.now();
    setI(idx);
    setPhase(p);
    setNow(t);
    setEndAt(t + ms);
    setLeftMs(ms);
    setRunning(true);
    lastSec.current = -1;
    vibrate(p === 'work' ? BUZZ.start : BUZZ.end); // empieza el ejercicio (3 cortos) / acaba el anterior (2 largos)
  }, [steps, restSec]);

  const finish = useCallback(() => {
    setRunning(false);
    setPhase('done');
    vibrate([200, 100, 200]);
    sound.done();
    if (!completed.current) {
      completed.current = true;
      onComplete(); // marca el hábito de hoy
    }
  }, [onComplete, sound]);

  // Avanza solo: fin del ejercicio → 5 s de preparación → siguiente ejercicio.
  const advance = useCallback(() => {
    if (phase === 'work') {
      if (i >= steps.length - 1) finish();
      else begin('rest', i);
    } else if (phase === 'rest') {
      sound.done();
      begin('work', i + 1);
    }
  }, [phase, i, steps.length, begin, finish, sound]);

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNow(Date.now()), 200);
    // Si la app pasa a segundo plano (p. ej. al abrir YouTube) se pausa; al volver sigue donde estaba.
    const vis = () => {
      if (document.visibilityState === 'hidden') {
        setLeftMs(Math.max(0, endAt - Date.now()));
        setRunning(false);
      }
    };
    document.addEventListener('visibilitychange', vis);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', vis);
    };
  }, [running, endAt]);

  useEffect(() => {
    if (running && remainingMs <= 0) advance();
  }, [running, remainingMs, advance]);

  // Avisos suaves: cuenta atrás de la preparación, cambio de mitad y avisos periódicos.
  useEffect(() => {
    if (!running || remaining === lastSec.current) return;
    lastSec.current = remaining;
    if (phase === 'rest' && remaining <= 3 && remaining > 0) {
      sound.tick();
      vibrate(25);
    }
    if (phase === 'work') {
      if (step.halves && elapsed === sideSeconds(step.seconds)[0]) vibrate(BUZZ.side);
      if (step.pulse && elapsed > 0 && elapsed % step.pulse.every === 0 && elapsed < step.seconds) vibrate(35);
    }
  }, [running, remaining, phase, step, elapsed, sound]);

  const togglePause = () => {
    if (phase !== 'work' && phase !== 'rest') return;
    if (running) {
      setLeftMs(Math.max(0, endAt - Date.now()));
      setRunning(false);
    } else {
      const t = Date.now();
      setNow(t);
      setEndAt(t + leftMs);
      setRunning(true);
    }
  };
  const prev = () => {
    sound.unlock();
    if (phase === 'ready' || phase === 'done') return;
    // En la preparación, «anterior» repite el que acabas de hacer; en un ejercicio, si ya llevas más de 3 s lo reinicia y si no, vuelve al anterior.
    begin('work', phase === 'rest' || (phase === 'work' && elapsed > 3) ? i : Math.max(0, i - 1));
  };
  const skip = () => {
    sound.unlock();
    if (phase === 'work') {
      if (i >= steps.length - 1) finish();
      else begin('rest', i);
    } else if (phase === 'rest') begin('work', i + 1);
  };
  const start = () => {
    sound.unlock();
    begin('work', 0);
  };

  const half = step.halves ? (elapsed < sideSeconds(step.seconds)[0] ? 0 : 1) : 0;
  const soft = { color: 'rgba(255,255,255,.65)' };

  return (
    <div className="night-screen fixed inset-0 z-[80] flex flex-col" style={{ background: 'linear-gradient(180deg,#0A0F1D 0%,#141C33 55%,#1E293B 100%)', paddingTop: 'env(safe-area-inset-top)' }} role="dialog" aria-label="Face Yoga nocturno">
      <div className="flex shrink-0 items-center justify-between px-5 pt-4">
        <span className="flex items-center gap-2 text-sm font-semibold" style={soft}><Moon size={16} /> Face Yoga · {Math.max(1, Math.round(nightTotal(steps, restSec) / 60))} min</span>
        <button className="rounded-full bg-white/10 p-2 text-white" onClick={onClose} aria-label="Salir"><X size={18} /></button>
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-4">
        {phase === 'done' && (
          <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-emerald-500/20"><Moon size={44} className="text-emerald-400" /></div>
            <h2 className="text-2xl font-black text-white">¡Rutina completada!</h2>
            <p className="text-sm" style={soft}>Hábito de hoy marcado. Buenas noches.</p>
            <button className="mt-4 w-full max-w-xs rounded-2xl bg-emerald-500 py-3.5 font-bold text-white active:scale-95" onClick={onClose}>Cerrar</button>
          </div>
        )}

        {phase === 'ready' && (
          <div className="mx-auto max-w-sm pt-4">
            <h2 className="text-center text-xl font-black text-white">Rutina nocturna</h2>
            <p className="mt-1 text-center text-xs" style={soft}>{steps.length} ejercicios · hoy empiezas con «{steps[0].title}»</p>
            <ol className="mt-4 space-y-1.5">
              {steps.map((s, k) => (
                <li key={s.id} className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-sm text-white"><span className="w-5 text-center font-bold text-emerald-300">{k + 1}</span><span className="min-w-0 flex-1 truncate">{s.title}</span><span className="shrink-0 text-[11px]" style={soft}>{s.position}</span></li>
              ))}
            </ol>
            <p className="mt-4 rounded-2xl bg-white/5 p-3 text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,.7)' }}>{NIGHT_INFO}</p>
          </div>
        )}

        {phase === 'work' && (
          <div className="mx-auto flex max-w-sm flex-col items-center">
            <div className="relative mt-2 h-44 w-44">
              <svg viewBox="0 0 220 220" className="h-full w-full -rotate-90">
                <circle cx="110" cy="110" r={R} fill="none" stroke="rgba(255,255,255,.10)" strokeWidth="10" />
                <circle cx="110" cy="110" r={R} fill="none" stroke="#10B981" strokeWidth="10" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - remainingMs / (total * 1000))} />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center" role="timer" aria-label={`${remaining} segundos`}>
                <span className="text-6xl font-black tabular-nums text-white">{remaining}</span>
                <span className="text-xs font-semibold" style={soft}>Ejercicio {i + 1}/{steps.length}</span>
              </div>
            </div>
            <h3 className="mt-3 text-center text-xl font-bold text-white">{step.title}</h3>
            <div className="mt-2 flex flex-wrap justify-center gap-1.5 text-xs">
              <span className="rounded-full bg-emerald-500/20 px-2.5 py-1 font-semibold text-emerald-300">Posición: {step.position}</span>
              <span className="rounded-full bg-white/10 px-2.5 py-1 text-white">Enfoque: {step.focus}</span>
            </div>
            {step.halves && <p className="mt-3 rounded-full bg-emerald-500 px-4 py-1.5 text-sm font-bold text-white">{step.halves[half]} · {half === 0 ? sideSeconds(step.seconds)[0] - elapsed : step.seconds - elapsed} s</p>}
            {step.pulse && elapsed % step.pulse.every < 2 && elapsed > 0 && <p className="mt-3 rounded-full bg-sky-500 px-4 py-1.5 text-sm font-bold text-white">{step.pulse.label}</p>}
            <StepImage step={step} className="mt-3" />
            <details key={step.id} className="group mt-3 w-full rounded-2xl bg-white/5">
              <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold text-white">
                Ver explicación y vídeo <ChevronDown size={16} className="transition-transform group-open:rotate-180" />
              </summary>
              <div className="px-4 pb-4">
                <p className="text-left text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,.88)' }}>{step.how}</p>
                <a className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white active:scale-95" href={step.url} target="_blank" rel="noopener noreferrer"><ExternalLink size={14} /> Buscar vídeo en YouTube</a>
              </div>
            </details>
          </div>
        )}

        {phase === 'rest' && next && (
          <div className="mx-auto flex max-w-sm flex-col items-center pt-2 text-center">
            <p className="text-sm font-semibold uppercase tracking-wide text-emerald-300">Prepárate para el siguiente…</p>
            <div className="my-2 text-7xl font-black tabular-nums text-white" role="timer" aria-label={`${remaining} segundos`}>{remaining}</div>
            <h3 className="text-lg font-bold text-white">{i + 2}. {next.title}</h3>
            <div className="mt-2 flex flex-wrap justify-center gap-1.5 text-xs">
              <span className="rounded-full bg-emerald-500/20 px-2.5 py-1 font-semibold text-emerald-300">Posición: {next.position}</span>
              <span className="rounded-full bg-white/10 px-2.5 py-1 text-white">Enfoque: {next.focus}</span>
            </div>
            <StepImage step={next} className="mt-3" />
            <p className="mt-3 text-left text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,.88)' }}>{next.how}</p>
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-white/10 bg-black/20 px-5 pt-3" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)' }}>
        {phase === 'ready' ? (
          <button className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 py-4 text-base font-bold text-white active:scale-95" onClick={start}><Play size={20} /> Empezar</button>
        ) : phase === 'done' ? null : (
          <div className="mx-auto grid max-w-sm grid-cols-3 gap-2">
            <button className="flex flex-col items-center gap-0.5 rounded-2xl bg-white/10 py-3 text-xs font-semibold text-white active:scale-95" onClick={prev} aria-label="Ejercicio anterior"><SkipBack size={20} /> Anterior</button>
            <button className="flex flex-col items-center gap-0.5 rounded-2xl bg-emerald-500 py-3 text-xs font-bold text-white active:scale-95" onClick={togglePause} aria-label={running ? 'Pausar' : 'Reanudar'}>{running ? <Pause size={20} /> : <Play size={20} />} {running ? 'Pausar' : 'Reanudar'}</button>
            <button className="flex flex-col items-center gap-0.5 rounded-2xl bg-white/10 py-3 text-xs font-semibold text-white active:scale-95" onClick={skip} aria-label="Siguiente ejercicio"><SkipForward size={20} /> Siguiente</button>
          </div>
        )}
      </div>
    </div>
  );
}
