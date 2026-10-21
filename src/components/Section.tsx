import { ChevronDown } from 'lucide-react';
import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cx } from '../lib/utils';

/** Panel de acordeón controlado: el padre decide cuál está abierto (solo uno a la vez). */
export function Section({ id, icon: Icon, title, hint, open, onToggle, children }: { id?: string; icon?: LucideIcon; title: string; hint?: string; open: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <div id={id} className="card !p-0 overflow-hidden scroll-mt-4">
      <button onClick={onToggle} aria-expanded={open} className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left">
        <span className="flex items-center gap-3">
          {Icon && <Icon size={20} strokeWidth={1.5} className="shrink-0 text-accent" />}
          <span>
            <span className="block font-bold text-white">{title}</span>
            {hint && !open && <span className="block text-xs text-slate-500">{hint}</span>}
          </span>
        </span>
        <ChevronDown size={18} className={cx('shrink-0 text-slate-400 transition-transform', open && 'rotate-180')} />
      </button>
      {open && <div className="space-y-3 border-t border-slate-800 px-4 pb-4 pt-3">{children}</div>}
    </div>
  );
}
