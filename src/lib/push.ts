import { readCloud } from './cloud';
import { dayBalance } from './metabolic';
import { photoDueAt, postWorkoutInfo } from './reminders';
import type { AppState } from './types';
import { faceStreak, faceTimeOf } from './streaks';
import { dayKey, daysUntil } from './utils';
import { requestPermission } from './notify';

const ON = 'apex-push-on';

export const pushSupported = (): boolean => typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
export const pushEnabled = (): boolean => {
  try {
    return localStorage.getItem(ON) === '1' && Notification.permission === 'granted';
  } catch {
    return false;
  }
};

const rpc = async (name: string, body: Record<string, unknown>): Promise<unknown> => {
  const c = readCloud();
  if (!c.url.trim() || !c.anonKey.trim()) throw new Error('Primero configura la copia en la nube (URL y clave pública de Supabase).');
  const res = await fetch(`${c.url.trim().replace(/\/+$/, '')}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { apikey: c.anonKey.trim(), Authorization: `Bearer ${c.anonKey.trim()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(res.status === 404 ? 'Falta ejecutar el SQL de avisos en Supabase (paso 1).' : `Supabase respondió ${res.status}`);
  const t = await res.text();
  return t ? JSON.parse(t) : null;
};

const b64ToBytes = (b64: string): Uint8Array<ArrayBuffer> => {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
};

/** Pide permiso, se suscribe a las notificaciones push y registra este iPhone en tu Supabase. Debe llamarse desde un toque. */
export async function enablePush(): Promise<void> {
  if (!pushSupported()) throw new Error('Este navegador no admite avisos push. En iPhone: instala la app («Añadir a pantalla de inicio», iOS 16.4+) y ábrela desde el icono.');
  if ((await requestPermission()) !== 'granted') throw new Error('Permiso de notificaciones denegado. Actívalo en Ajustes de iOS → Notificaciones → Apex Coach.');
  const key = (await rpc('apex_push_pubkey', {})) as string | null;
  if (!key) throw new Error('La función «apex-push» aún no ha creado las claves: despliégala (paso 2), espera 20 segundos y vuelve a pulsar.');
  const reg = await navigator.serviceWorker.ready;
  const old = await reg.pushManager.getSubscription();
  if (old) await old.unsubscribe().catch(() => false); // por si cambió la clave
  const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(key) });
  await rpc('apex_push_register', { p_device: readCloud().deviceId, p_sub: sub.toJSON() });
  try {
    localStorage.setItem(ON, '1');
  } catch {
    /* noop */
  }
  window.dispatchEvent(new Event('apex-push-change'));
}

export const disablePush = (): void => {
  try {
    localStorage.removeItem(ON);
  } catch {
    /* noop */
  }
  window.dispatchEvent(new Event('apex-push-change'));
};

// Las operaciones se aplican en orden (cancelar y reprogramar el descanso seguidos no deben cruzarse).
let chain: Promise<unknown> = Promise.resolve();
const queued = (fn: () => Promise<unknown>): Promise<boolean> => {
  const run = chain.then(fn, fn).then(() => true, () => false);
  chain = run;
  return run;
};

/** Programa (o reprograma, mismo `tag`) un aviso en el servidor. No hace nada si los avisos push no están activados. */
export async function pushSchedule(tag: string, title: string, body: string, dueMs: number): Promise<boolean> {
  if (!pushEnabled()) return false;
  return queued(() => rpc('apex_push_schedule', { p_device: readCloud().deviceId, p_tag: tag, p_title: title, p_body: body, p_due: new Date(dueMs).toISOString() }));
}

export async function pushCancel(tag: string): Promise<boolean> {
  if (!pushEnabled()) return false;
  return queued(() => rpc('apex_push_cancel', { p_device: readCloud().deviceId, p_tag: tag }));
}

const nextAt = (hour: number, now: number, weekday?: number, minute = 0): number => {
  const d = new Date(now);
  d.setHours(hour, minute, 0, 0);
  if (weekday !== undefined) d.setDate(d.getDate() + ((weekday - d.getDay() + 7) % 7));
  if (d.getTime() <= now + 30000) d.setDate(d.getDate() + (weekday !== undefined ? 7 : 1));
  return d.getTime();
};

/**
 * Deja programados en el servidor los avisos que se pueden prever (se ponen al día cada vez que abres la app):
 * cena tras entrenar, medidas semanales, proteína de la tarde y caducidades. Los que dejan de tener sentido se cancelan.
 */
export async function syncPushJobs(s: AppState, now = Date.now()): Promise<void> {
  if (!pushEnabled()) return;
  const post = postWorkoutInfo(s, now);
  if (post && post.dueAt > now + 30000) await pushSchedule('post', post.title, post.text, post.dueAt);
  else await pushCancel('post');

  if (s.settings.measureRemind !== false) {
    const measureAt = nextAt(s.settings.measureHour ?? 8, now, s.settings.measureDay ?? 1);
    await pushSchedule('measure', 'Toca medirte', 'Pésate y mídete en ayunas y en las mismas condiciones (una vez a la semana basta).', measureAt);
  } else await pushCancel('measure');

  const b = dayBalance(s);
  const missing = Math.round(b.proteinTarget - b.proteinEaten);
  const at18 = nextAt(18, now);
  if (b.eaten > 0 && missing >= 30 && new Date(at18).getDate() === new Date(now).getDate()) await pushSchedule('protein', `Te faltan ${missing} g de proteína hoy`, 'Ideas rápidas: atún + yogur griego, 2 huevos o un batido de proteínas.', at18);
  else await pushCancel('protein');

  // Rutina facial: hoy a la hora elegida si aún no la has hecho; si ya la hiciste (o ya pasó la hora), mañana.
  if (s.settings.faceRemind) {
    const { h, m } = faceTimeOf(s.settings);
    const n = faceStreak(s.habits, now);
    const doneToday = !!s.habits[dayKey(now)]?.faceYoga;
    let at = nextAt(h, now, undefined, m);
    if (doneToday && new Date(at).getDate() === new Date(now).getDate()) at += 86400000;
    await pushSchedule('face', 'Toca tu Face Yoga', `Son 7 minutos en la cama.${n > 0 ? ` Llevas ${n} día${n === 1 ? '' : 's'} seguidos: no rompas la racha.` : ' Empieza hoy tu racha.'}`, at);
  } else await pushCancel('face');

  const photoAt = photoDueAt(s, now);
  if (photoAt !== null && photoAt > now + 30000) await pushSchedule('photo', 'Toca tu foto de progreso', 'Una de cuerpo entero y otra de la cara, con la misma luz y postura. Hoy → Progreso → Fotos.', photoAt);
  else await pushCancel('photo');

  const at9 = nextAt(9, now);
  const soon = s.pantry.filter((p) => p.expires && daysUntil(p.expires, at9) >= 0 && daysUntil(p.expires, at9) <= 2).map((p) => p.name);
  if (soon.length > 0) await pushSchedule('expiry', 'Caducan pronto', `${soon.slice(0, 4).join(', ')}${soon.length > 4 ? '…' : ''}: úsalos hoy o mañana.`, at9);
  else await pushCancel('expiry');
}
