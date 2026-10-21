import { Camera, Film, ShieldCheck, Upload, Video } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { analyzeForm, type FormCheck } from '../lib/gemini';
import { extractFrames } from '../lib/videoFrames';
import { useStore } from '../lib/store';
import type { Exercise, Location } from '../lib/types';
import { cx } from '../lib/utils';
import { ErrorBox, Modal } from './ui';
import { Hint } from './Hint';

const MESSAGES = ['Analizando trayectoria de la carga…', 'Evaluando alineación articular…', 'Revisando el recorrido de las rodillas…', 'Comprobando el control del tempo…', 'Preparando tu corrección…'];

const LEVEL = {
  verde: { dot: 'bg-emerald-500', text: 'text-emerald-500', ring: 'border-emerald-500/50', label: 'Técnica sólida y segura' },
  amarillo: { dot: 'bg-amber-400', text: 'text-amber-400', ring: 'border-amber-400/50', label: 'Buena base con puntos a corregir' },
  rojo: { dot: 'bg-red-500', text: 'text-red-400', ring: 'border-red-500/50', label: 'Riesgo de lesión: ajusta de inmediato' },
} as const;

/** Revisión de técnica con vídeo: se extraen fotogramas en el dispositivo y solo estos se envían a Gemini. El vídeo no se guarda. */
export function VideoFormCheck({ exercise, location, onApply, onClose }: { exercise: Exercise; location: Location; onApply?: (cue: string) => void; onClose: () => void }) {
  const { state } = useStore();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(0);
  const [err, setErr] = useState('');
  const [res, setRes] = useState<FormCheck | null>(null);
  const camRef = useRef<HTMLInputElement>(null);
  const galRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!busy) return;
    const i = setInterval(() => setMsg((m) => (m + 1) % MESSAGES.length), 2200);
    return () => clearInterval(i);
  }, [busy]);

  const run = async (f: File | undefined) => {
    if (camRef.current) camRef.current.value = '';
    if (galRef.current) galRef.current.value = '';
    if (!f) return;
    setErr('');
    if (!state.settings.geminiKey.trim()) return setErr('Falta la clave de Gemini (Ajustes) para revisar la técnica.');
    setBusy(true);
    setMsg(0);
    try {
      const frames = await extractFrames(f);
      setRes(await analyzeForm(state.settings, frames, { nombre: exercise.name, musculo: exercise.muscleGroup, equipo: exercise.equipment }, { home: location === 'home', kneeSafe: state.settings.kneeSafe }));
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'No se pudo analizar el vídeo');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Revisar técnica con vídeo" onClose={busy ? () => undefined : onClose}>
      {!busy && !res && (
        <div className="space-y-3">
          <p className="text-sm text-slate-300">Ejercicio: <b className="text-white">{exercise.name}</b></p>
          <div className="flex gap-2 rounded-xl bg-slate-800 p-3 text-xs text-slate-300">
            <Film size={16} strokeWidth={1.75} className="mt-0.5 shrink-0 text-accent" />
            <span>Graba de 5 a 15 segundos (3-4 repeticiones) de perfil o en diagonal, con el cuerpo entero a la vista. Máximo 20 s y 25 MB.</span>
          </div>
          <div className="grid gap-2">
            <button className="btn btn-green" onClick={() => camRef.current?.click()}><Camera size={18} strokeWidth={1.75} /> Grabar con la cámara</button>
            <button className="btn btn-ghost" onClick={() => galRef.current?.click()}><Upload size={18} strokeWidth={1.75} /> Subir un clip de la galería</button>
          </div>
          <input ref={camRef} type="file" accept="video/*" capture="environment" className="hidden" onChange={(e) => void run(e.target.files?.[0])} />
          <input ref={galRef} type="file" accept="video/*" className="hidden" onChange={(e) => void run(e.target.files?.[0])} />
          <Hint className="flex items-center gap-1.5 text-[11px] text-slate-500"><ShieldCheck size={13} /> El vídeo se procesa en tu móvil: solo se envían unos fotogramas a Gemini y no se guarda nada.</Hint>
          {err && <ErrorBox msg={err} />}
        </div>
      )}

      {busy && (
        <div className="flex flex-col items-center gap-4 py-6" role="status" aria-live="polite">
          <div className="relative flex h-24 w-24 items-center justify-center rounded-3xl bg-accent/15">
            <Video size={40} strokeWidth={1.5} className="animate-pulse text-accent" />
            <span className="absolute inset-x-3 h-0.5 animate-[scan_1.6s_ease-in-out_infinite] rounded bg-accent/80" />
          </div>
          <p key={msg} className="text-center text-sm font-semibold text-white">{MESSAGES[msg]}</p>
          <div className="h-1.5 w-48 overflow-hidden rounded-full bg-slate-800"><div className="h-full w-1/3 animate-[slide_1.3s_ease-in-out_infinite] rounded-full bg-accent" /></div>
        </div>
      )}

      {res && (
        <div className="space-y-3">
          <div className={cx('rounded-2xl border-2 p-4', LEVEL[res.nivel].ring)}>
            <div className="mb-3 flex items-center gap-2">
              <span className={cx('h-4 w-4 rounded-full', LEVEL[res.nivel].dot)} />
              <span className={cx('text-base font-bold', LEVEL[res.nivel].text)}>{LEVEL[res.nivel].label}</span>
            </div>
            {res.bien && <div className="mb-3"><div className="text-[11px] font-bold uppercase text-emerald-500">Lo que haces bien</div><p className="text-sm text-slate-200">{res.bien}</p></div>}
            {res.correccion && <div className="mb-3"><div className={cx('text-[11px] font-bold uppercase', LEVEL[res.nivel].text)}>Corrección principal</div><p className="text-sm text-slate-200">{res.correccion}</p></div>}
            {res.cue && <div className="rounded-xl bg-slate-800 p-3"><div className="text-[11px] font-bold uppercase text-accent">Para la próxima serie</div><p className="text-base font-bold text-white">“{res.cue}”</p></div>}
          </div>
          <button className="btn btn-green w-full" onClick={() => { onApply?.(res.cue); onClose(); }}>¡Entendido! Aplicar a la siguiente serie</button>
          <button className="btn btn-ghost w-full" onClick={() => { setRes(null); setErr(''); }}>Revisar otro vídeo</button>
        </div>
      )}
    </Modal>
  );
}
