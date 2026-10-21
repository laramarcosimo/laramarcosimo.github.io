import { Loader2, X } from 'lucide-react';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { aiGraceUntil, aiPending, cancelAi, subscribeAi } from '../lib/gemini';

/**
 * Aviso flotante mientras la IA trabaja, siempre con un botón para cancelar. Primero hay un margen de unos segundos en el que la
 * consulta aún NO se ha enviado a Google: cancelar entonces no gasta nada. Después, cancelar corta la espera, pero puede que ya se haya gastado.
 */
export function AiCancelBar() {
  const n = useSyncExternalStore(subscribeAi, aiPending, aiPending);
  const until = useSyncExternalStore(subscribeAi, aiGraceUntil, aiGraceUntil);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (until <= Date.now()) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(id);
  }, [until]);
  if (n === 0) return null;
  const left = Math.max(0, Math.ceil((until - now) / 1000));
  const waiting = until > now;
  return (
    <div className="fixed inset-x-3 top-3 z-[100] mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-slate-700 bg-slate-900/95 px-4 py-2.5 shadow-lg backdrop-blur" role="status" style={{ marginTop: 'env(safe-area-inset-top)' }}>
      <Loader2 size={16} className="shrink-0 animate-spin text-accent" />
      <span className="min-w-0 flex-1 text-sm text-slate-200">
        {waiting ? <>Se enviará a la IA en <b className="text-white">{left} s</b>. <span className="text-xs text-emerald-400">Si cancelas ahora, no se gasta nada.</span></> : <>La IA está trabajando… <span className="text-xs text-slate-400">Si cancelas, puede que ya se haya gastado.</span></>}
      </span>
      <button className="flex shrink-0 items-center gap-1 rounded-full bg-red-500/20 px-3 py-1.5 text-xs font-bold text-red-400 active:scale-95" onClick={cancelAi}><X size={13} /> Cancelar</button>
    </div>
  );
}
