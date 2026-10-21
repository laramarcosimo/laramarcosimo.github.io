import { PlayCircle } from 'lucide-react';
import { useState } from 'react';
import { cx } from '../lib/utils';
import type { MuscleKey } from '../lib/muscles';
import { BodyMap, type Motion } from './BodyMap';
import { DemoModal } from './DemoModal';
import { Modal } from './ui';

/** «Ver técnica»: animación en bucle, músculos implicados, 3 puntos de técnica y botón Entendido. */
export function TechniqueModal({ title, imageUrl, muscles, bm, bmSecondary = [], motion, equipment, tips, demoKey, onClose }: { title: string; imageUrl?: string; muscles: string[]; bm: MuscleKey[]; bmSecondary?: MuscleKey[]; motion?: Motion; equipment?: string; tips: string[]; demoKey: string; onClose: () => void }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [demo, setDemo] = useState(false);
  const show = !!imageUrl && !failed;

  return (
    <Modal title={title} onClose={onClose}>
      <div className="space-y-3">
        <div className="relative mx-auto aspect-square w-full max-w-xs overflow-hidden rounded-3xl bg-white ring-1 ring-black/5">
          {show ? (
            <>
              {!loaded && <div className="absolute inset-0 animate-pulse bg-slate-200" aria-hidden />}
              <img src={imageUrl} alt={`Técnica: ${title}`} loading="lazy" draggable={false} onLoad={() => setLoaded(true)} onError={() => setFailed(true)} className={cx('absolute inset-0 h-full w-full object-contain transition-opacity', loaded ? 'opacity-100' : 'opacity-0')} />
            </>
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-slate-800 p-4"><BodyMap primary={bm} secondary={bmSecondary} motion={motion} className="h-full w-full" label={`Músculos y movimiento: ${title}`} /></div>
          )}
        </div>

        <div className="flex flex-wrap justify-center gap-1.5">
          {muscles.map((m) => <span key={m} className="rounded-full bg-accent/15 px-2.5 py-1 text-[11px] font-bold text-accent">{m}</span>)}
          {equipment && <span className="rounded-full bg-slate-800 px-2.5 py-1 text-[11px] font-semibold text-slate-300">{equipment}</span>}
        </div>

        <ul className="space-y-2 rounded-2xl bg-slate-800/60 p-3">
          {tips.map((t, i) => (
            <li key={i} className="flex gap-2.5 text-sm text-slate-200"><span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-white">{i + 1}</span><span>{t}</span></li>
          ))}
        </ul>

        <button className="btn btn-green w-full" onClick={onClose}>Entendido</button>
        <button className="flex w-full items-center justify-center gap-1.5 text-xs font-semibold text-slate-400" onClick={() => setDemo(true)}><PlayCircle size={14} /> Ver también un vídeo (tu enlace)</button>
      </div>
      {demo && <DemoModal demoKey={demoKey} title={title} onClose={() => setDemo(false)} />}
    </Modal>
  );
}
