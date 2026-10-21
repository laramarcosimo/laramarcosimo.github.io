import { Check, Copy, Download, Loader2, Minus, Plus, Send, ShoppingBasket, Sparkles, ThumbsDown, Trash2, Wand2, X } from 'lucide-react';
import { useState } from 'react';
import { suggestShoppingIdeas, type ShoppingIdea } from '../lib/gemini';
import { weekContext } from '../lib/nutriWeek';
import { addToPantry } from '../lib/pantry';
import { storeList } from '../lib/stores';
import { useStore } from '../lib/store';
import { cx, looseMatch, uid } from '../lib/utils';
import { ImportModal } from './ShoppingImport';
import { Hint } from './Hint';
import { ProductThumb } from './ProductThumb';

const SHORTCUT_NAME = 'Compra a Recordatorios';

/** Lista de la compra: sugiere lo que falta, se copia/comparte o se envía a Recordatorios con un Atajo. */
export function ShoppingList() {
  const { state, update, removeWithUndo } = useStore();
  const [name, setName] = useState('');
  const [importing, setImporting] = useState(false);
  const [msg, setMsg] = useState('');
  const [ideas, setIdeas] = useState<ShoppingIdea[]>([]);
  const [skipped, setSkipped] = useState<string[]>([]); // ideas ya descartadas: no se repiten
  const [ideasBusy, setIdeasBusy] = useState(false);
  const [ideasErr, setIdeasErr] = useState('');
  const list = state.shopping;
  const text = list.map((i) => (i.qty > 1 ? `${i.name} x${i.qty}` : i.name)).join('\n');
  const flash = (m: string) => {
    setMsg(m);
    setTimeout(() => setMsg(''), 2200);
  };

  const add = (n: string, qty = 1) =>
    update((s) => (s.shopping.some((i) => looseMatch(i.name, n)) ? s : { ...s, shopping: [...s.shopping, { id: uid(), name: n, qty }] }));

  const suggest = () => {
    const low = state.pantry.filter((p) => p.qty <= 1 && !list.some((i) => looseMatch(i.name, p.name)));
    if (low.length === 0) return flash('No hay nada que se esté acabando.');
    update((s) => ({ ...s, shopping: [...s.shopping, ...low.map((p) => ({ id: uid(), name: p.name, qty: 2 }))] }));
  };

  const askIdeas = async () => {
    setIdeasBusy(true);
    setIdeasErr('');
    try {
      const recent = [...new Set(state.meals.slice(-30).map((m) => m.plato))].slice(-15);
      setIdeas(await suggestShoppingIdeas(state.settings, { despensa: state.pantry.map((p) => p.name), lista: list.map((i) => i.name), ultimasComidas: recent, noLeGusta: state.dislikes, descartadas: skipped, semana: weekContext(state) }, storeList(state.defaultSupermarket, state.supermarkets), state.defaultSupermarket));
    } catch (e) {
      setIdeasErr(e instanceof Error ? e.message : 'No se pudieron generar ideas.');
    } finally {
      setIdeasBusy(false);
    }
  };
  const dropIdea = (n: string) => {
    setIdeas((c) => c.filter((x) => x.nombre !== n));
    setSkipped((c) => [...c, n]);
  };
  const dislike = (n: string) => {
    update((s) => (s.dislikes.some((d) => d.toLowerCase() === n.toLowerCase()) ? s : { ...s, dislikes: [...s.dislikes, n] }));
    dropIdea(n);
    flash(`«${n}» guardado en «Alimentos que no me gustan» (Ajustes)`);
  };

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-bold text-white"><ShoppingBasket size={18} strokeWidth={1.5} className="text-accent" /> Lista de la compra</h3>
        <button className="text-sm font-semibold text-fuel" onClick={() => setImporting(true)}><Download size={14} className="inline" /> Importar</button>
      </div>

      <div className="flex gap-2">
        <input className="field" placeholder="Añadir a la lista…" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) { add(name.trim()); setName(''); } }} />
        <button className="btn btn-ghost" disabled={!name.trim()} onClick={() => { add(name.trim()); setName(''); }} aria-label="Añadir"><Plus size={18} /></button>
      </div>
      <button className="btn btn-ghost w-full !py-2" onClick={suggest}><Wand2 size={16} strokeWidth={1.75} /> Sugerir lo que se acaba</button>

      <button className="btn btn-ghost w-full !py-2 text-accent" disabled={ideasBusy} onClick={() => void askIdeas()}>{ideasBusy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} strokeWidth={1.75} />} {ideas.length ? 'Otras ideas nuevas' : 'Ideas nuevas: qué más añadir'}</button>
      {ideasErr && <p className="rounded-lg bg-red-500/10 p-2 text-xs text-red-400">{ideasErr}</p>}
      {ideas.length > 0 && (
        <div className="space-y-1.5 rounded-xl bg-violet-500/10 p-2">
          <div className="text-[11px] font-semibold uppercase text-violet-300">Ideas de la IA: tú decides</div>
          {ideas.map((i) => (
            <div key={i.nombre} className="rounded-lg border border-violet-500/40 bg-slate-900 p-2">
              <div className="text-sm font-semibold text-white">{i.nombre}{i.tipo === 'utensilio' && <span className="ml-1.5 rounded bg-slate-700 px-1.5 py-0.5 align-middle text-[10px] font-normal text-slate-300">utensilio</span>}</div>
              <div className="text-xs text-slate-300">{i.motivo}</div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                <button className="flex items-center gap-1 rounded-full bg-violet-600 px-3 py-1 text-xs font-semibold text-white active:scale-95" onClick={() => { add(i.nombre); dropIdea(i.nombre); }}><Plus size={12} /> Añadir a la lista</button>
                <button className="flex items-center gap-1 rounded-full bg-slate-700 px-3 py-1 text-xs font-semibold text-slate-100 active:scale-95" onClick={() => dropIdea(i.nombre)}><X size={12} /> No ahora</button>
                {i.tipo === 'alimento' && <button className="flex items-center gap-1 rounded-full bg-red-500/20 px-3 py-1 text-xs font-semibold text-red-400 active:scale-95" onClick={() => dislike(i.nombre)}><ThumbsDown size={12} /> No me gusta</button>}
              </div>
            </div>
          ))}
        </div>
      )}

      {list.length === 0 && <p className="text-sm text-slate-500">Tu lista está vacía.</p>}
      <div className="space-y-1.5">
        {list.map((i) => (
          <div key={i.id} className="flex items-center gap-2 rounded-xl bg-slate-800 px-3 py-2">
            <button className="shrink-0 rounded-lg bg-emerald-600 p-1.5 text-white" onClick={() => update((s) => ({ ...s, shopping: s.shopping.filter((x) => x.id !== i.id), pantry: addToPantry(s.pantry, [{ name: i.name, qty: i.qty, store: s.defaultSupermarket }]) }))} aria-label={`Comprado: ${i.name}`}><Check size={15} strokeWidth={2.2} /></button>
            <ProductThumb name={i.name} size={32} />
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-white">{i.name}</span>
            <button className="rounded-lg bg-slate-900 p-1.5" onClick={() => update((s) => ({ ...s, shopping: s.shopping.map((x) => (x.id === i.id ? { ...x, qty: Math.max(1, x.qty - 1) } : x)) }))} aria-label="Menos"><Minus size={13} /></button>
            <span className="w-5 text-center text-sm tabular-nums text-white">{i.qty}</span>
            <button className="rounded-lg bg-slate-900 p-1.5" onClick={() => update((s) => ({ ...s, shopping: s.shopping.map((x) => (x.id === i.id ? { ...x, qty: x.qty + 1 } : x)) }))} aria-label="Más"><Plus size={13} /></button>
            <button className="p-1 text-slate-500" onClick={() => removeWithUndo(`«${i.name}» quitado`, (s) => ({ ...s, shopping: s.shopping.filter((x) => x.id !== i.id) }))} aria-label={`Quitar ${i.name}`}><Trash2 size={14} /></button>
          </div>
        ))}
      </div>
      {list.length > 1 && <button className="btn btn-ghost w-full" onClick={() => { const n = list.length; update((s) => ({ ...s, shopping: [], pantry: addToPantry(s.pantry, s.shopping.map((i) => ({ name: i.name, qty: i.qty, store: s.defaultSupermarket }))) })); flash(`${n} productos pasados a la despensa`); }}><Check size={15} /> Todo comprado → a la despensa</button>}
      {list.length > 0 && <Hint className="text-[11px] text-slate-500">El check verde marca «comprado»: lo suma a tu despensa y lo quita de la lista.</Hint>}

      {list.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          <button className="btn btn-ghost !px-2 !py-2 text-xs" onClick={async () => { try { await navigator.clipboard.writeText(text); flash('Lista copiada'); } catch { flash('No se pudo copiar'); } }}><Copy size={14} strokeWidth={1.75} /> Copiar</button>
          <button className="btn btn-ghost !px-2 !py-2 text-xs" onClick={async () => { try { if (navigator.share) await navigator.share({ title: 'Lista de la compra', text }); else flash('Compartir no disponible'); } catch { /* cancelado */ } }}><Send size={14} strokeWidth={1.75} /> Compartir</button>
          <button className="btn btn-blue !px-2 !py-2 text-xs" onClick={() => { window.location.href = `shortcuts://run-shortcut?name=${encodeURIComponent(SHORTCUT_NAME)}&input=text&text=${encodeURIComponent(text)}`; }}>A Recordatorios</button>
        </div>
      )}
      {msg && <p className={cx('text-xs font-semibold', 'text-emerald-500')}>{msg}</p>}
      {importing && <ImportModal onClose={() => setImporting(false)} />}
    </div>
  );
}
