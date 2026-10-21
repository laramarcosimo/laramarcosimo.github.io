import { BellRing, ChevronDown, Download, Ruler, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { exportBackupFile } from '../lib/backup';
import { notifyGeneric } from '../lib/notify';
import { dueReminders, snooze } from '../lib/reminders';
import { useStore } from '../lib/store';
import { deloadActive } from '../lib/workout';
import { cx, dayKey } from '../lib/utils';

const DAYS: Record<string, number> = { face: 0.25, postworkout: 0.25, measure: 1, backup: 3, expiry: 1, protein: 1, joint: 7, deload: 21, cloud: 1, photo: 1 };

/** Avisos compactos y descartables [x]; tocar el título despliega el detalle. Con permiso, también avisa al abrir la app. */
export function Reminders({ onMeasure }: { onMeasure?: () => void }) {
  const { state, update } = useStore();
  const [tick, setTick] = useState(0);
  const [open, setOpen] = useState<string | null>(null);
  // `tick` fuerza el recálculo tras posponer o completar.
  void tick;
  const list = dueReminders(state);

  useEffect(() => {
    // Una notificación del sistema como máximo al día (solo si la app se abre y hay permiso).
    if (list.length === 0) return;
    try {
      const k = 'apex-reminder-notified';
      if (localStorage.getItem(k) === dayKey()) return;
      localStorage.setItem(k, dayKey());
      void notifyGeneric(list[0].title, list[0].text, 'apex-reminder');
    } catch {
      /* noop */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const deload = deloadActive(state.settings.deloadUntil);
  if (list.length === 0 && !deload) return null;
  const dismiss = (id: string) => { snooze(id, DAYS[id] ?? 1); setTick((t) => t + 1); };

  return (
    <div className="space-y-1.5">
      {deload && (
        <div className="flex items-center gap-2 rounded-xl bg-violet-500/15 px-3 py-2 text-xs text-violet-300">
          <span className="min-w-0 flex-1"><b>Semana de descarga activa</b> hasta el {new Date(state.settings.deloadUntil ?? 0).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric' })}</span>
          <button className="shrink-0 font-bold" onClick={() => update((s) => ({ ...s, settings: { ...s.settings, deloadUntil: undefined } }))}>Terminar</button>
        </div>
      )}
      {list.map((r) => {
        const expanded = open === r.id;
        return (
          <div key={r.id} className="rounded-xl bg-slate-800 px-3 py-2">
            <div className="flex items-center gap-2">
              <BellRing size={15} strokeWidth={1.75} className="shrink-0 text-accent" />
              <button className="flex min-w-0 flex-1 items-center gap-1 text-left text-xs font-semibold text-white" onClick={() => setOpen(expanded ? null : r.id)} aria-expanded={expanded}>
                <span className="truncate">{r.title}</span>
                <ChevronDown size={13} className={cx('shrink-0 text-slate-500 transition-transform', expanded && 'rotate-180')} />
              </button>
              {r.id === 'measure' && <button className="btn btn-blue shrink-0 !px-2.5 !py-1 text-[11px]" onClick={() => onMeasure?.()}><Ruler size={12} strokeWidth={1.75} /> Medir</button>}
              {r.id === 'backup' && <button className="btn btn-blue shrink-0 !px-2.5 !py-1 text-[11px]" onClick={async () => { if (await exportBackupFile(state)) setTick((t) => t + 1); }}><Download size={12} strokeWidth={1.75} /> Copiar</button>}
              {r.id === 'deload' && <button className="btn btn-blue shrink-0 !px-2.5 !py-1 text-[11px]" onClick={() => { update((s) => ({ ...s, settings: { ...s.settings, deloadUntil: Date.now() + 7 * 86400000 } })); snooze('deload', 35); setTick((t) => t + 1); }}>Activar</button>}
              {!r.persistent && <button className="shrink-0 rounded-full p-1 text-slate-500 active:scale-90" onClick={() => dismiss(r.id)} aria-label="Descartar aviso"><X size={14} /></button>}
            </div>
            {expanded && <p className="mt-1.5 pl-6 text-xs text-slate-400">{r.text}</p>}
          </div>
        );
      })}
    </div>
  );
}
