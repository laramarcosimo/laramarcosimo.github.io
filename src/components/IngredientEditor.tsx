import { Loader2, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { resolveLine } from '../lib/foodDb';
import { lineToItem } from '../lib/foodItems';
import { estimateItems, isCancelled } from '../lib/gemini';
import { storeList } from '../lib/stores';
import { useStore } from '../lib/store';
import { ErrorBox, Modal, NumInput } from './ui';

export interface Macros4 {
  kcal: number;
  prot: number;
  carbs: number;
  fat: number;
}

export interface IngredientEdit {
  /** Línea nueva del ingrediente (solo cambia si tocaste los gramos). */
  line: string;
  /** Diferencia de macros respecto a lo que valía antes (para ajustar el total del plato). */
  delta: Macros4;
}

const round = (n: number): number => Math.round(n);

/**
 * «Cada alimento (puedes ajustar los números a mano)»: el nombre, sus gramos editables y 4 casillas independientes (kcal, proteína,
 * carbohidratos y grasas). Al cambiar los gramos se recalcula proporcionalmente; también puedes escribir cada cifra directamente.
 */
export function IngredientEditor({ line, onSave, onClose, onSwap }: { line: string; onSave: (r: IngredientEdit) => void; onClose: () => void; onSwap?: () => void }) {
  const { state } = useStore();
  const item = lineToItem(line);
  const known = resolveLine(line);
  const startGrams = known?.grams ?? (item.unidad === 'g' || item.unidad === 'ml' ? item.cantidad : 0);
  const start: Macros4 = known ? { kcal: round(known.kcal), prot: round(known.protein), carbs: round(known.carbs), fat: round(known.fat) } : { kcal: 0, prot: 0, carbs: 0, fat: 0 };
  const [grams, setGrams] = useState(Math.round(startGrams));
  const [m, setM] = useState<Macros4>(start);
  const [base, setBase] = useState<Macros4>(start); // lo que ya contaba este alimento en el total del plato
  const [baseGrams, setBaseGrams] = useState(Math.round(startGrams));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const unknown = !known;

  /** Cambiar los gramos reescala las 4 cifras en proporción a lo que valían. */
  const changeGrams = (g: number) => {
    const ref = m.kcal + m.prot + m.carbs + m.fat > 0 && grams > 0 ? { g: grams, m } : null;
    setGrams(g);
    if (ref && g > 0) setM({ kcal: round((ref.m.kcal * g) / ref.g), prot: round((ref.m.prot * g) / ref.g), carbs: round((ref.m.carbs * g) / ref.g), fat: round((ref.m.fat * g) / ref.g) });
  };

  const calcAI = async () => {
    setBusy(true);
    setErr('');
    try {
      const r = await estimateItems(state.settings, [{ nombre: item.nombre, cantidad: grams > 0 ? grams : item.cantidad, unidad: grams > 0 ? 'g' : item.unidad }], storeList(state.defaultSupermarket, state.supermarkets), state.defaultSupermarket, null);
      const e = r.items[0];
      if (e) {
        const v = { kcal: e.calorias, prot: e.proteinas, carbs: e.carbs, fat: e.grasas };
        setM(v);
        setBase(v);
        setBaseGrams(grams);
      }
    } catch (e) {
      setErr(e instanceof Error && !isCancelled(e) ? e.message : 'Cancelado.');
    } finally {
      setBusy(false);
    }
  };

  const num = (label: string, key: keyof Macros4, text: string) => (
    <label className="block">
      <span className="mb-1 block text-[10px] font-semibold uppercase text-slate-400">{text}</span>
      <NumInput decimal={false} value={m[key]} label={`${item.nombre}: ${label}`} className="field !py-2 text-center" onChange={(n) => setM({ ...m, [key]: n })} />
    </label>
  );

  const save = () => {
    const changedGrams = grams > 0 && grams !== baseGrams;
    onSave({
      line: changedGrams ? `${item.nombre} (≈ ${grams} g)` : line,
      delta: { kcal: m.kcal - base.kcal, prot: m.prot - base.prot, carbs: m.carbs - base.carbs, fat: m.fat - base.fat },
    });
  };

  return (
    <Modal title="Ajustar alimento" onClose={onClose}>
      <div className="space-y-3">
        <div className="text-[11px] font-semibold uppercase text-slate-400">Cada alimento (puedes ajustar los números a mano)</div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="min-w-0 break-words text-lg font-bold text-white">{item.nombre}</span>
          <span className="text-slate-400">·</span>
          <NumInput value={grams} label={`${item.nombre}: gramos`} className="field !w-20 !py-1.5 text-center" onChange={changeGrams} />
          <span className="text-sm text-slate-300">g</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {num('kcal', 'kcal', 'KCAL')}
          {num('proteína', 'prot', 'PROT G')}
          {num('carbohidratos', 'carbs', 'CARBS G')}
          {num('grasas', 'fat', 'GRASAS G')}
        </div>
        <p className="text-[11px] text-slate-400">{unknown ? 'No tengo los valores de este alimento en la tabla: escríbelos o pide el cálculo a la IA. Lo que escribas se suma al total del plato.' : `Valores de la tabla de composición para ${baseGrams} g. Al cambiar los gramos se recalculan en proporción.`}</p>
        {unknown && (
          <button className="btn btn-ghost w-full text-accent" disabled={busy} onClick={() => void calcAI()}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} Calcular con IA</button>
        )}
        {err && <ErrorBox msg={err} />}
        <button className="btn btn-blue w-full" onClick={save}>Guardar cambios</button>
        {onSwap && <button className="w-full text-center text-xs font-semibold text-accent underline" onClick={onSwap}>Cambiar por otro alimento</button>}
      </div>
    </Modal>
  );
}
