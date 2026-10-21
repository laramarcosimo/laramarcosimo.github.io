import type { AppState } from './types';
import { decryptText, encryptText, encryptionOn } from './crypto';
import { uid } from './utils';

/**
 * Copia de seguridad en Supabase (plan gratuito) mediante su API REST, sin SDK y SIN cuentas ni contraseñas.
 * La app es offline-first: todo vive en este dispositivo y la nube es solo una copia.
 * Cada dispositivo tiene un código anónimo (UUID aleatorio, el «código de recuperación»): quien lo conoce puede leer
 * y sobrescribir esa copia mediante dos funciones de la base de datos; la tabla no es accesible de ninguna otra forma.
 * Una única fila por código: cada copia SOBRESCRIBE la anterior.
 */

const KEY = 'apex-supabase';
const LAST = 'apex-supabase-last';
const ERR = 'apex-supabase-error';

/** Último fallo de la copia automática (para avisarte si lleva días sin subirse). */
export const lastBackupError = (): { ts: number; msg: string } | null => {
  try {
    return JSON.parse(localStorage.getItem(ERR) ?? 'null') as { ts: number; msg: string } | null;
  } catch {
    return null;
  }
};
const setBackupError = (msg: string | null): void => {
  try {
    if (msg === null) localStorage.removeItem(ERR);
    else localStorage.setItem(ERR, JSON.stringify({ ts: Date.now(), msg }));
  } catch {
    /* noop */
  }
};

export interface CloudConfig {
  url: string;
  anonKey: string;
  auto: boolean;
  /** Código anónimo de este dispositivo (UUID v4). */
  deviceId: string;
}

export const SQL_SETUP = `create table if not exists public.apex_backups (
  device_id uuid primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
-- Sin políticas: nadie puede leer la tabla directamente; solo las dos funciones de abajo.
alter table public.apex_backups enable row level security;

create or replace function public.apex_put(p_device uuid, p_data jsonb)
returns timestamptz language sql security definer set search_path = public as $$
  insert into public.apex_backups (device_id, data, updated_at) values (p_device, p_data, now())
  on conflict (device_id) do update set data = excluded.data, updated_at = now()
  returning updated_at;
$$;

create or replace function public.apex_get(p_device uuid)
returns table (data jsonb, updated_at timestamptz) language sql security definer set search_path = public as $$
  select data, updated_at from public.apex_backups where device_id = p_device;
$$;

grant execute on function public.apex_put(uuid, jsonb) to anon;
grant execute on function public.apex_get(uuid) to anon;`;

const newId = (): string => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${uid()}${uid()}`);

export const readCloud = (): CloudConfig => {
  let c: Partial<CloudConfig> = {};
  try {
    c = (JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<CloudConfig> | null) ?? {};
  } catch {
    /* configuración corrupta */
  }
  const cfg: CloudConfig = { url: c.url ?? '', anonKey: c.anonKey ?? '', auto: c.auto ?? true, deviceId: c.deviceId || newId() };
  if (!c.deviceId) writeCloud(cfg); // el código se crea una vez y se conserva
  return cfg;
};

export const writeCloud = (c: CloudConfig): void => {
  try {
    localStorage.setItem(KEY, JSON.stringify(c));
  } catch {
    /* sin almacenamiento */
  }
};

export const lastBackupAt = (): number => {
  try {
    return Number(localStorage.getItem(LAST) ?? 0) || 0;
  } catch {
    return 0;
  }
};
const setLast = (t: number): void => {
  try {
    localStorage.setItem(LAST, String(t));
  } catch {
    /* noop */
  }
};

const base = (c: CloudConfig): string => c.url.trim().replace(/\/+$/, '');
const headers = (c: CloudConfig): Record<string, string> => ({
  apikey: c.anonKey.trim(),
  Authorization: `Bearer ${c.anonKey.trim()}`,
  'Content-Type': 'application/json',
});

const fail = async (res: Response): Promise<never> => {
  let msg = `Supabase respondió ${res.status}`;
  try {
    const j = (await res.json()) as { msg?: string; message?: string; error_description?: string; error?: string };
    msg = j.msg || j.message || j.error_description || j.error || msg;
  } catch {
    /* sin cuerpo */
  }
  if (/apex_(put|get)/.test(msg) || res.status === 404) msg = 'Falta la configuración inicial en Supabase: ejecuta el script de «Configuración inicial (una vez)».';
  throw new Error(msg);
};

const need = (c: CloudConfig): void => {
  if (!c.url.trim() || !c.anonKey.trim()) throw new Error('Rellena la URL y la clave pública (anon) de tu proyecto.');
};

/** Payload de la copia: sin sesión activa ni clave de Gemini. */
export const snapshot = (s: AppState): AppState => ({ ...s, active: null, settings: { ...s.settings, geminiKey: '' } });

/** Sobrescribe la copia anterior de este dispositivo. */
export async function backupNow(s: AppState): Promise<number> {
  try {
    const c = readCloud();
    need(c);
    const res = await fetch(`${base(c)}/rest/v1/rpc/apex_put`, { method: 'POST', headers: headers(c), body: JSON.stringify({ p_device: c.deviceId, p_data: encryptionOn() ? { enc: 'v1', d: await encryptText(JSON.stringify(snapshot(s)), c.deviceId) } : snapshot(s) }) });
    if (!res.ok) return await fail(res);
    const now = Date.now();
    setLast(now);
    setBackupError(null);
    return now;
  } catch (e) {
    setBackupError(e instanceof Error ? e.message : 'Error desconocido');
    throw e;
  }
}

/** Copia guardada con un código (el de este dispositivo si no se indica otro). */
export async function fetchBackup(deviceId?: string): Promise<{ data: AppState; updatedAt: string } | null> {
  const c = readCloud();
  need(c);
  const id = (deviceId ?? c.deviceId).trim();
  if (!/^[0-9a-f-]{32,36}$/i.test(id)) throw new Error('El código de recuperación no es válido.');
  const res = await fetch(`${base(c)}/rest/v1/rpc/apex_get`, { method: 'POST', headers: headers(c), body: JSON.stringify({ p_device: id }) });
  if (!res.ok) return fail(res);
  const rows = (await res.json()) as { data: AppState; updated_at: string }[];
  if (!rows[0]) return null;
  let data = rows[0].data as AppState & { enc?: string; d?: string };
  if (data && data.enc === 'v1' && typeof data.d === 'string') data = JSON.parse(await decryptText(data.d, id)) as AppState; // cifrada: pide la contraseña si falta
  return { data, updatedAt: rows[0].updated_at };
}

export const isConnected = (): boolean => {
  const c = readCloud();
  return !!(c.url && c.anonKey);
};

/** ¿Toca copia automática? (configurada, activada y han pasado ≥ 24 h, o ≥ 1 h tras un entreno). */
export const dueForBackup = (afterWorkout: boolean): boolean => {
  const c = readCloud();
  if (!c.auto || !c.url || !c.anonKey) return false;
  return Date.now() - lastBackupAt() >= (afterWorkout ? 3600000 : 86400000);
};
