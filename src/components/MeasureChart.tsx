import { useState } from 'react';
import { useStore } from '../lib/store';
import { cx, fmtKg } from '../lib/utils';
import { measureTone, toneClass } from '../lib/measureRules';
import { MEASURES, type MeasureKind } from './MeasureEntry';

const RANGES: { id: number; label: string }[] = [
  { id: 30, label: '30 días' },
  { id: 90, label: '90 días' },
  { id: 0, label: 'Todo' },
];

/** Tendencia de cintura, cadera, peso y demás medidas: gráfica con la variación en el periodo. */
export function MeasureChart({ kinds }: { kinds: MeasureKind[] }) {
  const { state } = useStore();
  const [kind, setKind] = useState<MeasureKind | null>(null);
  const [range, setRange] = useState(90);
  const [sel, setSel] = useState<number | null>(null);
  const [nowTs] = useState(() => Date.now());

  const withData = kinds.filter((k) => state.measurements.some((m) => (m[k] ?? 0) > 0));
  if (withData.length === 0) return null;
  const cur = kind && withData.includes(kind) ? kind : withData.includes('waist') ? 'waist' : withData[0];
  const meta = MEASURES.find((m) => m.id === cur)!;
  const all = state.measurements.filter((m) => (m[cur] ?? 0) > 0).sort((a, b) => a.ts - b.ts);
  const list = range === 0 ? all : all.filter((m) => m.ts >= nowTs - range * 86400000);
  const pts = list.map((m) => m[cur] as number);
  const shownIdx = sel !== null && list[sel] ? sel : list.length - 1;
  const shown = list[shownIdx];
  const delta = pts.length >= 2 ? Math.round((pts[pts.length - 1] - pts[0]) * 10) / 10 : null;

  const W = 320;
  const H = 100;
  const pad = 12;
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const x = (i: number) => pad + (pts.length <= 1 ? (W - 2 * pad) / 2 : (i / (pts.length - 1)) * (W - 2 * pad));
  const y = (v: number) => H - pad - ((v - min) / (max - min || 1)) * (H - 2 * pad);

  return (
    <div className="mt-3 space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {withData.map((k) => (
          <button key={k} onClick={() => { setKind(k); setSel(null); }} className={cx('rounded-full px-3 py-1 text-xs font-semibold active:scale-95', cur === k ? 'bg-accent text-white' : 'bg-slate-800 text-slate-300')}>{MEASURES.find((m) => m.id === k)!.label}</button>
        ))}
      </div>
      <div className="flex items-end justify-between gap-2">
        <div>
          <div className="text-xl font-extrabold text-white">{shown ? `${fmtKg(shown[cur] as number)} ${meta.unit}` : '—'}{shown && <span className="ml-1.5 text-xs font-medium capitalize text-slate-400">· {new Date(shown.ts).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}</span>}</div>
          {delta !== null && <div className={cx('text-xs font-bold', delta === 0 ? 'text-slate-400' : cur === 'weight' ? (delta < 0 ? 'text-emerald-500' : 'text-amber-500') : toneClass(measureTone(cur, delta)))}>{delta > 0 ? '+' : ''}{fmtKg(delta)} {meta.unit} en {range === 0 ? 'todo el historial' : `${range} días`}</div>}
        </div>
        <div className="flex gap-1">
          {RANGES.map((r) => <button key={r.id} onClick={() => { setRange(r.id); setSel(null); }} className={cx('rounded-full px-2.5 py-1 text-[11px] font-semibold active:scale-95', range === r.id ? 'bg-slate-700 text-white' : 'bg-slate-800 text-slate-400')}>{r.label}</button>)}
        </div>
      </div>
      {pts.length === 0 ? (
        <p className="rounded-xl bg-slate-800 p-3 text-center text-xs text-slate-500">Sin medidas en este periodo.</p>
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Evolución de ${meta.label.toLowerCase()}`}>
          {pts.length > 1 && <polyline points={pts.map((v, i) => `${x(i)},${y(v)}`).join(' ')} fill="none" stroke="#10B981" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />}
          {pts.map((v, i) => (
            <g key={i} onClick={() => setSel(i)} className="cursor-pointer">
              <circle cx={x(i)} cy={y(v)} r="14" fill="transparent" />
              <circle cx={x(i)} cy={y(v)} r={i === shownIdx ? 5.5 : 3.5} fill={i === shownIdx ? '#10B981' : '#fff'} stroke="#10B981" strokeWidth="2" />
            </g>
          ))}
        </svg>
      )}
    </div>
  );
}
