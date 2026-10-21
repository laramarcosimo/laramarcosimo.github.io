import { ShoppingCart } from 'lucide-react';
import { useStore } from '../lib/store';
import { SUPERMARKETS, storeInfo } from '../lib/stores';

/** Supermercado predeterminado: se cambia con un toque desde Nutrición y Despensa. */
export function DefaultStore() {
  const { state, update } = useStore();
  const def = state.defaultSupermarket;
  const hex = storeInfo(def).color.replace('#', '');
  const light = hex.length === 6 && (parseInt(hex.slice(0, 2), 16) * 299 + parseInt(hex.slice(2, 4), 16) * 587 + parseInt(hex.slice(4, 6), 16) * 114) / 1000 > 150;
  const fg = light ? '#0f172a' : '#ffffff';
  const options = [...new Set([...SUPERMARKETS.map((s) => s.name), ...state.supermarkets, def])];
  return (
    <label className="mb-4 inline-flex max-w-full flex-wrap items-center gap-x-2 rounded-full px-3 py-1.5 text-sm font-bold shadow active:scale-95" style={{ backgroundColor: storeInfo(def).color, color: fg }}>
      <ShoppingCart size={14} />
      <span className="text-[11px] font-semibold uppercase opacity-100">Predeterminado</span>
      <select className="max-w-[9.5rem] bg-transparent font-bold outline-none" style={{ color: fg }} value={def} onChange={(e) => update((s) => ({ ...s, defaultSupermarket: e.target.value }))} aria-label="Supermercado predeterminado">
        {options.map((o) => <option key={o} value={o} className="text-slate-900">{o}</option>)}
      </select>
    </label>
  );
}
