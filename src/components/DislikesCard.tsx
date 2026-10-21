import { ChevronDown, ThumbsDown } from 'lucide-react';
import { useState } from 'react';
import { useStore } from '../lib/store';
import { cx } from '../lib/utils';
import { DislikesEditor } from './DislikesEditor';

/** Alimentos que no te gustan, siempre a la vista en Nutrición: la IA nunca los propone y se descartan las opciones que los lleven. */
export function DislikesCard() {
  const { state } = useStore();
  const [open, setOpen] = useState(false);
  const n = state.dislikes.length;
  return (
    <div className="card !p-3">
      <button className="flex w-full items-center gap-2 text-left" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <ThumbsDown size={16} className="shrink-0 text-red-400" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-white">Alimentos que no me gustan ({n})</span>
          <span className="block truncate text-[11px] text-slate-400">{n ? state.dislikes.slice(0, 6).join(', ') + (n > 6 ? '…' : '') : 'Añade los que no quieras ver en las sugerencias.'}</span>
        </span>
        <ChevronDown size={16} className={cx('shrink-0 text-slate-500 transition-transform', open && 'rotate-180')} />
      </button>
      {open && <div className="mt-3"><DislikesEditor /></div>}
    </div>
  );
}
