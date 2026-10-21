import { fetchBackup, isConnected } from './cloud';
import { listPhotos } from './photos';
import type { AppState } from './types';

export interface BackupSummary {
  workouts: number;
  meals: number;
  templates: number;
  measurements: number;
  pantry: number;
  products: number;
}

/** Resumen de lo que contiene una copia; null si no tiene pinta de ser una copia válida. */
export const summarizeBackup = (d: Partial<AppState> | null | undefined): BackupSummary | null => {
  if (!d || typeof d !== 'object' || !d.profile || !Array.isArray(d.workouts)) return null;
  const n = (x: unknown): number => (Array.isArray(x) ? x.length : 0);
  return { workouts: n(d.workouts), meals: n(d.meals), templates: n(d.templates), measurements: n(d.measurements), pantry: n(d.pantry), products: n(d.products) };
};

const LABEL: Record<keyof BackupSummary, string> = { workouts: 'entrenos', meals: 'comidas', templates: 'rutinas', measurements: 'medidas', pantry: 'productos en la despensa', products: 'productos guardados' };

/** Qué tiene tu móvil que la copia en la nube aún no tiene (vacío si está al día). */
export const missingInBackup = (cloud: BackupSummary, local: BackupSummary): string[] =>
  (Object.keys(LABEL) as (keyof BackupSummary)[]).filter((k) => local[k] > cloud[k]).map((k) => `${local[k] - cloud[k]} ${LABEL[k]}`);

export interface BackupCheck {
  ok: boolean;
  updatedAt: string;
  cloud: BackupSummary;
  /** Diferencias con tu móvil: lo que falta en la copia. */
  missing: string[];
  /** Fotos de progreso: en este móvil y ya subidas a la nube. */
  photos: { local: number; uploaded: number };
}

/** Descarga tu copia, la descifra (si hace falta) y comprueba que se puede restaurar. NO cambia tus datos. */
export async function verifyBackup(state: AppState): Promise<BackupCheck> {
  if (!isConnected()) throw new Error('Primero configura la copia en la nube (URL y clave pública).');
  const r = await fetchBackup();
  if (!r) throw new Error('Todavía no hay ninguna copia en la nube. Pulsa «Subir copia a la nube».');
  const cloud = summarizeBackup(r.data);
  if (!cloud) throw new Error('La copia descargada no tiene un formato válido.');
  const local = summarizeBackup(state) as BackupSummary;
  const photos = await listPhotos();
  return { ok: true, updatedAt: r.updatedAt, cloud, missing: missingInBackup(cloud, local), photos: { local: photos.length, uploaded: photos.filter((p) => p.cloud).length } };
}
