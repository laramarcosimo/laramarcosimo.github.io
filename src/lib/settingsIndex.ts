export interface SettingEntry {
  /** Qué ve la usuaria en el resultado. */
  label: string;
  /** Apartado de Ajustes donde está. */
  section: string;
  sectionTitle: string;
  /** Palabras que también deben encontrarlo. */
  words: string;
}

const E = (section: string, sectionTitle: string, label: string, words: string): SettingEntry => ({ section, sectionTitle, label, words });

export const SETTINGS_INDEX: SettingEntry[] = [
  E('perfil', 'Perfil y objetivos', 'Edad, altura y peso', 'datos biometricos perfil sexo'),
  E('perfil', 'Perfil y objetivos', 'Objetivo (recomposición, déficit…)', 'meta deficit superavit mantenimiento recomposicion'),
  E('perfil', 'Perfil y objetivos', 'Actividad diaria y calorías (TMB)', 'tmb metabolismo actividad'),
  E('perfil', 'Perfil y objetivos', 'Baremo de grasas y carbohidratos (entreno / sin entreno)', 'grasa grasas carbohidratos carbos hidratos macros gramos objetivo baremo minimo maximo descanso sin entreno'),
  E('perfil', 'Perfil y objetivos', 'Rango de proteína', 'proteina proteínas minimo maximo gramos'),
  E('perfil', 'Perfil y objetivos', 'Rangos de calorías', 'kcal calorias minimo maximo flexibles'),
  E('entreno', 'Entrenamiento', 'Mis días de entreno', 'dias semana descanso calendario'),
  E('entreno', 'Entrenamiento', 'Objetivo semanal de entrenos', 'racha semana meta'),
  E('entreno', 'Entrenamiento', 'Protección de rodilla', 'rodilla lesion saltos'),
  E('entreno', 'Entrenamiento', 'Material en casa', 'equipamiento mancuernas bandas casa gimnasio'),
  E('entreno', 'Entrenamiento', 'Modo vacaciones', 'vacaciones viaje mantenimiento pausa'),
  E('entreno', 'Entrenamiento', 'Descanso entre series', 'temporizador sonido vibracion descanso'),
  E('comida', 'Alimentación', 'Supermercado predeterminado', 'tienda mercadona hiperdino lidl carrefour compra'),
  E('comida', 'Alimentación', 'Utensilios de cocina', 'airfryer horno sarten microondas recetas'),
  E('comida', 'Alimentación', 'Meriendas fuera de casa', 'universidad merienda dias'),
  E('supl', 'Suplementación', 'Suplementos', 'creatina proteina vitaminas magnesio omega'),
  E('avisos', 'Avisos y recordatorios', 'Aviso de Face Yoga', 'cara yoga facial noche recordatorio'),
  E('avisos', 'Avisos y recordatorios', 'Recordatorio mensual de la foto', 'fotos progreso mes recordatorio'),
  E('avisos', 'Avisos y recordatorios', 'Aviso de cena tras entrenar', 'post entreno proteina cena'),
  E('avisos', 'Avisos y recordatorios', 'Aviso semanal: pesarte y medirte en ayunas', 'aviso recordatorio semanal medirte pesarme peso cintura medidas ayunas'),
  E('avisos', 'Avisos y recordatorios', 'Avisos con la app cerrada', 'notificaciones push supabase pantalla bloqueo'),
  E('avisos', 'Avisos y recordatorios', 'Guía de iOS (Atajos)', 'ios atajos no molestar shortcuts'),
  E('apariencia', 'Apariencia y modo simple', 'Tema claro u oscuro', 'modo oscuro claro tema'),
  E('apariencia', 'Apariencia y modo simple', 'Tamaño de letra', 'texto grande fuente'),
  E('apariencia', 'Apariencia y modo simple', 'Posición de la barra de navegación', 'barra abajo arriba menu'),
  E('apariencia', 'Apariencia y modo simple', 'Modo simple', 'menos saturacion iconos explicaciones ocultar'),
  E('apariencia', 'Apariencia y modo simple', 'Textos explicativos (cortos o detallados)', 'explicaciones ayuda textos'),
  E('ia', 'Inteligencia artificial (Gemini)', 'Clave de Gemini', 'api key clave ia google'),
  E('ia', 'Inteligencia artificial (Gemini)', 'Uso de hoy y límite por minuto', 'cupo peticiones limite 429'),
  E('ia', 'Inteligencia artificial (Gemini)', 'Modelo de IA', 'modelo flash lite'),
  E('ia', 'Inteligencia artificial (Gemini)', 'Margen para cancelar antes de enviar', 'cancelar ia tokens gastar cupo margen segundos'),
  E('datos', 'Copias de seguridad y datos', 'Copia en la nube (Supabase)', 'nube supabase copia automatica'),
  E('datos', 'Copias de seguridad y datos', 'Comprobar que mi copia se puede restaurar', 'verificar probar copia restaurar'),
  E('datos', 'Copias de seguridad y datos', 'Cifrado con contraseña', 'cifrar contrasena seguridad privacidad'),
  E('datos', 'Copias de seguridad y datos', 'Fotos de progreso en la nube', 'fotos supabase copia'),
  E('datos', 'Copias de seguridad y datos', 'Guardar o importar copia en archivo', 'json archivos importar exportar'),
  E('datos', 'Copias de seguridad y datos', 'Exportar entrenos (CSV)', 'csv hevy strong historial'),
  E('datos', 'Copias de seguridad y datos', 'Borrar todos los datos', 'eliminar reset borrar'),
];

const norm = (s: string): string => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

/** Busca en las opciones de Ajustes por cualquier palabra (sin tildes ni mayúsculas). Todas las palabras escritas deben aparecer. */
export const searchSettings = (query: string, index: SettingEntry[] = SETTINGS_INDEX, max = 6): SettingEntry[] => {
  const words = norm(query).split(' ').filter((w) => w.length >= 2);
  if (words.length === 0) return [];
  return index
    .map((e) => {
      const hay = norm(`${e.label} ${e.sectionTitle} ${e.words}`);
      const label = norm(e.label);
      if (!words.every((w) => hay.includes(w))) return null;
      return { e, score: words.filter((w) => label.includes(w)).length };
    })
    .filter((x): x is { e: SettingEntry; score: number } => !!x)
    .sort((a, b) => b.score - a.score)
    .slice(0, max)
    .map((x) => x.e);
};
