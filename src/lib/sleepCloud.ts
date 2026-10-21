import { isConnected } from './cloud';
import { cloudCall } from './photosCloud';
import type { AppState, HabitDay } from './types';
import { dayKey, round } from './utils';

/** Script (una vez) para que un Atajo de iPhone avise del sueño sin abrir la app. */
export const SQL_SLEEP = `create table if not exists public.apex_sleep (
  id bigserial primary key,
  device_id uuid not null,
  kind text not null check (kind in ('start','stop')),
  at timestamptz not null default now()
);
alter table public.apex_sleep enable row level security;

create or replace function public.apex_sleep_event(p_device uuid, p_kind text)
returns void language sql security definer set search_path = public as $$
  insert into public.apex_sleep (device_id, kind) values (p_device, p_kind);
$$;

create or replace function public.apex_sleep_pull(p_device uuid)
returns table (kind text, at timestamptz) language sql security definer set search_path = public as $$
  with d as (delete from public.apex_sleep where device_id = p_device returning kind, at)
  select kind, at from d order by at;
$$;

grant execute on function public.apex_sleep_event(uuid, text) to anon;
grant execute on function public.apex_sleep_pull(uuid) to anon;`;

export interface SleepEvent {
  kind: 'start' | 'stop';
  at: number;
}

/** Descarta de la nube los avisos pendientes del Atajo (los borra al leerlos). */
export async function pullSleepEvents(): Promise<SleepEvent[]> {
  if (!isConnected()) return [];
  const rows = await cloudCall<{ kind: string; at: string }[] | null>('apex_sleep_pull', {});
  return (rows ?? [])
    .map((r) => ({ kind: r.kind === 'stop' ? ('stop' as const) : ('start' as const), at: Date.parse(r.at) }))
    .filter((e) => Number.isFinite(e.at) && (e.kind === 'start' || e.kind === 'stop'))
    .sort((a, b) => a.at - b.at);
};

/** Tramos de menos de esto no cuentan como sueño (un «No molestar» corto durante el día). */
export const MIN_SLEEP_H = 1.5;

/** Aplica los avisos: «start» fija la hora de dormir; «stop» guarda las horas en el día en que te despiertas. */
export function applySleepEvents(s: AppState, events: SleepEvent[]): AppState {
  let sleepStart = s.sleepStart;
  let habits = s.habits;
  for (const e of events) {
    if (e.kind === 'start') {
      if (sleepStart === null || e.at > sleepStart) sleepStart = e.at;
    } else if (sleepStart !== null && e.at > sleepStart) {
      const hours = round((e.at - sleepStart) / 3600000, 2);
      if (hours >= MIN_SLEEP_H) {
        const k = dayKey(e.at);
        const cur: HabitDay = habits[k] ?? { agua: 0 };
        habits = { ...habits, [k]: { ...cur, sleepHours: Math.min(16, hours) } };
      }
      sleepStart = null;
    }
  }
  return sleepStart === s.sleepStart && habits === s.habits ? s : { ...s, sleepStart, habits };
}
