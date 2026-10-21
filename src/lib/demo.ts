/** Demostraciones en vídeo: enlaces de YouTube (Shorts o normales) que se ven dentro de la app. */
export const ytId = (url: string): string | null => {
  const u = url.trim();
  const m = u.match(/(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:shorts\/|embed\/|live\/)|[?&]v=)([A-Za-z0-9_-]{11})/);
  if (m) return m[1];
  return /^[A-Za-z0-9_-]{11}$/.test(u) ? u : null;
};

/** Reproductor incrustado sin cookies; sin salir de la app. */
export const embedUrl = (id: string): string => `https://www.youtube-nocookie.com/embed/${id}?playsinline=1&rel=0&modestbranding=1`;
export const watchUrl = (id: string): string => `https://www.youtube.com/watch?v=${id}`;

/** Búsqueda orientada a demostraciones de mujeres (entrenadoras o fisioterapeutas) en formato corto. */
export const searchUrl = (name: string): string => `https://www.youtube.com/results?search_query=${encodeURIComponent(`${name} ejercicio mujer fisioterapeuta entrenadora shorts`)}`;

/** Demostraciones incluidas de serie (clave = id del ejercicio o del paso del calentamiento). */
export const DEFAULT_DEMOS: Record<string, string> = {
  'single-leg-press': 'BuHs-Ohdfn8',
};
