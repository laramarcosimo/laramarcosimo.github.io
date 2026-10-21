import { pushCancel, pushSchedule } from './push';

export type PermState = 'unsupported' | 'default' | 'granted' | 'denied';

type RestOptions = NotificationOptions & { vibrate?: number[]; renotify?: boolean };

export const permissionState = (): PermState => (typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported');

/** Debe llamarse desde un toque del usuario (requisito de iOS). */
export async function requestPermission(): Promise<PermState> {
  if (!('Notification' in window)) return 'unsupported';
  try {
    return await Notification.requestPermission();
  } catch {
    return permissionState();
  }
}

const readyWithTimeout = (): Promise<ServiceWorkerRegistration | null> =>
  'serviceWorker' in navigator ? Promise.race([navigator.serviceWorker.ready, new Promise<null>((r) => setTimeout(() => r(null), 1500))]) : Promise.resolve(null);

const ASKED = 'apex-notif-asked';

/** Pide permiso de notificaciones UNA vez al empezar un descanso (se llama desde un toque, como exige iOS). Nunca lanza error. */
export async function maybeAskNotifications(): Promise<void> {
  try {
    if (permissionState() !== 'default' || localStorage.getItem(ASKED) === '1') return;
    localStorage.setItem(ASKED, '1');
    await requestPermission();
  } catch {
    /* sin soporte: la app sigue funcionando sin avisos */
  }
}

/** Aviso local de respaldo en el Service Worker: se activa al salir de la app y se cancela al volver. */
export async function setLocalRestBackup(endsAt: number | null): Promise<void> {
  try {
    const reg = await readyWithTimeout();
    reg?.active?.postMessage(endsAt === null ? { type: 'rest-cancel' } : { type: 'rest-start', endsAt });
  } catch {
    /* sin Service Worker */
  }
}

/** Si el servidor ya tiene programado el aviso de un temporizador, el aviso local sobra (saldrían dos). */
const serverTimer: Record<TimerKind, boolean> = { rest: false, warmup: false };
export const serverTimerActive = (k: TimerKind = 'rest'): boolean => serverTimer[k];

/** Notificación de fin de descanso, siempre a través del Service Worker (mismo tag que el resto: nunca dos avisos). */
export async function notifyRestDone(): Promise<void> {
  if (serverTimer.rest) return;
  if (permissionState() !== 'granted') return;
  const reg = await readyWithTimeout();
  if (!reg) return;
  const opts: RestOptions = {
    body: 'Toca volver a la carga con la siguiente serie',
    icon: '/pwa-192x192.png',
    badge: '/badge-72.png',
    vibrate: [300, 100, 300],
    tag: 'workout-timer',
    renotify: false,
  };
  try {
    await reg.showNotification('¡Tiempo de descanso terminado! ⏱️', opts);
  } catch {
    /* sin permiso o SW no disponible */
  }
}

export type TimerKind = 'rest' | 'warmup';
const TIMER_TEXT: Record<TimerKind, { title: string; body: string }> = {
  rest: { title: '¡Tiempo de descanso terminado! ⏱️', body: 'Toca volver a la carga con la siguiente serie' },
  warmup: { title: '¡Calentamiento listo! 🔥', body: 'Empieza con una primera serie ligera antes de tu peso de trabajo.' },
};

/** Programa (o cancela) el aviso de fin de un temporizador: primero en el servidor y, si no se puede, en el Service Worker. */
export async function scheduleTimer(kind: TimerKind, endsAt: number | null): Promise<void> {
  const txt = TIMER_TEXT[kind];
  // Respaldo en el servidor (llega aunque iOS cierre la app). +4 s de margen: si acaba con la app abierta, se cancela antes.
  if (endsAt === null) {
    serverTimer[kind] = false;
    void pushCancel(kind);
  } else {
    serverTimer[kind] = await pushSchedule(kind, txt.title, txt.body, endsAt + 4000);
    if (serverTimer[kind]) return;
  }
  const reg = await readyWithTimeout();
  reg?.active?.postMessage(endsAt === null ? { type: 'timer-cancel' } : { type: 'timer-start', endsAt, title: txt.title, body: txt.body });
}
export const scheduleRestInSW = (endsAt: number | null): Promise<void> => scheduleTimer('rest', endsAt);

/** Notificación genérica (recordatorios) a través del Service Worker, solo si hay permiso. */
export async function notifyGeneric(title: string, body: string, tag: string): Promise<void> {
  if (permissionState() !== 'granted') return;
  const reg = await readyWithTimeout();
  if (!reg) return;
  try {
    await reg.showNotification(title, { body, icon: '/pwa-192x192.png', badge: '/badge-72.png', tag } as RestOptions);
  } catch {
    /* sin permiso o SW no disponible */
  }
}
