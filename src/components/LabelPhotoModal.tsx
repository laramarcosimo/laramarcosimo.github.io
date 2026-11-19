import { Camera, Check, ImagePlus, Loader2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { UNIT_KEYS, UNIT_LABEL, type UnitKey } from '../lib/catalog';
import { readNutritionLabel } from '../lib/gemini';
import { compressToBase64 } from '../lib/image';
import { saveProduct } from '../lib/products';
import { useStore } from '../lib/store';
import { uid } from '../lib/utils';
import { ErrorBox, Modal, NumInput } from './ui';

interface V { kcal: number; protein: number; carbs: number; fat: number; fiber: number; sugars: number; satFat: number; salt: number }
const ZERO: V = { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugars: 0, satFat: 0, salt: 0 };
const STORES = ['Mercadona', 'HiperDino', 'Otro'];

/** Foto de la tabla nutricional: la IA la lee UNA vez, tú lo confirmas y queda guardado para siempre (sin volver a usar IA). */
export function LabelPhotoModal({ onClose, onSaved }: { onClose: () => void; onSaved: (name: string) => void }) {
  const { state, update } = useStore();
  const ref = useRef<HTMLInputElement>(null);
  const galRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [read, setRead] = useState(false);
  const [name, setName] = useState('');
  const [store, setStore] = useState('Mercadona');
  const [v, setV] = useState<V>(ZERO);
  const [serving, setServing] = useState(0);
  const [unit, setUnit] = useState<UnitKey>('unidad');
  const [w, setW] = useState(0);

  const onFile = async (f: File | undefined) => {
    if (ref.current) ref.current.value = '';
    if (galRef.current) galRef.current.value = '';
    if (!f) return;
    setBusy(true);
    setErr('');
    try {
      const r = await readNutritionLabel(state.settings, await compressToBase64(f, 1400, 0.9));
      setV({ kcal: r.kcal, protein: r.protein, carbs: r.carbs, fat: r.fat, fiber: r.fiber, sugars: r.sugars, satFat: r.satFat, salt: r.salt });
      setServing(r.serving);
      if (r.serving > 0 && w === 0) setW(r.serving);
      setRead(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'No se pudo leer la tabla.');
    } finally {
      setBusy(false);
    }
  };
  const save = () => {
    const n = name.trim();
    if (!n || !(v.kcal > 0)) {
      setErr('Pon el nombre del producto y revisa que las kcal estén bien.');
      return;
    }
    const id = uid();
    update((s) => {
      const s2 = saveProduct(s, { id, name: n, store, ...v, ...(serving > 0 ? { serving } : {}), ...(unit === 'unidad' && w > 0 ? { pack: w } : {}) });
      const saved = (s2.products ?? []).find((x) => x.name.toLowerCase() === n.toLowerCase() && !x.brand);
      if (!saved || !(w > 0)) return s2;
      const key = `s:${saved.id}`;
      return { ...s2, foodUnits: { ...s2.foodUnits, [key]: { ...s2.foodUnits?.[key], [unit]: w } } };
    });
    onSaved(n);
    onClose();
  };
  const F = ([['kcal', 'kcal'], ['protein', 'Proteína'], ['carbs', 'Hidratos'], ['fat', 'Grasas'], ['fiber', 'Fibra'], ['sugars', 'Azúcares']] as const);

  return (
    <Modal title="Foto de la tabla nutricional" onClose={onClose}>
      <div className="space-y-3">
        <input ref={ref} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />
        <input ref={galRef} type="file" accept="image/*" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />
        <div className="grid grid-cols-2 gap-2">
          <button className="btn btn-blue" disabled={busy} onClick={() => ref.current?.click()}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />} {read ? 'Otra foto' : 'Hacer foto'}</button>
          <button className="btn btn-ghost" disabled={busy} onClick={() => galRef.current?.click()}><ImagePlus size={16} /> Subir de galería</button>
        </div>
        <p className="text-[11px] text-slate-400">Con buena luz y la tabla recta. La IA la lee una sola vez; luego queda guardado y no se vuelve a usar.</p>
        {err && <ErrorBox msg={err} />}
        {read && (
          <div className="space-y-3">
            <div className="text-xs font-semibold text-amber-400">Revisa los números con el envase: si alguno está mal, corrígelo antes de guardar. Son valores por 100 g.</div>
            <input className="field" placeholder="Nombre (ej: Jamón cocido Hacendado)" value={name} onChange={(e) => setName(e.target.value)} aria-label="Nombre del producto" />
            <div className="flex gap-1.5">{STORES.map((s) => <button key={s} onClick={() => setStore(s)} aria-pressed={store === s} className={store === s ? 'rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-white' : 'rounded-full bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-400'}>{s}</button>)}</div>
            <div className="grid grid-cols-3 gap-1.5">
              {F.map(([k, l]) => <div key={k}><div className="text-[10px] uppercase text-slate-400">{l}</div><NumInput value={v[k]} label={`${l} por 100 g`} className="field !py-1.5 text-center text-xs" onChange={(n) => setV({ ...v, [k]: n })} /></div>)}
            </div>
            <div className="rounded-xl bg-slate-800 p-2.5">
              <div className="mb-1.5 text-[11px] text-slate-300">¿Cuánto pesa una unidad? (opcional, para sumar «2 lonchas» o «1 yogur»)</div>
              <div className="flex flex-wrap items-center gap-1.5">
                <select className="field !w-auto !py-1.5 text-xs" value={unit} onChange={(e) => setUnit(e.target.value as UnitKey)} aria-label="Medida">{UNIT_KEYS.map((u) => <option key={u} value={u}>1 {UNIT_LABEL[u].one}</option>)}</select>
                <span className="text-xs text-slate-400">pesa</span>
                <NumInput value={w} label="Gramos de una unidad" className="field !w-20 !py-1.5 text-center text-xs" onChange={setW} />
                <span className="text-xs text-slate-400">g</span>
              </div>
            </div>
            <button className="btn btn-green w-full" onClick={save}><Check size={16} /> Guardar producto</button>
          </div>
        )}
      </div>
    </Modal>
  );
}
