import { Apple, Bean, Beef, Camera, Image as ImageIcon, Link2, Milk, Package, RotateCcw, Search, Wheat, type LucideIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { compressToBase64 } from '../lib/image';
import { cleanName, findProductImage, forgetCachedImage, productKey, searchImageCandidates, type ImageCandidate } from '../lib/openfood';
import { useStore } from '../lib/store';
import { norm } from '../lib/utils';
import { storeInfo, storeInitials } from '../lib/stores';
import { ErrorBox, Modal, Spinner } from './ui';
import { Hint } from './Hint';

const CATS: { re: RegExp; icon: LucideIcon; color: string }[] = [
  { re: /leche|yogur|queso|mantequilla|nata|kefir|requeson|skyr|lacteo/, icon: Milk, color: '#38bdf8' },
  { re: /pollo|pavo|ternera|cerdo|jamon|atun|salmon|pescado|huevo|carne|lata|gamba|bacalao|merluza|proteina/, icon: Beef, color: '#f87171' },
  { re: /lenteja|garbanzo|alubia|judia|soja|tofu|guisante|legumbre|hummus/, icon: Bean, color: '#a3e635' },
  { re: /tomate|cebolla|platano|manzana|naranja|lechuga|zanahoria|pimiento|espinaca|brocoli|fruta|verdura|aguacate|calabacin|pepino|limon|fresa|uva/, icon: Apple, color: '#4ade80' },
  { re: /arroz|pasta|pan |pan$|avena|patata|harina|cereal|cuscus|quinoa|galleta|tortita|maiz/, icon: Wheat, color: '#fbbf24' },
];

/**
 * Miniatura del producto. La foto se aprende: la primera vez se busca en Open Food Facts (solo si hay coincidencia
 * fiable) y se guarda por producto; si el producto vuelve a aparecer, se reutiliza. Un toque permite corregirla.
 */
export function ProductThumb({ name, store, size = 44, editable = false }: { name: string; store?: string; size?: number; editable?: boolean }) {
  const { state, update } = useStore();
  const key = productKey(name);
  const saved = state.productImages[key]; // undefined = aún sin resolver
  const [broken, setBroken] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (saved !== undefined || !key) return;
    let live = true;
    void findProductImage(name, store).then((u) => {
      if (live && u) update((s) => (s.productImages[key] === undefined ? { ...s, productImages: { ...s.productImages, [key]: u } } : s));
    });
    return () => {
      live = false;
    };
  }, [saved, key, name, store, update]);

  useEffect(() => setBroken(false), [saved]);

  const n = norm(name);
  const cat = CATS.find((c) => c.re.test(n)) ?? { icon: Package, color: '#94a3b8' };
  const Icon = cat.icon;
  const box = { width: size, height: size };
  const img = saved && !broken ? saved : '';

  const face = (
    <div style={box} className="relative shrink-0">
      {img ? (
        <img src={img} alt={name} loading="lazy" onError={() => setBroken(true)} className="h-full w-full rounded-xl bg-white object-contain" />
      ) : (
        <div style={{ ...box, backgroundColor: cat.color + '26', color: cat.color }} className="flex items-center justify-center rounded-xl">
          <Icon size={Math.round(size * 0.5)} />
        </div>
      )}
      {store && (
        <span style={{ backgroundColor: storeInfo(store).color }} className="absolute -bottom-1 -right-1 rounded-md px-1 text-[8px] font-black leading-4 text-white ring-2 ring-slate-900">
          {storeInitials(store)}
        </span>
      )}
    </div>
  );

  if (!editable) return face;
  return (
    <>
      <button onClick={() => setOpen(true)} aria-label="Cambiar foto del producto" className="shrink-0">{face}</button>
      {open && <PhotoModal name={name} img={img} onClose={() => setOpen(false)} />}
    </>
  );
}

function PhotoModal({ name, img, onClose }: { name: string; img: string; onClose: () => void }) {
  const { update } = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);
  const key = productKey(name);
  const [q, setQ] = useState(cleanName(name));
  const [list, setList] = useState<ImageCandidate[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [url, setUrl] = useState('');

  const set = (value: string | undefined) =>
    update((s) => {
      const next = { ...s.productImages };
      if (value === undefined) delete next[key];
      else next[key] = value;
      return { ...s, productImages: next };
    });

  const search = async () => {
    setBusy(true);
    setErr('');
    try {
      const r = await searchImageCandidates(q.trim() || name);
      setList(r);
      if (r.length === 0) setErr('Sin resultados. Prueba con otro nombre o marca.');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'No se pudo buscar');
    } finally {
      setBusy(false);
    }
  };

  const useUrl = () => {
    const u = url.trim();
    if (!/^https?:\/\//i.test(u)) return setErr('Pega una URL de imagen que empiece por http(s)://');
    const probe = new Image();
    probe.onload = () => {
      set(u);
      onClose();
    };
    probe.onerror = () => setErr('No se pudo cargar esa imagen.');
    probe.src = u;
  };

  const onFile = async (f: File | undefined, ref: React.RefObject<HTMLInputElement | null>) => {
    if (ref.current) ref.current.value = '';
    if (!f) return;
    try {
      set(`data:image/jpeg;base64,${await compressToBase64(f, 320, 0.8)}`);
      onClose();
    } catch {
      setErr('Imagen ilegible.');
    }
  };

  return (
    <Modal title="Cambiar imagen" onClose={onClose}>
      <div className="mb-3 flex items-center gap-3">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white">
          {img ? <img src={img} alt={name} className="h-full w-full object-contain" /> : <Package size={32} strokeWidth={1.5} className="text-slate-400" />}
        </div>
        <div className="min-w-0">
          <div className="truncate font-semibold text-white">{name}</div>
          <Hint className="text-xs text-slate-400">Se asocia a este producto para siempre.</Hint>
        </div>
      </div>

      <div className="flex gap-2">
        <input className="field" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void search()} placeholder="Nombre y marca" />
        <button className="btn btn-blue" disabled={busy} onClick={() => void search()} aria-label="Buscar"><Search size={16} strokeWidth={1.75} /></button>
      </div>
      {busy && <Spinner label="Buscando en Open Food Facts…" />}
      {err && <div className="mt-2"><ErrorBox msg={err} /></div>}
      {list && list.length > 0 && (
        <div className="mt-3 grid grid-cols-4 gap-2">
          {list.map((c) => (
            <button key={c.url} title={c.label} onClick={() => { set(c.url); onClose(); }} className="aspect-square overflow-hidden rounded-xl bg-white p-1 active:scale-95">
              <img src={c.url} alt={c.label} loading="lazy" className="h-full w-full object-contain" />
            </button>
          ))}
        </div>
      )}

      <div className="mt-4 flex gap-2">
        <input className="field" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Pegar URL de imagen" inputMode="url" />
        <button className="btn btn-ghost" disabled={!url.trim()} onClick={useUrl}><Link2 size={16} strokeWidth={1.75} /></button>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button className="btn btn-ghost" onClick={() => camRef.current?.click()}><Camera size={16} strokeWidth={1.75} /> Tomar foto</button>
        <button className="btn btn-ghost" onClick={() => fileRef.current?.click()}><ImageIcon size={16} strokeWidth={1.75} /> Galería</button>
        <button className="btn btn-ghost" onClick={() => { set(''); onClose(); }}>Solo icono</button>
        <button className="btn btn-ghost" onClick={() => { forgetCachedImage(name); set(undefined); onClose(); }}><RotateCcw size={16} strokeWidth={1.75} /> Automática</button>
      </div>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => void onFile(e.target.files?.[0], fileRef)} />
      <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => void onFile(e.target.files?.[0], camRef)} />
    </Modal>
  );
}
