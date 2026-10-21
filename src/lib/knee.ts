/** Protección de rodilla: sin saltos ni apoyo directo de rodilla en el suelo. */
export const KNEE_UNSAFE = /salto|jump|burpee|comba|pliom|arrodill|kneeling|drag squat|de rodillas/i;

export const isKneeUnsafe = (name: string): boolean => KNEE_UNSAFE.test(name);

/** Alternativa de gimnasio con prensa inclinada, rango seguro y control. */
export const GYM_KNEE_SAFE_ID = 'Leg_Press';

export const KNEE_RULES_PROMPT =
  'REGLAS ESTRICTAS DE PROTECCIÓN DE RODILLA: PROHIBIDO sugerir saltos (cajón, comba, jump squats, burpees, pliometría) y ejercicios con apoyo directo de la rodilla en el suelo sin acolchado (zancadas arrodilladas, drag squats). Prioriza cuádriceps sin impacto: en gimnasio prensa inclinada con pies a media altura sin hiperextender, hack squat controlado, peso muerto rumano, curl femoral y extensión de cuádriceps en rango medio con tempo; en casa wall-sit, box squat controlado sentado a una silla, puente de glúteos y peso muerto rumano con mancuernas o bandas.';
