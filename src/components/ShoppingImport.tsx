import { Camera, ClipboardPaste, Minus, Plus, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { extractShoppingList } from '../lib/gemini';
import { compressToBase64 } from '../lib/image';
import { addToPantry } from '../lib/pantry';
import { parseList, type ParsedItem } from '../lib/shoppingParse';
import { useStore } from '../lib/store';
import { cx, looseMatch } from '../lib/utils';
import { ErrorBox, Modal, Spinner } from './ui';
import { Hint } from './Hint';

interface Row extends ParsedItem {
  on: boolean;
  disliked: boolean;
}

/** Pantalla de revisión: nada se añade sin que lo confirmes; lo que no te gusta sale desmarcado. */
export function ImportReview({ items, onClose }: { items: ParsedItem[]; onClose: () => void }) {
  const { state, update } = useStore();
  const [rows, setRows] = useState<Row[]>(() =>
    items.map((i) => {
      const disliked = state.dislikes.some((d) => looseMatch(d, i.name));
      return { ...i, on: !disliked, disliked };
    }),
  );
  const patch = (i: number, p: Partial<Row>) => setRows((r) => r.map((x, k) => (k === i ? { ...x, ...p } : x)));
  const chosen = rows.filter((r) => r.on);

  return (
    <Modal title="Revisar lista" onClose={onClose}>
      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">No se encontró ningún producto.</p>
      ) : (
        <>
          <Hint className="mb-3 text-xs text-slate-400">Desmarca o quita lo que no quieras en tu despensa. Lo que ya tengas se suma a su cantidad.</Hint>
          <div className="space-y-1.5">
            {rows.map((r, i) => (
              <div key={i} className={cx('flex items-center gap-2 rounded-xl bg-slate-800 px-3 py-2', !r.on && 'opacity-50')}>
                <input type="checkbox" className="h-5 w-5 shrink-0" checked={r.on} onChange={(e) => patch(i, { on: e.target.checked })} aria-label={`Añadir ${r.name}`} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-white">{r.name}</div>
                  {r.disliked && <div className="text-[11px] text-red-400">En tu lista de «no me gusta»</div>}
                </div>
                <button className="rounded-lg bg-slate-900 p-1.5" onClick={() => patch(i, { qty: Math.max(1, r.qty - 1) })} aria-label="Menos"><Minus size={13} /></button>
                <span className="w-6 text-center text-sm tabular-nums text-white">{r.qty}</span>
                <button className="rounded-lg bg-slate-900 p-1.5" onClick={() => patch(i, { qty: r.qty + 1 })} aria-label="Más"><Plus size={13} /></button>
                <button className="p-1 text-slate-500" onClick={() => setRows((x) => x.filter((_, k) => k !== i))} aria-label={`Quitar ${r.name}`}><X size={14} /></button>
              </div>
            ))}
          </div>
        </>
      )}
      <button
        className="btn btn-green mt-4 w-full"
        disabled={chosen.length === 0}
        onClick={() => {
          update((s) => ({ ...s, pantry: addToPantry(s.pantry, chosen.map((r) => ({ name: r.name, qty: r.qty, store: s.defaultSupermarket }))) }));
          onClose();
        }}
      >
        Añadir {chosen.length} producto{chosen.length === 1 ? '' : 's'} a la despensa
      </button>
    </Modal>
  );
}

type Source = 'pegar' | 'captura';

/** Importar la lista de la compra: pegando el texto o subiendo capturas de pantalla (alternativa al Atajo). */
export function ImportModal({ onClose }: { onClose: () => void }) {
  const { state } = useStore();
  const [src, setSrc] = useState<Source>('pegar');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [review, setReview] = useState<ParsedItem[] | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFiles = async (files: FileList | null) => {
    const list = files ? [...files].slice(0, 4) : [];
    if (fileRef.current) fileRef.current.value = '';
    if (list.length === 0) return;
    setBusy(true);
    setErr('');
    try {
      // Las capturas viven solo en memoria durante la lectura y no se guardan.
      let imgs: string[] | null = await Promise.all(list.map((f) => compressToBase64(f, 1280, 0.8)));
      const items = await extractShoppingList(state.settings, imgs);
      imgs = null;
      if (items.length === 0) throw new Error('No encontré productos en la captura. Prueba con otra o pega el texto.');
      setReview(items);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error desconocido');
    } finally {
      setBusy(false);
    }
  };

  if (review) return <ImportReview items={review} onClose={onClose} />;

  return (
    <Modal title="Importar lista de la compra" onClose={onClose}>
      <div className="mb-3 grid grid-cols-2 gap-1 rounded-xl bg-slate-800 p-1">
        {([['pegar', 'Pegar texto', ClipboardPaste], ['captura', 'Subir captura', Camera]] as const).map(([id, l, Icon]) => (
          <button key={id} onClick={() => setSrc(id)} className={cx('flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold', src === id ? 'bg-accent text-white' : 'text-slate-400')}><Icon size={14} strokeWidth={1.75} /> {l}</button>
        ))}
      </div>
      {src === 'pegar' ? (
        <div className="space-y-3">
          <Hint className="text-xs text-slate-400">En Recordatorios selecciona los elementos de tu lista, cópialos y pégalos aquí (una línea por producto).</Hint>
          <textarea rows={7} className="field text-sm" placeholder={'Leche\n2 yogures griegos\nHuevos x12'} value={text} onChange={(e) => setText(e.target.value)} />
          <button className="btn btn-blue w-full" disabled={!text.trim()} onClick={() => setReview(parseList(text))}>Revisar productos</button>
        </div>
      ) : (
        <div className="space-y-3">
          <Hint className="text-xs text-slate-400">Haz una o varias capturas de tu lista (hasta 4) y súbelas. Gemini lee los productos y tú los revisas antes de añadirlos. Las imágenes no se guardan.</Hint>
          <button className="btn btn-blue w-full" disabled={busy || !state.settings.geminiKey} onClick={() => fileRef.current?.click()}><Camera size={16} strokeWidth={1.75} /> Elegir capturas</button>
          {!state.settings.geminiKey && <Hint className="text-[11px] text-slate-500">Necesita la clave de Gemini (Ajustes).</Hint>}
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => void onFiles(e.target.files)} />
          {busy && <Spinner label="Leyendo la lista…" />}
          {err && <ErrorBox msg={err} />}
        </div>
      )}
    </Modal>
  );
}
