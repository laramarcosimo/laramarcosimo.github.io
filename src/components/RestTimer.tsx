import { Volume2, VolumeX } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { vibrate } from '../lib/feedback';
import { notifyRestDone, scheduleRestInSW, serverTimerActive, setLocalRestBackup } from '../lib/notify';
import { useResume } from '../lib/resume';
import { useStore } from '../lib/store';
import { NumInput } from './ui';
import { useSoundAlert } from '../lib/useSoundAlert';
import { fmtDuration } from '../lib/utils';

export interface RestState {
  endsAt: number;
  total: number;
}

export interface TimePlan {
  /** Minutos objetivo de la sesión. */
  target: number;
  startedAt: number;
  /** Series planificadas y hechas (para saber si va con el tiempo justo). */
  planned: number;
  done: number;
}

export function RestTimer({ rest, setRest, options, plan }: { rest: RestState; setRest: (r: RestState | null) => void; options: number[]; plan?: TimePlan | null }) {
  const { state, update } = useStore();
  const { restSound, restVibrate } = state.settings;
  const sound = useSoundAlert();
  const [now, setNow] = useState(() => Date.now());
  const left = Math.max(0, Math.ceil((rest.endsAt - now) / 1000));
  const lastTick = useRef(-1);
  const fired = useRef(0);
  const [custom, setCustom] = useState(0);

  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(i);
  }, []);

  // Respaldo en el Service Worker por si iOS suspende la página en segundo plano.
  useEffect(() => {
    void scheduleRestInSW(rest.endsAt);
    return () => void scheduleRestInSW(null);
  }, [rest.endsAt]);

  // Al volver a la app se relee la hora y se cancela el aviso local pendiente; al salir se vuelve a armar (el aviso del servidor sigue siempre).
  useResume(() => {
    setNow(Date.now());
    void setLocalRestBackup(null);
  });
  useEffect(() => {
    const onHide = () => {
      // Si el servidor ya tiene el aviso programado, el local sobra (saldrían dos).
      if (document.visibilityState === 'hidden' && !serverTimerActive('rest')) void setLocalRestBackup(rest.endsAt);
    };
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, [rest.endsAt]);

  useEffect(() => {
    if (left > 0 && left <= 3 && lastTick.current !== left) {
      lastTick.current = left;
      sound.tick();
    }
  }, [left, sound]);

  useEffect(() => {
    if (left > 0 || fired.current === rest.endsAt) return;
    fired.current = rest.endsAt;
    sound.done();
    if (restVibrate) vibrate([300, 100, 300]);
    if (document.hidden) void notifyRestDone();
    const t = setTimeout(() => setRest(null), 1800);
    return () => clearTimeout(t);
  }, [left, rest.endsAt, restVibrate, sound, setRest]);

  const adjust = (d: number) => setRest({ ...rest, endsAt: rest.endsAt + d * 1000, total: rest.total + d });
  const pct = rest.total > 0 ? Math.min(100, (left / rest.total) * 100) : 0;
  const done = left === 0;
  // Con el tiempo justo (el avance de series va por detrás del reloj) el temporizador parpadea suavemente.
  const tight = !!plan && plan.planned > 0 && (now - plan.startedAt) / 60000 / plan.target > plan.done / plan.planned + 0.1;

  return (
    <div className="fixed inset-x-3 z-50 isolate" style={{ bottom: 'var(--rest-bottom, calc(env(safe-area-inset-bottom) + 76px))' }}>
      <div className={`overflow-hidden rounded-2xl border shadow-2xl ${tight && !done ? 'rest-tight' : ''} ${done ? 'border-fuel bg-emerald-950' : 'border-accent bg-slate-900'}`}>
        <div className="h-1 bg-slate-800">
          <div className={`h-full ${done ? 'bg-fuel' : 'bg-accent'}`} style={{ width: `${pct}%`, transition: 'width 0.25s linear' }} />
        </div>
        <div className="p-3">
          <div className="relative">
            <div className="text-center text-4xl font-black tabular-nums text-white">{done ? '¡Listo!' : fmtDuration(left)}</div>
            <button
              className="absolute right-0 top-1 rounded-full bg-slate-800 p-2 text-slate-300"
              onClick={() => { update((s) => ({ ...s, settings: { ...s.settings, restSound: !restSound } })); }}
              aria-label={restSound ? 'Silenciar' : 'Activar sonido'}
            >
              {restSound ? <Volume2 size={16} /> : <VolumeX size={16} />}
            </button>
          </div>
          <div className="mt-1 flex justify-center gap-1">
            {options.map((o) => (
              <button key={o} onClick={() => setRest({ endsAt: Date.now() + o * 1000, total: o })} className={`rounded-md px-2 py-0.5 text-[11px] ${rest.total === o ? 'bg-accent text-white' : 'bg-slate-800 text-slate-400'}`}>
                {o}s
              </button>
            ))}
          </div>
          <div className="mt-2 flex items-center justify-center gap-2">
            <span className="text-[11px] text-slate-400">Otro tiempo:</span>
            <NumInput decimal={false} value={custom} label="Segundos de descanso" placeholder="seg" className="field !w-20 !px-1 !py-1 text-center text-xs" onChange={setCustom} />
            <button className="rounded-lg bg-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-100 active:scale-95 disabled:opacity-40" disabled={custom < 5} onClick={() => { const sec = Math.min(900, custom); setRest({ endsAt: Date.now() + sec * 1000, total: sec }); setCustom(0); }}>Poner</button>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2">
            <button className="btn btn-ghost !py-2" onClick={() => adjust(-15)}>-15s</button>
            <button className="btn btn-ghost !py-2" onClick={() => adjust(30)}>+30s</button>
            <button className="btn btn-blue !py-2" onClick={() => setRest(null)}>Saltar</button>
          </div>
        </div>
      </div>
    </div>
  );
}
