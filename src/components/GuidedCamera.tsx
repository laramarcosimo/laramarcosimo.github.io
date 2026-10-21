import { Camera, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useScrollLock } from '../lib/scrollLock';

/**
 * Cámara con guía: muestra tu foto anterior semitransparente encima de la imagen en directo para repetir la misma distancia y postura.
 * Si el navegador no da acceso a la cámara, avisa y se puede usar la cámara normal del móvil.
 */
export function GuidedCamera({ ghost, selfie, onShot, onClose, onFallback }: { ghost: string; selfie: boolean; onShot: (f: File) => void; onClose: () => void; onFallback?: () => void }) {
  useScrollLock();
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState('');
  const [opacity, setOpacity] = useState(0.4);
  const [timer, setTimer] = useState<number>(() => {
    try {
      return Number(localStorage.getItem('apex-photo-timer') ?? '5') || 0;
    } catch {
      return 5;
    }
  });
  const [count, setCount] = useState(0); // cuenta atrás en curso (0 = ninguna)
  const tick = useRef<number>();

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('Este navegador no permite usar la cámara aquí.');
        const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: selfie ? 'user' : 'environment', width: { ideal: 1280 }, height: { ideal: 1280 } }, audio: false });
        if (!live) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream.current = s;
        if (video.current) {
          video.current.srcObject = s;
          await video.current.play().catch(() => undefined);
        }
        setReady(true);
      } catch (e) {
        setErr(e instanceof Error && e.message ? e.message : 'No se pudo abrir la cámara. Revisa el permiso de cámara en los ajustes del móvil.');
      }
    })();
    return () => {
      live = false;
      stream.current?.getTracks().forEach((t) => t.stop());
      stream.current = null;
    };
  }, [selfie]);

  const pickTimer = (n: number) => {
    setTimer(n);
    try {
      localStorage.setItem('apex-photo-timer', String(n));
    } catch {
      /* noop */
    }
  };
  useEffect(() => () => window.clearInterval(tick.current), []);
  const press = () => {
    if (count > 0) {
      window.clearInterval(tick.current);
      setCount(0);
      return;
    }
    if (timer <= 0) return shoot();
    let left = timer;
    setCount(left);
    tick.current = window.setInterval(() => {
      left -= 1;
      if (left <= 0) {
        window.clearInterval(tick.current);
        setCount(0);
        shoot();
      } else {
        setCount(left);
        try {
          navigator.vibrate?.(30);
        } catch {
          /* noop */
        }
      }
    }, 1000);
  };

  const shoot = () => {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    const c = document.createElement('canvas');
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext('2d')?.drawImage(v, 0, 0, c.width, c.height);
    c.toBlob((b) => {
      c.width = 0;
      c.height = 0;
      if (b) onShot(new File([b], `foto-${Date.now()}.jpg`, { type: 'image/jpeg' }));
    }, 'image/jpeg', 0.9);
  };

  const mirror = selfie ? { transform: 'scaleX(-1)' } : undefined;
  return (
    <div className="fixed inset-0 z-[90] flex flex-col bg-black" role="dialog" aria-label="Cámara con guía">
      <div className="flex items-center justify-between px-4 text-white" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 10px)' }}>
        <span className="text-sm font-semibold">Alinea con tu foto anterior</span>
        <button className="rounded-full bg-white/15 p-2" onClick={onClose} aria-label="Cerrar cámara"><X size={18} /></button>
      </div>
      <div className="relative mt-2 flex-1 overflow-hidden">
        <video ref={video} playsInline muted className="absolute inset-0 h-full w-full object-contain" style={mirror} />
        {ghost && <img src={ghost} alt="" className="pointer-events-none absolute inset-0 h-full w-full object-contain" style={{ opacity, ...mirror }} />}
        {err && (
          <div className="absolute inset-x-4 top-4 space-y-2 rounded-xl bg-red-500/90 p-3 text-sm text-white">
            <div>{err}</div>
            {onFallback && <button className="w-full rounded-lg bg-white/20 py-2 font-semibold" onClick={onFallback}>Usar la cámara del móvil</button>}
          </div>
        )}
        {count > 0 && <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-[9rem] font-black text-white drop-shadow-[0_2px_12px_rgba(0,0,0,.7)]" role="timer" aria-label={`${count} segundos`}>{count}</div>}
      </div>
      <div className="space-y-3 px-5 pt-3" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 14px)' }}>
        <label className="flex items-center gap-3 text-xs text-white/80">Guía
          <input type="range" min={0} max={0.8} step={0.05} value={opacity} onChange={(e) => setOpacity(Number(e.target.value))} className="flex-1" aria-label="Transparencia de la foto guía" />
        </label>
        <div className="flex items-center justify-center gap-1.5 text-xs" role="group" aria-label="Temporizador">
          <span className="mr-1 text-white/70">Temporizador</span>
          {[0, 3, 5, 10].map((n) => <button key={n} aria-pressed={timer === n} disabled={count > 0} onClick={() => pickTimer(n)} className={`rounded-full px-3 py-1.5 font-semibold ${timer === n ? 'bg-white text-slate-900' : 'bg-white/15 text-white'}`}>{n === 0 ? 'Ya' : `${n} s`}</button>)}
        </div>
        <button className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border-4 border-white bg-white/20 text-white disabled:opacity-40 active:scale-95" disabled={!ready} onClick={press} aria-label={count > 0 ? 'Cancelar la cuenta atrás' : 'Hacer la foto'}>{count > 0 ? <X size={26} /> : <Camera size={26} />}</button>
      </div>
    </div>
  );
}
