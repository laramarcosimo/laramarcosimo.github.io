import { Download, ShieldAlert, ShieldCheck, ShieldQuestion } from 'lucide-react';
import { useState } from 'react';
import { exportBackupFile, lastManualBackupTs } from '../lib/backup';
import { backupNow, isConnected, lastBackupAt, lastBackupError, readCloud } from '../lib/cloud';
import { useStore } from '../lib/store';
import { cx } from '../lib/utils';

const DAY = 86_400_000;
const ago = (ts: number, now: number): string => {
  if (!ts) return 'nunca';
  const d = Math.floor((now - ts) / DAY);
  return d <= 0 ? 'hoy' : d === 1 ? 'ayer' : `hace ${d} días`;
};

/** Estado de tus copias de seguridad de un vistazo (nube y archivo) con un botón para hacerla ahora. */
export function BackupStatus() {
  const { state } = useStore();
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const cloud = isConnected();
  const cloudTs = lastBackupAt();
  const fileTs = lastManualBackupTs();
  const err = lastBackupError();
  const newest = Math.max(cloudTs, fileTs);
  const age = newest ? (now - newest) / DAY : Infinity;
  const level: 'ok' | 'warn' | 'bad' = err && now - err.ts < 7 * DAY ? 'bad' : age <= 3 ? 'ok' : age <= 7 ? 'warn' : 'bad';
  const Icon = level === 'ok' ? ShieldCheck : level === 'warn' ? ShieldQuestion : ShieldAlert;
  const tone = level === 'ok' ? 'bg-emerald-500/15 text-emerald-500' : level === 'warn' ? 'bg-amber-500/15 text-amber-500' : 'bg-red-500/15 text-red-400';
  const verdict = level === 'ok' ? 'Tus datos están protegidos.' : level === 'warn' ? 'Conviene hacer una copia pronto.' : err && now - err.ts < 7 * DAY ? 'La última copia en la nube falló.' : 'Llevas demasiado sin copia: si pierdes el móvil, perderías lo posterior.';

  const run = async () => {
    setBusy(true);
    setMsg('');
    try {
      if (cloud) await backupNow(state);
      else await exportBackupFile(state);
      setMsg(cloud ? 'Copia subida a la nube.' : 'Copia guardada.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'No se pudo hacer la copia.');
    } finally {
      setNow(Date.now());
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2 rounded-2xl border border-slate-800 p-3">
      <div className={cx('flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold', tone)}><Icon size={18} /> {verdict}</div>
      <div className="grid grid-cols-2 gap-2 text-center text-xs">
        <div className="rounded-xl bg-slate-800 p-2"><div className="font-bold text-white">{cloud ? ago(cloudTs, now) : 'No configurada'}</div><div className="text-slate-400">Nube {cloud ? (readCloud().auto ? '(automática)' : '(manual)') : ''}</div></div>
        <div className="rounded-xl bg-slate-800 p-2"><div className="font-bold text-white">{ago(fileTs, now)}</div><div className="text-slate-400">Archivo</div></div>
      </div>
      <button className="btn btn-blue w-full !py-2 text-xs" disabled={busy} onClick={() => void run()}><Download size={14} /> {cloud ? 'Hacer copia en la nube ahora' : 'Guardar copia ahora'}</button>
      {msg && <p className="text-[11px] text-slate-400">{msg}</p>}
    </div>
  );
}
