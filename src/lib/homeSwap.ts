import { isKneeUnsafe } from './knee';
import type { Exercise, HomeGear, HomeSpecs, TemplateSet } from './types';

export const HOME_GEAR_LABEL: Record<HomeGear, string> = {
  bodyweight: 'Solo peso corporal',
  pullup: 'Barra de dominadas',
  bands: 'Bandas elásticas',
  dumbbells: 'Mancuernas',
  kettlebell: 'Kettlebell',
  bench: 'Banco plano',
  inclinebench: 'Banco inclinable',
  barbell: 'Barra con discos',
  rack: 'Rack / soportes',
  dipbars: 'Paralelas / fondos',
  straps: 'TRX / anillas',
  abwheel: 'Rueda abdominal',
  box: 'Cajón / step',
  backpack: 'Mochila con peso',
  furniture: 'Muebles (mesa y silla)',
};

/** Descripción con detalles, para mostrar y para el prompt de Gemini. */
export const describeGear = (gear: HomeGear[], sp: HomeSpecs): string[] =>
  gear.map((g) => {
    switch (g) {
      case 'dumbbells': return `Mancuernas (hasta ${sp.dumbbellKg} kg por mano)`;
      case 'kettlebell': return `Kettlebell de ${sp.kettlebellKg} kg`;
      case 'bands': return `Bandas elásticas (resistencia ${sp.bandLevel})`;
      case 'backpack': return `Mochila cargada (~${sp.backpackKg} kg)`;
      default: return HOME_GEAR_LABEL[g];
    }
  });

interface Opt {
  id: string;
  all?: HomeGear[];
  any?: HomeGear[];
}

const ok = (o: Opt, g: HomeGear[]): boolean => (o.all ?? []).every((x) => g.includes(x)) && (!o.any || o.any.some((x) => g.includes(x)));

const TABLE: HomeGear[] = ['bench', 'furniture', 'pullup', 'straps'];
const SEAT: HomeGear[] = ['bench', 'furniture', 'box'];

/** Candidatos por patrón de movimiento, en orden de preferencia. */
const POOLS: Record<string, Opt[]> = {
  push: [
    { id: 'Barbell_Bench_Press_-_Medium_Grip', all: ['barbell', 'bench'] },
    { id: 'Dumbbell_Bench_Press', all: ['dumbbells', 'bench'] },
    { id: 'Incline_Dumbbell_Press', all: ['dumbbells', 'inclinebench'] },
    { id: 'Dumbbell_Floor_Press', all: ['dumbbells'] },
    { id: 'Dips_-_Chest_Version', all: ['dipbars'] },
    { id: 'Decline_Push-Up', any: SEAT },
    { id: 'Bench_Press_-_With_Bands', all: ['bands'] },
    { id: 'Pushups' },
  ],
  fly: [
    { id: 'Dumbbell_Flyes', all: ['dumbbells'] },
    { id: 'Push-Up_Wide' },
  ],
  row: [
    { id: 'Bent_Over_Barbell_Row', all: ['barbell'] },
    { id: 'One-Arm_Dumbbell_Row', all: ['dumbbells'] },
    { id: 'Two-Arm_Kettlebell_Row', all: ['kettlebell'] },
    { id: 'Inverted_Row', any: TABLE },
    { id: 'Band_Pull_Apart', all: ['bands'] },
    { id: 'Superman' },
  ],
  vpull: [
    { id: 'Pullups', all: ['pullup'] },
    { id: 'Chin-Up', all: ['pullup'] },
    { id: 'Inverted_Row', any: ['straps'] },
    { id: 'One-Arm_Dumbbell_Row', all: ['dumbbells'] },
    { id: 'Inverted_Row', any: TABLE },
    { id: 'Band_Pull_Apart', all: ['bands'] },
    { id: 'Superman' },
  ],
  hinge: [
    { id: 'Romanian_Deadlift', all: ['barbell'] },
    { id: 'Stiff-Legged_Dumbbell_Deadlift', all: ['dumbbells'] },
    { id: 'One-Arm_Kettlebell_Swings', all: ['kettlebell'] },
    { id: 'Single_Leg_Glute_Bridge' },
  ],
  squat: [
    { id: 'Barbell_Squat', all: ['barbell', 'rack'] },
    { id: 'Front_Barbell_Squat', all: ['barbell', 'rack'] },
    { id: 'Goblet_Squat', all: ['kettlebell'] },
    { id: 'Dumbbell_Squat', all: ['dumbbells'] },
    { id: 'Split_Squat_with_Dumbbells', any: SEAT },
    { id: 'Squats_-_With_Bands', all: ['bands'] },
    { id: 'Bodyweight_Walking_Lunge' },
    { id: 'Bodyweight_Squat' },
  ],
  ham: [
    { id: 'Stiff-Legged_Dumbbell_Deadlift', all: ['dumbbells'] },
    { id: 'Romanian_Deadlift', all: ['barbell'] },
    { id: 'Single_Leg_Glute_Bridge' },
  ],
  glute: [
    { id: 'Barbell_Hip_Thrust', all: ['barbell', 'bench'] },
    { id: 'Hip_Extension_with_Bands', all: ['bands'] },
    { id: 'One-Arm_Kettlebell_Swings', all: ['kettlebell'] },
    { id: 'Single_Leg_Glute_Bridge' },
    { id: 'Butt_Lift_Bridge' },
  ],
  calf: [
    { id: 'Calf_Raise_On_A_Dumbbell', all: ['dumbbells'] },
    { id: 'Calf_Raises_-_With_Bands', all: ['bands'] },
  ],
  press: [
    { id: 'Standing_Military_Press', all: ['barbell'] },
    { id: 'Two-Arm_Kettlebell_Military_Press', all: ['kettlebell'] },
    { id: 'Dumbbell_Shoulder_Press', all: ['dumbbells'] },
    { id: 'Shoulder_Press_-_With_Bands', all: ['bands'] },
    { id: 'Decline_Push-Up', any: SEAT },
    { id: 'Push-Up_Wide' },
  ],
  delt: [
    { id: 'Side_Lateral_Raise', all: ['dumbbells'] },
    { id: 'Lateral_Raise_-_With_Bands', all: ['bands'] },
    { id: 'Band_Pull_Apart', all: ['bands'] },
    { id: 'Superman' },
  ],
  bicep: [
    { id: 'Barbell_Curl', all: ['barbell'] },
    { id: 'Dumbbell_Bicep_Curl', all: ['dumbbells'] },
    { id: 'Chin-Up', all: ['pullup'] },
    { id: 'Inverted_Row', any: ['straps', 'furniture', 'bench'] },
    { id: 'Superman' },
  ],
  tricep: [
    { id: 'Close-Grip_Barbell_Bench_Press', all: ['barbell', 'bench'] },
    { id: 'Dips_-_Triceps_Version', all: ['dipbars'] },
    { id: 'Standing_Dumbbell_Triceps_Extension', all: ['dumbbells'] },
    { id: 'Bench_Dips', any: SEAT },
    { id: 'Decline_Push-Up', any: SEAT },
    { id: 'Push-Up_Wide' },
  ],
  core: [{ id: 'Ab_Roller', all: ['abwheel'] }, { id: 'Reverse_Crunch' }, { id: 'Plank' }],
};

/** Alternativas genéricas sin material, para no repetir el mismo ejercicio en toda la rutina. */
const LAST_RESORT: Opt[] = [{ id: 'Superman' }, { id: 'Plank' }, { id: 'Side_Bridge' }, { id: 'Reverse_Crunch' }, { id: 'Bodyweight_Squat' }, { id: 'Butt_Lift_Bridge' }];

const poolKey = (e: Exercise): string => {
  const n = e.name.toLowerCase();
  switch (e.muscleGroup) {
    case 'Pecho': return /pec deck|cruce|apertura/.test(n) ? 'fly' : 'push';
    case 'Espalda': return /peso muerto|hiperext/.test(n) ? 'hinge' : /remo|pull|face/.test(n) && !/jal[oó]n|dominad|pull-over/.test(n) ? 'row' : 'vpull';
    case 'Cuádriceps': return 'squat';
    case 'Isquios': return /rumano|buenos|nórdico|peso muerto/.test(n) ? 'hinge' : 'ham';
    case 'Glúteos': return 'glute';
    case 'Gemelos': return 'calf';
    case 'Hombros': return /lateral|frontal|pájaro|face pull|mentón|trapecio|encog/.test(n) ? 'delt' : 'press';
    case 'Bíceps': return 'bicep';
    case 'Tríceps': return 'tricep';
    default: return 'core';
  }
};

/** ¿Se puede hacer este ejercicio tal cual con el material de casa? */
export const feasibleAtHome = (e: Exercise, gear: HomeGear[]): boolean => {
  const n = e.name.toLowerCase();
  switch (e.equipment) {
    case 'Mancuernas': return gear.includes('dumbbells') && (!/inclinado/.test(n) || gear.includes('inclinebench')) && (!/banca/.test(n) || gear.includes('bench') || gear.includes('inclinebench'));
    case 'Kettlebell': return gear.includes('kettlebell');
    case 'Banda': return gear.includes('bands');
    case 'Barra': {
      if (!gear.includes('barbell')) return false;
      if (/sentadilla|hack/.test(n)) return gear.includes('rack');
      if (/banca|press cerrado|francés|predicador/.test(n)) return gear.includes('bench') || (gear.includes('inclinebench') && /inclinado/.test(n));
      if (/hip thrust/.test(n)) return gear.includes('bench');
      return true;
    }
    case 'Peso Corporal': {
      if (/dominadas|colgado/.test(n)) return gear.includes('pullup');
      if (/paralelas/.test(n)) return gear.includes('dipbars');
      if (/fondos en banco/.test(n)) return gear.some((g) => SEAT.includes(g));
      if (/invertido/.test(n)) return gear.some((g) => TABLE.includes(g));
      if (/rueda/.test(n)) return gear.includes('abwheel');
      if (/step-up/.test(n)) return gear.includes('box');
      if (/hiperext|nórdico/.test(n)) return false;
      return true;
    }
    default: return false; // máquina, polea
  }
};

/** Sustituto biomecánico para entrenar en casa (o el mismo ejercicio si ya es viable). */
/** Prioridad de sentadillas sin impacto cuando la protección de rodilla está activa. */
const KNEE_SQUAT: Opt[] = [
  { id: 'Dumbbell_Squat_To_A_Bench', all: ['dumbbells'], any: SEAT },
  { id: 'chair-box-squat', any: SEAT },
  { id: 'wall-sit' },
];

export const adaptToHome = (e: Exercise, library: Exercise[], gear: HomeGear[], exclude: Set<string> = new Set(), kneeSafe = false): Exercise => {
  const key = poolKey(e);
  if (feasibleAtHome(e, gear) && !exclude.has(e.id) && !(kneeSafe && isKneeUnsafe(e.name))) return e;
  const base = [...(kneeSafe && key === 'squat' ? KNEE_SQUAT : []), ...(POOLS[key] ?? POOLS.core), ...LAST_RESORT];
  const safe = (o: Opt) => !kneeSafe || !isKneeUnsafe(library.find((x) => x.id === o.id)?.name ?? '');
  const pick = base.find((o) => ok(o, gear) && !exclude.has(o.id) && safe(o)) ?? base[base.length - 1];
  return library.find((x) => x.id === pick.id) ?? e;
};

const TIPS: Partial<Record<Exercise['muscleGroup'], string>> = {
  Pecho: 'pausa 1 s abajo',
  Espalda: 'aprieta escápulas 1 s',
  Cuádriceps: 'baja en 3 s',
  Isquios: 'controla la bajada 3 s',
  Glúteos: 'pausa 2 s arriba',
  Hombros: 'sin balanceo',
  Bíceps: 'sube explosivo, baja 3 s',
  Tríceps: 'codos cerrados',
  Abdominales: 'respira y no arquees la lumbar',
};

export interface HomeSetsResult {
  sets: TemplateSet[];
  note: string;
}

/**
 * Series para casa según la carga real disponible:
 *  - Mancuerna/kettlebell: se limita al máximo que tienes y las repeticiones suben proporcionalmente a la carga que falta.
 *  - Banda / peso corporal: sin carga (o con la mochila si la tienes) y +50 % de repeticiones con tempo lento.
 */
export const adaptSetsForHome = (orig: Exercise, sub: Exercise, sets: TemplateSet[], gear: HomeGear[], sp: HomeSpecs): HomeSetsResult => {
  const tip = TIPS[sub.muscleGroup];
  if (sub.id === 'wall-sit') return { sets: sets.map((x) => ({ type: x.type, weight: 0, reps: 40 })), note: 'isométrico: mantén 30-45 s por serie (reps = segundos), rodillas a 90° sin pasar la punta del pie' };
  if (sub.id === 'chair-box-squat') return { sets: sets.map((x) => ({ type: x.type, weight: 0, reps: x.reps > 0 ? Math.min(20, Math.round(x.reps * 1.2)) : 12 })), note: 'siéntate en la silla sin rebotar, baja en 3 s y sube sin impulso' };
  if (sub.id === orig.id && sub.equipment !== 'Mancuernas' && sub.equipment !== 'Kettlebell') return { sets, note: '' };
  const cap = sub.equipment === 'Mancuernas' ? sp.dumbbellKg : sub.equipment === 'Kettlebell' ? sp.kettlebellKg : 0;
  const bagKg = gear.includes('backpack') && sub.equipment === 'Peso Corporal' && ['Pecho', 'Cuádriceps', 'Glúteos', 'Hombros', 'Tríceps'].includes(sub.muscleGroup) && !/plancha|crunch|superman/i.test(sub.name) ? sp.backpackKg : 0;

  const out = sets.map((s): TemplateSet => {
    if (cap > 0) {
      if (sub.id === orig.id) {
        // Mismo ejercicio: solo se limita al máximo que tienes y se compensa con repeticiones.
        if (s.weight <= cap) return s;
        return { type: s.type, weight: cap, reps: Math.min(30, Math.round(s.reps * (s.weight / cap) ** 0.5)) };
      }
      const wanted = s.weight > 0 ? s.weight * 0.5 : 0; // en casa se parte de ~50 % de la carga de gimnasio
      const w = wanted > 0 ? Math.min(cap, Math.max(2, Math.round(wanted * 2) / 2)) : 0;
      const short = wanted > 0 ? Math.max(0, (wanted - w) / wanted) : 0; // fracción de carga que no tienes
      return { type: s.type, weight: w, reps: s.reps > 0 ? Math.min(30, Math.round(s.reps * (1.2 + 0.6 * short))) : s.reps };
    }
    return { type: s.type, weight: bagKg, reps: s.reps > 0 ? Math.min(30, Math.round(s.reps * (bagKg ? 1.2 : 1.5))) : s.reps };
  });

  const parts: string[] = [];
  if (sub.equipment === 'Banda') parts.push(`banda ${sp.bandLevel}`);
  else if (cap > 0) parts.push(`máx. ${cap} kg`);
  else if (bagKg > 0) parts.push(`mochila ~${bagKg} kg`);
  else parts.push('tempo 3-1-1');
  if (tip) parts.push(tip);
  return { sets: out, note: parts.join(' · ') };
};
