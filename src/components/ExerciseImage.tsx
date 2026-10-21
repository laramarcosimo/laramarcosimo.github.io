import { Activity, Cable, Circle, Cog, Dumbbell, Flame, Footprints, Layers, Shield, Smile, Target, Zap, type LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { posterUrl } from '../lib/exercises';
import { useStore } from '../lib/store';
import type { MuscleGroup } from '../lib/types';
import { cx } from '../lib/utils';

export const MUSCLE_ICONS: Record<MuscleGroup, LucideIcon> = {
  Pecho: Shield,
  Espalda: Layers,
  Hombros: Target,
  Bíceps: Dumbbell,
  Tríceps: Zap,
  Cuádriceps: Footprints,
  Isquios: Activity,
  Glúteos: Circle,
  Gemelos: Footprints,
  Abdominales: Flame,
  Estiramientos: Activity,
  'Rostro y Cuello': Smile,
};

/** Miniatura: póster JPG local con <img lazy>; si falla (o no hay), un icono limpio del grupo muscular. */
/** Icono limpio según el equipo (cuando un ejercicio no tiene ilustración libre equivalente). */
export const EQUIPMENT_ICONS: Record<string, LucideIcon> = { Polea: Cable, Máquina: Cog, Barra: Dumbbell, Mancuernas: Dumbbell, Kettlebell: Dumbbell, Banda: Activity, 'Peso Corporal': Footprints };

export function PosterThumb({ src, alt, size, Icon, className }: { src?: string; alt: string; size: number; Icon: LucideIcon; className?: string }) {
  const [failed, setFailed] = useState(false);
  const box = { width: size, height: size };
  if (!src || failed)
    return (
      <div style={box} className={cx('flex shrink-0 items-center justify-center rounded-xl bg-slate-800 text-accent', className)}>
        <Icon size={Math.round(size * 0.46)} strokeWidth={1.6} />
      </div>
    );
  return (
    <div style={box} className={cx('relative shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-white', className)}>
      <img src={src} alt={alt} loading="lazy" decoding="async" draggable={false} onError={() => setFailed(true)} className="absolute inset-0 h-full w-full object-contain" />
    </div>
  );
}

/**
 * Imagen del ejercicio (estilo Hevy): en miniaturas, el póster estático de su animación; en la vista grande, la animación en bucle.
 * Nunca muestra un muñeco anatómico: si no hay imagen, un icono del grupo muscular.
 */
export function ExerciseImage({ exerciseId, size = 56, className }: { exerciseId: string; size?: number; className?: string }) {
  const { state } = useStore();
  const ex = state.exercises.find((e) => e.id === exerciseId);
  const [failed, setFailed] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<string | null>(null);
  const Icon = EQUIPMENT_ICONS[ex?.equipment ?? ''] ?? MUSCLE_ICONS[ex?.muscleGroup ?? 'Abdominales'];
  const box = { width: size, height: size };

  if (!ex) return <PosterThumb alt="" size={size} Icon={Icon} className={className} />;
  const own = ex.imageUrl.startsWith('data:'); // foto que subiste tú: se respeta
  if (size <= 120 && !own) return <PosterThumb src={posterUrl(ex.imageUrl) || (ex.imageUrl.endsWith('.svg') ? ex.imageUrl : '')} alt={ex.name} size={size} Icon={Icon} className={className} />;
  if (!ex.imageUrl || failed === ex.imageUrl)
    return (
      <div style={box} className={cx('flex shrink-0 flex-col items-center justify-center gap-1 rounded-xl bg-slate-800 text-accent', className)}>
        <Icon size={Math.round(size * 0.3)} strokeWidth={1.6} />
        <span className="text-[10px] font-bold uppercase">{ex.muscleGroup}</span>
        <span className="px-2 text-center text-[10px] text-slate-400">{ex.equipment} · sin imagen disponible</span>
      </div>
    );
  const ready = loaded === ex.imageUrl;
  return (
    <div style={box} className={cx('relative shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-white', className)}>
      {!ready && <div className="absolute inset-0 animate-pulse bg-slate-200" aria-hidden />}
      {ex.imageNote && ready && <span className="absolute inset-x-0 bottom-0 z-10 bg-black/60 px-2 py-1 text-center text-[10px] font-semibold text-white">{ex.imageNote}</span>}
      <img src={ex.imageUrl} alt={ex.name} loading="lazy" decoding="async" draggable={false} onLoad={() => setLoaded(ex.imageUrl)} onError={() => setFailed(ex.imageUrl)} className={cx('absolute inset-0 h-full w-full object-contain transition-opacity', ready ? 'opacity-100' : 'opacity-0')} />
    </div>
  );
}
