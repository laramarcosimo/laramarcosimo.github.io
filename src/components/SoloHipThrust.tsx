import { RefreshCw } from 'lucide-react';
import { useStore } from '../lib/store';
import { Hint } from './Hint';
import { Modal } from './ui';

export const HIP_THRUST_ID = 'Barbell_Hip_Thrust';

const OPTIONS: { id: string; title: string; text: string }[] = [
  { id: 'hip-thrust-machine', title: 'Máquina de Hip Thrust (plate-loaded o selectorizada)', text: 'Se ajusta con cinturón o palanca: sin balancear discos pesados y sin ayuda de nadie.' },
  { id: 'hip-thrust-smith', title: 'Hip Thrust en Multipower (Smith)', text: 'Barra guiada con tope de seguridad giratorio: la montas tú sola con total control.' },
  { id: 'hip-thrust-single', title: 'Hip Thrust unilateral (1 pierna)', text: 'Con mancuerna o en banco: excelente activación con carga ligera y montaje autónomo en 10 segundos.' },
];

/** «Si entreno sola»: cambia el Hip Thrust SOLO en esta sesión por una alternativa con el mismo estímulo en glúteo que se monta sin ayuda. */
export function SoloHipThrust({ onPick, onClose }: { onPick: (exerciseId: string) => void; onClose: () => void }) {
  const { state } = useStore();
  return (
    <Modal title="Si entreno sola" onClose={onClose}>
      <Hint className="mb-3 text-sm text-slate-400">Mismo estímulo en glúteo, sin necesitar ayuda. El cambio es solo para hoy: tu rutina no se modifica, mantienes las 3 series y los datos se guardan en el histórico de cada ejercicio.</Hint>
      <div className="space-y-2">
        {OPTIONS.map((o) => {
          const ex = state.exercises.find((e) => e.id === o.id);
          if (!ex) return null;
          return (
            <button key={o.id} className="flex w-full items-start gap-3 rounded-xl bg-slate-800 p-3 text-left active:scale-[0.99]" onClick={() => onPick(o.id)}>
              <RefreshCw size={18} strokeWidth={1.75} className="mt-0.5 shrink-0 text-accent" />
              <span><span className="block text-sm font-semibold text-white">{o.title}</span><span className="block text-xs text-slate-400">{o.text}</span></span>
            </button>
          );
        })}
      </div>
    </Modal>
  );
}
