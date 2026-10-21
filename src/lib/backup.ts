import type { AppState } from './types';

const TS_KEY = 'apex-last-backup-ts';

export const lastManualBackupTs = (): number => {
  try {
    return Number(localStorage.getItem(TS_KEY) ?? 0) || 0;
  } catch {
    return 0;
  }
};

/** Copia en archivo JSON (sin la clave de Gemini). En iPhone usa la hoja de compartir. Devuelve false si se cancela. */
export async function exportBackupFile(state: AppState): Promise<boolean> {
  const safe: AppState = { ...state, active: null, settings: { ...state.settings, geminiKey: '' } };
  const name = `apex-coach-${new Date().toISOString().slice(0, 10)}.json`;
  const file = new File([JSON.stringify(safe, null, 2)], name, { type: 'application/json' });
  let done = false;
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Copia de seguridad de Apex Coach' });
      done = true;
    }
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return false;
  }
  if (!done) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(file);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  try {
    localStorage.setItem(TS_KEY, String(Date.now()));
    localStorage.setItem('apex-last-backup', new Date().toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }));
  } catch {
    /* noop */
  }
  return true;
}
