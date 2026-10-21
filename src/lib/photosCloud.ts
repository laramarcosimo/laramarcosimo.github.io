import { compressPhoto, deletePhoto, kindWire, listPhotos, listTrash, parseKindWire, putPhoto, trashExpired, type PhotoRec } from './photos';
import { isConnected, readCloud } from './cloud';
import { decryptBytes, encryptBytes, encryptionOn, isEncrypted } from './crypto';

/**
 * Copia de las fotos de progreso en TU Supabase, aparte de la copia de datos (que se sobrescribe): aquí cada foto se queda.
 * En la nube van REDUCIDAS (480 px, ≈ 15-25 kB); el original de 720 px queda en el móvil. Con topes para no llenar el plan gratuito.
 */
export const SQL_PHOTOS = `create table if not exists public.apex_photos (
  device_id uuid not null,
  photo_id text not null,
  kind text not null,
  ts bigint not null,
  data text not null,
  primary key (device_id, photo_id)
);
alter table public.apex_photos enable row level security; -- sin políticas: solo las funciones de abajo

create or replace function public.apex_photo_put(p_device uuid, p_id text, p_kind text, p_ts bigint, p_data text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if length(p_data) > 80000 then raise exception 'foto demasiado grande'; end if;
  -- topes de seguridad: 1.500 fotos por dispositivo y 120 MB en total (el plan gratuito da 500 MB por proyecto)
  if not exists (select 1 from public.apex_photos where device_id = p_device and photo_id = p_id) then
    if (select count(*) from public.apex_photos where device_id = p_device) >= 1500 then raise exception 'limite de fotos'; end if;
    if (select coalesce(sum(length(data)), 0) from public.apex_photos) > 120000000 then raise exception 'espacio de fotos lleno'; end if;
  end if;
  insert into public.apex_photos (device_id, photo_id, kind, ts, data) values (p_device, p_id, p_kind, p_ts, p_data)
  on conflict (device_id, photo_id) do update set data = excluded.data;
end $$;

create or replace function public.apex_photo_list(p_device uuid)
returns table (photo_id text, kind text, ts bigint, bytes int) language sql security definer set search_path = public as $$
  select photo_id, kind, ts, length(data) from public.apex_photos where device_id = p_device order by ts;
$$;

create or replace function public.apex_photo_get(p_device uuid, p_id text)
returns text language sql security definer set search_path = public as $$
  select data from public.apex_photos where device_id = p_device and photo_id = p_id;
$$;

create or replace function public.apex_photo_delete(p_device uuid, p_id text)
returns void language sql security definer set search_path = public as $$
  delete from public.apex_photos where device_id = p_device and photo_id = p_id;
$$;

grant execute on function public.apex_photo_put(uuid, text, text, bigint, text) to anon;
grant execute on function public.apex_photo_list(uuid) to anon;
grant execute on function public.apex_photo_get(uuid, text) to anon;
grant execute on function public.apex_photo_delete(uuid, text) to anon;`;

const OFF = 'apex-photos-cloud-off';
export const cloudPhotosOn = (): boolean => {
  try {
    return localStorage.getItem(OFF) !== '1';
  } catch {
    return true;
  }
};
export const setCloudPhotos = (on: boolean): void => {
  try {
    localStorage.setItem(OFF, on ? '0' : '1');
  } catch {
    /* noop */
  }
};

const call = async <T,>(fn: string, body: Record<string, unknown>): Promise<T> => {
  const c = readCloud();
  const res = await fetch(`${c.url.trim().replace(/\/+$/, '')}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: c.anonKey.trim(), Authorization: `Bearer ${c.anonKey.trim()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_device: c.deviceId, ...body }),
  });
  if (!res.ok) {
    let msg = `Supabase respondió ${res.status}`;
    try {
      const j = (await res.json()) as { message?: string };
      if (j.message) msg = j.message;
    } catch {
      /* sin cuerpo */
    }
    if (res.status === 404 || /apex_photo/.test(msg)) msg = 'Falta ejecutar el script de fotos en Supabase (SQL Editor).';
    if (/espacio de fotos lleno|limite de fotos/.test(msg)) msg = 'El espacio reservado a fotos en Supabase está lleno (tope de seguridad).';
    throw new Error(msg);
  }
  const t = await res.text();
  return (t ? JSON.parse(t) : null) as T;
};

const toB64 = (b: Blob): Promise<string> =>
  new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(',')[1] ?? '');
    r.onerror = () => rej(new Error('No se pudo leer la foto'));
    r.readAsDataURL(b);
  });

const fromB64 = (b64: string): Blob => {
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return new Blob([out], { type: 'image/jpeg' });
};

/** Acceso genérico a las funciones de Supabase (lo usa también el archivo de informes PDF). */
export const cloudCall = call;
/** Texto que se sube de un archivo: base64 o, si el cifrado está activado, cifrado. */
export const encodeForCloud = async (b: Blob): Promise<string> => (encryptionOn() ? encryptBytes(new Uint8Array(await b.arrayBuffer()), readCloud().deviceId) : toB64(b));
export const decodeFromCloud = async (data: string, mime: string): Promise<Blob> => {
  if (isEncrypted(data)) return new Blob([await decryptBytes(data, readCloud().deviceId)], { type: mime });
  const raw = atob(data);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return new Blob([out], { type: mime });
};

export interface SyncIO {
  /** Versión reducida de la foto para la nube. */
  shrink: (p: PhotoRec) => Promise<Blob>;
  /** Texto que se sube (base64, o cifrado si está activado). */
  encode: (b: Blob) => Promise<string>;
  upload: (p: PhotoRec, data: string) => Promise<void>;
  markCloud: (p: PhotoRec) => Promise<void>;
}

/** Sube en orden las fotos pendientes; si una falla, se detiene y el resto queda pendiente para el próximo intento. */
export async function syncWith(photos: PhotoRec[], io: SyncIO): Promise<{ uploaded: number; pending: number; error: string }> {
  const todo = photos.filter((p) => !p.cloud);
  let uploaded = 0;
  try {
    for (const p of todo) {
      await io.upload(p, await io.encode(await io.shrink(p)));
      await io.markCloud(p);
      uploaded++;
    }
    return { uploaded, pending: 0, error: '' };
  } catch (e) {
    return { uploaded, pending: todo.length - uploaded, error: e instanceof Error ? e.message : 'Error desconocido' };
  }
}

const ERR = 'apex-photos-cloud-error';
/** Último fallo de la copia automática de fotos (null si la última subida fue bien). */
export const lastPhotoSyncError = (): string | null => {
  try {
    return localStorage.getItem(ERR);
  } catch {
    return null;
  }
};
const setPhotoSyncError = (m: string): void => {
  try {
    if (m) localStorage.setItem(ERR, m);
    else localStorage.removeItem(ERR);
  } catch {
    /* noop */
  }
};

let syncing = false;

/** Sube a la nube las fotos pendientes (versión reducida y, si está activado, cifrada). Seguro de llamar muchas veces. */
export async function syncPhotos(): Promise<{ uploaded: number; pending: number; error: string; busy?: boolean }> {
  if (syncing) return { uploaded: 0, pending: 0, error: '', busy: true };
  if (!isConnected() || !cloudPhotosOn()) return { uploaded: 0, pending: 0, error: '' };
  syncing = true;
  try {
    const r = await syncWith(await listPhotos(), {
      shrink: (p) => (p.lowres ? Promise.resolve(p.blob) : compressPhoto(p.blob, 480, 22_000)),
      encode: async (b) => (encryptionOn() ? encryptBytes(new Uint8Array(await b.arrayBuffer()), readCloud().deviceId) : toB64(b)),
      upload: (p, data) => call<void>('apex_photo_put', { p_id: p.id, p_kind: kindWire(p), p_ts: p.ts, p_data: data }),
      markCloud: (p) => putPhoto({ ...p, cloud: true }),
    });
    setPhotoSyncError(r.error);
    return r;
  } finally {
    syncing = false;
  }
}

/** Marca todas las fotos como pendientes para volver a subirlas (por ejemplo, ya cifradas). */
export async function resetCloudFlags(): Promise<void> {
  for (const p of await listPhotos()) if (p.cloud) await putPhoto({ ...p, cloud: false });
}

export const deleteCloudPhoto = async (id: string): Promise<void> => {
  if (!isConnected()) return;
  try {
    await call<void>('apex_photo_delete', { p_id: id });
  } catch {
    /* si no hay red, la copia en la nube se queda: no afecta al móvil */
  }
};

/** Trae del Supabase las fotos que no están en este móvil (por ejemplo tras cambiar de móvil). Vienen en versión reducida. */
export async function restorePhotos(): Promise<number> {
  if (!isConnected()) throw new Error('Configura primero la copia en la nube (Ajustes).');
  const remote = await call<{ photo_id: string; kind: string; ts: number }[]>('apex_photo_list', {});
  const have = new Set((await listPhotos(true)).map((p) => p.id));
  let n = 0;
  for (const r of remote ?? []) {
    if (r.kind.startsWith('pdf:') || have.has(r.photo_id)) continue; // los PDF archivados no son fotos
    const data = await call<string | null>('apex_photo_get', { p_id: r.photo_id });
    if (!data) continue;
    const blob = isEncrypted(data) ? new Blob([await decryptBytes(data, readCloud().deviceId)], { type: 'image/jpeg' }) : fromB64(data);
    const rec: PhotoRec = { id: r.photo_id, ts: Number(r.ts), ...parseKindWire(r.kind), blob, bytes: blob.size, cloud: true, lowres: true };
    await putPhoto(rec);
    n++;
  }
  return n;
}

/** Borra del todo (móvil y nube) las fotos que llevan 3 días en la papelera. */
export async function purgeTrash(now = Date.now()): Promise<number> {
  let n = 0;
  for (const p of await listTrash()) {
    if (!trashExpired(p, now)) continue;
    await deletePhoto(p.id);
    await deleteCloudPhoto(p.id);
    n++;
  }
  return n;
}
