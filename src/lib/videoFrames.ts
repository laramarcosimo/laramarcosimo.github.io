export const MAX_SECONDS = 20;
export const MAX_BYTES = 25 * 1024 * 1024;

const once = (el: HTMLVideoElement, ev: string, ms = 8000): Promise<void> =>
  new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('El vídeo tarda demasiado en cargar. Prueba con un clip más corto.')), ms);
    el.addEventListener(
      ev,
      () => {
        clearTimeout(t);
        resolve();
      },
      { once: true },
    );
    el.addEventListener('error', () => { clearTimeout(t); reject(new Error('No se pudo leer el vídeo. Prueba a grabarlo de nuevo.')); }, { once: true });
  });

/**
 * Extrae fotogramas clave (JPEG base64, sin cabecera) de un vídeo EN MEMORIA: nada se sube ni se guarda.
 * Libera la URL del vídeo y el lienzo al terminar.
 */
export async function extractFrames(file: File, count = 8, maxSide = 640): Promise<string[]> {
  if (file.size > MAX_BYTES) throw new Error(`El vídeo pesa ${(file.size / 1048576).toFixed(0)} MB; el máximo es 25 MB. Graba un clip más corto.`);
  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  const canvas = document.createElement('canvas');
  try {
    video.src = url;
    await once(video, 'loadedmetadata');
    const dur = video.duration;
    if (Number.isFinite(dur) && dur > MAX_SECONDS + 0.5) throw new Error(`El vídeo dura ${Math.round(dur)} s; el máximo es ${MAX_SECONDS} s (3-4 repeticiones bastan).`);
    const length = Number.isFinite(dur) && dur > 0 ? dur : 10;
    const scale = Math.min(1, maxSide / Math.max(video.videoWidth || maxSide, video.videoHeight || maxSide));
    canvas.width = Math.round((video.videoWidth || maxSide) * scale);
    canvas.height = Math.round((video.videoHeight || maxSide) * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('El navegador no puede procesar el vídeo.');
    const frames: string[] = [];
    for (let i = 0; i < count; i++) {
      const seek = once(video, 'seeked');
      video.currentTime = Math.min(length - 0.05, (length * (i + 0.5)) / count);
      await seek;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      frames.push(canvas.toDataURL('image/jpeg', 0.72).split(',')[1]);
    }
    return frames;
  } finally {
    video.removeAttribute('src');
    video.load();
    URL.revokeObjectURL(url);
    canvas.width = 0;
    canvas.height = 0;
  }
}
