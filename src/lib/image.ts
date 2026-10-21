/**
 * Lee un archivo de imagen, lo comprime en Canvas (JPEG 0.75, máx 768 px) y devuelve SOLO el
 * Base64 en memoria. No se guarda en ningún almacenamiento; el llamador debe descartarlo.
 */
export async function compressToBase64(file: File, maxSide = 768, quality = 0.75): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error('No se pudo leer la imagen'));
      i.src = url;
    });
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const c2d = canvas.getContext('2d');
    if (!c2d) throw new Error('Canvas no disponible');
    c2d.drawImage(img, 0, 0, canvas.width, canvas.height);
    const b64 = canvas.toDataURL('image/jpeg', quality).split(',')[1] ?? '';
    canvas.width = 0; // libera el búfer
    canvas.height = 0;
    return b64;
  } finally {
    URL.revokeObjectURL(url);
  }
}
