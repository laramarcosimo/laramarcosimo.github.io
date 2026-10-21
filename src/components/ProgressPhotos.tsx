import { Camera, Download, FileText, Trash2, X, Image as ImageIcon } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { isConnected } from '../lib/cloud';
import { addPhoto, ANGLES, checkPhoto, deletePhoto, listPhotos, listTrash, putPhoto, TRASH_DAYS, viewOf, type PhotoKind, type PhotoRec, type PhotoView } from '../lib/photos';
import { cloudPhotosOn, deleteCloudPhoto, lastPhotoSyncError, purgeTrash, restorePhotos, syncPhotos } from '../lib/photosCloud';
import { monthlyPhotosPdf } from '../lib/photosPdf';
import { GuidedCamera } from './GuidedCamera';
import { goalSummary } from '../lib/goalSummary';
import { archiveReport } from '../lib/reports';
import { useStore } from '../lib/store';
import { cx } from '../lib/utils';
import { ErrorBox } from './ui';

const fmtDate = (t: number): string => new Date(t).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
const kb = (n: number): string => (n > 1_000_000 ? `${(n / 1_000_000).toFixed(1)} MB` : `${Math.round(n / 1000)} kB`);

/** Fotos de progreso (cuerpo entero y yoga facial): comprimidas, guardadas todo el año solo en este móvil y fuera de la copia de seguridad. */
export function ProgressPhotos() {
  const { state, update } = useStore();
  const [cloudMsg, setCloudMsg] = useState('');
  const [err2, setErr2] = useState(lastPhotoSyncError);
  const [kind, setKind] = useState<PhotoKind>('cuerpo');
  const [angle, setAngle] = useState<PhotoView>('frente');
  const [guided, setGuided] = useState(false);
  const [all, setAll] = useState<PhotoRec[]>([]);
  const [trash, setTrash] = useState<PhotoRec[]>([]);
  const [showTrash, setShowTrash] = useState(false);
  const [nowTs, setNowTs] = useState(() => Date.now());
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [view, setView] = useState<PhotoRec | null>(null);
  const [compare, setCompare] = useState(false);
  const [cmpA, setCmpA] = useState('');
  const [cmpB, setCmpB] = useState('');
  const [slide, setSlide] = useState(false);
  const [pos, setPos] = useState(50);
  const ref = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      await purgeTrash();
      setNowTs(Date.now());
      setAll(await listPhotos());
      setTrash(await listTrash());
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'No se pudieron leer las fotos.');
    }
  }, []);
  const sync = useCallback(async () => {
    if (!isConnected() || !cloudPhotosOn()) return;
    const r = await syncPhotos();
    setErr2(r.error || null);
    setCloudMsg(r.error ? '' : r.uploaded ? `${r.uploaded} foto${r.uploaded === 1 ? '' : 's'} subida${r.uploaded === 1 ? '' : 's'} a tu Supabase.` : '');
    if (r.uploaded) await load();
  }, [load]);
  useEffect(() => {
    void load().then(() => sync());
  }, [load, sync]);

  // Miniaturas: se crean y se liberan al cambiar la lista (no se acumula memoria).
  useEffect(() => {
    const m: Record<string, string> = {};
    for (const p of [...all, ...trash]) m[p.id] = URL.createObjectURL(p.blob);
    setUrls(m);
    return () => Object.values(m).forEach((u) => URL.revokeObjectURL(u));
  }, [all, trash]);

  const list = all.filter((p) => p.kind === kind && viewOf(p) === angle);
  const total = all.reduce((a, p) => a + p.bytes, 0);
  const first = list[list.length - 1];
  const last = list[0];

  const [warn, setWarn] = useState<{ file: File; why: string } | null>(null);
  const onFile = async (f: File | null, force = false) => {
    if (!f) return;
    setBusy(true);
    setErr('');
    try {
      if (!force) {
        const c = await checkPhoto(f);
        if (c.dark || c.blurry) {
          setWarn({ file: f, why: c.dark && c.blurry ? 'muy oscura y borrosa' : c.dark ? 'muy oscura' : 'borrosa' });
          return;
        }
      }
      setWarn(null);
      await addPhoto(f, kind, angle);
      update((st) => ({ ...st, settings: { ...st.settings, lastPhotoTs: Date.now() } }));
      await load();
      void sync();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'No se pudo guardar la foto.');
    } finally {
      setBusy(false);
    }
  };

  const save = async (p: PhotoRec) => {
    const file = new File([p.blob], `${p.kind}-${viewOf(p)}-${new Date(p.ts).toISOString().slice(0, 10)}.jpg`, { type: 'image/jpeg' });
    try {
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file] });
      else {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(file);
        a.download = file.name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      }
    } catch {
      /* cancelado */
    }
  };

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-bold text-white"><Camera size={18} strokeWidth={1.5} className="text-accent" /> Fotos de progreso</h3>
        <div className="flex gap-1.5">
          <button className="btn btn-blue !px-3 !py-2 text-xs" disabled={busy} onClick={() => (typeof navigator !== 'undefined' && typeof navigator.mediaDevices?.getUserMedia === 'function' ? setGuided(true) : ref.current?.click())} aria-label="Hacer foto con la cámara"><Camera size={16} /> Cámara</button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-800 p-1">
        {([['cuerpo', 'Cuerpo entero'], ['cara', 'Yoga facial']] as const).map(([k, l]) => (
          <button key={k} onClick={() => { setKind(k); setAngle('frente'); setCompare(false); }} className={cx('rounded-lg py-2 text-xs font-semibold', kind === k ? 'bg-slate-900 text-accent' : 'text-slate-400')}>{l}</button>
        ))}
      </div>
      <div className={cx('grid gap-1 rounded-xl bg-slate-800 p-1', ANGLES[kind].length === 3 ? 'grid-cols-3' : 'grid-cols-2')} role="group" aria-label="Ángulo de la foto">
        {ANGLES[kind].map((a) => (
          <button key={a.id} aria-pressed={angle === a.id} onClick={() => { setAngle(a.id); setCompare(false); }} className={cx('rounded-lg py-2 text-xs font-semibold', angle === a.id ? 'bg-slate-900 text-accent' : 'text-slate-400')}>{a.label} <span className="opacity-60">({all.filter((p) => p.kind === kind && viewOf(p) === a.id).length})</span></button>
        ))}
      </div>
      {err && <ErrorBox msg={err} />}
      {busy && <p className="text-xs text-slate-400">Comprimiendo y guardando…</p>}
      {warn && (
        <div className="space-y-2 rounded-xl bg-amber-500/15 p-3 text-xs text-amber-500">
          <p>La foto salió {warn.why}. Para comparar bien el progreso conviene repetirla con buena luz y sin mover el móvil.</p>
          <div className="grid grid-cols-2 gap-2">
            <button className="btn btn-blue !py-2 text-xs" onClick={() => { setWarn(null); ref.current?.click(); }}>Repetir</button>
            <button className="btn btn-ghost !py-2 text-xs" onClick={() => void onFile(warn.file, true)}>Guardar igualmente</button>
          </div>
        </div>
      )}

      {list.length === 0 ? (
        <p className="text-sm text-slate-500">Aún no hay fotos de {ANGLES[kind].find((a) => a.id === angle)?.long}. Pulsa «+» para hacer la primera (misma luz, misma distancia y misma postura cada vez).</p>
      ) : (
        <>
          {list.length >= 2 && (
            <button className="btn btn-ghost w-full !py-2 text-xs" onClick={() => setCompare((c) => !c)}>{compare ? 'Ocultar comparación' : 'Comparar dos fechas'}</button>
          )}
          {compare && first && last && (() => {
            const A = list.find((x) => x.id === cmpA) ?? first;
            const B = list.find((x) => x.id === cmpB) ?? last;
            return (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  {([['Antes', A, setCmpA], ['Después', B, setCmpB]] as const).map(([l, cur, set]) => (
                    <label key={l} className="text-[11px] text-slate-400">{l}
                      <select className="field !py-1.5 text-xs" value={cur.id} onChange={(e) => set(e.target.value)} aria-label={`Foto ${l.toLowerCase()}`}>{[...list].reverse().map((x) => <option key={x.id} value={x.id}>{fmtDate(x.ts)}</option>)}</select>
                    </label>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-800 p-1">
                  {([[false, 'Lado a lado'], [true, 'Deslizador']] as const).map(([v, l]) => <button key={l} onClick={() => setSlide(v)} className={cx('rounded-lg py-1.5 text-xs font-semibold', slide === v ? 'bg-slate-900 text-accent' : 'text-slate-400')}>{l}</button>)}
                </div>
                {slide ? (
                  <div className="space-y-1.5">
                    <div className="relative mx-auto aspect-[3/4] w-full max-w-xs overflow-hidden rounded-lg bg-slate-800">
                      <img src={urls[B.id]} alt={`Después, ${fmtDate(B.ts)}`} className="absolute inset-0 h-full w-full object-cover" />
                      <img src={urls[A.id]} alt={`Antes, ${fmtDate(A.ts)}`} className="absolute inset-0 h-full w-full object-cover" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }} />
                      <div className="absolute inset-y-0 w-0.5 bg-white shadow" style={{ left: `${pos}%` }} />
                      <span className="absolute left-1 top-1 rounded bg-black/55 px-1.5 py-0.5 text-[10px] text-white">{fmtDate(A.ts)}</span>
                      <span className="absolute right-1 top-1 rounded bg-black/55 px-1.5 py-0.5 text-[10px] text-white">{fmtDate(B.ts)}</span>
                    </div>
                    <input type="range" min={0} max={100} value={pos} onChange={(e) => setPos(Number(e.target.value))} className="w-full" aria-label="Deslizar entre las dos fotos" />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {[A, B].map((x) => (
                      <div key={x.id} className="space-y-1 text-center">
                        <img src={urls[x.id]} alt={`Foto del ${fmtDate(x.ts)}`} className="w-full rounded-lg bg-slate-800 object-cover" />
                        <div className="text-[11px] text-slate-400">{fmtDate(x.ts)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}
          <div className="grid grid-cols-3 gap-2">
            {list.map((p) => (
              <button key={p.id} className="relative overflow-hidden rounded-lg bg-slate-800 active:scale-95" onClick={() => setView(p)} aria-label={`Ver foto del ${fmtDate(p.ts)}`}>
                {urls[p.id] && <img src={urls[p.id]} alt="" className="aspect-[3/4] w-full object-cover" />}
                <span className="absolute inset-x-0 bottom-0 bg-black/55 py-0.5 text-center text-[10px] text-white">{fmtDate(p.ts)}</span>
              </button>
            ))}
          </div>
        </>
      )}
      <p className="text-[11px] text-slate-500">{all.length} foto{all.length === 1 ? '' : 's'} · {kb(total)} en total (≈ {all.length ? kb(total / all.length) : '0 kB'} cada una). Se guardan todo el año en este móvil (y, si lo activas abajo, una copia reducida en tu Supabase). No van a la copia de datos ni se sustituyen al restaurarla.</p>

      {(err2 || cloudMsg) && <p className={cx('rounded-lg p-2 text-xs', err2 ? 'bg-red-500/15 text-red-400' : 'bg-emerald-500/10 text-emerald-400')}>{err2 ? `La copia en la nube falló (se reintenta sola al abrir): ${err2}` : cloudMsg}</p>}
      <div className="grid grid-cols-2 gap-2">
        <button className="btn btn-blue !py-2 text-xs" disabled={busy} onClick={() => galleryRef.current?.click()} aria-label="Subir foto de la galería"><ImageIcon size={14} /> Galería</button>
        <button className="btn btn-ghost !py-2 text-xs" disabled={busy || !isConnected()} onClick={async () => { setBusy(true); try { const n = await restorePhotos(); setCloudMsg(n ? `Recuperadas ${n} foto${n === 1 ? '' : 's'} de la nube (versión reducida).` : 'No falta ninguna foto en este móvil.'); await load(); } catch (e) { setErr(e instanceof Error ? e.message : 'No se pudo recuperar.'); } finally { setBusy(false); } }}>Recuperar de la nube</button>
      </div>
      {!isConnected() && <p className="text-[11px] text-slate-500">Para la copia en la nube, configúrala en Ajustes.</p>}
      <button className="btn btn-blue w-full !py-2 text-xs" disabled={busy || all.length === 0} onClick={async () => { setBusy(true); setErr(''); try { await monthlyPhotosPdf(all, state.measurements, goalSummary(state, Math.min(...all.map((p) => p.ts)), Math.max(...all.map((p) => p.ts))), (f) => { const from = Math.min(...all.map((p) => p.ts)); const to = Math.max(...all.map((p) => p.ts)); return archiveReport(f, { kind: 'fotos', year: new Date(to).getFullYear(), label: `PDF de fotos ${new Date(from).getFullYear()}-${new Date(to).getFullYear()}`, from, to }); }); } catch (e) { setErr(e instanceof Error ? e.message : 'No se pudo crear el PDF.'); } finally { setBusy(false); } }}><FileText size={14} /> PDF del proceso (por mes y por año)</button>

      {trash.length > 0 && (
        <div className="rounded-xl bg-slate-800/60 p-3 text-xs text-slate-300">
          <button className="flex w-full items-center justify-between font-semibold text-white" onClick={() => setShowTrash((v) => !v)}><span>Papelera ({trash.length})</span><span>{showTrash ? '−' : '+'}</span></button>
          {showTrash && (
            <div className="mt-2 space-y-2">
              <p className="text-slate-400">Se borran del todo a los {TRASH_DAYS} días (también de la nube).</p>
              {trash.map((p) => {
                const left = Math.max(0, Math.ceil((p.deletedAt! + TRASH_DAYS * 86_400_000 - nowTs) / 86_400_000));
                return (
                  <div key={p.id} className="flex items-center gap-2 rounded-lg bg-slate-900 p-2">
                    {urls[p.id] && <img src={urls[p.id]} alt="" className="h-14 w-11 shrink-0 rounded object-cover" />}
                    <div className="min-w-0 flex-1"><div className="text-white">{ANGLES[p.kind].find((a) => a.id === viewOf(p))?.long ?? p.kind} · {fmtDate(p.ts)}</div><div className="text-[11px] text-slate-400">Se borra en {left} día{left === 1 ? '' : 's'}</div></div>
                    <button className="shrink-0 rounded-full bg-accent px-2.5 py-1 font-semibold text-white" onClick={async () => { await putPhoto({ ...p, deletedAt: undefined }); await load(); }}>Restaurar</button>
                    <button className="shrink-0 rounded-full bg-red-500/20 px-2.5 py-1 font-semibold text-red-400" onClick={async () => { if (confirm('¿Borrar ya del todo? No se puede recuperar.')) { await deletePhoto(p.id); void deleteCloudPhoto(p.id); await load(); } }}>Borrar ya</button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {guided && <GuidedCamera ghost={list[0] ? urls[list[0].id] ?? '' : ''} selfie={kind === 'cara'} onShot={(file) => { setGuided(false); void onFile(file); }} onClose={() => setGuided(false)} onFallback={() => { setGuided(false); ref.current?.click(); }} />}
      <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0] ?? null; if (galleryRef.current) galleryRef.current.value = ''; void onFile(f); }} />
      <input ref={ref} type="file" accept="image/*" capture={kind === 'cara' ? 'user' : 'environment'} className="hidden" onChange={(e) => { const f = e.target.files?.[0] ?? null; if (ref.current) ref.current.value = ''; void onFile(f); }} />

      {view && (
        <div className="fixed inset-0 z-[80] flex flex-col bg-black/90 p-3" onClick={() => setView(null)}>
          <div className="mb-2 flex items-center justify-between text-sm text-white">
            <span>{fmtDate(view.ts)} · {kb(view.bytes)}</span>
            <button className="rounded-full bg-slate-800 p-2" onClick={() => setView(null)} aria-label="Cerrar"><X size={18} /></button>
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center">{urls[view.id] && <img src={urls[view.id]} alt="" className="max-h-full max-w-full rounded-lg object-contain" onClick={(e) => e.stopPropagation()} />}</div>
          <div className="mt-2 grid grid-cols-2 gap-2" onClick={(e) => e.stopPropagation()}>
            <button className="btn btn-ghost" onClick={() => void save(view)}><Download size={16} /> Guardar</button>
            <button className="btn btn-ghost text-red-400" onClick={async () => { if (confirm(`¿Borrar esta foto? Va a la papelera ${TRASH_DAYS} días y después se borra del móvil y de la nube.`)) { await putPhoto({ ...view, deletedAt: Date.now() }); setView(null); await load(); } }}><Trash2 size={16} /> Borrar</button>
          </div>
        </div>
      )}
    </div>
  );
}
