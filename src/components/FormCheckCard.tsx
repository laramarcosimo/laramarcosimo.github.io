import { Check, Search, Video } from 'lucide-react';
import { useState } from 'react';
import { useStore } from '../lib/store';
import type { Location } from '../lib/types';
import { cx, norm } from '../lib/utils';
import { VideoFormCheck } from './VideoFormCheck';
import { Hint } from './Hint';

const KEY = 'apex-formcheck-ex';

/** Acceso a «Revisar técnica con vídeo» desde la página de Entreno: buscas el ejercicio y grabas o subes el clip. */
export function FormCheckCard({ location }: { location: Location }) {
  const { state } = useStore();
  const sorted = [...state.exercises].sort((a, b) => a.name.localeCompare(b.name, 'es'));
  const [sel, setSel] = useState(() => {
    try {
      return localStorage.getItem(KEY) ?? '';
    } catch {
      return '';
    }
  });
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const current = sorted.find((e) => e.id === sel);
  const nq = norm(q);
  const matches = nq ? sorted.filter((e) => norm(`${e.name} ${e.muscleGroup} ${e.equipment}`).includes(nq)).slice(0, 8) : [];

  const pick = (id: string) => {
    setSel(id);
    setQ('');
    try {
      localStorage.setItem(KEY, id);
    } catch {
      /* noop */
    }
  };

  return (
    <div className="card space-y-3">
      <div>
        <div className="flex items-center gap-2 font-bold text-white"><Video size={18} strokeWidth={1.5} className="text-accent" /> Revisar técnica con vídeo</div>
        <Hint className="mt-1 text-xs text-slate-400">Graba 5-15 s (3-4 repeticiones) de perfil o en diagonal y el coach te corrige la técnica, cuidando tus rodillas. También lo tienes con el icono de vídeo dentro de cada ejercicio de un entreno en curso.</Hint>
      </div>

      <div className="relative">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input className="field !pl-9" placeholder="Busca el ejercicio (sentadilla, press, remo…)" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar ejercicio" />
      </div>
      {q && (
        <div className="space-y-1">
          {matches.length === 0 && <p className="px-1 text-sm text-slate-500">Ningún ejercicio coincide con «{q}».</p>}
          {matches.map((e) => (
            <button key={e.id} className={cx('flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left active:scale-[0.99]', e.id === current?.id ? 'bg-accent/20' : 'bg-slate-800')} onClick={() => pick(e.id)}>
              <span className="min-w-0"><span className="block truncate text-sm font-semibold text-white">{e.name}</span><span className="block text-[11px] text-slate-400">{e.muscleGroup} · {e.equipment}</span></span>
              {e.id === current?.id && <Check size={16} className="shrink-0 text-accent" />}
            </button>
          ))}
        </div>
      )}
      {!q && (
        <div className="flex items-center justify-between rounded-xl bg-slate-800 px-3 py-2.5 text-sm">
          {current ? <span className="min-w-0 truncate text-white"><span className="text-slate-400">Ejercicio: </span><b>{current.name}</b></span> : <span className="text-slate-400">Busca y elige un ejercicio</span>}
        </div>
      )}

      <button className="btn btn-blue w-full" disabled={!current} onClick={() => setOpen(true)}><Video size={18} strokeWidth={1.75} /> Revisar técnica con vídeo</button>
      {open && current && <VideoFormCheck exercise={current} location={location} onClose={() => setOpen(false)} />}
    </div>
  );
}
