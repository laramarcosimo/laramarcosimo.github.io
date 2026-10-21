import { CalendarRange, Check, AlertCircle, ChevronLeft, ChevronRight, Info, Share2 } from 'lucide-react';
import { useStore } from '../lib/store';
import { weekLabel, weekSummary } from '../lib/weekly';
import { cx, fmtKg } from '../lib/utils';
import { measureTone, toneClass } from '../lib/measureRules';
import { MEASURES } from './MeasureEntry';
import { useRef, useState } from 'react';

const ICON = { good: Check, warn: AlertCircle, neutral: Info } as const;
const TONE = { good: 'text-emerald-500', warn: 'text-amber-500', neutral: 'text-slate-400' } as const;

/** Resumen semanal automático (últimos 7 días). */
export function WeeklySummary() {
  const { state } = useStore();
  const [nowTs] = useState(() => Date.now());
  const [offset, setOffset] = useState(0); // 0 = esta semana, 1 = la anterior…
  const w = weekSummary(state, nowTs, offset);
  const ref = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  // Convierte la tarjeta en imagen y la comparte (o la descarga si el móvil no puede compartir).
  const share = async () => {
    if (!ref.current || busy) return;
    setBusy(true);
    try {
      const { default: html2canvas } = await import('html2canvas');
      const bg = getComputedStyle(document.body).backgroundColor;
      const canvas = await html2canvas(ref.current, { backgroundColor: bg, scale: 2, ignoreElements: (el) => el.hasAttribute('data-no-share') });
      const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, 'image/png'));
      if (!blob) return;
      const file = new File([blob], 'mi-semana.png', { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: 'Mi semana' });
      else { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'mi-semana.png'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); }
    } catch { /* cancelado por el usuario */ } finally { setBusy(false); }
  };
  const hiddenM = state.layoutHidden['hoy-medidas'] ?? [];
  // Medidas de la semana: última medida de los últimos 7 días frente a la anterior.
  const changes = MEASURES.filter((m) => !hiddenM.includes(m.id)).flatMap((m) => {
    const list = state.measurements.filter((x) => (x[m.id] ?? 0) > 0).sort((a, b) => a.ts - b.ts);
    const inWeek = list.filter((x) => x.ts >= w.start && x.ts < w.start + 7 * 86400000);
    if (inWeek.length === 0) return [];
    const now = inWeek[inWeek.length - 1][m.id] as number;
    const before = list.filter((x) => x.ts < w.start).pop()?.[m.id] ?? (inWeek.length > 1 ? inWeek[0][m.id] : undefined);
    return [{ m, now, d: before !== undefined ? Math.round((now - (before as number)) * 10) / 10 : null }];
  });
  const items: [string, string][] = [
    ['Entrenos', `${w.workouts}`],
    ['Volumen', `${w.volume.toLocaleString('es-ES')} kg`],
    ['kcal medias', w.daysLogged ? `${w.avgKcal}` : '-'],
    ['Proteína media', w.daysLogged ? `${w.avgProtein} g` : '-'],
    ['Días con proteína', w.daysLogged ? `${w.proteinDays} de ${w.daysLogged}` : '-'],
  ];
  return (
    <div className="card" ref={ref}>
      <div className="mb-3 flex items-center gap-2 font-bold text-white"><CalendarRange size={18} strokeWidth={1.5} className="text-accent" /> Tu semana
        <button data-no-share onClick={share} disabled={busy} aria-label="Compartir resumen como imagen" className="ml-auto flex items-center gap-1 rounded-full bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-300"><Share2 size={13} /> {busy ? '…' : 'Compartir'}</button>
      </div>
      <div className="mb-3 flex items-center justify-between">
        <button data-no-share className="rounded-full bg-slate-800 p-2" onClick={() => setOffset(offset + 1)} aria-label="Semana anterior"><ChevronLeft size={16} /></button>
        <div className="text-center">
          <div className="font-bold text-white">{weekLabel(w.start)}</div>
          <div className="text-[11px] text-slate-400">{offset === 0 ? 'Esta semana' : offset === 1 ? 'Semana pasada' : `Hace ${offset} semanas`}</div>
        </div>
        <button data-no-share className="rounded-full bg-slate-800 p-2 disabled:opacity-30" disabled={offset === 0} onClick={() => setOffset(offset - 1)} aria-label="Semana siguiente"><ChevronRight size={16} /></button>
      </div>
      <div className="grid grid-cols-6 gap-2 text-center [&>*:nth-child(-n+2)]:col-span-3 [&>*:nth-child(n+3)]:col-span-2">
        {items.map(([l, v]) => (
          <div key={l} className="rounded-xl bg-slate-800 p-2">
            <div className="text-sm font-bold text-white">{v}</div>
            <div className="text-[10px] uppercase text-slate-400">{l}</div>
          </div>
        ))}
      </div>
      <div className="mt-3">
        <div className="mb-1 flex items-center justify-between text-[11px] text-slate-400">
          <span>Volumen por día</span>
          <span>
            {w.prs > 0 && <b className="mr-2 text-amber-500">{w.prs} PR{w.prs === 1 ? '' : 's'} nuevo{w.prs === 1 ? '' : 's'}</b>}
            {w.volumePrev > 0 && <span className={cx('font-semibold', w.volume >= w.volumePrev ? 'text-emerald-500' : 'text-amber-500')}>{w.volume >= w.volumePrev ? '+' : ''}{Math.round(((w.volume - w.volumePrev) / w.volumePrev) * 100)} % vs semana anterior</span>}
          </span>
        </div>
        <div className="flex h-14 items-end gap-1.5">
          {w.dayVolume.map((d, i) => {
            const max = Math.max(1, ...w.dayVolume.map((x) => x.kg));
            return (
              <div key={i} className="flex flex-1 flex-col items-center gap-1">
                <div className={cx('w-full rounded-t', d.kg > 0 ? 'bg-accent' : 'bg-slate-800')} style={{ height: `${Math.max(6, (d.kg / max) * 100)}%` }} />
                <span className="text-[9px] text-slate-500">{d.label}</span>
              </div>
            );
          })}
        </div>
      </div>
      {w.cardioMin > 0 && <div className="mt-3 rounded-xl bg-slate-800 p-2 text-center text-xs text-slate-300">Cardio esta semana: <b className="text-white">{w.cardioMin} min · {fmtKg(w.cardioKm)} km</b></div>}
      {changes.length > 0 && (
        <div className="mt-3">
          <div className="mb-1 text-[11px] text-slate-400">Tus medidas esta semana</div>
          <div className="flex flex-wrap gap-1.5">
            {changes.map(({ m, now, d }) => (
              <span key={m.id} className="rounded-full bg-slate-800 px-2.5 py-1 text-xs text-slate-300">{m.label} <b className="text-white">{fmtKg(now)} {m.unit}</b>{d !== null && <b className={cx('ml-1', d === 0 ? 'text-slate-400' : m.id === 'weight' ? (d < 0 ? 'text-emerald-500' : 'text-amber-500') : toneClass(measureTone(m.id, d)))}>{d > 0 ? '+' : ''}{fmtKg(d)}</b>}</span>
            ))}
          </div>
        </div>
      )}
      {(w.waistDelta !== null || w.weightDelta !== null) && (
        <div className="mt-2 text-xs text-slate-400">
          {w.waistDelta !== null && <>Cintura <b className={cx(w.waistDelta <= 0 ? 'text-emerald-500' : 'text-amber-500')}>{w.waistDelta > 0 ? '+' : ''}{w.waistDelta} cm</b> </>}
          {w.weightDelta !== null && <>· Peso <b className="text-slate-200">{w.weightDelta > 0 ? '+' : ''}{w.weightDelta} kg</b></>}
        </div>
      )}
      {w.nutri.length > 0 && (
        <div className="mt-3">
          <div className="mb-1 text-[11px] text-slate-400">Alimentación: media diaria frente a tu baremo ({w.daysLogged} día{w.daysLogged === 1 ? '' : 's'} con comidas)</div>
          <div className="space-y-1.5">
            {w.nutri.map((r) => {
              const good = r.ok === r.days;
              return (
                <div key={r.label} className="flex items-center justify-between gap-2 rounded-xl bg-slate-800 px-3 py-2 text-xs">
                  <div className="min-w-0"><div className="font-semibold text-white">{r.label}</div><div className="text-slate-400">Baremo {r.lo === r.hi ? r.hi : `${r.lo}–${r.hi}`} {r.unit}</div></div>
                  <div className="text-right"><div className="font-bold tabular-nums text-white">{r.avg.toLocaleString('es-ES')} {r.unit}</div><div className={cx('font-semibold', good ? 'text-emerald-500' : r.ok === 0 ? 'text-amber-500' : 'text-slate-300')}>{r.ok} de {r.days} días en rango</div></div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      <ul className="mt-3 space-y-1.5">
        {w.notes.map((n, i) => {
          const I = ICON[n.tone];
          return (
            <li key={i} className="flex gap-2 text-sm text-slate-300">
              <I size={15} strokeWidth={1.75} className={cx('mt-0.5 shrink-0', TONE[n.tone])} />
              <span>{n.text}</span>
            </li>
          );
        })}
      </ul>
      <div className="mt-2 text-[11px] text-slate-500">Racha: {w.dayStreak} día{w.dayStreak === 1 ? '' : 's'} seguidos · {w.weekStreak} semana{w.weekStreak === 1 ? '' : 's'} cumpliendo el objetivo</div>
    </div>
  );
}
