import { ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { useStore } from '../lib/store';
import { DoubleReadToggle } from './DoubleReadToggle';

/** Opciones del análisis por foto, recogidas: descripción del plato y doble lectura. Cerradas por defecto para no ocupar sitio. */
export function AnalysisOptions({ note, setNote, busy }: { note: string; setNote: (v: string) => void; busy: boolean }) {
  const { state } = useStore();
  const [open, setOpen] = useState(false);
  const active = note.trim().length > 0 || !!state.settings.doubleRead;
  return (
    <div className="space-y-2">
      <button type="button" className="flex w-full items-center justify-center gap-1 py-1 text-xs font-semibold text-slate-400" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />} Contar qué lleva el plato (opcional){active && !open ? ' · activo' : ''}
      </button>
      {open && (
        <div className="space-y-2">
          <textarea value={note} onChange={(e) => setNote(e.target.value.slice(0, 400))} rows={2} disabled={busy} aria-label="Describe qué lleva el plato (opcional)" placeholder="Ej: 150 g de pollo a la plancha, arroz con aceite de oliva… La IA lo tiene en cuenta al analizar la foto." className="w-full resize-none rounded-xl bg-slate-800 px-3 py-2 text-white outline-none ring-1 ring-slate-700 placeholder:text-slate-500 focus:ring-accent" />
          <DoubleReadToggle />
        </div>
      )}
    </div>
  );
}
