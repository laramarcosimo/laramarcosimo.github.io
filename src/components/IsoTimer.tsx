import { Pause, Play, Timer } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSoundAlert } from '../lib/useSoundAlert';
import { useWakeLock } from '../lib/wakeLock';

/** Cronómetro para ejercicios isométricos (sentadilla en pared): empieza, aguanta hasta no poder más y al parar se guardan los segundos. */
export function IsoTimer({ weight, setNo, best, onStop }: { weight: number; setNo: number; best: number; onStop: (secs: number) => void }) {
  const sound = useSoundAlert();
  const [startAt, setStartAt] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  useWakeLock(startAt !== null);
  useEffect(() => {
    if (startAt === null) return;
    const t = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(t);
  }, [startAt]);
  const secs = startAt === null ? 0 : Math.max(0, Math.floor((now - startAt) / 1000));
  const stop = () => {
    if (startAt === null) return;
    const s = Math.max(1, Math.round((Date.now() - startAt) / 1000));
    setStartAt(null);
    sound.done();
    onStop(s);
  };
  return (
    <div className="mt-3 rounded-xl bg-accent/10 p-3 text-center">
      <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-accent"><Timer size={13} /> Cronómetro · serie {setNo}{weight > 0 ? ` · ${weight} kg` : ''}</div>
      <div className="my-1 text-5xl font-black tabular-nums text-white" role="timer" aria-label={`${secs} segundos`}>{secs}<span className="text-lg font-semibold text-slate-400"> s</span></div>
      {best > 0 && <div className={secs > best ? 'text-xs font-bold text-emerald-400' : 'text-xs text-slate-400'}>{secs > best ? '¡Récord de esta serie superado!' : `Última vez: ${best} s`}</div>}
      {startAt === null ? (
        <button className="btn btn-blue mt-2 w-full" onClick={() => { sound.unlock(); setNow(Date.now()); setStartAt(Date.now()); }}><Play size={16} /> Empezar</button>
      ) : (
        <button className="btn btn-green mt-2 w-full" onClick={stop}><Pause size={16} /> Parar y guardar</button>
      )}
    </div>
  );
}
