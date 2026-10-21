import { Activity, Flame, Pause, Play, ShieldCheck, SkipForward, Video } from 'lucide-react';
import { useResume } from '../lib/resume';
import { useEffect, useMemo, useRef, useState } from 'react';
import { BUZZ, vibrate } from '../lib/feedback';
import { scheduleTimer } from '../lib/notify';
import type { Exercise } from '../lib/types';
import { useSoundAlert } from '../lib/useSoundAlert';
import { localWarmup, type WarmupItem } from '../lib/warmup';
import { useWakeLock } from '../lib/wakeLock';
import { PosterThumb } from './ExerciseImage';
import { TechniqueModal } from './TechniqueModal';
import { gifUrl, posterOfEdb } from '../lib/exercises';
import { Modal } from './ui';

const mmss = (s: number): string => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/** Calentamiento ágil de 3 minutos (movilidad dinámica y suave, sin impactos) para la rutina de hoy. */
export function WarmupModal({ exercises, onClose }: { exercises: Exercise[]; onClose: () => void }) {
  const sound = useSoundAlert();
  const plan = useMemo(() => localWarmup(exercises), [exercises]);
  const total = plan.items.reduce((a, x) => a + x.seconds, 0);

  const [guided, setGuided] = useState(false);
  const [i, setI] = useState(0);
  const [running, setRunning] = useState(true);
  const [endsAt, setEndsAt] = useState(0);
  const [pausedLeft, setPausedLeft] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [done, setDone] = useState(false);
  const [demo, setDemo] = useState<WarmupItem | null>(null);
  const lastSplit = useRef(0);
  useWakeLock(guided && !done);

  const item = plan.items[i];
  const leftMs = running ? Math.max(0, endsAt - now) : pausedLeft;
  const left = Math.ceil(leftMs / 1000);
  const doneBefore = plan.items.slice(0, i).reduce((a, x) => a + x.seconds, 0);
  const totalLeft = guided && !done ? Math.max(0, total - doneBefore - (item.seconds - left)) : total;
  const splitIdx = item?.splits ? Math.min(item.splits.length - 1, Math.floor(((item.seconds * 1000 - leftMs) / (item.seconds * 1000)) * item.splits.length)) : 0;

  useEffect(() => {
    if (!guided || !running || done) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [guided, running, done]);
  function goTo(n: number) {
    if (n >= plan.items.length) {
      setDone(true);
      vibrate([200, 100, 200]);
      sound.done();
      return;
    }
    vibrate(BUZZ.endThenStart); // acaba uno (2 largos) y empieza el siguiente (3 cortos)
    lastSplit.current = 0;
    const t = Date.now();
    setNow(t);
    setI(n);
    setEndsAt(t + plan.items[n].seconds * 1000);
    setRunning(true);
  };

  // Al desbloquear o volver a la app se recalcula al instante qué ejercicio toca y cuánto queda (aunque haya pasado más de uno).
  const catchUp = () => {
    const t = Date.now();
    setNow(t);
    if (!guided || !running || done) return;
    let idx = i;
    let end = endsAt;
    while (end <= t) {
      idx++;
      if (idx >= plan.items.length) {
        goTo(plan.items.length);
        return;
      }
      end += plan.items[idx].seconds * 1000;
    }
    if (idx !== i) {
      lastSplit.current = 0;
      setI(idx);
      setEndsAt(end);
    }
  };
  useResume(catchUp);

  // Aviso del fin del calentamiento (servidor o Service Worker): llega aunque la pantalla esté bloqueada.
  const finalAt = guided && running && !done ? endsAt + plan.items.slice(i + 1).reduce((a, x) => a + x.seconds, 0) * 1000 : 0;
  useEffect(() => {
    if (!finalAt) return;
    void scheduleTimer('warmup', finalAt);
    return () => void scheduleTimer('warmup', null);
  }, [finalAt]);

  useEffect(() => {
    if (guided && running && !done && leftMs <= 0) goTo(i + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leftMs, guided, running, done]);

  useEffect(() => {
    if (!guided || done || splitIdx === lastSplit.current) return;
    lastSplit.current = splitIdx;
    vibrate(BUZZ.side); // cambio de pierna / sentido / lado
  }, [splitIdx, guided, done]);

  const startGuided = () => {
    sound.unlock();
    setGuided(true);
    setDone(false);
    lastSplit.current = 0;
    const t = Date.now();
    setNow(t);
    setI(0);
    setEndsAt(t + plan.items[0].seconds * 1000);
    setRunning(true);
  };

  return (
    <Modal title={`${plan.title} (3 min)`} onClose={onClose}>
      {!guided ? (
        <div className="space-y-3">
          <ol className="space-y-2">
            {plan.items.map((x) => (
              <li key={x.key} className="flex gap-3 rounded-xl bg-slate-800 p-3">
                <PosterThumb src={posterOfEdb(x.img)} alt={x.name} size={44} Icon={Activity} />
                <div className="min-w-0 flex-1"><div className="text-sm font-semibold text-white">{x.name} <span className="font-normal text-slate-500">· {x.seconds} s</span></div><div className="text-xs text-slate-400">{x.detail}</div></div>
                <button className="shrink-0 self-start rounded-lg bg-slate-700/60 p-2 text-accent active:scale-95" onClick={() => setDemo(x)} aria-label={`Ver técnica: ${x.name}`}><Video size={16} /></button>
              </li>
            ))}
          </ol>
          <div className="flex gap-2 rounded-xl bg-emerald-500/10 p-3 text-xs text-emerald-500">
            <ShieldCheck size={16} strokeWidth={1.75} className="mt-0.5 shrink-0" />
            <span><b>Cuida tus rodillas:</b> {plan.why}</span>
          </div>
          <div className="grid gap-2">
            <button className="btn btn-green" onClick={startGuided}><Flame size={18} strokeWidth={1.75} /> Iniciar calentamiento guiado ({mmss(total)})</button>
            <button className="btn btn-ghost" onClick={onClose}>Empezar a entrenar</button>
          </div>
        </div>
      ) : done ? (
        <div className="space-y-3 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20"><Flame size={30} className="text-emerald-500" /></div>
          <p className="font-bold text-white">¡Calentamiento listo!</p>
          <p className="text-sm text-slate-400">Empieza con una primera serie ligera antes de ir a tu peso de trabajo.</p>
          <button className="btn btn-green w-full" onClick={onClose}>Empezar a entrenar</button>
        </div>
      ) : (
        <div className="space-y-4 text-center">
          <div className="flex items-center justify-between text-xs font-semibold uppercase text-slate-400"><span>Ejercicio {i + 1} de {plan.items.length}</span><span className="tabular-nums">Total {mmss(totalLeft)}</span></div>
          <h3 className="text-lg font-bold text-white">{item.name}</h3>
          <p className="text-sm text-slate-400">{item.detail}</p>
          {item.splits && <div className="mx-auto w-fit rounded-full bg-accent px-4 py-1.5 text-sm font-bold text-white">{item.splits[splitIdx]}</div>}
          <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-full border-4 border-emerald-500/60 text-4xl font-black tabular-nums text-white" role="timer" aria-label={`${left} segundos`}>{left}</div>
          <div className="grid grid-cols-3 gap-2">
            <button className="btn btn-ghost !px-1 text-xs" onClick={() => { if (running) { setPausedLeft(Math.max(0, endsAt - Date.now())); setRunning(false); } else { const t = Date.now(); setNow(t); setEndsAt(t + pausedLeft); setRunning(true); } }}>{running ? <><Pause size={15} /> Pausar</> : <><Play size={15} /> Seguir</>}</button>
            <button className="btn btn-ghost !px-1 text-xs" onClick={() => goTo(i + 1)}><SkipForward size={15} /> Siguiente</button>
            <button className="btn btn-ghost !px-1 text-xs" onClick={() => setDemo(item)}><Video size={15} /> Ver técnica</button>
          </div>
          <button className="btn btn-blue w-full" onClick={onClose}>Empezar a entrenar</button>
        </div>
      )}
      {demo && <TechniqueModal title={demo.name} imageUrl={demo.img ? gifUrl(demo.img) : ''} muscles={demo.muscles} bm={demo.bm} motion={demo.motion} tips={demo.tips} demoKey={demo.key} onClose={() => setDemo(null)} />}
    </Modal>
  );
}
