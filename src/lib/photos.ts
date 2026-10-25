/**
 * Fotos de progreso (cuerpo entero y yoga facial): se comprimen y se guardan SOLO en este dispositivo, en IndexedDB.
 * Viven aparte de los datos de la app: no entran en la copia de seguridad ni se sustituyen al restaurar una copia.
 */
export type PhotoKind = 'cuerpo' | 'cara';
/** Ángulo de la foto: cuerpo de frente / de lado / de espaldas; yoga facial: cara de frente, de perfil y cuello. */
export type PhotoView = 'frente' | 'lado' | 'espalda' | 'perfil' | 'cuello';

export const ANGLES: Record<PhotoKind, { id: PhotoView; label: string; long: string }[]> = {
  cuerpo: [{ id: 'frente', label: 'Frente', long: 'cuerpo de frente' }, { id: 'lado', label: 'Lado', long: 'cuerpo de lado' }, { id: 'espalda', label: 'Espalda', long: 'cuerpo de espaldas' }],
  cara: [{ id: 'frente', label: 'Frente', long: 'cara de frente' }, { id: 'perfil', label: 'Perfil', long: 'cara de perfil' }, { id: 'cuello', label: 'Cuello', long: 'cuello' }],
};
/** Las fotos anteriores a los ángulos cuentan como «de frente». */
export const viewOf = (p: { view?: PhotoView }): PhotoView => p.view ?? 'frente';
/** En la nube el ángulo viaja dentro del texto del tipo («cuerpo:lado»). */
export const kindWire = (p: { kind: PhotoKind; view?: PhotoView }): string => (p.view ? `${p.kind}:${p.view}` : p.kind);
export const parseKindWire = (s: string): { kind: PhotoKind; view?: PhotoView } => {
  const [k, v] = s.split(':');
  return { kind: k === 'cara' ? 'cara' : 'cuerpo', view: v === 'frente' || v === 'lado' || v === 'espalda' || v === 'perfil' || v === 'cuello' ? v : undefined };
};

export interface PhotoRec {
  id: string;
  ts: number;
  kind: PhotoKind;
  /** Ángulo (ausente en las fotos antiguas = de frente). */
  view?: PhotoView;
  blob: Blob;
  bytes: number;
  /** Ya hay una copia reducida en tu Supabase. */
  cloud?: boolean;
  /** Viene de la nube (versión reducida, no la original). */
  lowres?: boolean;
  /** En la papelera desde esta fecha (se borra del todo a los 3 días). */
  deletedAt?: number;
}

const DB = 'apex-photos';
const STORE = 'photos';

const open = (): Promise<IDBDatabase> =>
  new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'id' });
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error ?? new Error('No se pudo abrir el almacén de fotos'));
  });

const tx = async <T,>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> => {
  const db = await open();
  try {
    return await new Promise<T>((res, rej) => {
      const r = fn(db.transaction(STORE, mode).objectStore(STORE));
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error ?? new Error('Error al guardar la foto'));
    });
  } finally {
    db.close();
  }
};

/** Pide al navegador que no borre estas fotos si falta espacio (iOS lo concede a las apps instaladas). */
export const requestPersistence = async (): Promise<void> => {
  try {
    await navigator.storage?.persist?.();
  } catch {
    /* sin soporte */
  }
};

/** Comprime a JPEG pequeño (lado mayor 720 px) y baja la calidad hasta que pese ≤ ~70 kB. */
export async function compressPhoto(file: Blob, maxSide = 720, targetBytes = 70_000): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error('No se pudo leer la foto'));
      i.src = url;
    });
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(img.naturalWidth * scale));
    c.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = c.getContext('2d');
    if (!ctx) throw new Error('Canvas no disponible');
    ctx.drawImage(img, 0, 0, c.width, c.height);
    let q = 0.7;
    let blob: Blob | null = null;
    for (let i = 0; i < 5; i++) {
      blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/jpeg', q));
      if (!blob || blob.size <= targetBytes) break;
      q -= 0.1;
    }
    c.width = 0;
    c.height = 0;
    if (!blob) throw new Error('No se pudo comprimir la foto');
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function addPhoto(file: File, kind: PhotoKind, view: PhotoView = 'frente'): Promise<PhotoRec> {
  const blob = await compressPhoto(file);
  const rec: PhotoRec = { id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, ts: Date.now(), kind, view, blob, bytes: blob.size };
  await tx('readwrite', (s) => s.put(rec));
  void requestPersistence();
  return rec;
}

/** Fotos (sin las de la papelera, salvo que se pidan). */
export const listPhotos = async (withTrash = false): Promise<PhotoRec[]> => ((await tx('readonly', (s) => s.getAll())) as PhotoRec[]).filter((p) => withTrash || !p.deletedAt).sort((a, b) => b.ts - a.ts);

export const TRASH_DAYS = 3;
/** Fotos en la papelera. */
export const listTrash = async (): Promise<PhotoRec[]> => ((await listPhotos(true)).filter((p) => !!p.deletedAt)).sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0));
/** ¿Ya pasaron los días de papelera? */
export const trashExpired = (p: PhotoRec, now = Date.now()): boolean => !!p.deletedAt && now - p.deletedAt >= TRASH_DAYS * 86_400_000;

export const putPhoto = async (rec: PhotoRec): Promise<void> => {
  await tx('readwrite', (s) => s.put(rec));
};

export const deletePhoto = async (id: string): Promise<void> => {
  await tx('readwrite', (s) => s.delete(id));
};

/** Brillo medio (0-255) y nitidez (varianza del laplaciano) de una imagen en grises. */
export function grayStats(gray: ArrayLike<number>, w: number, h: number): { mean: number; sharp: number } {
  let sum = 0;
  for (let i = 0; i < w * h; i++) sum += gray[i];
  const mean = sum / (w * h);
  const lap: number[] = [];
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) lap.push(4 * gray[y * w + x] - gray[y * w + x - 1] - gray[y * w + x + 1] - gray[(y - 1) * w + x] - gray[(y + 1) * w + x]);
  const lm = lap.reduce((a, b) => a + b, 0) / Math.max(1, lap.length);
  const sharp = lap.reduce((a, b) => a + (b - lm) * (b - lm), 0) / Math.max(1, lap.length);
  return { mean, sharp };
}

export interface PhotoCheck {
  dark: boolean;
  blurry: boolean;
}

/** Avisa si la foto está muy oscura o borrosa antes de guardarla (se analiza una miniatura de 160 px). */
export async function checkPhoto(file: Blob): Promise<PhotoCheck> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error('No se pudo leer la foto'));
      i.src = url;
    });
    const sc = 160 / Math.max(img.naturalWidth, img.naturalHeight);
    const w = Math.max(8, Math.round(img.naturalWidth * sc));
    const h = Math.max(8, Math.round(img.naturalHeight * sc));
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    if (!ctx) return { dark: false, blurry: false };
    ctx.drawImage(img, 0, 0, w, h);
    const px = ctx.getImageData(0, 0, w, h).data;
    const gray = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) gray[i] = 0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2];
    const { mean, sharp } = grayStats(gray, w, h);
    return { dark: mean < 45, blurry: sharp < 12 };
  } catch {
    return { dark: false, blurry: false };
  } finally {
    URL.revokeObjectURL(url);
  }
}
