import { useKeyboardPin, useVisibleArea } from '../lib/viewport';
import { X } from 'lucide-react';
import { useScrollLock } from '../lib/scrollLock';
import { useEffect, useState, type ReactNode } from 'react';
import { cx, num } from '../lib/utils';
import { LayoutGrid } from 'lucide-react';
import { useLayoutEdit } from '../lib/layoutEdit';
import { ThemeToggle } from './ThemeToggle';

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useScrollLock();
  const { typing, handlers, justFocused } = useKeyboardPin();
  const area = useVisibleArea(typing); // al escribir, la hoja sube arriba para que el teclado no la tape
  return (
    <div className={cx('fixed inset-0 z-[60] flex justify-center', typing ? 'items-start' : 'items-end')} style={typing && area ? { top: area.top, height: area.height, bottom: 'auto' } : undefined} onClick={() => { if (!justFocused()) onClose(); }} {...handlers}>
      <div className="modal-backdrop absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className={cx('relative w-full max-w-xl overflow-y-auto overscroll-contain border-slate-700 bg-slate-900 p-5', typing ? cx('pb-safe rounded-b-3xl border-b', area ? 'max-h-[calc(100%-env(safe-area-inset-top))]' : 'max-h-[47dvh]') : 'pb-safe max-h-[88dvh] rounded-t-3xl border-t')}
        style={typing ? { marginTop: 'env(safe-area-inset-top)' } : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-white">{title}</h3>
          <button className="rounded-full bg-slate-800 p-2" onClick={onClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Bar({ value, max, color = 'bg-accent' }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-800">
      <div className={cx('h-full rounded-full transition-all duration-500', color)} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-6 text-slate-300">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-600 border-t-fuel" />
      {label && <span className="text-sm">{label}</span>}
    </div>
  );
}

export function ErrorBox({ msg }: { msg: string }) {
  // Cancelar a propósito no es un fallo: se muestra en neutro.
  if (/^Cancelado/.test(msg)) return <div className="rounded-xl bg-slate-800 p-3 text-sm text-slate-300">Cancelado. No se ha cambiado nada.</div>;
  return <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{msg}</div>;
}

export function Title({ children, sub }: { children: ReactNode; sub?: string }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-extrabold text-white">{children}</h1>
        {sub && <p className="text-sm text-slate-400">{sub}</p>}
      </div>
      <div className="flex items-center gap-2">
        <EditToggle />
        <ThemeToggle />
      </div>
    </div>
  );
}

export function Stat({ label, value, unit }: { label: string; value: string | number; unit?: string }) {
  return (
    <div className="rounded-xl bg-slate-800 p-3 text-center">
      <div className="text-xl font-bold text-white">
        {value}
        {unit && <span className="ml-0.5 text-xs font-medium text-slate-400">{unit}</span>}
      </div>
      <div className="text-[11px] uppercase tracking-wide text-slate-400">{label}</div>
    </div>
  );
}

export function MacroPill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex-1 rounded-xl bg-slate-800 p-2 text-center">
      <div className={cx('text-lg font-bold', color)}>{value}<span className="text-xs">g</span></div>
      <div className="text-[11px] uppercase text-slate-400">{label}</div>
    </div>
  );
}

/** Input numérico con teclado decimal de iOS; admite escribir "7." o "7,5" sin perder el cursor. */
/** Número con decimales flexibles: acepta «55,6» y «55.6» (teclado decimal de iOS), guarda 55.6 y limita a 2 decimales. */
export function NumInput({ value, onChange, className, placeholder, decimal = true, label }: { value: number; onChange: (n: number) => void; className?: string; placeholder?: string; decimal?: boolean; label?: string }) {
  const [txt, setTxt] = useState(value ? String(value) : '');
  useEffect(() => {
    setTxt((t) => (num(t) === value ? t : value ? String(value) : ''));
  }, [value]);
  return (
    <input
      type="text"
      inputMode={decimal ? 'decimal' : 'numeric'}
      pattern={decimal ? '[0-9]*[.,]?[0-9]*' : '[0-9]*'}
      autoComplete="off"
      aria-label={label}
      placeholder={placeholder ?? (decimal ? '0.0' : undefined)}
      className={className}
      value={txt}
      onFocus={(e) => e.target.select()}
      onChange={(e) => {
        let v = e.target.value.replace(decimal ? /[^0-9.,]/g : /[^0-9]/g, '');
        const i = v.search(/[.,]/);
        if (i >= 0) v = (v.slice(0, i + 1) + v.slice(i + 1).replace(/[.,]/g, '')).replace(/([.,]\d{2})\d+/, '$1'); // un solo separador y máx. 2 decimales
        setTxt(v);
        onChange(num(v.replace(',', '.')));
      }}
    />
  );
}

/** Activa el modo «Ordenar» de la página actual. */
export function EditToggle() {
  const { editing, setEditing } = useLayoutEdit();
  return (
    <button onClick={() => setEditing(!editing)} aria-label="Ordenar bloques" aria-pressed={editing} className={cx('rounded-full p-2.5 active:scale-90', editing ? 'bg-accent text-white' : 'bg-slate-800 text-slate-300')}>
      <LayoutGrid size={18} strokeWidth={1.5} />
    </button>
  );
}
