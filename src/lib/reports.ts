import { cloudCall, decodeFromCloud, encodeForCloud, deleteCloudPhoto } from './photosCloud';
import { isConnected } from './cloud';
import { deletePhoto, listPhotos } from './photos';

/**
 * Archivo de informes PDF en el móvil (y copia en tu Supabase solo de los del año y de fotos):
 *  - informes del MES: se guardan solo durante ese año (al cambiar de año se borran) y solo en el móvil;
 *  - informe del AÑO y PDF de FOTOS: se guardan 3 años (el actual y los 2 anteriores), también en la nube, en trozos pequeños;
 *  - las fotos sueltas se pueden borrar una vez que su PDF está guardado (a mano o automáticamente).
 */
export type ReportKind = 'mes' | 'anio' | 'fotos';

export interface ReportRec {
  id: string;
  kind: ReportKind;
  year: number;
  month?: number;
  label: string;
  ts: number;
  bytes: number;
  blob: Blob;
  /** PDF de fotos: rango de fechas de las fotos que incluye. */
  from?: number;
  to?: number;
  /** Ya hay copia en la nube. */
  cloud?: boolean;
}

const DB = 'apex-reports';
const STORE = 'reports';
const AUTODEL = 'apex-reports-autodel';
const CHUNK = 60_000;

const open = (): Promise<IDBDatabase> =>
  new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'id' });
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error ?? new Error('No se pudo abrir el archivo de informes'));
  });
const tx = async <T,>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> => {
  const db = await open();
  try {
    return await new Promise<T>((res, rej) => {
      const r = fn(db.transaction(STORE, mode).objectStore(STORE));
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error ?? new Error('Error en el archivo de informes'));
    });
  } finally {
    db.close();
  }
};

export const reportId = (kind: ReportKind, year: number, month?: number): string => (kind === 'mes' ? `mes-${year}-${String((month ?? 0) + 1).padStart(2, '0')}` : `${kind}-${year}`);
export const listReports = async (): Promise<ReportRec[]> => ((await tx('readonly', (s) => s.getAll())) as ReportRec[]).sort((a, b) => b.ts - a.ts);
export const getReport = (id: string): Promise<ReportRec | undefined> => tx('readonly', (s) => s.get(id)) as Promise<ReportRec | undefined>;
export const deleteReport = (id: string): Promise<unknown> => tx('readwrite', (s) => s.delete(id));
export const putReport = (r: ReportRec): Promise<unknown> => tx('readwrite', (s) => s.put(r));

export const autoDeletePhotos = (): boolean => {
  try {
    return localStorage.getItem(AUTODEL) === '1';
  } catch {
    return false;
  }
};
export const setAutoDeletePhotos = (on: boolean): void => {
  try {
    localStorage.setItem(AUTODEL, on ? '1' : '0');
  } catch {
    /* noop */
  }
};

/** Qué informes se conservan en `now`: del mes, solo los del año en curso; del año y de fotos, el año en curso y los 2 anteriores. */
export const keepReport = (r: Pick<ReportRec, 'kind' | 'year'>, now = Date.now()): boolean => {
  const y = new Date(now).getFullYear();
  return r.kind === 'mes' ? r.year >= y : r.year >= y - 2;
};

const cloudParts = async (id: string): Promise<string[]> => {
  const rows = await cloudCall<{ photo_id: string }[]>('apex_photo_list', {});
  return (rows ?? []).map((r) => r.photo_id).filter((p) => p.startsWith(`pdf-${id}-`));
};
export async function deleteReportCloud(id: string): Promise<void> {
  for (const pid of await cloudParts(id)) await cloudCall<void>('apex_photo_delete', { p_id: pid });
}
export async function uploadReport(r: ReportRec): Promise<void> {
  const data = await encodeForCloud(r.blob);
  const n = Math.ceil(data.length / CHUNK);
  await deleteReportCloud(r.id);
  for (let i = 0; i < n; i++) await cloudCall<void>('apex_photo_put', { p_id: `pdf-${r.id}-${i}`, p_kind: `pdf:${r.kind}:${r.year}:${n}`, p_ts: r.ts, p_data: data.slice(i * CHUNK, (i + 1) * CHUNK) });
}

/** Guarda un PDF recién generado (sustituye al del mismo periodo) y, si procede, sube su copia a la nube. Nunca lanza error. */
export async function archiveReport(file: File, meta: { kind: ReportKind; year: number; month?: number; label: string; from?: number; to?: number }): Promise<void> {
  try {
    const rec: ReportRec = { id: reportId(meta.kind, meta.year, meta.month), kind: meta.kind, year: meta.year, month: meta.month, label: meta.label, ts: Date.now(), bytes: file.size, blob: file, from: meta.from, to: meta.to };
    await putReport(rec);
    if (meta.kind !== 'mes' && isConnected()) {
      try {
        await uploadReport(rec);
        await putReport({ ...rec, cloud: true });
      } catch {
        /* sin conexión o sin permiso: queda solo en el móvil */
      }
    }
    await enforceRetention();
  } catch {
    /* sin almacenamiento disponible: el PDF se comparte igualmente */
  }
}

/** Borra los informes caducados (móvil y nube) y, si lo activaste, las fotos de años anteriores cuyo PDF ya está guardado. */
export async function enforceRetention(now = Date.now()): Promise<{ reports: number; photos: number }> {
  let reports = 0;
  let photos = 0;
  try {
    const all = await listReports();
    for (const r of all) {
      if (keepReport(r, now)) continue;
      await deleteReport(r.id);
      if (r.cloud && isConnected()) await deleteReportCloud(r.id).catch(() => undefined);
      reports++;
    }
    if (autoDeletePhotos()) {
      const y = new Date(now).getFullYear();
      for (const r of all.filter((x) => x.kind === 'fotos' && keepReport(x, now) && x.to !== undefined && x.from !== undefined)) {
        const pics = (await listPhotos(true)).filter((p) => p.ts >= (r.from as number) && p.ts <= (r.to as number) && new Date(p.ts).getFullYear() < y);
        for (const p of pics) {
          await deletePhoto(p.id);
          if (isConnected()) await deleteCloudPhoto(p.id).catch(() => undefined);
          photos++;
        }
      }
    }
  } catch {
    /* se reintenta la próxima vez */
  }
  return { reports, photos };
}

/** Borra las fotos que incluye un PDF de fotos ya guardado (móvil y nube). */
export async function deletePhotosOf(r: ReportRec): Promise<number> {
  if (r.from === undefined || r.to === undefined) return 0;
  const pics = (await listPhotos(true)).filter((p) => p.ts >= (r.from as number) && p.ts <= (r.to as number));
  for (const p of pics) {
    await deletePhoto(p.id);
    if (isConnected()) await deleteCloudPhoto(p.id).catch(() => undefined);
  }
  return pics.length;
}

/** Trae de la nube los PDF del año y de fotos que no estén en este móvil. */
export async function restoreReports(): Promise<number> {
  if (!isConnected()) throw new Error('Configura primero la copia en la nube (Ajustes).');
  const rows = (await cloudCall<{ photo_id: string; kind: string; ts: number }[]>('apex_photo_list', {})) ?? [];
  const groups = new Map<string, { kind: string; ts: number; ids: string[] }>();
  for (const r of rows) {
    const m = r.photo_id.match(/^pdf-(.+)-(\d+)$/);
    if (!m || !r.kind.startsWith('pdf:')) continue;
    const g = groups.get(m[1]) ?? { kind: r.kind, ts: Number(r.ts), ids: [] };
    g.ids[Number(m[2])] = r.photo_id;
    groups.set(m[1], g);
  }
  const have = new Set((await listReports()).map((r) => r.id));
  let n = 0;
  for (const [id, g] of groups) {
    if (have.has(id)) continue;
    const [, kind, year] = g.kind.split(':');
    if (!['anio', 'fotos'].includes(kind) || !keepReport({ kind: kind as ReportKind, year: Number(year) })) continue;
    let data = '';
    for (const pid of g.ids) data += (await cloudCall<string | null>('apex_photo_get', { p_id: pid })) ?? '';
    if (!data) continue;
    const blob = await decodeFromCloud(data, 'application/pdf');
    await putReport({ id, kind: kind as ReportKind, year: Number(year), label: kind === 'anio' ? `Informe del año ${year}` : `PDF de fotos ${year}`, ts: g.ts, bytes: blob.size, blob, cloud: true });
    n++;
  }
  return n;
}
