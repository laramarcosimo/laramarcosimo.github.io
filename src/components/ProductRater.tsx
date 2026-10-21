import { Plus, Sparkles, X } from 'lucide-react';
import { useState } from 'react';
import { rateProduct, type ProductRating } from '../lib/gemini';
import { findProductImage } from '../lib/openfood';
import { useStore } from '../lib/store';
import { storeList } from '../lib/stores';
import { uid } from '../lib/utils';
import { ErrorBox, Spinner } from './ui';

export interface RateInput {
  name: string;
  brand: string;
  kcal: number;
  protein: number;
  carbs: number;
  sugars: number;
  fat: number;
  satFat: number;
  fiber: number;
  salt: number;
}

/** «¿Es buena opción?»: valoración con IA de un producto (por 100 g) y, si es mejorable, alternativas en tu supermercado con foto y enlace. */
export function ProductRater({ prod }: { prod: RateInput }) {
  const { state, update } = useStore();
  const [rating, setRating] = useState<ProductRating | null>(null);
  const [altImg, setAltImg] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [added, setAdded] = useState('');

  const rate = async () => {
    setBusy(true);
    setErr('');
    try {
      const r = await rateProduct(state.settings, { nombre: prod.name, marca: prod.brand, kcal: prod.kcal, protein: prod.protein, carbs: prod.carbs, sugars: prod.sugars, fat: prod.fat, satFat: prod.satFat, fiber: prod.fiber, salt: prod.salt }, storeList(state.defaultSupermarket, state.supermarkets), state.defaultSupermarket);
      setRating(r);
      setAltImg({});
      for (const a of r.alternativas) void findProductImage(`${a.nombre} ${a.marca}`.trim(), a.tienda || state.defaultSupermarket).then((u) => u && setAltImg((c) => ({ ...c, [a.nombre]: u })));
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'No se pudo valorar el producto.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <button className="btn btn-ghost w-full" disabled={busy} onClick={() => void rate()}><Sparkles size={16} /> ¿Es buena opción? Valorar con IA</button>
      {busy && <Spinner label="Valorando el producto…" />}
      {err && <ErrorBox msg={err} />}
      {added && <p className="text-xs font-semibold text-emerald-500">{added}</p>}
      {rating && (
        <div className={rating.veredicto === 'buena' ? 'space-y-2 rounded-xl bg-emerald-500/15 p-3 text-sm' : rating.veredicto === 'aceptable' ? 'space-y-2 rounded-xl bg-amber-500/15 p-3 text-sm' : 'space-y-2 rounded-xl bg-red-500/15 p-3 text-sm'}>
          <div className="flex items-center justify-between gap-2 font-bold text-white"><span>{rating.veredicto === 'buena' ? 'Buena opción' : rating.veredicto === 'aceptable' ? 'No está mal' : 'Mejorable'}</span><button onClick={() => setRating(null)} aria-label="Cerrar valoración"><X size={14} /></button></div>
          <p className="text-slate-200">{rating.motivo}</p>
          {rating.alternativas.length > 0 && <div className="text-xs font-semibold uppercase text-slate-300">La próxima vez, mejor en {state.defaultSupermarket || 'tu supermercado'}:</div>}
          {rating.alternativas.map((a) => (
            <div key={a.nombre} className="flex items-start gap-2 rounded-lg bg-slate-900 p-2">
              {altImg[a.nombre] ? <img src={altImg[a.nombre]} alt="" className="h-14 w-14 shrink-0 rounded-lg bg-white object-contain" /> : <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-[10px] text-slate-500">sin foto</div>}
              <div className="min-w-0 flex-1 text-xs">
                <div className="font-semibold text-white">{a.nombre}{a.marca ? ` · ${a.marca}` : ''}</div>
                <div className="text-slate-300">{a.porque}</div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <a className="rounded-full bg-slate-700 px-2.5 py-1 font-semibold text-slate-100" href={`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(`${a.nombre} ${a.marca} ${a.tienda || state.defaultSupermarket}`.trim())}`} target="_blank" rel="noopener noreferrer">Ver fotos en internet</a>
                  <button className="flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 font-semibold text-white" onClick={() => { update((s) => ({ ...s, shopping: s.shopping.some((x) => x.name.toLowerCase() === a.nombre.toLowerCase()) ? s.shopping : [...s.shopping, { id: uid(), name: a.marca ? `${a.nombre} (${a.marca})` : a.nombre, qty: 1 }] })); setAdded('Añadido a la lista de la compra'); }}><Plus size={12} /> A la lista de la compra</button>
                </div>
              </div>
            </div>
          ))}
          <p className="text-[11px] text-slate-400">Es una valoración orientativa de la IA; las marcas y productos de cada tienda cambian, compruébalo en la estantería.</p>
        </div>
      )}
    </div>
  );
}
