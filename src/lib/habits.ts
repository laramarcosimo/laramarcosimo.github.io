import type { AppState } from './types';

export interface Habit {
  key: string;
  kind: 'include' | 'remove';
  templateId: string;
  exerciseId: string;
  count: number;
  total: number;
}

const DISMISS = 'apex-habit-dismiss';
export const dismissed = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(DISMISS) ?? '[]') as string[];
  } catch {
    return [];
  }
};
export const dismissHabit = (key: string): void => {
  try {
    localStorage.setItem(DISMISS, JSON.stringify([...dismissed(), key]));
  } catch {
    /* noop */
  }
};

/** Patrones repetidos: extras que añades siempre (→ incluirlos) y ejercicios que omites casi siempre (→ quitarlos). */
export function habitSuggestions(s: AppState): Habit[] {
  const hidden = new Set(dismissed());
  const out: Habit[] = [];
  for (const t of s.templates) {
    const logs = s.workouts.filter((w) => w.templateId === t.id).sort((a, b) => Date.parse(b.startTime) - Date.parse(a.startTime)).slice(0, 6);
    if (logs.length < 3) continue;
    const inTpl = new Set(t.exercises.map((e) => e.exerciseId));
    const extra = new Map<string, number>();
    const skipped = new Map<string, number>();
    for (const l of logs) {
      for (const e of l.exercises) if (e.extra) extra.set(e.exerciseId, (extra.get(e.exerciseId) ?? 0) + 1);
      for (const id of l.skipped ?? []) skipped.set(id, (skipped.get(id) ?? 0) + 1);
    }
    for (const [id, n] of extra) {
      const key = `inc:${t.id}:${id}`;
      if (n >= 3 && !inTpl.has(id) && !hidden.has(key)) out.push({ key, kind: 'include', templateId: t.id, exerciseId: id, count: n, total: logs.length });
    }
    for (const [id, n] of skipped) {
      const key = `rem:${t.id}:${id}`;
      if (n >= 3 && inTpl.has(id) && !hidden.has(key)) out.push({ key, kind: 'remove', templateId: t.id, exerciseId: id, count: n, total: logs.length });
    }
  }
  return out;
}
