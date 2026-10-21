import { ExternalLink, Search, Video } from 'lucide-react';
import { useState } from 'react';
import { DEFAULT_DEMOS, embedUrl, searchUrl, watchUrl, ytId } from '../lib/demo';
import { useStore } from '../lib/store';
import { ErrorBox, Modal } from './ui';

/** «Ver demostración»: vídeo vertical (Shorts) en una ventana rápida, sin salir de la sesión. El enlace es tuyo y se guarda. */
export function DemoModal({ demoKey, title, onClose }: { demoKey: string; title: string; onClose: () => void }) {
  const { state, update } = useStore();
  const saved = state.demoLinks[demoKey];
  const id = ytId(saved ?? '') ?? ytId(DEFAULT_DEMOS[demoKey] ?? '');
  const [edit, setEdit] = useState(!id);
  const [link, setLink] = useState('');
  const [err, setErr] = useState('');

  const save = () => {
    if (!ytId(link)) return setErr('Pega un enlace de YouTube (vídeo o Short).');
    update((s) => ({ ...s, demoLinks: { ...s.demoLinks, [demoKey]: link.trim() } }));
    setLink('');
    setErr('');
    setEdit(false);
  };

  return (
    <Modal title={title} onClose={onClose}>
      {id && !edit && (
        <div className="space-y-3">
          <div className="mx-auto aspect-[9/16] max-h-[55vh] overflow-hidden rounded-2xl bg-black">
            <iframe className="h-full w-full" src={embedUrl(id)} title={`Demostración: ${title}`} loading="lazy" allow="accelerometer; encrypted-media; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <a className="btn btn-ghost" href={watchUrl(id)} target="_blank" rel="noopener noreferrer"><ExternalLink size={15} /> Abrir en YouTube</a>
            <button className="btn btn-ghost" onClick={() => setEdit(true)}>Cambiar enlace</button>
          </div>
        </div>
      )}
      {edit && (
        <div className="space-y-3">
          <p className="text-sm text-slate-300">{id ? 'Elige otro vídeo para este ejercicio.' : 'Aún no hay vídeo para este ejercicio.'} Busca una demostración con una entrenadora o fisioterapeuta en formato vertical (Shorts), copia su enlace y pégalo aquí: se guarda y se verá dentro de la app.</p>
          <a className="btn btn-blue w-full" href={searchUrl(title)} target="_blank" rel="noopener noreferrer"><Search size={16} /> Buscar demostraciones en YouTube</a>
          <div className="flex gap-2">
            <input className="field" placeholder="Pega el enlace de YouTube / Short" value={link} onChange={(e) => setLink(e.target.value)} inputMode="url" autoCapitalize="none" />
            <button className="btn btn-green shrink-0" disabled={!link.trim()} onClick={save}><Video size={16} /> Guardar</button>
          </div>
          {err && <ErrorBox msg={err} />}
          {id && <div className="flex gap-2"><button className="btn btn-ghost flex-1" onClick={() => setEdit(false)}>Volver al vídeo</button>{saved && <button className="btn btn-ghost flex-1 !text-red-400" onClick={() => { update((s) => { const d = { ...s.demoLinks }; delete d[demoKey]; return { ...s, demoLinks: d }; }); setEdit(false); }}>Quitar el mío</button>}</div>}
        </div>
      )}
    </Modal>
  );
}
