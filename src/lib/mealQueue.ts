import { analyzePlate } from './plateAnalysis';
import type { AppState, MealAnalysis } from './types';

/**
 * Cola de fotos de comida sin conexión: si no hay internet, la foto (ya reducida) espera en este móvil y se analiza sola cuando
 * vuelve la conexión. En cuanto se analiza, la foto se BORRA y solo queda el resultado hasta que lo aceptes o lo descartes.
 */
export interface QueuedMeal {
  id: string;
  ts: number;
  /** Foto en base64; vacía cuando ya se analizó. */
  b64: string;
  result?: MealAnalysis;
  error?: string;
}

const DB = 'apex-mealqueue';
const STORE = 'q';
export const QUEUE_EVENT = 'apex-mealqueue-changed';

const open = (): Promise<IDBDatabase> =>
  new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'id' });
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error ?? new Error('No se pudo abrir la cola'));
  });

const tx = async <T,>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> => {
  const db = await open();
  try {
    return await new Promise<T>((res, rej) => {
      const r = fn(db.transaction(STORE, mode).objectStore(STORE));
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error ?? new Error('Error en la cola'));
    });
  } finally {
    db.close();
  }
};

const changed = (): void => {
  try {
    window.dispatchEvent(new Event(QUEUE_EVENT));
  } catch {
    /* sin ventana */
  }
};

/** ¿El fallo es de conexión (no de clave, cupo o formato)? */
export const isNetworkError = (e: unknown): boolean => {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  const m = e instanceof Error ? `${e.name} ${e.message}` : String(e);
  return /failed to fetch|networkerror|network request failed|load failed|offline|sin conexi/i.test(m);
};

export const enqueueMeal = async (b64: string): Promise<void> => {
  await tx('readwrite', (s) => s.put({ id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, ts: Date.now(), b64 } satisfies QueuedMeal));
  changed();
};

export const listQueue = async (): Promise<QueuedMeal[]> => ((await tx('readonly', (s) => s.getAll())) as QueuedMeal[]).sort((a, b) => a.ts - b.ts);

export const removeQueued = async (id: string): Promise<void> => {
  await tx('readwrite', (s) => s.delete(id));
  changed();
};

let running = false;

/** Analiza las fotos en espera (de una en una). Si vuelve a fallar la conexión, se detiene y las deja para luego. */
export async function processQueue(s: AppState): Promise<number> {
  if (running || (typeof navigator !== 'undefined' && navigator.onLine === false)) return 0;
  running = true;
  let done = 0;
  try {
    for (const q of await listQueue()) {
      if (!q.b64) continue;
      try {
        const r = await analyzePlate(s, q.b64);
        await tx('readwrite', (st) => st.put({ ...q, b64: '', result: r, error: undefined } satisfies QueuedMeal)); // la foto se borra
        done++;
      } catch (e) {
        if (isNetworkError(e)) break;
        await tx('readwrite', (st) => st.put({ ...q, error: e instanceof Error ? e.message : 'No se pudo analizar' } satisfies QueuedMeal));
        break;
      }
    }
  } finally {
    running = false;
    changed();
  }
  return done;
}
