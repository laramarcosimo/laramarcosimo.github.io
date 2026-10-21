import { ArrowDown, ArrowUp, Check, Eye, EyeOff, RotateCcw } from 'lucide-react';
import type { ReactNode } from 'react';
import { useLayoutEdit } from '../lib/layoutEdit';
import { useStore } from '../lib/store';
import { cx } from '../lib/utils';

/**
 * Bloques reordenables de una página. Con el modo «Ordenar» activo cada bloque muestra flechas
 * para subirlo o bajarlo; el orden se guarda por página.
 */
export function Blocks({ page, items, replaces }: { page: string; items: Record<string, ReactNode>; replaces?: Record<string, string[]> }) {
  const { state, update } = useStore();
  const { editing, setEditing } = useLayoutEdit();
  const hidden = state.layoutHidden[page] ?? [];
  const present = Object.keys(items).filter((k) => items[k]);
  const saved = (state.layout[page] ?? []).flatMap((k) => replaces?.[k] ?? [k]).filter((k) => present.includes(k));
  const all = [...saved, ...present.filter((k) => !saved.includes(k))];
  // Fuera del modo Ordenar los bloques ocultos no se ven; dentro se muestran atenuados para poder recuperarlos.
  const order = editing ? all : all.filter((k) => !hidden.includes(k));
  const toggleHidden = (k: string) =>
    update((s) => {
      const cur = s.layoutHidden[page] ?? [];
      return { ...s, layoutHidden: { ...s.layoutHidden, [page]: cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k] } };
    });

  const move = (k: string, d: -1 | 1) => {
    const i = order.indexOf(k);
    const j = i + d;
    if (j < 0 || j >= order.length) return;
    const next = [...order];
    [next[i], next[j]] = [next[j], next[i]];
    update((s) => ({ ...s, layout: { ...s.layout, [page]: next } }));
  };
  const reset = () =>
    update((s) => {
      const layout = { ...s.layout };
      const layoutHidden = { ...s.layoutHidden };
      delete layout[page];
      delete layoutHidden[page];
      return { ...s, layout, layoutHidden };
    });

  return (
    <>
      {editing && (
        <div className="flex items-center justify-between gap-2 rounded-2xl border border-accent/40 bg-accent/10 p-3 text-sm text-slate-200">
          <span>Flechas para ordenar; el ojo oculta o muestra un bloque.</span>
          <span className="flex shrink-0 gap-1.5">
            <button className="rounded-lg bg-slate-800 p-2" onClick={reset} aria-label="Restablecer orden"><RotateCcw size={16} strokeWidth={1.75} /></button>
            <button className="btn btn-blue !px-3 !py-2" onClick={() => setEditing(false)}><Check size={16} strokeWidth={2} /> Listo</button>
          </span>
        </div>
      )}
      {order.map((k, i) => (
        <div key={k} className={cx('relative', editing && 'rounded-2xl outline-dashed outline-2 outline-offset-2 outline-accent/50')}>
          <div className={cx(editing && 'pointer-events-none select-none', editing && hidden.includes(k) ? 'opacity-40' : editing && 'opacity-90')}>{items[k]}</div>
          {editing && (
            <div className="absolute -top-3 right-3 z-10 flex gap-1.5">
              <button className={cx('rounded-full p-2 shadow-lg ring-1', hidden.includes(k) ? 'bg-accent text-white ring-accent' : 'bg-slate-900 text-white ring-slate-600')} onClick={() => toggleHidden(k)} aria-label={hidden.includes(k) ? 'Mostrar bloque' : 'Ocultar bloque'} aria-pressed={hidden.includes(k)}>{hidden.includes(k) ? <EyeOff size={16} strokeWidth={2} /> : <Eye size={16} strokeWidth={2} />}</button>
              <button className="rounded-full bg-slate-900 p-2 text-white shadow-lg ring-1 ring-slate-600 disabled:opacity-30" disabled={i === 0} onClick={() => move(k, -1)} aria-label="Subir bloque"><ArrowUp size={16} strokeWidth={2} /></button>
              <button className="rounded-full bg-slate-900 p-2 text-white shadow-lg ring-1 ring-slate-600 disabled:opacity-30" disabled={i === order.length - 1} onClick={() => move(k, 1)} aria-label="Bajar bloque"><ArrowDown size={16} strokeWidth={2} /></button>
            </div>
          )}
        </div>
      ))}
    </>
  );
}
