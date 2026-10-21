import { MapPin } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useStore } from '../lib/store';
import { num, uid } from '../lib/utils';
import { Modal, NumInput } from './ui';

export type MeasureKind = 'weight' | 'hip' | 'waist' | 'belly' | 'thigh' | 'arm' | 'chest';

/** Medidas disponibles (peso, cadera y cintura son las principales; el resto son opcionales). */
export const MEASURES: { id: MeasureKind; label: string; unit: string }[] = [
  { id: 'weight', label: 'Peso', unit: 'kg' },
  { id: 'hip', label: 'Cadera', unit: 'cm' },
  { id: 'waist', label: 'Cintura', unit: 'cm' },
  { id: 'belly', label: 'Barriga baja', unit: 'cm' },
  { id: 'thigh', label: 'Muslo', unit: 'cm' },
  { id: 'arm', label: 'Brazo', unit: 'cm' },
  { id: 'chest', label: 'Pecho', unit: 'cm' },
];

export const lastOf = (list: { ts: number; weight?: number; hip?: number; waist?: number; belly?: number; thigh?: number; arm?: number; chest?: number }[], k: MeasureKind): number | undefined =>
  [...list].filter((m) => (m[k] ?? 0) > 0).sort((a, b) => b.ts - a.ts)[0]?.[k];

const META: Record<MeasureKind, { title: string; unit: string; tip: string; ref?: string }> = {
  weight: { title: 'Peso', unit: 'kg', tip: 'En ayunas, al levantarte.' },
  hip: { title: 'Cadera', unit: 'cm', tip: 'Punto de máxima proyección del glúteo (con pies juntos).', ref: 'Mitad exacta del glúteo' },
  thigh: { title: 'Muslo', unit: 'cm', tip: 'Parte más ancha del muslo, de pie y relajada.', ref: 'Parte alta del muslo, bajo el glúteo' },
  arm: { title: 'Brazo', unit: 'cm', tip: 'Brazo relajado, a la mitad entre hombro y codo.', ref: 'Punto medio del bíceps' },
  chest: { title: 'Pecho', unit: 'cm', tip: 'Cinta horizontal por la parte más ancha del pecho, soltando el aire.', ref: 'A la altura del pezón' },
  waist: { title: 'Cintura', unit: 'cm', tip: 'Por encima del ombligo (zona más estrecha).', ref: '~2 cm arriba del ombligo' },
  belly: { title: 'Barriga baja', unit: 'cm', tip: 'De pie y relajada, sin meter tripa, al final de una exhalación. Cinta horizontal por la parte más prominente de la barriga baja.', ref: '~4 cm por debajo del ombligo' },
};

const SKIN = '#F1C9AA';
const SKIN_SHADE = '#E2B08F';
const TOP = '#64748B';
const SHORTS = '#475569';
const TAPE = '#FACC15';
const FRONT_LABEL: Record<string, string> = { waist: 'Torso femenino de frente con la cinta métrica por encima del ombligo', belly: 'Torso femenino de frente con la cinta por debajo del ombligo, en la barriga baja', chest: 'Torso femenino de frente con la cinta a la altura del pecho', arm: 'Brazo con la cinta en el punto medio del bíceps', thigh: 'Muslo con la cinta en la parte más ancha' };

/** Cinta de sastre horizontal con marcas de cm (curva = perspectiva al rodear el cuerpo). */
function Tape({ x1, x2, y, bend, tail, thin }: { x1: number; x2: number; y: number; bend: number; tail?: boolean; thin?: boolean }) {
  const k = thin ? 0.7 : 1;
  const d = `M${x1} ${y} Q${(x1 + x2) / 2} ${y + bend} ${x2} ${y}`;
  return (
    <g>
      <path d={d} fill="none" stroke="#B45309" strokeWidth={7.4 * k} strokeLinecap="round" opacity=".35" transform="translate(0 1)" />
      <path d={d} fill="none" stroke={TAPE} strokeWidth={6.4 * k} strokeLinecap="round" />
      <path d={d} fill="none" stroke="#1E293B" strokeWidth={2.6 * k} strokeDasharray="0.7 3.3" opacity=".75" />
      {tail && <path d={`M${x2} ${y} q5 6 3 15`} fill="none" stroke={TAPE} strokeWidth="5" strokeLinecap="round" />}
    </g>
  );
}

/** Dibujo anatómico que señala dónde medir. */
function Where({ kind }: { kind: MeasureKind }) {
  if (kind === 'weight')
    return (
      <svg viewBox="0 0 120 160" className="h-full w-full" role="img" aria-label="Báscula">
        <rect x="18" y="40" width="84" height="68" rx="16" fill="#CBD5E1" />
        <rect x="18" y="40" width="84" height="68" rx="16" fill="none" stroke="#94A3B8" strokeWidth="3" />
        <path d="M38 74a22 22 0 0 1 44 0" fill="none" stroke="#10B981" strokeWidth="5" strokeLinecap="round" />
        <line x1="60" y1="78" x2="71" y2="62" stroke="#0F172A" strokeWidth="3.5" strokeLinecap="round" />
        <circle cx="60" cy="78" r="4" fill="#0F172A" />
        <ellipse cx="42" cy="98" rx="11" ry="5" fill="#94A3B8" /><ellipse cx="78" cy="98" rx="11" ry="5" fill="#94A3B8" />
      </svg>
    );
  if (kind === 'waist' || kind === 'belly' || kind === 'chest' || kind === 'arm' || kind === 'thigh')
    return (
      <svg viewBox="0 0 136 160" className="h-full w-full" role="img" aria-label={FRONT_LABEL[kind]}>
        {/* Brazos */}
        <path d="M25 24C17 36 14 58 12 82C11 92 17 93 20 84C24 66 28 50 34 38Z" fill={SKIN} />
        <path d="M95 24C103 36 106 58 108 82C109 92 103 93 100 84C96 66 92 50 86 38Z" fill={SKIN} />
        {/* Torso: hombros, cintura marcada, caderas */}
        <path d="M50 8C44 12 30 14 24 22C22 27 24 33 29 40C34 54 38 68 39 84C40 98 28 106 29 124C30 138 32 148 34 160L86 160C88 148 90 138 91 124C92 106 80 98 81 84C82 68 86 54 91 40C96 33 98 27 96 22C90 14 76 12 70 8Z" fill={SKIN} />
        <path d="M39 84C40 98 28 106 29 124C30 138 32 148 34 160L40 160C38 146 38 130 40 118C41 106 46 98 44 86Z" fill={SKIN_SHADE} opacity=".5" />
        {/* Cuello y clavículas */}
        <path d="M51 8L51 18L69 18L69 8Z" fill={SKIN_SHADE} />
        <path d="M44 24Q52 28 58 25M76 24Q68 28 62 25" stroke={SKIN_SHADE} strokeWidth="1.6" fill="none" strokeLinecap="round" />
        {/* Top deportivo y shorts */}
        <path d="M31 36C40 40 80 40 89 36C88 46 88 50 85 55C70 59 50 59 35 55C32 50 32 46 31 36Z" fill={TOP} />
        <path d="M29 112C45 118 75 118 91 112C92 124 91 140 90 160L64 160L60 130L56 160L30 160C29 140 28 124 29 112Z" fill={SHORTS} />
        {/* Abdomen: línea alba y ombligo */}
        <path d="M60 60L60 90" stroke={SKIN_SHADE} strokeWidth="1.2" strokeLinecap="round" opacity=".7" />
        <ellipse cx="60" cy="97" rx="2.4" ry="3.4" fill="#C98F6E" />
        <path d="M45 66Q60 72 75 66" stroke={SKIN_SHADE} strokeWidth="1" fill="none" opacity=".5" />

        {kind === 'waist' && (
          <>
            <Tape x1={30} x2={90} y={84} bend={7} tail />
            <path d="M103 97L66 97" stroke="#0F172A" strokeWidth="1" strokeDasharray="2 2" opacity=".6" /><text x="104" y="100" fontSize="6.5" fill="#0F172A" fontWeight="700">ombligo</text>
            <path d="M103 84L92 84" stroke="#0F172A" strokeWidth="1" strokeDasharray="2 2" opacity=".6" /><text x="104" y="80" fontSize="6.5" fill="#B45309" fontWeight="700">cinta</text>
            <path d="M100 88L100 94" stroke="#0F172A" strokeWidth="1" opacity=".6" /><text x="86" y="108" fontSize="6" fill="#0F172A">≈2 cm</text>
          </>
        )}
        {kind === 'belly' && (
          <>
            <Tape x1={31} x2={89} y={108} bend={6} tail />
            <path d="M103 97L66 97" stroke="#0F172A" strokeWidth="1" strokeDasharray="2 2" opacity=".6" /><text x="104" y="95" fontSize="6.5" fill="#0F172A" fontWeight="700">ombligo</text>
            <path d="M103 109L92 109" stroke="#0F172A" strokeWidth="1" strokeDasharray="2 2" opacity=".6" /><text x="104" y="113" fontSize="6.5" fill="#B45309" fontWeight="700">cinta</text>
            <path d="M100 98L100 108" stroke="#0F172A" strokeWidth="1" opacity=".6" /><text x="104" y="105" fontSize="6" fill="#0F172A">≈4 cm</text>
          </>
        )}
        {kind === 'chest' && (
          <>
            <Tape x1={29} x2={91} y={47} bend={7} tail />
            <path d="M104 47L94 47" stroke="#0F172A" strokeWidth="1" strokeDasharray="2 2" opacity=".6" /><text x="105" y="50" fontSize="6.5" fill="#B45309" fontWeight="700">cinta</text>
            <text x="98" y="38" fontSize="6" fill="#0F172A">pezón</text>
          </>
        )}
        {kind === 'arm' && (
          <>
            <Tape x1={12} x2={32} y={52} bend={4} thin />
            <path d="M12 52L4 40" stroke="#0F172A" strokeWidth="1" strokeDasharray="2 2" opacity=".6" /><text x="1" y="36" fontSize="6.5" fill="#B45309" fontWeight="700">cinta</text>
            <text x="1" y="128" fontSize="6" fill="#0F172A">punto medio</text><text x="1" y="136" fontSize="6" fill="#0F172A">hombro-codo</text>
          </>
        )}
        {kind === 'thigh' && (
          <>
            <Tape x1={29} x2={61} y={124} bend={5} />
            <path d="M64 126L100 126" stroke="#0F172A" strokeWidth="1" strokeDasharray="2 2" opacity=".6" /><text x="101" y="129" fontSize="6.5" fill="#B45309" fontWeight="700">cinta</text>
            <text x="100" y="146" fontSize="6" fill="#0F172A">muslo</text>
          </>
        )}
      </svg>
    );
  return (
    <svg viewBox="0 0 120 160" className="h-full w-full" role="img" aria-label="Silueta femenina de perfil con la cinta métrica en el punto más saliente del glúteo">
      {/* Brazo (detrás) */}
      <path d="M56 26C60 44 60 66 56 84C55 90 61 90 62 84C66 66 66 44 62 26Z" fill={SKIN_SHADE} />
      {/* Cuerpo de perfil, mirando a la derecha: espalda, curva lumbar, glúteo, muslo */}
      <path d="M50 14C45 28 43 46 46 62C48 76 40 86 35 100C30 114 36 126 42 136C46 144 47 152 47 160L76 160C76 148 76 134 73 120C71 108 70 96 67 84C65 72 71 58 69 42C68 30 64 20 58 14Z" fill={SKIN} />
      <path d="M46 62C48 76 40 86 35 100C30 114 36 126 42 136C44 140 45 143 46 147C41 134 38 120 41 106C44 94 50 82 49 68Z" fill={SKIN_SHADE} opacity=".55" />
      {/* Cuello */}
      <path d="M52 6L52 16L62 16L62 6Z" fill={SKIN_SHADE} />
      {/* Top deportivo */}
      <path d="M48 28C54 30 62 30 68 28C69 36 70 42 68 50C62 52 54 52 48 50C46 42 46 34 48 28Z" fill={TOP} />
      {/* Pbusto de perfil */}
      <path d="M68 34C73 38 73 46 69 50" fill={TOP} stroke={TOP} strokeWidth="1" />
      {/* Shorts */}
      <path d="M44 92C54 96 66 96 72 92C74 104 75 114 76 128L47 128C41 116 39 104 44 92Z" fill={SHORTS} />
      {/* Cinta: circunferencia máxima del glúteo (punto más saliente hacia atrás) */}
      <Tape x1={24} x2={80} y={106} bend={5} />
      {/* Punto de máxima proyección */}
      <circle cx="34" cy="106" r="3" fill="#EF4444" stroke="#fff" strokeWidth="1.2" />
      <path d="M14 94L30 103" stroke="#0F172A" strokeWidth="1" strokeDasharray="2 2" opacity=".7" />
      <text x="4" y="90" fontSize="6.5" fill="#B91C1C" fontWeight="700">máx. proyección</text>
      <path d="M84 106L92 106" stroke="#0F172A" strokeWidth="1" strokeDasharray="2 2" opacity=".6" /><text x="94" y="109" fontSize="6.5" fill="#B45309" fontWeight="700">cinta</text>
      {/* Pies juntos (se intuyen detrás) */}
      <ellipse cx="62" cy="158" rx="14" ry="2.6" fill="#0F172A" opacity=".18" />
    </svg>
  );
}

/** Entrada rápida de peso, cadera o cintura al tocar la tarjeta: foco inmediato, decimales con coma o punto y dibujo de dónde medir. */
export function MeasureEntry({ kind, onClose }: { kind: MeasureKind; onClose: () => void }) {
  const { state, update } = useStore();
  const m = META[kind];
  const current = lastOf(state.measurements, kind) ?? (kind === 'weight' ? state.profile.weight : 0);
  const [val, setVal] = useState(current);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => wrap.current?.querySelector('input')?.focus(), 60);
    return () => clearTimeout(t);
  }, []);

  const waist = kind === 'waist' ? val : lastOf(state.measurements, 'waist') ?? 0;
  const hip = kind === 'hip' ? val : lastOf(state.measurements, 'hip') ?? 0;
  const ratio = waist > 0 && hip > 0 ? Math.round((waist / hip) * 100) / 100 : null;

  const save = () => {
    const v = num(val);
    if (v > 0) {
      update((s) => ({
        ...s,
        measurements: [...s.measurements, { id: uid(), ts: Date.now(), [kind]: v }],
        profile: kind === 'weight' ? { ...s.profile, weight: v } : s.profile, // el peso actualiza tus metas de calorías y proteína
      }));
    }
    onClose();
  };

  return (
    <Modal title={m.title} onClose={onClose}>
      <div ref={wrap} className="grid grid-cols-[1fr_auto] items-start gap-3 pb-10" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 40px)" }} onKeyDown={(e) => e.key === 'Enter' && save()}>
        <div className="space-y-3">
          <div>
            <label className="label">{m.title} ({m.unit})</label>
            <NumInput value={val} placeholder="0.0" className="field text-center text-3xl font-black" onChange={setVal} />
          </div>
          <button className="btn btn-green w-full" onClick={save} disabled={!(num(val) > 0)}>Guardar</button>
          {ratio !== null && kind !== 'weight' && <div className="rounded-full bg-accent/15 px-3 py-1.5 text-center text-xs font-bold text-accent">Ratio Cintura-Cadera: {ratio.toFixed(2)}</div>}
        </div>
        <div className="flex flex-col items-center gap-2">
          <div className="h-[176px] w-[132px] overflow-hidden rounded-2xl bg-slate-800 p-1.5 ring-1 ring-black/5"><Where kind={kind} /></div>
          {m.ref && <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/20 px-2.5 py-1 text-[11px] font-bold text-amber-600"><MapPin size={12} strokeWidth={2} /> Referencia: {m.ref}</span>}
          <p className="text-center text-xs font-semibold text-slate-300">{m.tip}</p>
        </div>
      </div>
    </Modal>
  );
}
