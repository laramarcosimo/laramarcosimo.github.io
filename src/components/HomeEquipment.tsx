import { Check } from 'lucide-react';
import { HOME_GEAR_LABEL } from '../lib/homeSwap';
import { useStore } from '../lib/store';
import type { BandLevel, HomeGear } from '../lib/types';
import { cx, num } from '../lib/utils';

const GROUPS: { title: string; items: HomeGear[] }[] = [
  { title: 'Peso libre', items: ['dumbbells', 'kettlebell', 'barbell', 'rack', 'backpack'] },
  { title: 'Bancos y apoyos', items: ['bench', 'inclinebench', 'box', 'furniture'] },
  { title: 'Calistenia y accesorios', items: ['pullup', 'dipbars', 'straps', 'abwheel', 'bands'] },
];

const DB = [2, 4, 6, 8, 10, 12, 15, 18, 20, 24, 30, 40];
const KB = [4, 6, 8, 10, 12, 14, 16, 20, 24, 28, 32];
const BAG = [3, 5, 8, 10, 12, 15, 20];

function Select({ label, value, opts, unit, onChange }: { label: string; value: number; opts: number[]; unit: string; onChange: (n: number) => void }) {
  return (
    <label className="flex items-center justify-between gap-2 rounded-xl bg-slate-800 px-3 py-2 text-sm text-slate-300">
      {label}
      <select className="rounded-lg bg-slate-900 px-2 py-1 text-white" value={value} onChange={(e) => onChange(num(e.target.value))}>
        {(opts.includes(value) ? opts : [...opts, value].sort((a, b) => a - b)).map((o) => <option key={o} value={o}>{o} {unit}</option>)}
      </select>
    </label>
  );
}

/** Material de casa con detalles (pesos máximos, nivel de bandas…) para adaptar con precisión. */
export function HomeEquipment() {
  const { state, update } = useStore();
  const sel = state.homeGear;
  const sp = state.homeSpecs;
  const setSpec = (p: Partial<typeof sp>) => update((s) => ({ ...s, homeSpecs: { ...s.homeSpecs, ...p } }));

  const toggle = (g: HomeGear) =>
    update((s) => {
      const has = s.homeGear.includes(g);
      let next: HomeGear[];
      if (g === 'bodyweight') next = ['bodyweight'];
      else {
        next = has ? s.homeGear.filter((x) => x !== g) : [...s.homeGear.filter((x) => x !== 'bodyweight'), g];
        // Dependencias: el rack requiere barra; sin barra no hay rack.
        if (g === 'barbell' && has) next = next.filter((x) => x !== 'rack');
        if (g === 'rack' && !has && !next.includes('barbell')) next.push('barbell');
      }
      if (next.length === 0) next = ['bodyweight'];
      return { ...s, homeGear: next };
    });

  const chip = (g: HomeGear) => (
    <button key={g} onClick={() => toggle(g)} className={cx('rounded-full px-3 py-1.5 text-sm font-semibold transition active:scale-95', sel.includes(g) ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-slate-400')}>
      {sel.includes(g) && <Check size={13} strokeWidth={2} className="mr-1 inline" />}{HOME_GEAR_LABEL[g]}
    </button>
  );

  return (
    <div className="space-y-3">
      <button onClick={() => toggle('bodyweight')} className={cx('rounded-full px-3 py-1.5 text-sm font-semibold', sel.includes('bodyweight') ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-slate-400')}>
        {sel.includes('bodyweight') && <Check size={13} strokeWidth={2} className="mr-1 inline" />}{HOME_GEAR_LABEL.bodyweight}
      </button>
      {GROUPS.map((g) => (
        <div key={g.title}>
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{g.title}</div>
          <div className="flex flex-wrap gap-2">{g.items.map(chip)}</div>
        </div>
      ))}

      {(sel.includes('dumbbells') || sel.includes('kettlebell') || sel.includes('bands') || sel.includes('backpack')) && (
        <div className="space-y-2 border-t border-slate-800 pt-3">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Detalles</div>
          {sel.includes('dumbbells') && <Select label="Mancuernas: máximo por mano" value={sp.dumbbellKg} opts={DB} unit="kg" onChange={(n) => setSpec({ dumbbellKg: n })} />}
          {sel.includes('kettlebell') && <Select label="Kettlebell" value={sp.kettlebellKg} opts={KB} unit="kg" onChange={(n) => setSpec({ kettlebellKg: n })} />}
          {sel.includes('backpack') && <Select label="Mochila cargada" value={sp.backpackKg} opts={BAG} unit="kg" onChange={(n) => setSpec({ backpackKg: n })} />}
          {sel.includes('bands') && (
            <div className="rounded-xl bg-slate-800 px-3 py-2">
              <div className="mb-1 text-sm text-slate-300">Resistencia de las bandas</div>
              <div className="grid grid-cols-3 gap-1.5">
                {(['ligera', 'media', 'fuerte'] as BandLevel[]).map((l) => (
                  <button key={l} onClick={() => setSpec({ bandLevel: l })} className={cx('rounded-lg py-1.5 text-sm font-semibold capitalize', sp.bandLevel === l ? 'bg-emerald-500 text-white' : 'bg-slate-900 text-slate-400')}>{l}</button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
