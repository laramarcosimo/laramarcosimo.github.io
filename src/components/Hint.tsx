import { Info } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useStore } from '../lib/store';
import { cx } from '../lib/utils';

/**
 * Texto explicativo: en modo «cortos» (por defecto) se ve solo la primera línea y se despliega al tocarlo;
 * en modo «detallados» (Ajustes) se ve completo siempre.
 */
export function Hint({ className, children }: { className?: string; children: ReactNode }) {
  const { state } = useStore();
  const [open, setOpen] = useState(false);
  if (state.settings.hideHints && !open) return <button className="p-0.5 text-slate-500" onClick={() => setOpen(true)} aria-label="Ver explicación"><Info size={16} /></button>;
  if (state.settings.hideHints) return <p className={className} style={{ display: 'block' }} onClick={() => setOpen(false)}>{children}</p>;
  const detailed = state.settings.textMode === 'detailed';
  if (detailed || open) return <p className={className} onClick={detailed ? undefined : () => setOpen(false)}>{children}</p>;
  return (
    <p className={cx(className, 'line-clamp-1 cursor-pointer')} onClick={() => setOpen(true)} title="Toca para ver el texto completo">
      {children}
    </p>
  );
}
