import { Camera, Check, ScanBarcode, Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { readLabel, readBarcode, readExpiry, readNutritionLabel } from '../lib/gemini';
import { ProductRater } from './ProductRater';
import { compressToBase64 } from '../lib/image';
import { lookupBarcode, productKey, type BarcodeProduct } from '../lib/openfood';
import { addToPantry } from '../lib/pantry';
import { saveProduct } from '../lib/products';
import { useStore } from '../lib/store';
import { inferSlot, logTemplate } from '../lib/templates';
import type { Slot } from '../lib/types';
import { ErrorBox, Modal, NumInput, Spinner } from './ui';
import { Hint } from './Hint';

interface Detector {
  detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]>;
}
const makeDetector = (): Detector | null => {
  const D = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
  return D ? new D({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] }) : null;
};

/** Escanea un código de barras (cámara en vivo si el navegador lo permite, foto o escribiéndolo) y lo busca en Open Food Facts. */
export function BarcodeScanner({ slot, onClose }: { slot?: Slot; onClose: () => void }) {
  const { state, update, removeWithUndo, undo, undoInfo } = useStore();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [prod, setProd] = useState<BarcodeProduct | null>(null);
  const [grams, setGrams] = useState(100);
  const [live, setLive] = useState(false);
  const [added, setAdded] = useState('');
  const [expires, setExpires] = useState('');
  const [dateRead, setDateRead] = useState(false);
  const [fromPhoto, setFromPhoto] = useState(false); // los valores nutricionales salen de la foto de la tabla
  const [unknownCode, setUnknownCode] = useState('');
  const [newName, setNewName] = useState('');
  const labelRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canLive = !!navigator.mediaDevices && !!makeDetector();

  const search = async (c: string) => {
    setBusy('Buscando producto…');
    setErr('');
    try {
      const p = await lookupBarcode(c);
      if (!p) {
        setUnknownCode(c);
        setErr(`No encuentro el código ${c} en Open Food Facts. Puedes leer la tabla nutricional del envase con una foto.`);
      } else {
        setUnknownCode('');
        setFromPhoto(false);
        setProd(p);
        setGrams(p.serving || 100);
      }
    } catch {
      setErr('No se pudo consultar Open Food Facts (¿sin conexión?).');
    } finally {
      setBusy('');
    }
  };

  const onPhoto = async (f: File | undefined) => {
    if (fileRef.current) fileRef.current.value = '';
    if (!f) return;
    setBusy('Leyendo código…');
    setErr('');
    try {
      let found = '';
      const det = makeDetector();
      if (det) {
        const bmp = await createImageBitmap(f);
        found = (await det.detect(bmp))[0]?.rawValue ?? '';
      }
      // Una sola foto: Gemini lee a la vez el código y la fecha de caducidad (si ambos se ven en el envase).
      if (state.settings.geminiKey.trim()) {
        try {
          const lab = await readLabel(state.settings, await compressToBase64(f, 1280, 0.85));
          if (!found) found = lab.codigo;
          if (lab.fecha) { setExpires(lab.fecha); setDateRead(true); }
        } catch {
          if (!found) found = await readBarcode(state.settings, await compressToBase64(f, 1280, 0.85));
        }
      }
      if (!found) {
        setBusy('');
        setErr('No he podido leer el código. Acércate más, con buena luz, o escríbelo.');
        return;
      }
      setCode(found);
      await search(found);
    } catch (e) {
      setBusy('');
      setErr(e instanceof Error ? e.message : 'Error al leer la foto');
    }
  };

  /** Guarda el producto con sus valores actuales (los editados o leídos de foto) para reutilizarlos al añadirlo a mano. */
  const remember = () => {
    if (!prod) return;
    update((s) => saveProduct(s, { name: prod.name, brand: prod.brand || undefined, code: prod.code || undefined, image: prod.image || undefined, store: state.defaultSupermarket || undefined, kcal: prod.kcal, protein: prod.protein, carbs: prod.carbs, fat: prod.fat, sugars: prod.sugars, satFat: prod.satFat, fiber: prod.fiber, salt: prod.salt, serving: prod.serving || undefined, pack: prod.pack || undefined }));
  };

  /** Foto de la tabla de información nutricional: sustituye (o crea, si el código no estaba) los valores por 100 g. */
  const onLabelPhoto = async (f: File | undefined) => {
    if (labelRef.current) labelRef.current.value = '';
    if (!f) return;
    setBusy('Leyendo la tabla nutricional…');
    setErr('');
    try {
      const v = await readNutritionLabel(state.settings, await compressToBase64(f, 1400, 0.9));
      const base = prod ?? { code: unknownCode || code, name: newName.trim() || 'Producto sin nombre', brand: '', image: '', serving: 0, pack: 0 };
      setProd({ ...base, kcal: v.kcal, protein: v.protein, carbs: v.carbs, fat: v.fat, sugars: v.sugars, satFat: v.satFat, fiber: v.fiber, salt: v.salt, serving: base.serving || v.serving });
      setFromPhoto(true);
      if (!prod) setGrams(v.serving || 100);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'No se pudo leer la tabla nutricional.');
    } finally {
      setBusy('');
    }
  };

  const onDatePhoto = async (f: File | undefined) => {
    if (dateRef.current) dateRef.current.value = '';
    if (!f) return;
    setBusy('Leyendo la fecha…');
    setErr('');
    try {
      const d = await readExpiry(state.settings, await compressToBase64(f, 1280, 0.85));
      if (d) { setExpires(d); setDateRead(true); }
      else setErr('No he podido leer la fecha. Escríbela con el selector.');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error al leer la fecha');
    } finally {
      setBusy('');
    }
  };

  // Cámara en vivo (solo donde exista BarcodeDetector).
  useEffect(() => {
    if (!live) return;
    const det = makeDetector();
    let stream: MediaStream | null = null;
    let timer = 0;
    let stop = false;
    void (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (stop || !videoRef.current || !det) return;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        timer = window.setInterval(async () => {
          if (!videoRef.current) return;
          const r = await det.detect(videoRef.current).catch(() => []);
          if (r[0]?.rawValue) {
            clearInterval(timer);
            setLive(false);
            setCode(r[0].rawValue);
            void search(r[0].rawValue);
          }
        }, 350);
      } catch {
        setLive(false);
        setErr('No se pudo abrir la cámara. Usa «Hacer foto» o escribe el código.');
      }
    })();
    return () => {
      stop = true;
      clearInterval(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [live]);

  const label = prod ? (prod.brand ? `${prod.name} (${prod.brand})` : prod.name) : '';
  const f = (v: number) => Math.round((v * grams) / 100);

  return (
    <Modal title="Escanear código de barras" onClose={onClose}>
      {!prod && (
        <div className="space-y-3">
          {live ? (
            <div className="overflow-hidden rounded-2xl bg-black">
              <video ref={videoRef} playsInline muted className="h-56 w-full object-cover" />
              <button className="btn btn-ghost w-full !rounded-none" onClick={() => setLive(false)}>Cancelar</button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {canLive && <button className="btn btn-green col-span-2" onClick={() => setLive(true)}><ScanBarcode size={18} strokeWidth={1.75} /> Escanear con la cámara</button>}
              <button className={canLive ? 'btn btn-ghost col-span-2' : 'btn btn-green col-span-2'} onClick={() => fileRef.current?.click()}><Camera size={18} strokeWidth={1.75} /> Hacer foto del código y la fecha</button>
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => void onPhoto(e.target.files?.[0])} />
          <div className="flex gap-2">
            <input className="field" inputMode="numeric" placeholder="O escribe los números del código" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} onKeyDown={(e) => e.key === 'Enter' && code.length >= 8 && void search(code)} />
            <button className="btn btn-blue" disabled={code.length < 8 || !!busy} onClick={() => void search(code)} aria-label="Buscar"><Search size={18} /></button>
          </div>
          <Hint className="text-xs text-slate-500">Haz la foto con el código de barras y la fecha de caducidad a la vista: se leen los dos a la vez (con Gemini) y la foto no se guarda. Si el iPhone no permite el lector en vivo, usa la foto.</Hint>
          {busy && <Spinner label={busy} />}
          {err && <ErrorBox msg={err} />}
          {unknownCode && !busy && (
            <div className="space-y-2 rounded-xl bg-slate-800 p-3">
              <div className="text-sm font-semibold text-white">Lee la tabla nutricional del envase</div>
              <input className="field" placeholder="Nombre del producto (opcional)" value={newName} onChange={(e) => setNewName(e.target.value)} aria-label="Nombre del producto" />
              <button className="btn btn-blue w-full" onClick={() => labelRef.current?.click()}><Camera size={16} strokeWidth={1.75} /> Foto de la tabla nutricional</button>
            </div>
          )}
        </div>
      )}
      <input ref={labelRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => void onLabelPhoto(e.target.files?.[0])} />
      {prod && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            {prod.image && <img src={prod.image} alt="" className="h-16 w-16 rounded-xl bg-white object-contain" />}
            <div className="min-w-0">
              <div className="font-bold text-white">{prod.name}</div>
              <div className="text-xs text-slate-400">{prod.brand || 'Sin marca'}</div>
            </div>
          </div>
          <div className="rounded-xl bg-slate-800 p-3">
            <div className="mb-2 flex items-center justify-between gap-2 text-xs">
              <span className="font-semibold uppercase text-slate-400">Valores por 100 g</span>
              <span className={fromPhoto ? 'text-fuel' : 'text-slate-500'}>{fromPhoto ? 'leídos de tu foto' : 'de Open Food Facts'}</span>
            </div>
            {prod.kcal === 0 && prod.protein === 0 && prod.carbs === 0 && prod.fat === 0 && <p className="mb-2 rounded-lg bg-amber-500/15 p-2 text-xs text-amber-500">Open Food Facts no tiene los valores de este producto. Haz una foto a la tabla nutricional.</p>}
            <div className="grid grid-cols-2 gap-x-3 gap-y-2">
              {([['kcal', 'Calorías (kcal)'], ['protein', 'Proteínas (g)'], ['carbs', 'Hidratos (g)'], ['sugars', '· de azúcares (g)'], ['fat', 'Grasas (g)'], ['satFat', '· saturadas (g)'], ['fiber', 'Fibra (g)'], ['salt', 'Sal (g)']] as const).map(([k, l]) => (
                <div key={k}><label className="label !mb-0.5 !text-[10px]">{l}</label><NumInput value={prod[k]} className="field !py-1.5 text-center" onChange={(n) => setProd({ ...prod, [k]: n })} /></div>
              ))}
            </div>
            <button className="btn btn-ghost mt-3 w-full !py-2 text-xs" disabled={!!busy} onClick={() => labelRef.current?.click()}><Camera size={14} strokeWidth={1.75} /> Los valores no coinciden: foto de la tabla nutricional</button>
            <p className="mt-1.5 text-[11px] text-slate-500">Los valores de la base de datos los escribe la comunidad y a veces fallan. Puedes corregirlos aquí a mano o leerlos de la foto del envase.</p>
          </div>
          <div>
            <label className="label">Cantidad que vas a comer (g)</label>
            <NumInput value={grams} className="field text-center" onChange={setGrams} />
            <div className="mt-1 text-xs text-slate-400">{f(prod.kcal)} kcal · P {f(prod.protein)} g · C {f(prod.carbs)} g · G {f(prod.fat)} g · Sal {Math.round((prod.salt * grams) / 100 * 100) / 100} g</div>
          </div>
          <div>
            <label className="label">Caducidad {dateRead && expires ? <span className="font-normal normal-case text-fuel">· leída de la foto, revísala</span> : '(opcional)'}</label>
            <div className="flex gap-2">
              <input type="date" className="field" value={expires} onChange={(e) => setExpires(e.target.value)} />
              <button className="btn btn-ghost shrink-0" disabled={!!busy} onClick={() => dateRef.current?.click()}><Camera size={16} strokeWidth={1.75} /> Leer</button>
            </div>
            <input ref={dateRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => void onDatePhoto(e.target.files?.[0])} />
            <Hint className="mt-1 text-[11px] text-slate-500">El código no incluye la fecha: ponla a mano o con foto (fecha real). Si la dejas vacía, se estimará según el producto y saldrá en violeta como aproximada.</Hint>
          </div>
          <ProductRater prod={prod} />
          {busy && <Spinner label={busy} />}
          {err && <ErrorBox msg={err} />}
          <div className="grid grid-cols-2 gap-2">
            <button className="btn btn-blue" onClick={() => { remember(); removeWithUndo('Añadido a la despensa', (s) => ({ ...s, pantry: addToPantry(s.pantry, [{ name: prod.name, store: state.defaultSupermarket || undefined, expires: expires || undefined, unitGrams: prod.pack || undefined, portionG: prod.serving || undefined }]), productImages: prod.image ? { ...s.productImages, [productKey(prod.name)]: prod.image } : s.productImages })); setAdded('Añadido a la despensa'); }}>A la despensa</button>
            <button className="btn btn-green" disabled={grams <= 0} onClick={() => { remember(); removeWithUndo('Anotado en el diario', (s) => logTemplate(s, { name: `${label} ${grams} g`, calorias: f(prod.kcal), proteinas: f(prod.protein), carbs: f(prod.carbs), grasas: f(prod.fat), ingredientes: [] }, false, slot ?? inferSlot(Date.now()))); setAdded('Registrado en el diario'); }}>Al diario</button>
          </div>
          <p className="text-[11px] text-slate-500">Al añadirlo se guardan sus valores: la próxima vez que escribas este alimento a mano se usarán los tuyos.</p>
          {added && (
            <div className="flex items-center gap-2 text-sm text-fuel">
              <Check size={15} /> {added}
              {undoInfo && <button className="ml-auto rounded-full bg-slate-700 px-3 py-1 text-xs font-bold text-slate-100 active:scale-95" onClick={() => { undo(); setAdded('Deshecho: no se ha guardado'); }}>Deshacer</button>}
            </div>
          )}
          <button className="btn btn-ghost w-full" onClick={() => { setProd(null); setCode(''); setAdded(''); setExpires(''); setDateRead(false); setFromPhoto(false); setUnknownCode(''); setNewName(''); setErr(''); }}>Escanear otro</button>
        </div>
      )}
    </Modal>
  );
}
