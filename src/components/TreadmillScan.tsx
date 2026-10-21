import { Camera, Image as ImageIcon, Loader2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { acsmKcal, parseClock } from '../lib/cardio';
import { isCancelled, readTreadmill } from '../lib/gemini';
import { compressToBase64 } from '../lib/image';
import { useStore } from '../lib/store';
import { fmtKg } from '../lib/utils';
import { ErrorBox, Modal } from './ui';

export interface CardioResult {
  min: number;
  km: number;
  kcal: number;
}

const toNum = (v: string): number => {
  const n = Number(v.replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : 0;
};
const fmtClock = (min: number): string => `${Math.floor(min)}:${String(Math.round((min % 1) * 60)).padStart(2, '0')}`;

/**
 * Pantalla de cinta: la foto rellena los campos (tiempo, distancia, inclinación y velocidad) y SIEMPRE se pueden escribir o corregir
 * a mano. Las kcal se calculan con la ecuación ACSM y tu peso real, vengan los datos de la foto o del teclado.
 */
export function TreadmillScan({ onClose, onSave }: { onClose: () => void; onSave: (r: CardioResult) => void }) {
  const { state } = useStore();
  const camRef = useRef<HTMLInputElement>(null);
  const galRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');
  const [machineKcal, setMachineKcal] = useState<number | null>(null);
  const [f, setF] = useState({ tiempo: '', dist: '', incl: '', vel: '' });
  const weight = state.profile.weight;

  const onFile = async (file: File | undefined, input: HTMLInputElement | null) => {
    if (input) input.value = '';
    if (!file) return;
    setBusy(true);
    setErr('');
    setNote('');
    try {
      const r = await readTreadmill(state.settings, await compressToBase64(file, 1280, 0.85));
      setF((cur) => ({
        tiempo: r.minutos !== null ? fmtClock(r.minutos) : cur.tiempo,
        dist: r.distancia !== null ? String(r.distancia) : cur.dist,
        incl: r.inclinacion !== null ? String(r.inclinacion) : cur.incl,
        vel: r.velocidad !== null ? String(r.velocidad) : cur.vel,
      }));
      setMachineKcal(r.caloriasMaquina);
      const got = [r.minutos, r.distancia, r.inclinacion, r.velocidad].filter((x) => x !== null).length;
      setNote(got === 4 ? 'Leído de la foto. Revisa que coincida con la pantalla y corrige lo que haga falta.' : got > 0 ? `Pude leer ${got} de 4 datos. Completa el resto a mano (2 segundos).` : 'No he podido leer los números de la foto. Escríbelos aquí abajo: tarda 2 segundos.');
    } catch (e) {
      // Un fallo de lectura nunca bloquea: los campos siguen disponibles para teclear.
      setErr(e instanceof Error && !isCancelled(e) ? 'No he podido leer la foto. Puedes escribir los datos directamente.' : 'Cancelado.');
    } finally {
      setBusy(false);
    }
  };

  const minutes = parseClock(f.tiempo);
  const dist = toNum(f.dist);
  const incl = toNum(f.incl);
  const speed = toNum(f.vel) || (dist > 0 && minutes > 0 ? Math.round((dist / minutes) * 60 * 10) / 10 : 0);
  const ready = minutes > 0 && speed > 0;
  const real = ready ? acsmKcal(speed, incl, minutes, weight) : 0;
  const diff = machineKcal && real > 0 ? Math.round(((machineKcal - real) / real) * 100) : null;
  const km = dist > 0 ? dist : Math.round(((speed * minutes) / 60) * 100) / 100;

  const field = (key: keyof typeof f, label: string, placeholder: string, mode: 'decimal' | 'numeric' = 'decimal') => (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold uppercase text-slate-400">{label}</span>
      <input
        className="field text-center"
        type="text"
        inputMode={mode}
        autoComplete="off"
        placeholder={placeholder}
        value={f[key]}
        onFocus={(e) => e.target.select()}
        onChange={(e) => setF({ ...f, [key]: e.target.value })}
        aria-label={label}
      />
    </label>
  );

  return (
    <Modal title="Escanear pantalla de cinta" onClose={onClose}>
      <div className="space-y-3">
        <p className="text-sm text-slate-300">Haz una foto de la pantalla (o súbela de la galería) y rellenará los datos. También puedes escribirlos a mano.</p>
        <div className="grid grid-cols-2 gap-2">
          <button className="btn btn-blue" disabled={busy} onClick={() => camRef.current?.click()}><Camera size={16} /> Hacer foto</button>
          <button className="btn btn-ghost" disabled={busy} onClick={() => galRef.current?.click()}><ImageIcon size={16} /> Galería</button>
        </div>
        <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => void onFile(e.target.files?.[0], camRef.current)} />
        <input ref={galRef} type="file" accept="image/*" className="hidden" onChange={(e) => void onFile(e.target.files?.[0], galRef.current)} />
        {busy && <div className="flex items-center justify-center gap-2 text-sm text-slate-400"><Loader2 size={16} className="animate-spin" /> Leyendo la pantalla…</div>}
        {note && <p className="rounded-lg bg-slate-800 p-2 text-xs text-slate-200">{note}</p>}
        {err && <ErrorBox msg={err} />}

        <div className="grid grid-cols-2 gap-2">
          {field('tiempo', 'Tiempo (min:seg)', '8:29', 'numeric')}
          {field('dist', 'Distancia (km)', '0.49')}
          {field('incl', 'Inclinación (%)', '7')}
          {field('vel', 'Velocidad (km/h)', '4.5')}
        </div>

        <div className="rounded-xl bg-emerald-500/10 p-3 text-sm">
          <div className="text-slate-300">Calorías calculadas a tu peso real ({fmtKg(weight)} kg)</div>
          <div className="text-2xl font-extrabold text-emerald-500">{ready ? `~${real} kcal` : '—'}</div>
          {!ready && <div className="text-[11px] text-slate-400">Faltan el tiempo y la velocidad (o la distancia) para calcularlas.</div>}
        </div>
        {machineKcal !== null && (
          <div className="rounded-xl bg-slate-800 p-3 text-sm text-slate-300">
            Estimación genérica de la máquina: <b className="text-white">{machineKcal} kcal</b>
            {diff !== null && <span className="text-slate-400"> (desfase de {diff > 0 ? '+' : ''}{diff} %)</span>}
          </div>
        )}
        <p className="text-[11px] text-slate-500">Ecuación ACSM de caminata con pendiente: VO₂ = 0,1·S + 1,8·S·G + 3,5 (S en m/min, G = pendiente).</p>
        <button className="btn btn-blue w-full" disabled={!ready} onClick={() => { onSave({ min: Math.round(minutes * 100) / 100, km, kcal: real }); onClose(); }}>Guardar cardio</button>
      </div>
    </Modal>
  );
}
