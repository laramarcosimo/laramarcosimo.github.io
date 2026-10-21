import { CloudOff } from 'lucide-react';
import { useState } from 'react';
import { isConnected, lastBackupAt, lastBackupError, readCloud } from '../lib/cloud';
import { useStore } from '../lib/store';

const DAY = 86_400_000;

/** Aviso discreto en Hoy si la copia en la nube no está configurada, falló o lleva más de 3 días sin subirse. */
export function BackupNotice() {
  const { state } = useStore();
  const [now] = useState(() => Date.now());
  const used = state.workouts.length + state.meals.length >= 5; // solo molesta cuando ya hay datos que proteger
  if (!used) return null;
  const err = lastBackupError();
  const last = lastBackupAt();
  let text = '';
  if (!isConnected()) text = 'Aún no tienes copia de seguridad automática. Configúrala en Ajustes → Copias de seguridad y datos.';
  else if (err && now - err.ts < 7 * DAY) text = `La última copia en la nube falló: ${err.msg}`;
  else if (readCloud().auto && now - last > 3 * DAY) text = 'Llevas más de 3 días sin copia en la nube. Abre Ajustes y pulsa «Subir copia a la nube».';
  else if (!readCloud().auto && now - last > 7 * DAY) text = 'La copia automática está desactivada y llevas más de una semana sin copia.';
  if (!text) return null;
  return (
    <div className="flex items-start gap-2 rounded-2xl bg-amber-500/15 p-3 text-xs text-amber-500">
      <CloudOff size={16} className="mt-0.5 shrink-0" />
      <span>{text}</span>
    </div>
  );
}
