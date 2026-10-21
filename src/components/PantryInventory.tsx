import { Camera, Image as ImageIcon, Minus, MoreHorizontal, Plus, Refrigerator, Search, Snowflake, Trash2, Warehouse } from 'lucide-react';
import { useRef, useState } from 'react';
import { ProductThumb } from './ProductThumb';
import { Modal, NumInput } from './ui';
import { ALL_CATEGORIES, categoryOf } from '../lib/categories';
import { readPackUnits } from '../lib/gemini';
import { compressToBase64 } from '../lib/image';
import { findProductImage, forgetCachedImage, productKey } from '../lib/openfood';
import { addToPantry, askUnits, configureUnits, PLACES, placeOf, setPackQty, spendUnits, suggestUnits, unitsSummary, type Place } from '../lib/pantry';
import { SUPERMARKETS } from '../lib/stores';
import { useStore } from '../lib/store';
import type { PantryItem } from '../lib/types';
import { cx, daysUntil, norm } from '../lib/utils';

const PLACE_ICON: Record<Place, typeof Refrigerator> = { nevera: Refrigerator, despensa: Warehouse, congelador: Snowflake };

/** Fila deslizable: arrastrar a la izquierda deja ver el fondo rojo y borra (con «Deshacer»). */
function SwipeRow({ onDelete, children }: { onDelete: () => void; children: React.ReactNode }) {
  const [dx, setDx] = useState(0);
  const [drag, setDrag] = useState(false);
  const start = useRef<{ x: number; y: number; lock: boolean | null } | null>(null);
  return (
    <div className="relative overflow-hidden rounded-2xl bg-red-500/25">
      <div className="absolute inset-y-0 right-0 flex w-20 items-center justify-center text-red-300" aria-hidden><Trash2 size={20} /></div>
      <div
        className="relative bg-slate-900"
        style={{ transform: `translateX(${dx}px)`, transition: drag ? 'none' : 'transform .2s' }}
        onTouchStart={(e) => { if (e.touches[0].clientX < 20 || e.touches[0].clientX > window.innerWidth - 20) return; setDrag(true); start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, lock: null }; }}
        onTouchMove={(e) => {
          const s = start.current;
          if (!s) return;
          const mx = e.touches[0].clientX - s.x;
          const my = e.touches[0].clientY - s.y;
          if (s.lock === null && (Math.abs(mx) > 8 || Math.abs(my) > 8)) s.lock = Math.abs(mx) > Math.abs(my);
          if (s.lock) setDx(Math.max(-120, Math.min(0, mx)));
        }}
        onTouchEnd={() => {
          const del = dx < -80;
          start.current = null;
          setDrag(false);
          setDx(0);
          if (del) onDelete();
        }}
      >
        {children}
      </div>
    </div>
  );
}

/** Cuenta por unidades sueltas: rebanadas de un pan de molde, pechugas de una bandeja, salchichas de un envase con varios packs. */
function UnitsEditor({ item, onChange, onSpend }: { item: PantryItem; onChange: (p: PantryItem) => void; onSpend: (n: number) => void }) {
  const { state } = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  // La foto del envase solo se usa para leer las unidades y no se guarda.
  const readPack = async (f: File | undefined) => {
    if (fileRef.current) fileRef.current.value = '';
    if (galleryRef.current) galleryRef.current.value = '';
    if (!f) return;
    setBusy(true);
    setErr('');
    try {
      const r = await readPackUnits(state.settings, await compressToBase64(f, 1400, 0.9));
      onChange(configureUnits(item, r.unitLabel ?? 'unidades', r.unitsPerPack ?? 0, r.innerPack));
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error desconocido');
    } finally {
      setBusy(false);
    }
  };
  const photoBtn = state.settings.geminiKey ? (
    <>
      <button className="btn btn-ghost w-full text-sm" disabled={busy} onClick={() => fileRef.current?.click()}><Camera size={16} /> {busy ? 'Leyendo el envase…' : 'Leer unidades del envase con foto'}</button>
      <button className="btn btn-ghost w-full text-sm" disabled={busy} onClick={() => galleryRef.current?.click()}><ImageIcon size={16} /> Subir foto del envase de la galería</button>
      <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => void readPack(e.target.files?.[0])} />
      <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={(e) => void readPack(e.target.files?.[0])} />
      {err && <p className="text-xs text-amber-500">{err}</p>}
    </>
  ) : null;
  const per = item.unitsPerPack;
  if (!per) {
    const s = suggestUnits(item.name);
    return (
      <div className="space-y-2">
        {photoBtn}
        <button className="btn btn-ghost w-full text-sm" onClick={() => onChange(configureUnits(item, s?.label ?? 'unidades', s?.per ?? 10, s?.inner))}>
          Contar por unidades (rebanadas, pechugas, salchichas…)
        </button>
      </div>
    );
  }
  const inner = item.innerPack ?? per;
  const packs = item.innerPack ? Math.round(per / item.innerPack) : 1;
  const set = (label: string, innerN: number, packsN: number) => onChange(configureUnits(item, label, innerN * Math.max(1, packsN), packsN > 1 ? innerN : undefined));
  return (
    <div className="space-y-2 rounded-xl bg-slate-800/60 p-3">
      <div className="text-xs font-bold uppercase text-slate-400">Se cuenta por unidades</div>
      <div className="grid grid-cols-3 gap-2">
        <div><label className="label">Unidad</label><input className="field !px-2 text-sm" value={item.unitLabel ?? ''} placeholder="rebanadas" onChange={(e) => onChange({ ...item, unitLabel: e.target.value })} /></div>
        <div><label className="label">{packs > 1 ? 'Por pack' : 'Por envase'}</label><NumInput decimal={false} value={inner} className="field text-center" onChange={(n) => n > 0 && set(item.unitLabel ?? 'unidades', n, packs)} /></div>
        <div><label className="label">Packs/envase</label><NumInput decimal={false} value={packs} className="field text-center" onChange={(n) => n > 0 && set(item.unitLabel ?? 'unidades', inner, n)} /></div>
      </div>
      {photoBtn}
      <p className="text-[11px] text-slate-400">Cada envase trae {per} {item.unitLabel || 'unidades'}{item.innerPack ? ` (${packs} packs de ${item.innerPack})` : ''}. Si no vienen del envase, son estimados: corrígelos con los de tu paquete.</p>
      <div className="flex items-center gap-2">
        <label className="label !mb-0 flex-1">Quedan ({item.unitLabel || 'unidades'})</label>
        <NumInput decimal={false} value={item.units ?? item.qty * per} className="field w-24 text-center" onChange={(n) => onChange({ ...item, units: Math.max(0, n), qty: Math.max(0, Math.ceil(Math.max(0, n) / per)) })} />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <button className="btn btn-ghost !py-2 text-xs" onClick={() => onSpend(1)}>Gastar 1</button>
        <button className="btn btn-ghost !py-2 text-xs" onClick={() => onSpend(2)}>Gastar 2</button>
        {item.innerPack ? <button className="btn btn-ghost !py-2 text-xs" onClick={() => onSpend(item.innerPack ?? 1)}>1 pack ({item.innerPack})</button> : <button className="btn btn-ghost !py-2 text-xs !text-red-400" onClick={() => onChange(configureUnits(item, '', 0))}>Quitar</button>}
      </div>
      {item.innerPack ? <button className="text-xs text-slate-500" onClick={() => onChange(configureUnits(item, '', 0))}>Dejar de contar por unidades</button> : null}
    </div>
  );
}

function ExpiryBadge({ p }: { p: PantryItem }) {
  if (!p.expires) return null;
  const d = daysUntil(p.expires);
  const tone = d < 0 ? 'bg-red-500/15 text-red-400' : d <= 3 ? 'bg-amber-500/15 text-amber-500' : 'bg-emerald-500/15 text-emerald-500';
  const txt = d < 0 ? 'Caducado' : d === 0 ? 'Caduca hoy' : d < 14 ? `Caduca en ${d} d` : d < 60 ? `Caduca en ${Math.round(d / 7)} sem` : `Caduca en ${Math.round(d / 30)} mes`;
  return <span className={cx('whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold', tone)}>{p.expiresApprox ? '~' : ''}{txt}</span>;
}

export function PantryInventory({ onBarcode, soon, setSoon }: { onBarcode: () => void; soon: boolean; setSoon: (v: boolean) => void }) {
  const { state, update, removeWithUndo } = useStore();
  const [q, setQ] = useState('');
  const [placeFilter, setPlaceFilter] = useState<'todo' | Place>('todo');
  const [cat, setCat] = useState('todos');
  const [menu, setMenu] = useState(false);
  const [photoMsg, setPhotoMsg] = useState('');
  const [detail, setDetail] = useState<string | null>(null);

  const missingPhoto = state.pantry.filter((p) => state.productImages[productKey(p.name)] === undefined);
  const autoPhotos = state.pantry.filter((p) => /openfoodfacts/i.test(state.productImages[productKey(p.name)] ?? ''));
  const fillPhotos = async (redo = false) => {
    setMenu(false);
    if (redo && !confirm('Se vuelven a buscar las fotos automáticas con el criterio nuevo (más estricto). Las que pusiste tú no se tocan. ¿Seguir?')) return;
    if (redo) update((s) => { const next = { ...s.productImages }; for (const p of autoPhotos.slice(0, 20)) delete next[productKey(p.name)]; return { ...s, productImages: next }; });
    const list = (redo ? autoPhotos : missingPhoto).slice(0, redo ? 20 : 15);
    for (let i = 0; i < list.length; i++) {
      setPhotoMsg(`Buscando fotos… ${i + 1} de ${list.length}`);
      forgetCachedImage(list[i].name);
      const u = await findProductImage(list[i].name, list[i].store);
      if (u) update((s) => (s.productImages[productKey(list[i].name)] === undefined ? { ...s, productImages: { ...s.productImages, [productKey(list[i].name)]: u } } : s));
    }
    setPhotoMsg(list.length ? 'Listo.' : '');
    setTimeout(() => setPhotoMsg(''), 5000);
  };

  const add = () => {
    const name = q.trim();
    if (!name) return;
    update((s) => ({ ...s, pantry: addToPantry(s.pantry, [{ name, store: s.defaultSupermarket, place: placeFilter === 'todo' ? undefined : placeFilter }]) }));
    setQ('');
  };
  const patch = (id: string, f: Partial<PantryItem>) => update((s) => ({ ...s, pantry: s.pantry.map((x) => (x.id === id ? { ...x, ...f } : x)) }));
  const del = (p: PantryItem) => { setDetail(null); removeWithUndo(`«${p.name}» eliminado`, (s) => ({ ...s, pantry: s.pantry.filter((x) => x.id !== p.id) })); };

  const nq = norm(q);
  const byPlace = state.pantry.filter((p) => (placeFilter === 'todo' || placeOf(p) === placeFilter) && (!soon || (p.expires && daysUntil(p.expires) <= 3)));
  const catsHere = ALL_CATEGORIES.filter((c) => byPlace.some((p) => categoryOf(p).id === c.id));
  const activeCat = cat === 'todos' || catsHere.some((c) => c.id === cat) ? cat : 'todos';
  const visible = byPlace.filter((p) => (activeCat === 'todos' || categoryOf(p).id === activeCat) && (!nq || norm(p.name).includes(nq)));
  const item = detail ? state.pantry.find((p) => p.id === detail) : undefined;
  const stores = [...new Set([state.defaultSupermarket, ...state.supermarkets, ...SUPERMARKETS.map((x) => x.name)])];

  const asks = askUnits(state.pantry).slice(0, 3);

  return (
    <div className="space-y-3">
      {asks.map(({ item: a, guess }) => (
        <div key={a.id} className="space-y-2 rounded-xl bg-accent/10 p-3 text-sm text-slate-200">
          <div>¿Cuento «{a.name}» por {guess.label}? (≈ {guess.per} por envase{guess.inner ? `, en packs de ${guess.inner}` : ''}) Así se descuenta pieza a pieza al cocinar.</div>
          <div className="grid grid-cols-2 gap-2">
            <button className="btn btn-green !py-2 text-xs" onClick={() => patch(a.id, configureUnits(a, guess.label, guess.per, guess.inner))}>Sí, contar</button>
            <button className="btn btn-ghost !py-2 text-xs" onClick={() => patch(a.id, configureUnits(a, '', 0))}>No, por envases</button>
          </div>
        </div>
      ))}
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input className="field !rounded-2xl !pl-10" placeholder="Buscar o añadir alimento…" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} aria-label="Buscar o añadir alimento" />
        </div>
        {q.trim() ? (
          <button className="btn btn-blue !rounded-2xl !px-3.5" onClick={add} aria-label="Añadir alimento"><Plus size={20} /></button>
        ) : (
          <button className="btn btn-ghost !rounded-2xl !px-3.5" onClick={onBarcode} aria-label="Escanear código de barras"><Camera size={20} /></button>
        )}
        <div className="relative">
          <button className="btn btn-ghost !rounded-2xl !px-3" onClick={() => setMenu((m) => !m)} aria-label="Más opciones" aria-expanded={menu}><MoreHorizontal size={20} /></button>
          {menu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />
              <div className="absolute right-0 top-full z-20 mt-1 w-60 overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-xl">
                <button className="block w-full px-4 py-3 text-left text-sm text-slate-200 disabled:text-slate-600" disabled={missingPhoto.length === 0 || !!photoMsg} onClick={() => void fillPhotos()}>
                  Buscar fotos que faltan{missingPhoto.length ? ` (${missingPhoto.length})` : ''}
                </button>
                <button className="block w-full border-t border-slate-800 px-4 py-3 text-left text-sm text-slate-200 disabled:text-slate-600" disabled={autoPhotos.length === 0 || !!photoMsg} onClick={() => void fillPhotos(true)}>
                  Repasar fotos automáticas
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-1 rounded-2xl bg-slate-800 p-1" role="tablist">
        {([['todo', 'Todo'], ...PLACES.map((p) => [p.id, p.label])] as [string, string][]).map(([id, l]) => {
          const n = id === 'todo' ? state.pantry.length : state.pantry.filter((p) => placeOf(p) === id).length;
          const on = placeFilter === id;
          return (
            <button key={id} role="tab" aria-selected={on} onClick={() => setPlaceFilter(id as 'todo' | Place)} className={cx('rounded-xl px-0.5 py-2 text-[12px] font-semibold transition-colors', on ? 'bg-slate-950 text-white shadow ring-1 ring-slate-600' : 'text-slate-400')}>
              {l} <span className={cx("whitespace-nowrap max-[359px]:block", on ? "text-accent" : "opacity-60")}>({n})</span>
            </button>
          );
        })}
      </div>

      {catsHere.length > 1 && (
        <select className="field !rounded-2xl font-semibold" value={activeCat} onChange={(e) => setCat(e.target.value)} aria-label="Categoría">
          <option value="todos">Todas las categorías ({byPlace.length})</option>
          {catsHere.map((c) => <option key={c.id} value={c.id}>{c.label} ({byPlace.filter((p) => categoryOf(p).id === c.id).length})</option>)}
        </select>
      )}
      {soon && <button className="rounded-full bg-amber-500/15 px-3 py-1.5 text-xs font-semibold text-amber-500" onClick={() => setSoon(false)}>Solo lo que caduca pronto · quitar filtro ✕</button>}
      {photoMsg && <p className="text-xs text-slate-300">{photoMsg}</p>}

      <div className="space-y-2">
        {state.pantry.length === 0 && <p className="text-sm text-slate-500">Tu despensa está vacía.</p>}
        {state.pantry.length > 0 && visible.length === 0 && <p className="text-sm text-slate-500">Nada coincide. {q.trim() && 'Toca + para añadirlo.'}</p>}
        {visible.map((p) => {
          const Pl = PLACE_ICON[placeOf(p)];
          return (
            <SwipeRow key={p.id} onDelete={() => del(p)}>
              <div role="button" tabIndex={0} onClick={() => setDetail(p.id)} onKeyDown={(e) => e.key === 'Enter' && setDetail(p.id)} className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-slate-800 bg-slate-900 p-3">
                <div className="shrink-0 rounded-xl shadow-md shadow-black/20"><ProductThumb name={p.name} store={p.store} size={60} /></div>
                <div className="min-w-[7rem] flex-1">
                  <div className="line-clamp-3 break-words text-base font-semibold leading-tight text-white">{p.name}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                    <ExpiryBadge p={p} />
                    <span className="inline-flex items-center gap-1"><Pl size={12} />{PLACES.find((x) => x.id === placeOf(p))?.label}</span>
                  </div>
                  {unitsSummary(p) && <div className="mt-1 text-xs font-semibold text-accent">{unitsSummary(p)}</div>}
                </div>
                <div className="flex shrink-0 items-center gap-1 max-[359px]:ml-auto" onClick={(e) => e.stopPropagation()}>
                  <button className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-slate-200 active:scale-95" onClick={() => update((s) => ({ ...s, pantry: spendUnits(s.pantry, p.id, 1) }))} aria-label={p.unitsPerPack ? `Gastar 1 de ${p.unitLabel ?? 'unidades'} de ${p.name}` : `Gastar una unidad de ${p.name}`}><Minus size={14} /></button>
                  <NumInput value={p.qty} label={`Envases de ${p.name}`} className="w-9 rounded-lg bg-transparent py-1 text-center text-base font-semibold tabular-nums text-white outline-none focus:bg-slate-800" onChange={(n) => update((s) => ({ ...s, pantry: s.pantry.map((x) => (x.id === p.id ? setPackQty(x, n) ?? { ...x, qty: 0, units: x.unitsPerPack ? 0 : x.units } : x)) }))} />
                  <button className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-slate-200 active:scale-95" onClick={() => update((s) => ({ ...s, pantry: addToPantry(s.pantry, [{ name: p.name }]) }))} aria-label={p.unitsPerPack ? `Añadir un envase de ${p.name}` : `Añadir una unidad de ${p.name}`}><Plus size={14} /></button>
                </div>
              </div>
            </SwipeRow>
          );
        })}
      </div>

      {item && (
        <Modal title="Detalles del alimento" onClose={() => setDetail(null)}>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <ProductThumb name={item.name} store={item.store} size={64} editable />
              <div className="min-w-0 text-base font-semibold text-white">{item.name}</div>
            </div>
            <div><label className="label">Supermercado</label>
              <select className="field" value={item.store ?? ''} onChange={(e) => patch(item.id, { store: e.target.value || undefined })}>
                <option value="">Sin supermercado</option>
                {stores.map((n) => <option key={n} value={n}>{n}</option>)}
              </select></div>
            <div className="grid grid-cols-2 gap-2">
              <div><label className="label">Ubicación</label>
                <select className="field" value={placeOf(item)} onChange={(e) => patch(item.id, { place: e.target.value as Place })}>
                  {PLACES.map((pl) => <option key={pl.id} value={pl.id}>{pl.label}</option>)}
                </select></div>
              <div><label className="label">Categoría</label>
                <select className="field" value={categoryOf(item).id} onChange={(e) => patch(item.id, { category: e.target.value })}>
                  {ALL_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select></div>
            </div>
            <div><label className="label">Caducidad{item.expiresApprox ? ' (estimada)' : ''}</label>
              <div className="flex gap-2">
                <input type="date" className="field min-w-0 flex-1" value={item.expires ?? ''} onChange={(e) => patch(item.id, { expires: e.target.value || undefined, expiresApprox: false })} />
                {item.expires && <button className="btn btn-ghost" onClick={() => patch(item.id, { expires: undefined, expiresApprox: false })}>Quitar</button>}
              </div></div>
            <UnitsEditor item={item} onChange={(next) => update((s) => ({ ...s, pantry: s.pantry.map((x) => (x.id === next.id ? next : x)) }))} onSpend={(n) => update((s) => ({ ...s, pantry: spendUnits(s.pantry, item.id, n) }))} />
            {item.unitGrams ? <p className="text-xs text-slate-400">{item.unitGrams * item.qty} g en total · ≈{Math.floor((item.unitGrams * item.qty) / (item.portionG || 100))} raciones</p> : null}
            <div className="flex gap-2">
              <button className="btn btn-ghost flex-1 !text-red-400" onClick={() => del(item)}><Trash2 size={16} /> Eliminar</button>
              <button className="btn btn-blue flex-1" onClick={() => setDetail(null)}>Listo</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
