import { isConnected } from './cloud';
import { cloudCall } from './photosCloud';
import type { AppState, HabitDay } from './types';

/** Script (una vez) para que un Atajo de iPhone mande los pasos del día sin abrir la app. */
export const SQL_STEPS = `create table if not exists public.apex_steps (
  device_id uuid not null,
  day text not null check (day ~ '^\\d{4}-\\d{2}-\\d{2}$'),
  steps integer not null check (steps >= 0 and steps <= 200000),
  updated_at timestamptz not null default now(),
  primary key (device_id, day)
);
alter table public.apex_steps enable row level security;

create or replace function public.apex_steps_event(p_device uuid, p_day text, p_steps integer)
returns void language sql security definer set search_path = public as $$
  insert into public.apex_steps (device_id, day, steps) values (p_device, p_day, p_steps)
  on conflict (device_id, day) do update set steps = excluded.steps, updated_at = now();
$$;

create or replace function public.apex_steps_pull(p_device uuid)
returns table (day text, steps integer) language sql security definer set search_path = public as $$
  with d as (delete from public.apex_steps where device_id = p_device returning day, steps)
  select day, steps from d order by day;
$$;

grant execute on function public.apex_steps_event(uuid, text, integer) to anon;
grant execute on function public.apex_steps_pull(uuid) to anon;`;

export interface StepsEvent {
  day: string;
  steps: number;
}

/** Recoge de la nube los pasos que mandó el Atajo (los borra al leerlos). */
export async function pullStepsEvents(): Promise<StepsEvent[]> {
  if (!isConnected()) return [];
  const rows = await cloudCall<{ day: string; steps: number }[] | null>('apex_steps_pull', {});
  return (rows ?? [])
    .map((r) => ({ day: String(r.day), steps: Math.round(Number(r.steps)) }))
    .filter((e) => /^\d{4}-\d{2}-\d{2}$/.test(e.day) && Number.isFinite(e.steps) && e.steps >= 0 && e.steps <= 200000)
    .sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
}

/** Guarda los pasos de cada día (el último aviso de cada día manda). */
export function applyStepsEvents(s: AppState, events: StepsEvent[]): AppState {
  let habits = s.habits;
  for (const e of events) {
    const cur: HabitDay = habits[e.day] ?? { agua: 0 };
    if (cur.steps === e.steps) continue;
    habits = { ...habits, [e.day]: { ...cur, steps: e.steps } };
  }
  return habits === s.habits ? s : { ...s, habits };
}
