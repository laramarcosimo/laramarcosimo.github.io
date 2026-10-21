import { Bell } from 'lucide-react';
import { useState } from 'react';
import { permissionState, requestPermission, type PermState } from '../lib/notify';
import { Hint } from './Hint';

const LABEL: Record<PermState, string> = {
  granted: 'Concedido',
  denied: 'Denegado',
  default: 'Sin activar',
  unsupported: 'No disponible',
};

export function usePermission() {
  const [perm, setPerm] = useState<PermState>(permissionState);
  const ask = async () => setPerm(await requestPermission());
  return { perm, ask };
}

/** Banner amistoso para activar los avisos (solo si aún no se decidió). */
export function NotifyBanner() {
  const { perm, ask } = usePermission();
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem('apex-notif-dismissed') === '1';
    } catch {
      return false;
    }
  });
  if (perm !== 'default' || hidden) return null;
  const dismiss = () => {
    setHidden(true);
    try {
      localStorage.setItem('apex-notif-dismissed', '1');
    } catch {
      /* noop */
    }
  };
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-accent/40 bg-accent/10 p-3">
      <button className="btn btn-blue flex-1 !py-2.5" onClick={() => void ask()}><Bell size={16} /> Activar avisos de descanso</button>
      <button className="px-2 text-xs text-slate-400" onClick={dismiss}>Ahora no</button>
    </div>
  );
}

export function PermissionStatus() {
  const { perm, ask } = usePermission();
  const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-300">Avisos en pantalla de bloqueo</span>
        <b className={perm === 'granted' ? 'text-fuel' : perm === 'denied' ? 'text-red-400' : 'text-slate-400'}>{LABEL[perm]}</b>
      </div>
      {perm === 'default' && <button className="btn btn-blue w-full" onClick={() => void ask()}><Bell size={16} /> Activar avisos de descanso</button>}
      {perm === 'denied' && <Hint className="text-xs text-slate-500">Actívalos en Ajustes de iOS → Notificaciones → Apex Coach.</Hint>}
      {perm === 'unsupported' && <Hint className="text-xs text-slate-500">En iPhone, instala la app: Compartir → «Añadir a pantalla de inicio» (iOS 16.4+) y ábrela desde el icono.</Hint>}
      {!standalone && perm !== 'unsupported' && <Hint className="text-xs text-slate-500">Para recibir avisos con la pantalla bloqueada, abre la app desde el icono de inicio.</Hint>}
    </div>
  );
}
