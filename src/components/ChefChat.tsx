import { Check, Loader2, Send } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { goalContext } from '../lib/coach';
import { askChef, type ChefAdd, type ChefChange, type ChefTurn, type FoodItemInput } from '../lib/gemini';
import { dayBalance } from '../lib/metabolic';
import { useStore } from '../lib/store';
import { Modal } from './ui';
import { cx } from '../lib/utils';

const CHIPS_DISH = ['¿Cuántas unidades y cucharadas pongo para cuadrar mis macros de hoy?', '¿Cómo lo hago más ligero sin perder proteína?'];
const CHIPS_GENERAL = ['¿Qué me falta hoy para llegar a mis macros?', 'Dame una idea rápida para la próxima comida', '¿Qué puedo picar si tengo hambre?'];

/** Chat con la nutricionista/chef. Con un plato en preparación, propone cantidades concretas que se aplican con un toque. */
export function ChefChat({ items, plato, onApply, onAdd, onClose }: { items?: FoodItemInput[]; plato?: string; onApply?: (c: ChefChange[]) => void; onAdd?: (a: ChefAdd[]) => void; onClose: () => void }) {
  const { state } = useStore();
  const [turns, setTurns] = useState<ChefTurn[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [applied, setApplied] = useState<number | null>(null);
  const [added, setAdded] = useState<string[]>([]);
  const endRef = useRef<HTMLDivElement>(null);
  const dish = items?.filter((x) => x.nombre.trim()) ?? null;

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [turns, busy]);

  const send = async (q: string) => {
    const text = q.trim();
    if (!text || busy) return;
    const next: ChefTurn[] = [...turns, { role: 'user', text }];
    setTurns(next);
    setInput('');
    setBusy(true);
    setErr('');
    try {
      const b = dayBalance(state);
      const contexto = `${goalContext(state, b)}${plato ? ` Plato: «${plato}».` : ''}`;
      const a = await askChef(state.settings, text, { contexto, plato: dish, noLeGusta: state.dislikes, despensa: state.pantry.filter((p) => p.qty > 0).map((p) => p.name) }, turns);
      setTurns([...next, { role: 'chef', text: a.respuesta, cambios: a.cambios, anadir: a.anadir }]);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'No se pudo consultar.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={dish ? 'Preguntar sobre este plato' : 'Coach de nutrición'} onClose={onClose}>
      <div className="space-y-3">
        <div className="max-h-[42dvh] space-y-2 overflow-y-auto overscroll-contain">
          {turns.length === 0 && (
            <p className="text-sm text-slate-400">{dish ? 'Cuéntale cómo es el plato (marcas, tamaños, salsa…) y pregunta qué cantidades poner. Sabe lo que te queda hoy de kcal, proteína, carbohidratos y grasa.' : 'Pregunta lo que quieras de tu alimentación de hoy. Sabe lo que te queda de kcal y de cada macro.'}</p>
          )}
          {turns.map((t, i) => (
            <div key={i} className={cx('max-w-[92%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm', t.role === 'user' ? 'ml-auto bg-accent text-white' : 'bg-slate-800 text-slate-100')}>
              {t.text}
              {t.role === 'chef' && t.cambios && t.cambios.length > 0 && onApply && dish && (
                <div className="mt-2 space-y-1 border-t border-slate-700 pt-2">
                  {t.cambios.map((c) => <div key={c.indice} className="text-xs text-slate-300">• {dish[c.indice]?.nombre}: <b className="text-white">{c.cantidad} {c.unidad}</b></div>)}
                  <button className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-xl bg-emerald-500 py-2 text-xs font-bold text-white active:scale-95" onClick={() => { onApply(t.cambios!); setApplied(i); }}>
                    {applied === i ? <><Check size={14} /> Aplicado en el plato</> : 'Aplicar estas cantidades'}
                  </button>
                </div>
              )}
              {t.role === 'chef' && t.anadir && t.anadir.length > 0 && onAdd && (
                <div className="mt-2 space-y-1.5 border-t border-slate-700 pt-2">
                  <div className="text-[10px] font-semibold uppercase text-slate-400">Añadir al plato</div>
                  {t.anadir.map((a) => {
                    const done = added.includes(a.nombre.toLowerCase());
                    return (
                      <button key={a.nombre} disabled={done} className="flex w-full items-center justify-between gap-2 rounded-xl bg-slate-900 px-3 py-2 text-left text-xs font-semibold text-slate-100 active:scale-95 disabled:opacity-60" onClick={() => { onAdd([a]); setAdded((l) => [...l, a.nombre.toLowerCase()]); }}>
                        <span className="min-w-0 flex-1 break-words">{a.nombre} · <b className="text-white">{a.cantidad} {a.unidad}</b></span>
                        <span className="shrink-0 text-emerald-400">{done ? <Check size={14} /> : '+ Añadir'}</span>
                      </button>
                    );
                  })}
                  {t.anadir.length > 1 && t.anadir.some((a) => !added.includes(a.nombre.toLowerCase())) && (
                    <button className="w-full rounded-xl bg-emerald-500 py-2 text-xs font-bold text-white active:scale-95" onClick={() => { const rest = t.anadir!.filter((a) => !added.includes(a.nombre.toLowerCase())); onAdd(rest); setAdded((l) => [...l, ...rest.map((a) => a.nombre.toLowerCase())]); }}>Añadir todos</button>
                  )}
                </div>
              )}
            </div>
          ))}
          {busy && <div className="flex items-center gap-2 text-sm text-slate-400"><Loader2 size={14} className="animate-spin" /> Pensando…</div>}
          {err && <div className="rounded-xl bg-red-500/10 p-2 text-xs text-red-400">{err}</div>}
          <div ref={endRef} />
        </div>
        {turns.length === 0 && (
          <div className="flex flex-wrap gap-1.5">
            {(dish ? CHIPS_DISH : CHIPS_GENERAL).map((c) => <button key={c} className="rounded-full bg-slate-800 px-3 py-1.5 text-left text-xs font-semibold text-slate-200 active:scale-95" disabled={busy} onClick={() => void send(c)}>{c}</button>)}
          </div>
        )}
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void send(input); }}>
          <input className="field !py-2.5" placeholder={dish ? 'Ej: las albóndigas son de Mercadona…' : 'Pregunta al Coach…'} value={input} enterKeyHint="send" onChange={(e) => setInput(e.target.value)} />
          <button type="submit" className="btn btn-blue shrink-0 !px-4" disabled={busy || !input.trim()} aria-label="Enviar"><Send size={16} /></button>
        </form>
      </div>
    </Modal>
  );
}
