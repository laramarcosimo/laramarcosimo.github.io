import { Camera, FileSpreadsheet } from 'lucide-react';
import { useRef, useState } from 'react';
import { readWorkoutScreenshot } from '../lib/gemini';
import { buildLog, importCsv, makeResolver } from '../lib/importers';
import { compressToBase64 } from '../lib/image';
import { useStore } from '../lib/store';
import type { Exercise, WorkoutLog } from '../lib/types';
import { ErrorBox, Spinner } from './ui';

export function ImportPanel() {
  const { state, update } = useStore();
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const csvRef = useRef<HTMLInputElement>(null);
  const ocrRef = useRef<HTMLInputElement>(null);

  const merge = (incoming: WorkoutLog[], created: Exercise[]): number => {
    let added = 0;
    update((s) => {
      const fresh = incoming.filter((w) => !s.workouts.some((x) => x.title === w.title && Math.abs(Date.parse(x.startTime) - Date.parse(w.startTime)) < 60000));
      added = fresh.length;
      const names = new Set(fresh.flatMap((w) => w.exercises.map((e) => e.exerciseId)));
      return { ...s, exercises: [...s.exercises, ...created.filter((c) => names.has(c.id))], workouts: [...fresh, ...s.workouts].sort((a, b) => Date.parse(b.startTime) - Date.parse(a.startTime)) };
    });
    return added;
  };

  const run = async (label: string, fn: () => Promise<string>) => {
    setBusy(label);
    setErr('');
    setMsg('');
    try {
      setMsg(await fn());
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error desconocido');
    } finally {
      setBusy('');
    }
  };

  const onCsv = (f: File | undefined) => {
    if (!f) return;
    void run('Leyendo CSV…', async () => {
      const { resolve, created } = makeResolver(state.exercises);
      const list = importCsv(await f.text(), state.profile.weight, resolve);
      return `${merge(list, created)} entrenamiento(s) nuevo(s) importado(s) de ${list.length}.`;
    });
    if (csvRef.current) csvRef.current.value = '';
  };

  const onOcr = (f: File | undefined) => {
    if (!f) return;
    void run('Leyendo captura con Gemini…', async () => {
      let b64: string | null = await compressToBase64(f);
      const r = await readWorkoutScreenshot(state.settings, b64);
      b64 = null; // la imagen no se conserva
      const { resolve, created } = makeResolver(state.exercises);
      const exs = r.ejercicios.map((e) => ({ ex: resolve(e.nombre), sets: e.series.map((s) => ({ type: 'normal' as const, weight: s.peso, reps: s.reps })) }));
      const durationSec = Math.max(60, Math.round(r.duracionMin * 60));
      const log = buildLog(r.titulo, Date.now() - durationSec * 1000, durationSec, exs, state.profile.weight, 'ocr', r.calorias, r.volumenKg);
      merge([log], created);
      return `Importado "${r.titulo}": ${log.totalVolumeKg} kg, ${log.caloriesBurned} kcal.`;
    });
    if (ocrRef.current) ocrRef.current.value = '';
  };

  return (
    <div className="card space-y-3">
      <h3 className="font-bold text-white">Importar historial</h3>
      <div className="grid grid-cols-2 gap-2">
        <button className="btn btn-ghost" disabled={!!busy} onClick={() => csvRef.current?.click()}><FileSpreadsheet size={16} /> CSV</button>
        <button className="btn btn-ghost" disabled={!!busy} onClick={() => ocrRef.current?.click()}><Camera size={16} /> Captura (OCR)</button>
      </div>
      <input ref={csvRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => onCsv(e.target.files?.[0])} />
      <input ref={ocrRef} type="file" accept="image/*" className="hidden" onChange={(e) => onOcr(e.target.files?.[0])} />
      {busy && <Spinner label={busy} />}
      {msg && <p className="text-sm text-emerald-400">{msg}</p>}
      {err && <ErrorBox msg={err} />}
    </div>
  );
}
